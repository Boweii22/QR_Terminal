/**
 * Braille-Block Hybrid Renderer
 *
 * Maps 2×4 blocks of QR modules onto Unicode Braille patterns (U+2800–U+28FF).
 * Gives 4× vertical resolution vs standard half-block rendering.
 *
 * Braille dot layout in one terminal cell:
 *   col+0  col+1
 *   dot1   dot4   (row+0)
 *   dot2   dot5   (row+1)
 *   dot3   dot6   (row+2)
 *   dot7   dot8   (row+3)
 *
 * Bit weights: dot1=1, dot2=2, dot3=4, dot4=8, dot5=16, dot6=32, dot7=64, dot8=128
 */

import chalk from 'chalk';
import { GRADIENT_PRESETS, computeColor } from './engine.js';

const BRAILLE_BASE = 0x2800;

// Map from (leftCol, rightCol) dot rows → bit positions
const DOT_BITS = [
  [1,   8],   // row+0: dot1, dot4
  [2,  16],   // row+1: dot2, dot5
  [4,  32],   // row+2: dot3, dot6
  [64, 128],  // row+3: dot7, dot8
];

export function renderBraille(modules, options = {}) {
  const { gradient = 'none', quietZone = 2 } = options;
  const { size, data } = modules;
  const preset = GRADIENT_PRESETS[gradient] ?? GRADIENT_PRESETS.none;

  const colStart = -quietZone, colEnd = size + quietZone;
  const rowStart = -quietZone, rowEnd = size + quietZone;
  const totalCols = colEnd - colStart;
  const totalRows = rowEnd - rowStart;

  // Braille: 2 QR cols per char, 4 QR rows per char
  const charCols = Math.ceil(totalCols / 2);
  const charRows = Math.ceil(totalRows / 4);

  const px = (r, c) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return 0;
    return data[r * size + c] ? 1 : 0;
  };

  const output = [];

  for (let ci = 0; ci < charRows; ci++) {
    const ty = charRows > 1 ? ci / (charRows - 1) : 0;
    let coloredLine = '';
    let runColor = null, runChars = '';

    const flush = () => {
      if (!runChars) return;
      coloredLine += runColor
        ? chalk.rgb(runColor[0], runColor[1], runColor[2])(runChars)
        : runChars;
      runChars = ''; runColor = null;
    };

    for (let cj = 0; cj < charCols; cj++) {
      const tx = charCols > 1 ? cj / (charCols - 1) : 0;
      const baseRow = rowStart + ci * 4;
      const baseCol = colStart + cj * 2;

      // Build 8-bit braille bitmask from the 2×4 QR module block
      let bitmask = 0;
      let hasDark = false;
      for (let dr = 0; dr < 4; dr++) {
        const [leftBit, rightBit] = DOT_BITS[dr];
        if (px(baseRow + dr, baseCol))     { bitmask |= leftBit;  hasDark = true; }
        if (px(baseRow + dr, baseCol + 1)) { bitmask |= rightBit; hasDark = true; }
      }

      const char = String.fromCodePoint(BRAILLE_BASE + bitmask);

      if (!hasDark || bitmask === 0) {
        flush();
        coloredLine += ' ';
      } else {
        const color = computeColor(preset, tx, ty);
        if (runColor && colorsClose(runColor, color, 8)) {
          runChars += char;
        } else {
          flush();
          runColor = color;
          runChars = char;
        }
      }
    }

    flush();
    output.push(coloredLine);
  }

  return output;
}

function colorsClose([r1,g1,b1],[r2,g2,b2],t){
  return Math.abs(r1-r2)<t && Math.abs(g1-g2)<t && Math.abs(b1-b2)<t;
}
