/**
 * Live Preview Engine
 *
 * WYSIWYG terminal experience: QR code re-renders on every keystroke.
 * Per-keystroke info badge shows QR version + char count in real-time.
 * Placeholder frame holds the exact space so there's no layout jump.
 */

import chalk from 'chalk';
import { createMatrix, renderHalfBlock, getQrVersion } from './engine.js';

const ESC = {
  up:         n  => `\x1b[${n}A`,
  clearDown:  '\x1b[J',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearLine:  '\x1b[2K\r',
};

const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Launch a live-updating QR preview input.
 * Returns a Promise that resolves with the final string on Enter.
 */
export function liveInput({ label = 'Enter text', errorLevel = 'M', gradient = 'none' } = {}) {
  return new Promise((resolve, reject) => {
    let input        = '';
    let lastHeight   = 0;
    let debounce     = null;
    let lastVersion  = 0;

    // ── Frame builder ─────────────────────────────────────────────────────────

    const buildLines = (text) => {
      const lines    = [];
      const termCols = Math.min(process.stdout.columns || 80, 100);

      if (!text) {
        // Ghost placeholder: exact dimensions of a version-3 QR
        const boxW = 33;
        const boxH = 17;
        const pad  = 4;
        const p    = ' '.repeat(pad);

        lines.push('');
        lines.push(p + chalk.rgb(30, 40, 60)('┌' + '─'.repeat(boxW + 2) + '┐'));
        for (let i = 0; i < boxH; i++) {
          if (i === Math.floor(boxH / 2) - 1) {
            const msg  = '  Enter text to generate QR  ';
            const side = Math.floor((boxW + 2 - msg.length) / 2);
            lines.push(
              p + chalk.rgb(30,40,60)('│') +
              ' '.repeat(side) +
              chalk.rgb(60, 80, 120).italic(msg) +
              ' '.repeat(boxW + 2 - side - msg.length) +
              chalk.rgb(30,40,60)('│')
            );
          } else if (i === Math.floor(boxH / 2) + 1) {
            const hint  = '  ▀▄ half-block engine ready  ';
            const hside = Math.floor((boxW + 2 - hint.length) / 2);
            lines.push(
              p + chalk.rgb(30,40,60)('│') +
              ' '.repeat(hside) +
              chalk.rgb(40, 60, 90).dim(hint) +
              ' '.repeat(boxW + 2 - hside - hint.length) +
              chalk.rgb(30,40,60)('│')
            );
          } else {
            // Subtle scanline pattern
            const dotRow = (i % 4 === 0)
              ? chalk.rgb(20, 30, 50)('·'.repeat(boxW + 2))
              : ' '.repeat(boxW + 2);
            lines.push(p + chalk.rgb(30,40,60)('│') + dotRow + chalk.rgb(30,40,60)('│'));
          }
        }
        lines.push(p + chalk.rgb(30, 40, 60)('└' + '─'.repeat(boxW + 2) + '┘'));
        lines.push('');
      } else {
        try {
          const modules = createMatrix(text, { errorLevel });
          const qrLines = renderHalfBlock(modules, { gradient });
          const qrWidth = strip(qrLines[0] ?? '').length;
          const pad     = Math.max(4, Math.floor((termCols - qrWidth) / 2));
          const p       = ' '.repeat(pad);
          const v       = getQrVersion(modules.size);

          // Version bump badge (flash when version increases)
          const vChanged   = v !== lastVersion;
          lastVersion      = v;

          const vBadge = vChanged
            ? chalk.bgCyan.bold.black(` QR v${v} `) + chalk.cyan(' ◄ upgraded')
            : chalk.bgRgb(20,20,50).rgb(80,160,255)(` QR v${v} `);

          const capBadge = chalk.dim(`${modules.size}×${modules.size}`);
          const lenBadge = text.length > 0
            ? chalk.dim(`${text.length} chars`)
            : '';

          lines.push('');
          lines.push(
            p + vBadge +
            chalk.dim('  ·  ') + capBadge +
            chalk.dim('  ·  ') + lenBadge
          );
          lines.push('');

          for (const line of qrLines) lines.push(p + line);
          lines.push('');
        } catch (e) {
          lines.push('');
          lines.push(chalk.red('  ⚠  Input exceeds QR capacity — try shortening the text'));
          lines.push('');
        }
      }

      // Input field
      const promptPrefix = chalk.bold.cyan('  › ') + chalk.bold.white(label + ':') + ' ';
      const cursor       = chalk.bgCyan.black(' ');
      lines.push(promptPrefix + chalk.white(text) + cursor);
      lines.push('');

      return lines;
    };

    // ── Draw / clear ──────────────────────────────────────────────────────────

    const draw = (lines) => {
      for (const line of lines) process.stdout.write(line + '\n');
      lastHeight = lines.length;
    };

    const clear = () => {
      if (lastHeight > 0) {
        process.stdout.write(ESC.up(lastHeight) + ESC.clearDown);
      }
    };

    const redraw = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        clear();
        draw(buildLines(input));
      }, 16);
    };

    // ── Keypress handler ──────────────────────────────────────────────────────

    const onData = (key) => {
      if (key === '\r' || key === '\n') {
        if (debounce) clearTimeout(debounce);
        clear();
        process.stdout.write(
          chalk.bold.cyan('  › ') +
          chalk.bold.white(label + ':') + ' ' +
          chalk.white(input) + '\n'
        );
        done(null, input);

      } else if (key === '\u0003') {
        done(new Error('Cancelled'));

      } else if (key === '\u007f' || key === '\b') {
        input = input.slice(0, -1);
        redraw();

      } else if (key === '\u001b') {
        input = '';
        redraw();

      } else if (key.charCodeAt(0) >= 32 && !key.startsWith('\x1b')) {
        input += key;
        redraw();
      }
    };

    const done = (err, result) => {
      process.stdin.removeListener('data', onData);
      try {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch {}
      process.stdout.write(ESC.showCursor);
      if (err) reject(err);
      else resolve(result);
    };

    // ── Boot ──────────────────────────────────────────────────────────────────

    process.stdout.write(ESC.hideCursor);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    draw(buildLines(input));
  });
}
