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

/**
 * How a shown number is rounded. A balance is shown rounded DOWN, so the HUD never
 * claims "50" while holding 49.97 and the 50-nut goal is still out of reach; the
 * default rounds to nearest, for rates and descriptions.
 */
export type RoundMode = 'round' | 'floor';

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(locale: string, digits: number): Intl.NumberFormat {
  const key = `${locale}|${digits}`;
  let found = formatters.get(key);
  if (!found) {
    try {
      found = new Intl.NumberFormat(locale, {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
      });
    } catch {
      found = new Intl.NumberFormat('en', { maximumFractionDigits: digits });
    }
    formatters.set(key, found);
  }
  return found;
}

function roundTo(value: number, digits: number, mode: RoundMode): number {
  const factor = Math.pow(10, digits);
  // A hair of tolerance so 0.3 shown at one decimal is never floored to 0.2.
  return mode === 'floor'
    ? Math.floor(value * factor + 1e-9) / factor
    : Math.round(value * factor) / factor;
}

export function formatNumber(value: number, locale = 'en', mode: RoundMode = 'round'): string {
  /* ASCII only, deliberately. This used to return the infinity sign, which has no
     glyph in the bundled Latin font subsets and renders as a tofu box — so a very
     large number looked like a broken one. Verified by rendering U+221E in the app's
     own font stack and pixel-comparing it against a private-use codepoint.
     `Inf` also keeps the register of the scientific-notation fallback below. */
  if (Number.isNaN(value)) return '0';
  if (!Number.isFinite(value)) return `${value < 0 ? '-' : ''}Inf`;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 1000) {
    if (Number.isInteger(abs)) return sign + abs.toString();
    // The locale's own decimal mark: "0,2/s" in Portuguese, beside "5,6M".
    const shown = roundTo(abs, 1, mode);
    if (shown >= 1000) return sign + formatNumber(shown, locale, mode);
    return sign + formatter(locale, 1).format(shown);
  }
  let tier = Math.floor(Math.log10(abs) / 3);
  if (tier < SHORT_SUFFIXES.length) {
    let scaled = abs / Math.pow(1000, tier);
    let digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    scaled = roundTo(scaled, digits, mode);
    // 999.96K rounds to 1M, not "1000K".
    if (scaled >= 1000 && tier + 1 < SHORT_SUFFIXES.length) {
      tier += 1;
      scaled = roundTo(scaled / 1000, 2, mode);
      digits = 2;
    }
    // Use locale grouping for the mantissa where it matters.
    return `${sign}${formatter(locale, digits).format(scaled)}${SHORT_SUFFIXES[tier]}`;
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

/**
 * Date AND time, for anything the player needs to identify a specific moment —
 * "last saved", an exported file, a backup. A save stamped only with a date is
 * useless for telling this session's save from yesterday's.
 */
export function formatDateTime(epochMs: number, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(epochMs),
  );
}

/**
 * A filename-safe stamp, e.g. `2026-09-14_1532`.
 *
 * Deliberately not locale-formatted: this goes in a filename, where slashes and
 * commas are hostile and sorting by name should sort by time.
 */
export function fileStamp(epochMs: number): string {
  const d = new Date(epochMs);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
