// Number and time formatting. Big idle numbers use compact suffixes; the game
// theme also supports a playful "nut scale" set of names used in the
// encyclopedia (One Nutillion!). Locale-aware formatting defers to Intl.

const SHORT_SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
];

export function formatNumber(value: number, locale = 'en'): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 1000) {
    return sign + (Number.isInteger(abs) ? abs.toString() : abs.toFixed(1));
  }
  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier < SHORT_SUFFIXES.length) {
    const scaled = abs / Math.pow(1000, tier);
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    // Use locale grouping for the mantissa where it matters.
    const mantissa = new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(scaled);
    return `${sign}${mantissa}${SHORT_SUFFIXES[tier]}`;
  }
  // Beyond our named suffixes, fall back to scientific notation.
  return sign + abs.toExponential(2).replace('e+', 'e');
}

export function formatInteger(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.floor(value));
}

export function formatRate(perSecond: number, locale = 'en'): string {
  return `${formatNumber(perSecond, locale)}/s`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export function formatDate(epochMs: number, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(epochMs));
}
