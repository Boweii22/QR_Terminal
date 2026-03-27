/**
 * Luma Detection via OSC 11
 *
 * Sends the OSC 11 escape sequence to query the terminal's actual background
 * color, then computes its luminance. Returns { r, g, b, luminance, isLight }
 * or null if the terminal doesn't support it (with a 400ms timeout).
 */

export async function detectTerminalBgColor() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null;

  return new Promise((resolve) => {
    let buffer = '';

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 400);

    const onData = (chunk) => {
      buffer += chunk;
      // OSC 11 response format: \x1b]11;rgb:RRRR/GGGG/BBBB\x07
      // Some terminals send \x1b\\ as terminator instead of \x07
      const match = buffer.match(/\x1b\]11;rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/);
      if (match) {
        cleanup();
        // Values are 16-bit (0000–FFFF); take the high byte for 0–255
        const r = parseInt(match[1].slice(0, 2), 16);
        const g = parseInt(match[2].slice(0, 2), 16);
        const b = parseInt(match[3].slice(0, 2), 16);
        // WCAG relative luminance
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        resolve({ r, g, b, luminance, isLight: luminance > 127 });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      try {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch {}
    };

    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('latin1');
      process.stdin.on('data', onData);
      // Send OSC 11 query
      process.stdout.write('\x1b]11;?\x07');
    } catch {
      cleanup();
      resolve(null);
    }
  });
}
