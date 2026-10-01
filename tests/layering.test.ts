import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// CONTRIBUTING requires the simulation to stay framework-independent: nothing in
// `src/sim` or `src/content` may import React, Electron, PixiJS or the DOM, so the
// whole game model stays unit-testable and shareable.
//
// This is easy to break by accident — a shared constant pulled in from a renderer
// module drags React in transitively. This test walks the real import graph rather
// than just the direct imports, so that transitive case is caught too.

const ROOT = join(__dirname, '..', 'src');
const FORBIDDEN = ['react', 'react-dom', 'electron', 'pixi.js'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** Local (relative) and bare import specifiers used by a file. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs: string[] = [];
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) specs.push(m[1]);
  return specs;
}

/** Resolve a relative specifier to a real file path, or null for bare imports. */
function resolveLocal(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(fromFile, '..', spec);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/**
 * Every module reachable from `entry`, plus the bare packages encountered along
 * the way and which file pulled each one in.
 */
function reachable(entry: string): { packages: Map<string, string> } {
  const seen = new Set<string>();
  const packages = new Map<string, string>();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(file)) {
      const local = resolveLocal(file, spec);
      if (local) {
        stack.push(local);
      } else {
        // Record the first importer, which is the useful one for a failure message.
        const pkg = spec.startsWith('@')
          ? spec.split('/').slice(0, 2).join('/')
          : spec.split('/')[0];
        if (!packages.has(pkg)) packages.set(pkg, file);
      }
    }
  }
  return { packages };
}

describe('architecture: the simulation stays framework-independent', () => {
  const layers = ['sim', 'content'];

  for (const layer of layers) {
    it(`src/${layer} never reaches a UI framework, even transitively`, () => {
      const offenders: string[] = [];
      for (const file of sourceFiles(join(ROOT, layer))) {
        const { packages } = reachable(file);
        for (const forbidden of FORBIDDEN) {
          const importer = packages.get(forbidden);
          if (importer) {
            offenders.push(
              `${file.replace(ROOT, 'src')} reaches "${forbidden}" via ${importer.replace(ROOT, 'src')}`,
            );
          }
        }
      }
      expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it(`src/${layer} contains no .tsx files`, () => {
      const tsx = sourceFiles(join(ROOT, layer)).filter((f) => f.endsWith('.tsx'));
      expect(tsx.map((f) => f.replace(ROOT, 'src'))).toEqual([]);
    });
  }
});

/* ---------------------------------------------------------------------------
 * The other kind of layering: what paints on top of what.
 *
 * This exists because a comment lied. `.speech-note` sat at z-index 9000 and
 * explained itself with "below modals (9997+)" — but 9997-9999 is the
 * cursor-attached tier (.tooltip, .drag-ghost, .sparkle-burst, .dust-puff), and the
 * real UI layers are far lower: .popup-backdrop 180, .toasts 200, .talk 210,
 * .opening-seq 260. So an ambient employee bubble on a timer painted over every
 * dialog in the game, including the first-run tutorial's own heading.
 *
 * Encoding the intended order here means the next person to pick a z-index cannot
 * quietly invert it, and does not have to trust a comment.
 * ------------------------------------------------------------------------- */

// The effective stylesheet, in cascade order: the `legacy` layer (styles.css) first,
// then the `game` layer (src/ui/game/*.css, in main.tsx import order), which wins
// over legacy regardless of specificity — so "the last declaration wins" below
// matches the browser.
// Comments are stripped first: a section banner sitting directly above a rule becomes
// part of the selector text otherwise, and the lookup silently finds nothing.
const GAME_LAYER = ['base', 'shell', 'popup', 'opening', 'world'].map((name) =>
  readFileSync(join(ROOT, 'ui', 'game', `${name}.css`), 'utf8'),
);
const STYLES = [readFileSync(join(ROOT, 'styles.css'), 'utf8'), ...GAME_LAYER]
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The effective z-index declared for an exact selector.
 *
 * Later declarations win at equal specificity, so the LAST one in source order is
 * the one that takes effect — the same rule that decides it in the browser.
 */
function zIndexOf(selector: string): number {
  let found: number | null = null;
  /* Match INNERMOST rule blocks: a body containing no braces. That makes the scan
     work for rules nested inside @media too — splitting the file on "}" instead reads
     the media query itself as the selector list and silently finds nothing. */
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rule.exec(STYLES))) {
    const selectors = match[1].split(',').map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    const declared = /(?:^|[;\s])z-index:\s*(-?\d+)/.exec(match[2]);
    // Later wins at equal specificity, so keep overwriting: the last one is effective.
    if (declared) found = Number(declared[1]);
  }
  if (found === null) throw new Error(`no z-index found for ${selector}`);
  return found;
}

describe('visual stacking order', () => {
  it('keeps ambient flavour underneath anything the player must read', () => {
    const note = zIndexOf('.speech-note');
    for (const selector of [
      '.popup-backdrop',
      '.modal-backdrop',
      '.toasts',
      '.talk',
      '.opening-seq',
    ]) {
      expect(
        note,
        `.speech-note (${note}) must paint BELOW ${selector} (${zIndexOf(selector)}): an ambient ` +
          `bubble on a timer must never cover a dialog, a notification or the intro`,
      ).toBeLessThan(zIndexOf(selector));
    }
  });

  it('still keeps a speech note above the office scene it belongs to', () => {
    // The note is portaled to the body, so it has to out-rank the scene's own layers.
    // (The moment-card viewer used to sit below the note at z 100; it is a modal the
    // player reads, so it now shares the popup tier and the note stays under it.)
    const note = zIndexOf('.speech-note');
    for (const selector of ['.photo-mode']) {
      expect(note, `.speech-note must stay above ${selector}`).toBeGreaterThan(zIndexOf(selector));
    }
    // ...and above the whole office shell it is anchored to.
    for (const selector of ['.hud', '.dock', '.sheet']) {
      expect(note, `.speech-note must stay above ${selector}`).toBeGreaterThan(zIndexOf(selector));
    }
  });

  it('reserves the top of the stack for things attached to the cursor', () => {
    // A tooltip and a drag ghost follow the pointer, so they are genuinely always on
    // top; nothing that merely happens on a timer belongs up here with them.
    const tooltip = zIndexOf('.tooltip');
    const ghost = zIndexOf('.drag-ghost');
    for (const selector of [
      '.popup-backdrop',
      '.toasts',
      '.talk',
      '.opening-seq',
      '.speech-note',
    ]) {
      expect(tooltip, `.tooltip must out-rank ${selector}`).toBeGreaterThan(zIndexOf(selector));
      expect(ghost, `.drag-ghost must out-rank ${selector}`).toBeGreaterThan(zIndexOf(selector));
    }
  });

  it('orders the UI tier the way the screen is actually composed', () => {
    // A popup is the most modal thing; a toast may sit over it; a conversation and the
    // cold open own the screen outright.
    expect(zIndexOf('.popup-backdrop')).toBeLessThan(zIndexOf('.toasts'));
    expect(zIndexOf('.toasts')).toBeLessThan(zIndexOf('.talk'));
    expect(zIndexOf('.talk')).toBeLessThan(zIndexOf('.opening-seq'));
  });
});

/* ---------------------------------------------------------------------------
 * Typography floor.
 *
 * A great deal of this UI sizes itself with `em` multipliers, and those COMPOUND: a
 * 0.66em note inside a row that is already 0.62em of a small parent landed at 8.5px,
 * and the reputation stamp's cycle label measured 6.81px. Thirty-one distinct selectors
 * were rendering text under 11px. The fix is a floor — `max(var(--fs-min), <intent>)` —
 * rather than 131 hand-picked sizes, so the intent survives wherever there is room.
 *
 * These guard the shape of that fix: that new relative sizes do not quietly bypass it,
 * and that the floor now applies at every window size (the compact-window exemption
 * existed only for the old 11-tab rail and letterhead, which the Phase 1 shell replaced).
 * ------------------------------------------------------------------------- */
describe('typography floor', () => {
  const TOKENS = readFileSync(join(ROOT, 'ui', 'tokens.css'), 'utf8');

  /** Relative font-size declarations that are NOT wrapped in the floor. */
  function unflooredRelativeSizes(): string[] {
    const out: string[] = [];
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = rule.exec(STYLES))) {
      const body = match[2];
      const decl = /font-size:\s*([^;]+);/g;
      let d: RegExpExecArray | null;
      while ((d = decl.exec(body))) {
        const value = d[1].trim();
        if (!/^(?:0?\.\d+|\d+(?:\.\d+)?)(?:em|rem|%)$/.test(value)) continue;
        out.push(`${match[1].trim().split('\n').pop()!.trim()} { font-size: ${value} }`);
      }
    }
    return out;
  }

  it('routes every relative font size through the floor, except the documented few', () => {
    /* The exemptions, and why each one has to be:
       - the title bar shares its row with the window controls, and widening anything in
         it pushes them off the right edge (window-chrome.spec.ts measures that). The
         stamp is also *meant* to be small: it is a rubber stamp.
       Everything else must go through max(var(--fs-min), …). */
    // (The old letterhead's stamp and department line were the only exemptions; the
    // letterhead is gone and the game-layer shell sizes its text in tokens and px.)
    const ALLOWED_UNFLOORED: string[] = [];
    const offenders = unflooredRelativeSizes().filter(
      (line) => !ALLOWED_UNFLOORED.some((sel) => line.startsWith(sel)),
    );
    expect(
      offenders,
      `These relative font sizes bypass the legibility floor. Wrap them as\n` +
        `max(var(--fs-min), <size>) so they cannot compound below readable:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the legibility floor on at every window size', () => {
    // It used to be gated behind a 1000×620 media query because the 11-tab rail and
    // the letterhead needed sub-11px text to fit a companion window. The Phase 1 HUD
    // and dock are built for 320×420 at legible sizes, so the floor is always on.
    expect(TOKENS).toMatch(/--fs-min:\s*calc\(11px \* var\(--font-scale\)\);/);
    expect(TOKENS).not.toMatch(/@media \(min-width: 1000px\) and \(min-height: 620px\)/);
  });

  it('exempts the dense tool surfaces by resetting the inherited token', () => {
    // The decoration tray is documented as height-sensitive (rebuilt in Phase 2).
    // Resetting --fs-min on the container is how the exemption is expressed.
    expect(TOKENS).toMatch(/\.deco-tray\s*\{\s*\n\s*--fs-min:\s*0px/);
  });

  it('never sets a tiny label in the display face', () => {
    // tokens.css states the rule: "tiny labels deliberately stay in Nunito: DynaPuff's
    // lively shapes become crowded below normal control sizes". The employee card's
    // legal-name line broke it, and at that size the word space in "Marlow Stillwater"
    // visually disappeared.
    const displayFaceRule = /([^{}]*)\{[^{}]*font-family:\s*var\(--font-head\)[^{}]*\}/g;
    const tiny: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = displayFaceRule.exec(STYLES))) {
      for (const sel of m[1].split(',').map((s) => s.trim())) {
        if (/__fullname|__note|__hint|__caption|-cycle$/.test(sel)) tiny.push(sel);
      }
    }
    expect(tiny, `${tiny.join(', ')} set a small secondary label in the display face`).toEqual([]);
  });
});
