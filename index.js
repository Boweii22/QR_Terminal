#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                    QR TERMINAL  v1.0.0                              ║
 * ║   High-Density Half-Block QR Code Generator for the Command Line    ║
 * ║                                                                      ║
 * ║   Engine:  Unicode ▀ ▄ █ bitmasking — 50% vertical compression     ║
 * ║   Colors:  chalk 24-bit TrueColor + multi-stop gradient rendering   ║
 * ║   Formats: URL · WiFi · vCard · Secret                              ║
 * ║   Export:  PNG · SVG · TXT · Clipboard                              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import chalk from 'chalk';
import { printHeader, log } from './src/ui.js';
import { runMainFlow } from './src/prompts.js';
import { detectTerminalBgColor } from './src/luma.js';

// ── CLI flags ────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const isPlain = args.includes('--plain') || args.includes('--no-color');

if (isPlain) {
  process.env._QR_PLAIN  = '1';
  process.env.FORCE_COLOR = '0';
} else {
  // Ensure stdout supports TrueColor
  process.env.FORCE_COLOR = process.env.FORCE_COLOR ?? '3';
}

async function main() {
  if (isPlain) {
    // Plain mode: minimal header, no color
    console.log('QR Terminal — plain/no-color mode\n');
    await runMainFlow();
    return;
  }

  // ── Splash ──────────────────────────────────────────────────────────────
  process.stdout.write('\x1Bc'); // Full terminal clear (preserves scroll buffer)

  printHeader();

  // Auto-detect terminal background before any prompts
  const bgResult = await detectTerminalBgColor();
  if (bgResult?.isLight) {
    log.warn('Light terminal background detected — QR colors auto-adjusted for readability.');
  }
  // Store as global for engine to use
  process.env._QR_LIGHT_BG = bgResult?.isLight ? '1' : '0';

  // ── Main flow ────────────────────────────────────────────────────────────
  try {
    await runMainFlow();
  } catch (err) {
    if (err?.message === 'Cancelled' || err?.name === 'ExitPromptError') {
      console.log('\n' + chalk.dim('  Aborted. Goodbye.') + '\n');
      process.exit(0);
    }

    log.error('Unexpected error: ' + (err?.message ?? String(err)));

    if (process.env.DEBUG) {
      console.error(err);
    } else {
      log.info('Set DEBUG=1 to see the full stack trace.');
    }
    process.exit(1);
  }

  // ── Sign-off ─────────────────────────────────────────────────────────────
  console.log(
    chalk.dim('  ─── Made with ') +
    chalk.red('♥') +
    chalk.dim(' using Node.js · qr-terminal ───\n')
  );
}

main();
