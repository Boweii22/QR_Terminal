/**
 * GIF export — two modes:
 *   exportStaticGIF   — single-frame colored QR (like PNG but as GIF)
 *   exportParticleGIF — animated fly-in: modules scatter → assemble
 *
 * Uses gif-encoder-2 (CJS) via createRequire.
 * Renders pixel data directly without a canvas context.
 */

import { createRequire }                    from 'module';
import { writeFile }                        from 'fs/promises';
import { GRADIENT_PRESETS, computeColor }   from './engine.js';

const require = createRequire(import.meta.url);

const MODULE_PX = 8; // pixels per QR module

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fill a MODULE_PX × MODULE_PX square into a Uint8ClampedArray RGBA buffer.
 */
function drawModule(pixels, width, col, row, r, g, b) {
  const px = col * MODULE_PX;
  const py = row * MODULE_PX;
  for (let dy = 0; dy < MODULE_PX; dy++) {
    for (let dx = 0; dx < MODULE_PX; dx++) {
      const idx = ((py + dy) * width + (px + dx)) * 4;
      if (idx < 0 || idx + 3 >= pixels.length) continue;
      pixels[idx]     = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
}

/**
 * Build a white RGBA pixel buffer with the QR matrix drawn into it.
 */
function buildStaticFrame(modules, preset, quietZone) {
  const { size, data } = modules;
  const total  = size + quietZone * 2;
  const width  = total * MODULE_PX;
  const height = total * MODULE_PX;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);

  for (let r = 0; r < total; r++) {
    for (let c = 0; c < total; c++) {
      const mr    = r - quietZone;
      const mc    = c - quietZone;
      const isDark = (mr >= 0 && mr < size && mc >= 0 && mc < size) && data[mr * size + mc];
      if (!isDark) continue;

      const tx = total > 1 ? c / (total - 1) : 0;
      const ty = total > 1 ? r / (total - 1) : 0;
      const [cr, cg, cb] = computeColor(preset, tx, ty);
      drawModule(pixels, width, c, r, cr, cg, cb);
    }
  }

  return { pixels, width, height };
}

/**
 * Build particle descriptors at module level (one particle per dark module).
 */
function buildModuleParticles(modules, preset, quietZone) {
  const { size, data } = modules;
  const total = size + quietZone * 2;

  const particles = [];
  for (let r = 0; r < total; r++) {
    for (let c = 0; c < total; c++) {
      const mr    = r - quietZone;
      const mc    = c - quietZone;
      const isDark = (mr >= 0 && mr < size && mc >= 0 && mc < size) && data[mr * size + mc];
      if (!isDark) continue;

      const tx    = total > 1 ? c / (total - 1) : 0;
      const ty    = total > 1 ? r / (total - 1) : 0;
      const color = computeColor(preset, tx, ty);
      particles.push({ targetRow: r, targetCol: c, color });
    }
  }
  return { particles, total };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Export a single-frame GIF (same visual as PNG, GIF container).
 */
export async function exportStaticGIF(modules, filePath, { gradient = 'none' } = {}) {
  const GIFEncoder = require('gif-encoder-2');
  const preset     = GRADIENT_PRESETS[gradient] ?? GRADIENT_PRESETS.none;
  const quietZone  = 4;

  const { pixels, width, height } = buildStaticFrame(modules, preset, quietZone);

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(100);
  encoder.addFrame(pixels);
  encoder.finish();

  await writeFile(filePath, encoder.out.getData());
}

/**
 * Export an animated particle fly-in GIF.
 *
 * @param {object} modules      - QR modules from createMatrix()
 * @param {string} filePath     - Output path (e.g. "qr-anim.gif")
 * @param {object} opts
 * @param {string} opts.gradient  - Color theme
 * @param {number} opts.frames    - Number of animation frames (default 30)
 * @param {number} opts.delay     - ms per frame (default 50)
 */
export async function exportParticleGIF(modules, filePath, {
  gradient = 'none',
  frames   = 30,
  delay    = 50,
} = {}) {
  const GIFEncoder = require('gif-encoder-2');
  const preset     = GRADIENT_PRESETS[gradient] ?? GRADIENT_PRESETS.none;
  const quietZone  = 4;

  const { particles, total } = buildModuleParticles(modules, preset, quietZone);
  const width  = total * MODULE_PX;
  const height = total * MODULE_PX;

  // Randomise start positions and stagger delays
  const seeded = particles.map(p => ({
    ...p,
    startRow: Math.random() * total,
    startCol: (Math.random() - 0.5) * total * 2 + total / 2,
    delay:    Math.random() * 0.30,
  }));

  const encoder = new GIFEncoder(width, height, 'neuquant', false, frames + 1);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(delay);
  encoder.setQuality(10);

  for (let f = 0; f <= frames; f++) {
    const globalT = f / frames;
    const pixels  = new Uint8ClampedArray(width * height * 4).fill(255);

    for (const p of seeded) {
      const localT = Math.max(0, (globalT - p.delay) / (1 - p.delay));
      const e      = 1 - Math.pow(1 - localT, 3); // cubic ease-out

      const row = Math.round(p.startRow + (p.targetRow - p.startRow) * e);
      const col = Math.round(p.startCol + (p.targetCol - p.startCol) * e);

      if (row < 0 || row >= total || col < 0 || col >= total) continue;

      const [r, g, b] = p.color;
      drawModule(pixels, width, col, row, r, g, b);
    }

    encoder.addFrame(pixels);
  }

  encoder.finish();
  await writeFile(filePath, encoder.out.getData());
}
