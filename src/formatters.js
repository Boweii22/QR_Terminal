/**
 * Data formatters + UI metadata for prompts
 */

export function formatWifi({ ssid, password, security = 'WPA', hidden = false }) {
  const esc = s => String(s).replace(/([\\;,":])/, '\\$1');
  if (security === 'nopass') return `WIFI:T:nopass;S:${esc(ssid)};;`;
  return `WIFI:T:${security};S:${esc(ssid)};P:${esc(password)};H:${hidden};;`;
}

export function formatVCard({ firstName = '', lastName = '', phone = '', email = '', org = '', url = '' }) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${[firstName, lastName].filter(Boolean).join(' ')}`,
  ];
  if (org)   lines.push(`ORG:${org}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${email}`);
  if (url)   lines.push(`URL:${url}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export const ERROR_LEVELS = {
  L: { label: 'L  —  Low        (7% recovery)',      desc: 'Smallest matrix. Best for pristine digital screens.',       recovery: '7%'  },
  M: { label: 'M  —  Medium    (15% recovery)',       desc: 'Balanced. Recommended for URLs and general use.',          recovery: '15%' },
  Q: { label: 'Q  —  Quartile  (25% recovery)',       desc: 'Good tolerance for printed/folded materials.',             recovery: '25%' },
  H: { label: 'H  —  High      (30% recovery)',       desc: 'Maximum redundancy — logos can overlay up to 30% area.',  recovery: '30%' },
};

export const GRADIENT_OPTIONS = [
  { name: '  ◆  Classic    — Crisp white, terminal-native',                     value: 'none'   },
  { name: '  ◈  Retro      — Diagonal: coral red → warm amber',                 value: 'retro'  },
  { name: '  ◈  Ocean      — Diagonal: deep navy → electric cyan',              value: 'ocean'  },
  { name: '  ◈  Neon       — Sine-wave: green · cyan · magenta ripple',         value: 'neon'   },
  { name: '  ◈  Sunset     — Diagonal: hot red → orange → gold',               value: 'sunset' },
  { name: '  ◈  Galaxy     — 4-corner bilinear: purple · blue · pink · teal',   value: 'galaxy' },
  { name: '  ◈  Cherry     — Radial bloom: soft white center → deep rose',      value: 'cherry' },
  { name: '  ◈  Matrix     — Vertical cascade: dark → electric green',          value: 'matrix' },
  { name: '  ◈  Fire       — Diagonal: blood red → ember orange → gold',        value: 'fire'   },
  { name: '  ◈  Vaporwave  — 4-corner: magenta · cyan · purple · blue',         value: 'vapor'  },
];
