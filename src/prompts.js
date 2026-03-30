/**
 * Main interactive flow.
 * Orchestrates inquirer prompts → live preview → QR generation → export.
 */

import { select, input, confirm, password } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import clipboard from 'clipboardy';

import { createMatrix, renderHalfBlock, renderASCII } from './engine.js';
import { liveInput } from './live-preview.js';
import { formatWifi, formatVCard, ERROR_LEVELS, GRADIENT_OPTIONS } from './formatters.js';
import { exportPNG, exportSVG, exportTXT } from './export.js';
import { exportPDF } from './export-pdf.js';
import { exportStaticGIF, exportParticleGIF } from './export-gif.js';
import { shortenUrl, isValidUrl, estimateSavings } from './shortlink.js';
import { printQR, revealQR, printDivider, detectDarkMode, log } from './ui.js';
import { animateParticleFlyIn } from './particle.js';
import { matrixRainQR } from './matrix-rain.js';
import { renderBraille } from './braille.js';
import { startHandshakeServer } from './handshake.js';
import { createDestructQR, showExplosion } from './destruct.js';
import { loadHistory, saveToHistory, historyChoice } from './history.js';
import { buildShareableLink } from './shareable.js';

const isPlain = process.env._QR_PLAIN === '1';

export async function runMainFlow() {
  // ──────────────────────────────────────────────
  // STEP 1 — Input type selection
  // ──────────────────────────────────────────────
  const inputType = await select({
    message: chalk.bold('What do you want to encode?'),
    choices: [
      {
        name:        '  🔗  URL / Link',
        value:       'url',
        description: 'Website, app deep-link, or any HTTP address',
      },
      {
        name:        '  📶  WiFi Credentials',
        value:       'wifi',
        description: 'Tap-to-join network QR (iOS 11+ / Android 10+)',
      },
      {
        name:        '  👤  vCard Contact',
        value:       'vcard',
        description: 'Share your contact card — imports directly to address book',
      },
      {
        name:        '  🔒  Secret Text',
        value:       'secret',
        description: 'Tokens, keys, passwords, or any sensitive payload',
      },
      {
        name:        '  🕐  View History',
        value:       'history',
        description: 'Recall and re-render a previously generated QR code',
      },
    ],
  });

  // ──────────────────────────────────────────────
  // HISTORY — recall a past QR
  // ──────────────────────────────────────────────
  if (inputType === 'history') {
    const history = await loadHistory();
    if (!history.entries.length) {
      log.info('No history yet — generate a QR first.');
      return;
    }

    const entry = await select({
      message: chalk.bold('Pick a previous QR to re-render:'),
      choices: history.entries.map((e, i) => historyChoice(e, i)),
      pageSize: 10,
    });

    // Re-run with saved settings
    await renderAndExport({
      inputType:  entry.inputType,
      qrData:     entry.qrData,
      dataLabel:  entry.dataLabel,
      gradient:   entry.gradient,
      errorLevel: entry.errorLevel,
      renderMode: entry.renderMode,
      fromHistory: true,
    });
    return;
  }

  // ──────────────────────────────────────────────
  // STEP 2 — Error correction level
  // ──────────────────────────────────────────────
  const errorLevel = await select({
    message: chalk.bold('Error correction level?'),
    choices: Object.entries(ERROR_LEVELS).map(([k, v]) => ({
      name:        v.label,
      value:       k,
      description: v.desc,
    })),
    default: 'M',
  });

  // ──────────────────────────────────────────────
  // STEP 3 — Visual gradient theme
  // ──────────────────────────────────────────────
  const gradient = isPlain ? 'none' : await select({
    message: chalk.bold('Color theme for the QR code?'),
    choices: GRADIENT_OPTIONS,
  });

  // ── Render engine selection ─────────────────────────────────────────────
  const renderMode = isPlain ? 'halfblock' : await select({
    message: chalk.bold('Render engine?'),
    choices: [
      { name: '  ▀▄  Half-Block    — Standard high-density (default)',        value: 'halfblock' },
      { name: '  ⣿   Braille       — 4× resolution "Retina" mode',           value: 'braille'  },
      { name: '  ✦   Particle      — Fly-in "Transformer" animation',         value: 'particle' },
      { name: '  ░   Matrix Rain   — Animated cascade → gradient settle',     value: 'matrix'   },
      { name: '  📡  Device Link   — Scan to connect phone → terminal',       value: 'handshake'},
    ],
  });

  // ──────────────────────────────────────────────
  // STEP 4 — Collect type-specific data
  // ──────────────────────────────────────────────
  let qrData    = '';
  let dataLabel = '';

  switch (inputType) {

    // ── URL ─────────────────────────────────────
    case 'url': {
      if (!isPlain) console.log(chalk.dim('\n  Live preview active — QR updates as you type\n'));

      let rawUrl = isPlain
        ? await input({ message: 'URL:' })
        : await liveInput({ label: 'URL', errorLevel, gradient });

      if (rawUrl && !rawUrl.match(/^https?:\/\//i)) {
        rawUrl = 'https://' + rawUrl;
      }

      if (!rawUrl) { log.error('No URL provided.'); return; }

      qrData    = rawUrl;
      dataLabel = 'URL';

      if (!isPlain && isValidUrl(qrData) && qrData.length > 40) {
        const shouldShorten = await confirm({
          message: `Shorten via TinyURL? ${chalk.dim('(reduces QR complexity)')}`,
          default: false,
        });

        if (shouldShorten) {
          const spinner = ora({ text: 'Connecting to TinyURL…', spinner: 'dots' }).start();
          try {
            const short    = await shortenUrl(qrData);
            const savings  = estimateSavings(qrData.length, short.length);
            spinner.succeed(chalk.green('Shortened: ') + chalk.white(short) + chalk.dim(`  (${savings})`));
            qrData = short;
          } catch (e) {
            spinner.fail(chalk.yellow('Could not reach TinyURL. Using original URL.'));
          }
        }
      }
      break;
    }

    // ── WiFi ────────────────────────────────────
    case 'wifi': {
      console.log();
      const ssid = await input({
        message: chalk.cyan('Network name (SSID):'),
        validate: (v) => v.trim().length > 0 || 'SSID cannot be empty',
      });

      const security = await select({
        message: chalk.cyan('Security protocol:'),
        choices: [
          { name: 'WPA / WPA2 / WPA3  (recommended)', value: 'WPA'    },
          { name: 'WEP  (legacy)',                     value: 'WEP'    },
          { name: 'Open / No password',                value: 'nopass' },
        ],
      });

      let wifiPassword = '';
      if (security !== 'nopass') {
        wifiPassword = await password({
          message:  chalk.cyan('Password:'),
          mask:     '●',
          validate: (v) => v.length > 0 || 'Password cannot be empty',
        });
      }

      const hidden = await confirm({
        message: chalk.cyan('Is this a hidden network?'),
        default: false,
      });

      qrData    = formatWifi({ ssid, password: wifiPassword, security, hidden });
      dataLabel = `WiFi: ${ssid}`;
      break;
    }

    // ── vCard ───────────────────────────────────
    case 'vcard': {
      console.log();
      const firstName = await input({ message: chalk.cyan('First name:') });
      const lastName  = await input({ message: chalk.cyan('Last name:'),    default: '' });
      const phone     = await input({ message: chalk.cyan('Phone:'),        default: '' });
      const email     = await input({ message: chalk.cyan('Email:'),        default: '' });
      const org       = await input({ message: chalk.cyan('Organization:'), default: '' });
      const url       = await input({ message: chalk.cyan('Website:'),      default: '' });

      if (!firstName && !lastName) { log.error('Name is required.'); return; }

      qrData    = formatVCard({ firstName, lastName, phone, email, org, url });
      dataLabel = `vCard: ${[firstName, lastName].filter(Boolean).join(' ')}`;
      break;
    }

    // ── Secret ──────────────────────────────────
    case 'secret': {
      console.log();
      const secret = await password({
        message:  chalk.cyan('Secret payload:'),
        mask:     '●',
        validate: (v) => v.length > 0 || 'Cannot encode an empty secret',
      });

      qrData    = secret;
      dataLabel = 'Secret Text';
      log.warn('Secret encoded — share this QR only with intended recipients.');
      break;
    }
  }

  if (!qrData) return;

  await renderAndExport({ inputType, qrData, dataLabel, gradient, errorLevel, renderMode });
}

// ── Core render + export pipeline ────────────────────────────────────────────

async function renderAndExport({
  inputType,
  qrData,
  dataLabel,
  gradient,
  errorLevel,
  renderMode,
  fromHistory = false,
}) {
  // ──────────────────────────────────────────────
  // STEP 5 — Generate & render the QR code
  // ──────────────────────────────────────────────
  printDivider('Generating');

  let modules;
  const spinner = ora({ text: 'Building QR matrix…', spinner: 'arc' }).start();

  try {
    modules = createMatrix(qrData, { errorLevel });
    spinner.succeed(chalk.green('QR matrix ready.'));
  } catch (e) {
    spinner.fail(chalk.red('QR generation failed: ' + e.message));
    log.tip('Try a shorter input or increase error correction to H.');
    return;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  // Special case: handshake mode
  if (renderMode === 'handshake') {
    const spinner2 = ora({ text: 'Starting device link server…', spinner: 'arc' }).start();
    let server;
    try {
      server = await startHandshakeServer();
      spinner2.succeed(`Server ready → ${chalk.underline(server.url)}`);
    } catch (e) {
      spinner2.fail('Could not start server: ' + e.message);
      return;
    }

    const linkModules = createMatrix(server.url, { errorLevel: 'M' });
    const linkLines   = renderHalfBlock(linkModules, { gradient: 'neon' });

    console.log();
    console.log(chalk.bold.cyanBright('  ┌─ Scan to Connect ──────────────────────────────────┐'));
    await revealQR(linkLines, { speed: 10 });
    console.log(chalk.dim('  Open on your phone: ') + chalk.white(server.url));
    console.log();

    const waitSpinner = ora({
      text: chalk.dim('Waiting for device to connect…'),
      spinner: 'dots',
      color: 'cyan',
    }).start();

    await server.waitForDevice;
    waitSpinner.succeed(chalk.bold.green('DEVICE CONNECTED ✓'));
    console.log(chalk.cyan('\n  Phone is now linked. Messages will appear below.\n'));
    console.log(chalk.dim('  Press Ctrl+C to close the connection.\n'));

    server.onMessage((text) => {
      console.log(chalk.bold.cyanBright('\n  📱 From phone: ') + chalk.white(text) + '\n');
    });

    await new Promise((_, reject) => {
      process.on('SIGINT', () => {
        server.close();
        console.log(chalk.dim('\n  Connection closed.'));
        reject(new Error('Cancelled'));
      });
    });
    return;
  }

  // ── Plain mode — print raw ASCII, no color ──────────────────────────────
  if (isPlain) {
    console.log();
    console.log(renderASCII(modules));
    console.log();
    return;
  }

  const qrLines = renderMode === 'braille'
    ? renderBraille(modules, { gradient })
    : renderHalfBlock(modules, { gradient });

  console.log();
  if (dataLabel) {
    const qrWidth = qrLines[0].replace(/\x1b\[[0-9;]*m/g, '').length;
    console.log(
      chalk.bold.cyanBright('  ┌─ ') +
      chalk.bold.white(dataLabel) +
      chalk.bold.cyanBright(' ' + '─'.repeat(Math.max(0, qrWidth - dataLabel.length - 3)) + '┐')
    );
  }

  if (renderMode === 'particle') {
    await animateParticleFlyIn(modules, { gradient, fps: 30, duration: 1100 });
  } else if (renderMode === 'matrix') {
    await matrixRainQR(modules, { gradient, duration: 2200, fps: 24 });
  } else {
    await revealQR(qrLines, { speed: 12 });
  }

  const version = Math.round((modules.size - 17) / 4);
  const stats = [
    chalk.bold.cyanBright(`v${version} QR`),
    chalk.dim(`${modules.size}×${modules.size} modules`),
    chalk.dim(`${qrLines.length * 2} → ${qrLines.length} rows`),
    chalk.dim(`EC: ${errorLevel}`),
    chalk.dim(renderMode),
  ];
  if (inputType !== 'secret') {
    const prev = qrData.slice(0, 35) + (qrData.length > 35 ? '…' : '');
    stats.push(chalk.dim.italic(`"${prev}"`));
  }
  console.log('  ' + stats.join(chalk.dim('  ·  ')));
  console.log();

  // ──────────────────────────────────────────────
  // STEP 6 — Save to history
  // ──────────────────────────────────────────────
  if (!fromHistory) {
    try {
      await saveToHistory({ inputType, dataLabel, qrData, gradient, errorLevel, renderMode });
    } catch {
      // history is non-critical — fail silently
    }
  }

  // ──────────────────────────────────────────────
  // STEP 7 — Post-generation actions (looped select)
  // ──────────────────────────────────────────────
  printDivider('Export');

  const exportChoices = [
    { name: '  📋  Copy ASCII to clipboard', value: 'clipboard' },
    { name: '  🖼   Save as PNG',             value: 'png'       },
    { name: '  📐  Save as SVG',             value: 'svg'       },
    { name: '  📄  Save as PDF',             value: 'pdf'       },
    { name: '  🎞   Save as GIF',            value: 'gif'       },
    { name: '  📝  Save as TXT',             value: 'txt'       },
    ...(inputType !== 'secret'
      ? [{ name: '  🔗  Get shareable link', value: 'share' }]
      : []),
    { name: '  ☠   Self-destruct share',    value: 'destruct'  },
    { name: '  ✓   Done',                   value: 'done'      },
  ];

  // Reset terminal state after animations before prompting
  process.stdout.write('\x1b[?25h\x1b[0m');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = await select({
      message: chalk.bold('What would you like to do?  (pick one, repeat as needed)'),
      choices: exportChoices,
    });

    if (action === 'done') break;

    console.log();

    switch (action) {

      case 'clipboard': {
        const sp = ora({ text: 'Writing to clipboard…', spinner: 'dots' }).start();
        try {
          await clipboard.write(renderASCII(modules));
          sp.succeed('ASCII QR code copied to clipboard!');
        } catch (e) {
          sp.fail('Clipboard unavailable: ' + e.message);
          log.tip('Try running with elevated permissions, or use the TXT export instead.');
        }
        break;
      }

      case 'png': {
        const fileName = await input({
          message: 'PNG filename:',
          default: sanitizeFilename(dataLabel) + '.png',
        });
        const sp = ora({ text: 'Rendering PNG…', spinner: 'arc' }).start();
        try {
          await exportPNG(qrData, fileName, { errorLevel });
          sp.succeed(`PNG saved → ${chalk.underline(fileName)}`);
        } catch (e) {
          sp.fail('PNG export failed: ' + e.message);
        }
        break;
      }

      case 'svg': {
        const fileName = await input({
          message: 'SVG filename:',
          default: sanitizeFilename(dataLabel) + '.svg',
        });
        const sp = ora({ text: 'Rendering SVG…', spinner: 'arc' }).start();
        try {
          await exportSVG(qrData, fileName, { errorLevel });
          sp.succeed(`SVG saved → ${chalk.underline(fileName)}`);
        } catch (e) {
          sp.fail('SVG export failed: ' + e.message);
        }
        break;
      }

      case 'pdf': {
        const fileName = await input({
          message: 'PDF filename:',
          default: sanitizeFilename(dataLabel) + '.pdf',
        });
        const sp = ora({ text: 'Rendering PDF…', spinner: 'arc' }).start();
        try {
          await exportPDF(qrData, fileName, { errorLevel, label: dataLabel });
          sp.succeed(`PDF saved → ${chalk.underline(fileName)}`);
        } catch (e) {
          sp.fail('PDF export failed: ' + e.message);
        }
        break;
      }

      case 'gif': {
        const animated = renderMode === 'particle' || renderMode === 'matrix';
        const fileName = await input({
          message: 'GIF filename:',
          default: sanitizeFilename(dataLabel) + (animated ? '-anim' : '') + '.gif',
        });
        const sp = ora({
          text:    animated ? 'Rendering animated GIF…' : 'Rendering GIF…',
          spinner: 'arc',
        }).start();
        try {
          if (animated) {
            await exportParticleGIF(modules, fileName, { gradient, frames: 30, delay: 50 });
          } else {
            await exportStaticGIF(modules, fileName, { gradient });
          }
          sp.succeed(`GIF saved → ${chalk.underline(fileName)}${animated ? chalk.dim('  (animated)') : ''}`);
        } catch (e) {
          sp.fail('GIF export failed: ' + e.message);
        }
        break;
      }

      case 'txt': {
        const fileName = await input({
          message: 'TXT filename:',
          default: sanitizeFilename(dataLabel) + '.txt',
        });
        const sp = ora({ text: 'Writing text file…', spinner: 'dots' }).start();
        try {
          await exportTXT(qrData, fileName, { errorLevel });
          sp.succeed(`TXT saved → ${chalk.underline(fileName)}`);
        } catch (e) {
          sp.fail('TXT export failed: ' + e.message);
        }
        break;
      }

      case 'share': {
        const link = buildShareableLink(qrData, { errorLevel });
        console.log(
          chalk.bold.cyanBright('  🔗 Shareable link:\n') +
          '     ' + chalk.underline.white(link) + '\n'
        );
        const copyLink = await confirm({
          message: 'Copy link to clipboard?',
          default: true,
        });
        if (copyLink) {
          try {
            await clipboard.write(link);
            log.success('Link copied to clipboard.');
          } catch {
            log.warn('Could not write to clipboard.');
          }
        }
        break;
      }

      case 'destruct': {
        const filePath = await input({ message: 'File to share (path):' });
        const sp = ora({ text: 'Creating tunnel…', spinner: 'arc' }).start();
        try {
          const session = await createDestructQR(filePath);
          sp.succeed(`Tunnel ready: ${chalk.underline(session.url)}`);

          const destructModules = createMatrix(session.url, { errorLevel: 'M' });
          const destructLines   = renderHalfBlock(destructModules, { gradient: 'fire' });
          console.log();
          for (const line of destructLines) console.log('  ' + line);
          console.log();
          log.warn('Scan to download. File will self-destruct after one download.');

          const waitSp = ora({ text: 'Waiting for download…', spinner: 'dots', color: 'red' }).start();
          await session.waitForDownload;
          waitSp.succeed(chalk.red('FILE CONSUMED — TUNNEL CLOSED'));
          await showExplosion();
        } catch (e) {
          sp.fail('Self-destruct failed: ' + e.message);
        }
        break;
      }
    }

    console.log();
  }

  printDivider();
  log.tip('Hold your phone camera over the QR code — no scanner app needed on iOS 11+ / Android 10+.');
  log.info(`Encoded ${qrData.length} characters with ${errorLevel}-level error correction.`);
  console.log();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'qr-code';
}
