/**
 * Particle Fly-In Animation — "The Transformer Effect"
 *
 * Each dark QR module becomes a particle that starts at a random scatter
 * position and flies into its correct place with cubic ease-out.
 * A stagger delay (0–30% of duration) makes the arrival feel organic.
 */

import { buildParticleData } from './engine.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Animate QR code appearing via particle fly-in.
 *
 * @param {object} modules   - QR modules from createMatrix()
 * @param {object} options
 * @param {string} options.gradient  - Gradient preset name
 * @param {number} options.fps       - Frames per second (default 30)
 * @param {number} options.duration  - Total animation ms (default 1100)
 */
export async function animateParticleFlyIn(modules, options = {}) {
  const { gradient = 'none', fps = 30, duration = 1100 } = options;
  const frameCount = Math.floor(duration / (1000 / fps));
  const frameMs    = Math.floor(1000 / fps);

  const { particles, displayRows, totalCols } = buildParticleData(modules, { gradient });

  // Assign each particle a random starting position + stagger delay
  const rng = () => Math.random();
  const seeded = particles.map(p => ({
    ...p,
    startRow:  rng() * displayRows,
    startCol:  (rng() - 0.5) * totalCols * 2 + totalCols / 2, // wider scatter on X
    delay:     rng() * 0.30,   // 0–30% stagger
  }));

  // Print blank placeholder
  process.stdout.write('\x1b[?25l');
  const blank = ' '.repeat(totalCols);
  for (let i = 0; i < displayRows; i++) process.stdout.write('  ' + blank + '\n');

  for (let f = 0; f <= frameCount; f++) {
    const globalT = f / frameCount;

    // Build framebuffer: 2D array of { char, color } | null
    const fb = Array.from({ length: displayRows }, () => new Array(totalCols).fill(null));

    for (const p of seeded) {
      // Apply per-particle stagger
      const localT = Math.max(0, (globalT - p.delay) / (1 - p.delay));
      // Cubic ease-out
      const e = 1 - Math.pow(1 - localT, 3);

      const row = Math.round(p.startRow + (p.targetRow - p.startRow) * e);
      const col = Math.round(p.startCol + (p.targetCol - p.startCol) * e);

      if (row >= 0 && row < displayRows && col >= 0 && col < totalCols) {
        fb[row][col] = { char: p.char, color: p.color };
      }
    }

    // Move cursor back to top of animation area
    process.stdout.write(`\x1b[${displayRows}A`);

    // Render framebuffer
    for (const row of fb) {
      let line = '', curColor = null;
      for (const cell of row) {
        if (!cell) {
          if (curColor) { line += '\x1b[0m'; curColor = null; }
          line += ' ';
        } else {
          const [r, g, b] = cell.color;
          const key = `${r},${g},${b}`;
          if (key !== curColor) {
            line += `\x1b[38;2;${r};${g};${b}m`;
            curColor = key;
          }
          line += cell.char;
        }
      }
      if (curColor) line += '\x1b[0m';
      process.stdout.write('  ' + line + '\n');
    }

    await sleep(frameMs);
  }

  process.stdout.write('\x1b[?25h');
}
