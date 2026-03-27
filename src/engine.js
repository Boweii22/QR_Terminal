/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        HIGH-DENSITY HALF-BLOCK RENDERING ENGINE             ║
 * ║  Compresses 2 vertical QR pixels → 1 Unicode character      ║
 * ║  2D per-character color: diagonal · wave · 4-corner · radial║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import QRCode from 'qrcode';
import chalk from 'chalk';

// Unicode half-block set
const BLOCK = {
  FULL:  '█',
  UPPER: '▀',
  LOWER: '▄',
  EMPTY: ' ',
};

/**
 * Gradient presets.
 * Each has a `type` that controls 2D color distribution,
 * and `stops` — an array of [R,G,B] color points.
 *
 * Types:
 *   solid    — single color
 *   diagonal — top-left → bottom-right blend
 *   vertical — top → bottom
 *   wave     — sinusoidal ripple across x+y
 *   radial   — center → edge bloom
 *   4corner  — bilinear blend between 4 corner colors [tl, tr, bl, br]
 */
export const GRADIENT_PRESETS = {
  none:   { type: 'solid',    stops: [[220, 220, 220]] },
  retro:  { type: 'diagonal', stops: [[235, 77, 75],  [255, 184, 64]] },
  ocean:  { type: 'diagonal', stops: [[0, 48, 200],   [0, 210, 255]] },
  neon:   { type: 'wave',     stops: [[57, 255, 20],  [0, 200, 255], [255, 0, 200]] },
  sunset: { type: 'diagonal', stops: [[255, 40, 40],  [255, 140, 40], [255, 220, 60]] },
  galaxy: { type: '4corner',  stops: [[160, 32, 240], [59, 130, 246], [255, 0, 128], [0, 200, 255]] },
  cherry: { type: 'radial',   stops: [[255, 255, 200],[255, 80, 130], [200, 0, 80]] },
  matrix: { type: 'vertical', stops: [[0, 60, 0],     [0, 200, 50],   [160, 255, 160]] },
  fire:   { type: 'diagonal', stops: [[160, 0, 0],    [255, 80, 0],   [255, 210, 0]] },
  vapor:  { type: '4corner',  stops: [[255, 0, 255],  [0, 220, 255],  [180, 0, 180], [80, 80, 255]] },
};

/**
 * Generate QR bit-matrix, bypassing qrcode's own renderer.
 */
export function createMatrix(text, { errorLevel = 'M' } = {}) {
  if (!text || text.length === 0) throw new Error('Empty input');
  return QRCode.create(text, { errorCorrectionLevel: errorLevel }).modules;
}

/**
 * Core renderer with 2D per-character color.
 *
 * For each character position (col, row), we compute tx ∈ [0,1] and ty ∈ [0,1]
 * then apply the gradient type formula to get a unique RGB for that character.
 * This creates diagonal sweeps, waves, and corner blooms across the QR matrix.
 *
 * @returns {string[]} — chalk-colored strings, one per display row
 */
export function renderHalfBlock(modules, options = {}) {
  const { gradient = 'none', quietZone = 2 } = options;
  const { size, data } = modules;

  const colStart    = -quietZone;
  const colEnd      = size + quietZone;
  const rowStart    = -quietZone;
  const rowEnd      = size + quietZone;
  const totalCols   = colEnd - colStart;
  const totalRows   = rowEnd - rowStart;
  const displayRows = Math.ceil(totalRows / 2);

  const preset = GRADIENT_PRESETS[gradient] ?? GRADIENT_PRESETS.none;

  const px = (r, c) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return 0;
    return data[r * size + c] ? 1 : 0;
  };

  const output = [];

  for (let di = 0; di < displayRows; di++) {
    const row = rowStart + di * 2;
    const ty  = displayRows > 1 ? di / (displayRows - 1) : 0;

    let coloredLine = '';

    // Track current run for grouping consecutive same-color chars
    let runColor  = null;
    let runChars  = '';

    const flushRun = () => {
      if (!runChars) return;
      if (runColor) {
        coloredLine += chalk.rgb(runColor[0], runColor[1], runColor[2])(runChars);
      } else {
        coloredLine += runChars;
      }
      runChars = '';
      runColor = null;
    };

    for (let ci = 0; ci < totalCols; ci++) {
      const col = colStart + ci;
      const tx  = totalCols > 1 ? ci / (totalCols - 1) : 0;

      const bitmask = (px(row, col) << 1) | px(row + 1, col);
      let char;
      switch (bitmask) {
        case 0b11: char = BLOCK.FULL;  break;
        case 0b10: char = BLOCK.UPPER; break;
        case 0b01: char = BLOCK.LOWER; break;
        default:   char = BLOCK.EMPTY;
      }

      if (char === BLOCK.EMPTY) {
        // Light module: transparent space — flush colored run first
        flushRun();
        coloredLine += char;
      } else {
        // Dark module: compute 2D color for this exact position
        const color = computeColor(preset, tx, ty);

        // Group with previous char if colors are close enough (Δ < 8 per channel)
        if (runColor && colorsClose(runColor, color, 8)) {
          runChars += char;
        } else {
          flushRun();
          runColor = color;
          runChars = char;
        }
      }
    }

    flushRun();
    output.push(coloredLine);
  }

  return output;
}

/**
 * Render QR as plain Unicode half-blocks (no ANSI).
 * For clipboard / README / text file export.
 */
export function renderASCII(modules, { quietZone = 2 } = {}) {
  const { size, data } = modules;
  const px = (r, c) => (r < 0 || r >= size || c < 0 || c >= size)
    ? 0 : (data[r * size + c] ? 1 : 0);

  const rows = [];
  for (let di = 0; di < Math.ceil((size + quietZone * 2) / 2); di++) {
    const row = -quietZone + di * 2;
    let line  = '';
    for (let col = -quietZone; col < size + quietZone; col++) {
      const bitmask = (px(row, col) << 1) | px(row + 1, col);
      switch (bitmask) {
        case 0b11: line += BLOCK.FULL;  break;
        case 0b10: line += BLOCK.UPPER; break;
        case 0b01: line += BLOCK.LOWER; break;
        default:   line += BLOCK.EMPTY;
      }
    }
    rows.push(line);
  }
  return rows.join('\n');
}

export function getQrVersion(size) {
  return Math.round((size - 17) / 4);
}

// ── Color computation ─────────────────────────────────────────────────────────

export function computeColor({ type, stops }, tx, ty) {
  switch (type) {
    case 'solid':
      return stops[0];

    case 'diagonal': {
      const t = clamp((tx + ty) / 2);
      return lerpStops(stops, t);
    }

    case 'vertical': {
      return lerpStops(stops, ty);
    }

    case 'wave': {
      // Sinusoidal ripple — creates a shimmering interference pattern
      const raw = Math.sin((tx * 3.5 + ty * 2.5) * Math.PI);
      const t   = clamp((raw + 1) / 2);
      return lerpStops(stops, t);
    }

    case 'radial': {
      // Bloom from center outward
      const dx = tx - 0.5;
      const dy = ty - 0.5;
      const t  = clamp(Math.sqrt(dx * dx + dy * dy) * Math.SQRT2);
      return lerpStops(stops, t);
    }

    case '4corner': {
      // Bilinear blend: [top-left, top-right, bottom-left, bottom-right]
      const [tl, tr, bl, br] = stops;
      const top    = lerp3(tl, tr, tx);
      const bottom = lerp3(bl, br, tx);
      return lerp3(top, bottom, ty);
    }

    default:
      return [220, 220, 220];
  }
}

// Multi-stop linear gradient interpolation
function lerpStops(stops, t) {
  if (stops.length === 1) return stops[0];
  const seg = 1 / (stops.length - 1);
  const i   = Math.min(Math.floor(t / seg), stops.length - 2);
  const lt  = clamp((t - i * seg) / seg);
  return lerp3(stops[i], stops[i + 1], lt);
}

// Lerp between two [R,G,B] triplets
function lerp3(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

// Check if two colors are close enough to group into the same chalk call
function colorsClose([r1, g1, b1], [r2, g2, b2], threshold) {
  return Math.abs(r1 - r2) < threshold &&
         Math.abs(g1 - g2) < threshold &&
         Math.abs(b1 - b2) < threshold;
}

/**
 * Build particle data for the fly-in animation.
 * Returns an array of { targetRow, targetCol, char, color } objects
 * and the framebuffer dimensions { displayRows, totalCols }.
 */
export function buildParticleData(modules, { gradient = 'none', quietZone = 2 } = {}) {
  const { size, data } = modules;
  const preset = GRADIENT_PRESETS[gradient] ?? GRADIENT_PRESETS.none;
  const colStart = -quietZone, colEnd = size + quietZone;
  const rowStart = -quietZone, rowEnd = size + quietZone;
  const totalCols = colEnd - colStart;
  const totalRows = rowEnd - rowStart;
  const displayRows = Math.ceil(totalRows / 2);

  const px = (r, c) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return 0;
    return data[r * size + c] ? 1 : 0;
  };

  const particles = [];
  for (let di = 0; di < displayRows; di++) {
    const row = rowStart + di * 2;
    const ty = displayRows > 1 ? di / (displayRows - 1) : 0;
    for (let ci = 0; ci < totalCols; ci++) {
      const col = colStart + ci;
      const tx = totalCols > 1 ? ci / (totalCols - 1) : 0;
      const bitmask = (px(row, col) << 1) | px(row + 1, col);
      if (bitmask === 0) continue;
      let char;
      switch (bitmask) {
        case 0b11: char = '█'; break;
        case 0b10: char = '▀'; break;
        default:   char = '▄';
      }
      particles.push({ targetRow: di, targetCol: ci, char, color: computeColor(preset, tx, ty) });
    }
  }
  return { particles, displayRows, totalCols };
}
