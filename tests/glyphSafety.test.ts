import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// The bundled fonts (DynaPuff, Nunito) ship as LATIN SUBSETS for offline use, so a
// decorative symbol from Arrows, Dingbats or Mathematical Operators has no glyph
// and renders as a tofu box. That looks exactly like a rendering bug — an arrow in
// the header's standing cell was shipping as an empty rectangle before this guard.
//
// So: user-facing strings and UI source may only use characters the subsets
// actually contain. Latin-1 Supplement is fine (× and ° render correctly, and the
// existing UI already relies on ×). Anything above U+0250 that is not an accented
// Latin letter or common punctuation is rejected.

const SRC = join(__dirname, '..', 'src');
const LOCALES = join(SRC, 'i18n', 'locales');

/**
 * Characters above Latin-1 that are known-safe because they are either in the
 * bundled subsets or are ordinary typographic punctuation the app already uses.
 */
const ALLOWED = new Set([
  '\u2018',
  '\u2019', // ' '
  '\u201c',
  '\u201d', // " "
  '\u2013',
  '\u2014', // – —
  '\u2026', // …
  '\u00b7', // ·
  '\u00d7', // × (used by the existing production multipliers)
]);

/** Blocks that have no coverage in a Latin subset. */
function isRisky(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  if (cp < 0x0100) return false; // ASCII + Latin-1 Supplement
  if (ALLOWED.has(ch)) return false;
  // Latin Extended-A/B and IPA cover every accented letter we localise into.
  if (cp <= 0x02af) return false;
  // Combining diacritics (decomposed accents in JSON).
  if (cp >= 0x0300 && cp <= 0x036f) return false;
  return true;
}

/**
 * Symbols that predate this guard.
 *
 * The original note here said "in practice a browser falls back to a system font for a
 * missing glyph, so on a normal desktop these render". That was measured and found to
 * be FALSE: rendering each of these in the app's own font stack and pixel-comparing it
 * against a private-use codepoint showed U+2605, U+221E, U+2197 and U+25CF drawing the
 * platform's notdef box. A screenshot of the cafe confirmed it — the menu board read
 * "NUT ROAST" above three literal rectangles.
 *
 * So the player-facing ones were replaced with CSS art or ASCII:
 *   U+2605 U+25CF U+2668  ->  drawn art (the cafe, now SVG in MinigameArt.tsx)
 *   U+221E                ->  formatNumber() returns "Inf"
 *   U+2197 U+25CF         ->  .onboarding-art__trend / .onboarding-art__pin
 * U+203A survived the audit: it does render, and is left alone.
 *
 * What remains is `src/dev/typography.tsx`, a developer-only specimen page that is
 * never reachable in a shipped build — it exists to show what the type looks like, and
 * a tofu box in it is a finding rather than a defect.
 *
 * This is a RATCHET: the baseline may shrink, never grow. Anything new fails.
 */
const KNOWN_BASELINE: Record<string, string[]> = {
  'src/dev/typography.tsx': ['\u25cf', '\u2302', '\u25a4', '\u2667'],
  // CoffeeRescue.tsx used to be here with U+2668, U+2605 and U+25CF. A screenshot of
  // the running cafe showed the star rendering as a literal tofu box on the menu
  // board, disproving the "the OS will have a fallback" assumption below, so all
  // three are now drawn (the cafe and its mugs are SVG art in MinigameArt.tsx).
  // FocusView.tsx's U+203A went with the old "Play ›" card label.
};

/** Locales shipped as complete. Drafts use scripts served by system fallback. */
const COMPLETE_LOCALES = ['en.json', 'pt-BR.json'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** Risky characters in a file, ignoring comments (prose in comments is harmless). */
function riskyIn(text: string): string[] {
  const found = new Set<string>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    // Comments never reach the screen.
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
    for (const ch of rawLine) if (isRisky(ch)) found.add(ch);
  }
  return [...found];
}

function describeChars(chars: string[]): string {
  return chars
    .map((c) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`)
    .join(', ');
}

describe('glyph safety: every rendered character exists in the bundled fonts', () => {
  it('introduces no new unsupported symbols in UI source', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      // Only the repository-relative lookup key uses '/'. Actual filesystem
      // paths stay native; substring replacement confused Windows separators
      // with new, unapproved source files.
      const rel = `src/${relative(SRC, file).split(sep).join('/')}`;
      const allowed = new Set(KNOWN_BASELINE[rel] ?? []);
      const risky = riskyIn(readFileSync(file, 'utf8')).filter((c) => !allowed.has(c));
      if (risky.length) offenders.push(`${rel}: ${describeChars(risky)}`);
    }
    expect(
      offenders,
      `New unsupported glyphs found. These render as tofu boxes wherever the system\n` +
        `has no fallback font. Use an ASCII equivalent or a CSS shape instead:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has no unsupported symbols in the locales shipped as complete', () => {
    const offenders: string[] = [];
    for (const entry of COMPLETE_LOCALES) {
      const risky = riskyIn(readFileSync(join(LOCALES, entry), 'utf8'));
      if (risky.length) offenders.push(`${entry}: ${describeChars(risky)}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('keeps the pre-existing baseline honest', () => {
    // If a baseline entry is cleaned up, this points it out so the allowlist can
    // shrink instead of quietly permitting a symbol that is no longer used.
    const stale: string[] = [];
    for (const [rel, chars] of Object.entries(KNOWN_BASELINE)) {
      const text = readFileSync(join(SRC, rel.replace(/^src\//, '')), 'utf8');
      const present = new Set(riskyIn(text));
      for (const ch of chars) {
        if (!present.has(ch)) stale.push(`${rel}: ${describeChars([ch])} no longer present`);
      }
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('recognises the characters it is meant to catch', () => {
    // Sanity-check the detector so it cannot silently pass everything.
    expect(isRisky('\u2192')).toBe(true); // arrow
    expect(isRisky('\u2726')).toBe(true); // dingbat
    expect(isRisky('\u2212')).toBe(true); // minus sign
    expect(isRisky('a')).toBe(false);
    expect(isRisky('\u00e7')).toBe(false); // ç
    expect(isRisky('\u00d7')).toBe(false); // ×
  });
});
