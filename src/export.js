/**
 * Export module: save QR codes as PNG, SVG, or plain ASCII text.
 * Leverages qrcode's built-in renderers for pixel-perfect file output.
 */

import QRCode from 'qrcode';
import { writeFile } from 'fs/promises';
import { createMatrix, renderASCII } from './engine.js';

/**
 * Export as high-resolution PNG using qrcode's canvas renderer.
 *
 * @param {string} text      - Data to encode
 * @param {string} filePath  - Output path (e.g. "qr-code.png")
 * @param {object} opts
 * @param {string} opts.errorLevel  - QR error correction level
 * @param {number} opts.width       - Image width in pixels (default 600)
 * @param {string} opts.darkColor   - Hex color for dark modules
 * @param {string} opts.lightColor  - Hex color for light modules
 */
export async function exportPNG(text, filePath, {
  errorLevel = 'M',
  width      = 600,
  darkColor  = '#000000',
  lightColor = '#FFFFFF',
} = {}) {
  await QRCode.toFile(filePath, text, {
    type:                 'png',
    width,
    margin:               4,
    errorCorrectionLevel: errorLevel,
    color: {
      dark:  darkColor,
      light: lightColor,
    },
  });
}

/**
 * Export as clean, scalable SVG vector.
 * SVG output is ideal for print, presentations, and web embedding.
 *
 * @param {string} text      - Data to encode
 * @param {string} filePath  - Output path (e.g. "qr-code.svg")
 * @param {object} opts
 */
export async function exportSVG(text, filePath, {
  errorLevel = 'M',
  darkColor  = '#000000',
  lightColor = '#FFFFFF',
} = {}) {
  const svg = await QRCode.toString(text, {
    type:                 'svg',
    margin:               4,
    errorCorrectionLevel: errorLevel,
    color: {
      dark:  darkColor,
      light: lightColor,
    },
  });
  await writeFile(filePath, svg, 'utf8');
}

/**
 * Export as plain Unicode half-block text (no ANSI codes).
 * Paste into README files, Markdown, or any plain-text environment.
 *
 * @param {string} text      - Data to encode
 * @param {string} filePath  - Output path (e.g. "qr-code.txt")
 * @param {object} opts
 */
export async function exportTXT(text, filePath, { errorLevel = 'M' } = {}) {
  const modules = createMatrix(text, { errorLevel });
  const ascii   = renderASCII(modules);
  await writeFile(filePath, ascii, 'utf8');
}
