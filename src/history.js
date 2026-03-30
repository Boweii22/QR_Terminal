/**
 * History — persist and recall previously generated QR codes.
 * Stored in ~/.qr-history.json, newest first, max 20 entries.
 */

import { readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const HISTORY_PATH = join(homedir(), '.qr-history.json');
const MAX_ENTRIES  = 20;

export async function loadHistory() {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { entries: [] };
  }
}

/**
 * Save a generated QR to history.
 * Secrets are stored without their payload (dataLabel only).
 */
export async function saveToHistory({ inputType, dataLabel, qrData, gradient, errorLevel, renderMode }) {
  const history = await loadHistory();

  const entry = {
    id:         Date.now().toString(36),
    timestamp:  new Date().toISOString(),
    inputType,
    dataLabel,
    qrData:     inputType === 'secret' ? null : qrData,
    gradient,
    errorLevel,
    renderMode,
  };

  history.entries.unshift(entry);
  if (history.entries.length > MAX_ENTRIES) {
    history.entries = history.entries.slice(0, MAX_ENTRIES);
  }

  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
  return entry;
}

/**
 * Format a history entry as an @inquirer/prompts choice object.
 */
export function historyChoice(entry, index) {
  const d       = new Date(entry.timestamp);
  const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const preview = entry.qrData
    ? (entry.qrData.slice(0, 48) + (entry.qrData.length > 48 ? '…' : ''))
    : '[secret — payload not stored]';

  return {
    name:        `  ${String(index + 1).padStart(2)} ·  ${entry.dataLabel.padEnd(22)}${preview}`,
    value:       entry,
    description: `${dateStr}  ·  theme: ${entry.gradient}  ·  EC: ${entry.errorLevel}  ·  engine: ${entry.renderMode}`,
    disabled:    !entry.qrData ? '(secret)' : false,
  };
}
