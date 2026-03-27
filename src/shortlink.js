/**
 * URL Shortener integration.
 * Uses TinyURL's free API (no auth key required).
 * Keeping the encoded text short → lower QR version → smaller, cleaner matrix.
 */

import axios from 'axios';

/**
 * Shorten a URL via TinyURL API.
 * Falls back gracefully on network errors.
 *
 * @param {string} url - The long URL to shorten
 * @returns {Promise<string>} - The shortened URL
 */
export async function shortenUrl(url) {
  const response = await axios.get('https://tinyurl.com/api-create.php', {
    params:  { url },
    timeout: 7000,
    headers: { 'User-Agent': 'qr-terminal/1.0.0' },
  });

  const result = response.data?.trim();
  if (!result || !result.startsWith('http')) {
    throw new Error('TinyURL returned an unexpected response');
  }
  return result;
}

/**
 * Check if a string is a valid, parseable URL.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Estimate how much "QR space" a URL will save after shortening.
 * QR version increases roughly every ~17 chars of extra data.
 *
 * @param {number} originalLength
 * @param {number} shortenedLength
 * @returns {string} - Human-readable savings description
 */
export function estimateSavings(originalLength, shortenedLength) {
  const saved   = originalLength - shortenedLength;
  const percent = Math.round((saved / originalLength) * 100);
  if (saved <= 0) return 'no change';
  return `−${saved} chars (${percent}% smaller QR matrix)`;
}
