/**
 * UI helpers: header, animated QR reveal, dark-mode detection
 */

import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { getQrVersion } from './engine.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '');

// ── Header ────────────────────────────────────────────────────────────────────

export function printHeader() {
  let art = '';
  try {
    art = figlet.textSync('QR  Terminal', { font: 'Slant', horizontalLayout: 'full' });
  } catch {
    art = figlet.textSync('QR Terminal');
  }

  const coloredArt  = gradient(['#FF416C', '#FF4B2B', '#F7971E', '#FFD200', '#4ECDC4', '#556270'])(art);
  const subtitle    = chalk.dim('  High-Density Half-Block Rendering Engine  ·  v1.1.0');
  const badges      = [
    chalk.bgRgb(40,40,80).rgb(100,180,255)(' URL '),
    chalk.bgRgb(40,40,80).rgb(100,255,160)(' WiFi '),
    chalk.bgRgb(40,40,80).rgb(255,180,100)(' vCard '),
    chalk.bgRgb(40,40,80).rgb(255,100,180)(' Secret '),
  ].join(chalk.dim('  '));

  const content = `${coloredArt}\n${subtitle}\n\n  ${badges}`;

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      margin:  { top: 0, bottom: 1, left: 1, right: 0 },
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );
}

// ── Animated QR reveal ────────────────────────────────────────────────────────

/**
 * Scanline reveal animation.
 *
 * Phase 1 — Ghost scan: print each row as dim '░' blocks with a brief
 *            bright cyan scanline flash before the real content settles.
 * Phase 2 — Lock-on pulse: after all rows are revealed, sweep back up and
 *            reprint every line 40 RGB units brighter, then settle to normal.
 *            Simulates a camera locking focus on the QR code.
 *
 * @param {string[]} lines  - chalk-colored QR rows from renderHalfBlock()
 * @param {object}   opts
 * @param {number}   opts.speed  - ms per row (default 14)
 */
export async function revealQR(lines, { speed = 14 } = {}) {
  process.stdout.write('\x1b[?25l'); // hide cursor

  // Phase 1: row-by-row scanline reveal
  for (const line of lines) {
    const raw  = strip(line);
    const w    = raw.length;

    // Scanline flash — bright cyan bar
    process.stdout.write('  ' + chalk.bgCyan.bold(' '.repeat(w)) + '\r');
    await sleep(speed);

    // Settle to the real colored line
    process.stdout.write('  ' + line + '\n');
  }

  // Phase 2: brief full-QR lock-on pulse
  await sleep(60);

  // Move cursor back to the top of the QR block
  process.stdout.write(`\x1b[${lines.length}A`);

  // Print brightened version
  for (const line of lines) {
    const bright = brighten(line, 45);
    process.stdout.write('  ' + bright + '\n');
  }

  await sleep(90);

  // Restore normal
  process.stdout.write(`\x1b[${lines.length}A`);
  for (const line of lines) {
    process.stdout.write('  ' + line + '\n');
  }

  process.stdout.write('\x1b[?25h'); // show cursor
}

/**
 * Print QR code with a stats box underneath.
 */
export function printQR(qrLines, { label = '', size = 0, dataPreview = '', errorLevel = 'M' } = {}) {
  const version  = getQrVersion(size);
  const cols     = Math.min(process.stdout.columns || 80, 80);
  const qrWidth  = strip(qrLines[0] ?? '').length + 2;

  // Label bar
  if (label) {
    const bar = chalk.bold.cyanBright('  ┌─ ') +
                chalk.bold.white(label) +
                chalk.bold.cyanBright(' ' + '─'.repeat(Math.max(0, qrWidth - label.length - 4)) + '┐');
    console.log(bar);
  }

  // QR rows (printed by caller via revealQR or directly)
  for (const line of qrLines) {
    console.log('  ' + line);
  }

  // Stats bar
  const stats = [
    chalk.bold.cyanBright(`v${version} QR`),
    chalk.dim(`${size}×${size} modules`),
    chalk.dim(`${qrLines.length * 2} → ${qrLines.length} rows`),
    chalk.dim(`EC: ${errorLevel}`),
  ];
  if (dataPreview) {
    const preview = dataPreview.slice(0, 35) + (dataPreview.length > 35 ? '…' : '');
    stats.push(chalk.dim.italic(`"${preview}"`));
  }

  console.log('  ' + stats.join(chalk.dim('  ·  ')));
  console.log();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Detect if the user's terminal has a dark background.
 * Uses COLORFGBG (set by iTerm2, xterm, etc.) and falls back to true.
 */
export function detectDarkMode() {
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(';');
    const bg    = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(bg)) return bg < 8;
  }
  const profile = (process.env.ITERM_PROFILE || process.env.TERM_PROFILE || '').toLowerCase();
  if (profile.includes('light')) return false;
  return true;
}

export function printDivider(label = '') {
  const cols  = Math.min(process.stdout.columns || 72, 72);
  const inner = label ? ` ${label} ` : '';
  const line  = '─'.repeat(Math.max(0, cols - 4 - inner.length));
  console.log(chalk.dim(`  ${inner}${line}`));
}

export const log = {
  success: msg => console.log(chalk.green('  ✓  ') + chalk.white(msg)),
  error:   msg => console.log(chalk.red('  ✗  ')   + chalk.white(msg)),
  info:    msg => console.log(chalk.cyan('  ℹ  ')  + chalk.dim(msg)),
  warn:    msg => console.log(chalk.yellow('  ⚠  ') + chalk.dim(msg)),
  tip:     msg => console.log(chalk.magenta('  ★  ')+ chalk.white(msg)),
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Increase all RGB values in ANSI-colored string by `amount`.
 * Used for the lock-on pulse effect.
 */
function brighten(line, amount) {
  return line.replace(
    /\x1b\[38;2;(\d+);(\d+);(\d+)m/g,
    (_, r, g, b) => {
      const clamp = v => Math.min(255, parseInt(v) + amount);
      return `\x1b[38;2;${clamp(r)};${clamp(g)};${clamp(b)}m`;
    }
  );
}
