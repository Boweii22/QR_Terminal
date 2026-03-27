/**
 * Self-Destructing Session QR
 *
 * Hosts a file over an HTTP server tunneled via localtunnel.
 * The QR code encodes the public tunnel URL.
 * After the file is downloaded once, the tunnel closes and an ASCII
 * "explosion" animation plays.
 */

import http from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename } from 'path';

/**
 * Create a self-destructing file share.
 *
 * @param {string} filePath  - Path to the file to share
 * @returns {Promise<{ url, waitForDownload, close }>}
 */
export async function createDestructQR(filePath) {
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const fileBuffer = await readFile(filePath);
  const fileName   = basename(filePath);
  const port       = 7654 + Math.floor(Math.random() * 200);
  let   downloaded = false;
  let   downloadResolve;
  const downloadPromise = new Promise(r => { downloadResolve = r; });

  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(404); res.end(); return; }

    if (downloaded) {
      res.writeHead(410, { 'Content-Type': 'text/html' });
      res.end('<html><body style="background:#0d0d0d;color:#ff0040;font-family:monospace;padding:40px"><h1>☠ FILE DESTROYED</h1><p>This QR code was single-use. The file no longer exists.</p></body></html>');
      return;
    }

    downloaded = true;
    res.writeHead(200, {
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length':      fileBuffer.length,
    });
    res.end(fileBuffer);

    // Signal after response is sent
    setTimeout(() => {
      downloadResolve();
      server.close();
    }, 500);
  });

  await new Promise((res, rej) => server.listen(port, (e) => e ? rej(e) : res()));

  // Try to set up localtunnel
  let tunnelUrl;
  try {
    const { default: localtunnel } = await import('localtunnel');
    const tunnel = await localtunnel({ port });
    tunnelUrl = tunnel.url;

    downloadPromise.then(() => tunnel.close()).catch(() => {});
  } catch {
    // Fall back to local IP if localtunnel unavailable
    const { networkInterfaces } = await import('os');
    const nets = networkInterfaces();
    let ip = '127.0.0.1';
    for (const name of Object.keys(nets)) {
      for (const iface of nets[name]) {
        if (iface.family === 'IPv4' && !iface.internal) { ip = iface.address; break; }
      }
    }
    tunnelUrl = `http://${ip}:${port}`;
  }

  return {
    url:             tunnelUrl,
    waitForDownload: downloadPromise,
    close:           () => server.close(),
  };
}

/**
 * ASCII explosion animation. Call after the file is consumed.
 */
export async function showExplosion() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const UP    = n  => `\x1b[${n}A`;

  const frames = [
    ['      ', '  ☠   ', '      '],
    ['  ·   ', ' ✦☠✦  ', '  ·   '],
    [' ·✦·  ', '✦✦☠✦✦ ', ' ·✦·  '],
    ['✦·✦·✦ ', '·✦ ✦· ', '✦·✦·✦ '],
    ['✧ ✦ ✧ ', ' ✦   ✦ ', '✧ ✦ ✧ '],
    [' ✧   ✧', '       ', ' ✧   ✧'],
    ['       ', '       ', '       '],
  ];

  const colors = [
    [255, 255, 0],
    [255, 200, 0],
    [255, 140, 0],
    [255, 80, 0],
    [255, 40, 0],
    [200, 20, 0],
    [100, 0, 0],
  ];

  // Print initial blank frame
  for (let i = 0; i < 3; i++) process.stdout.write('\n');

  for (let f = 0; f < frames.length; f++) {
    const [r, g, b] = colors[f];
    process.stdout.write(UP(3));
    for (const line of frames[f]) {
      process.stdout.write(`  \x1b[38;2;${r};${g};${b}m${line.padEnd(20)}\x1b[0m\n`);
    }
    await sleep(80);
  }
}
