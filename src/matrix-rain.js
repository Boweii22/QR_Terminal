/**
 * Matrix Rain Animation
 *
 * After the QR appears, cascading green "rain droplets" sweep down each
 * column before the code settles to its final gradient.
 * Contrast is preserved: each droplet is bright (#00FF41), which has
 * sufficient luminance against dark terminal backgrounds.
 */

import { buildParticleData } from './engine.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * @param {object} modules     - QR modules from createMatrix()
 * @param {object} options
 * @param {string} options.gradient   - Final color gradient
 * @param {number} options.duration   - Rain duration in ms (default 2000)
 * @param {number} options.fps        - Frames per second (default 24)
 */
export async function matrixRainQR(modules, { gradient = 'none', duration = 2000, fps = 24 } = {}) {
  const { particles, displayRows, totalCols } = buildParticleData(modules, { gradient });
  const frameMs    = Math.floor(1000 / fps);
  const frameCount = Math.floor(duration / frameMs);

  // Per-column rain phase offset (0–1, cycles continuously)
  const phases = Array.from({ length: totalCols }, () => Math.random());

  // Build a lookup for quick per-cell access: fb[row][col] = particle data
  const lookup = Array.from({ length: displayRows }, () => new Array(totalCols).fill(null));
  for (const p of particles) lookup[p.targetRow][p.targetCol] = p;

  process.stdout.write('\x1b[?25l');

  // Print initial static frame first (so there's no blank before rain starts)
  renderStatic(lookup, displayRows, totalCols, phases, 0);

  for (let f = 0; f < frameCount; f++) {
    const progress = f / frameCount; // 0 → 1

    // Advance rain phases
    for (let c = 0; c < totalCols; c++) {
      phases[c] = (phases[c] + 0.04) % 1;
    }

    process.stdout.write(`\x1b[${displayRows}A`);

    for (let row = 0; row < displayRows; row++) {
      let line = '', curColor = null;
      const ty = displayRows > 1 ? row / (displayRows - 1) : 0;

      for (let col = 0; col < totalCols; col++) {
        const cell = lookup[row][col];
        if (!cell) {
          if (curColor) { line += '\x1b[0m'; curColor = null; }
          line += ' ';
          continue;
        }

        // Rain droplet: bright where phase matches row position
        const phase    = phases[col];
        const relRow   = ty;
        const dist     = Math.abs(((phase - relRow + 1.5) % 1) - 0.5); // wrapped distance
        const droplet  = Math.max(0, 1 - dist * 8);

        // Fade rain out as progress → 1, revealing final gradient
        const rainStr  = droplet * (1 - progress);

        const base  = cell.color;
        const rain  = [0, 255, 65]; // matrix green
        const r = Math.round(base[0] * (1 - rainStr) + rain[0] * rainStr);
        const g = Math.round(base[1] * (1 - rainStr) + rain[1] * rainStr);
        const b = Math.round(base[2] * (1 - rainStr) + rain[2] * rainStr);

        const key = `${r},${g},${b}`;
        if (key !== curColor) {
          line += `\x1b[38;2;${r};${g};${b}m`;
          curColor = key;
        }
        line += cell.char;
      }

      if (curColor) line += '\x1b[0m';
      process.stdout.write('  ' + line + '\n');
    }

    await sleep(frameMs);
  }

  // Final settle: reprint without rain
  process.stdout.write(`\x1b[${displayRows}A`);
  renderStatic(lookup, displayRows, totalCols, phases, 1);

  process.stdout.write('\x1b[?25h');
}

function renderStatic(lookup, displayRows, totalCols, phases, _progress) {
  for (let row = 0; row < displayRows; row++) {
    let line = '', curColor = null;
    for (let col = 0; col < totalCols; col++) {
      const cell = lookup[row][col];
      if (!cell) {
        if (curColor) { line += '\x1b[0m'; curColor = null; }
        line += ' ';
      } else {
        const [r, g, b] = cell.color;
        const key = `${r},${g},${b}`;
        if (key !== curColor) { line += `\x1b[38;2;${r};${g};${b}m`; curColor = key; }
        line += cell.char;
      }
    }
    if (curColor) line += '\x1b[0m';
    process.stdout.write('  ' + line + '\n');
  }
}
