/**
 * Shareable link — build a browser-openable URL that renders the QR in an image.
 * Uses QuickChart.io's free public QR API (no auth required, rate-limited generously).
 *
 * Opening the link in any browser shows a 400×400 QR code PNG inline.
 */

export function buildShareableLink(qrData, { errorLevel = 'M', size = 400 } = {}) {
  const params = new URLSearchParams({
    text:    qrData,
    size:    size.toString(),
    margin:  '4',
    ecLevel: errorLevel,
    format:  'png',
  });
  return `https://quickchart.io/qr?${params.toString()}`;
}
