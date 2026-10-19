// The character art registry.
//
// WHY A REGISTRY RATHER THAN LITERALS
// -----------------------------------
// Character artwork is the highest-risk asset class in this project: a single bad
// frame in Pip's APNG produced a halo shimmer that took a long investigation to
// trace, and the fix had to be verified on real hardware. Any future art pass —
// redrawing an animal, re-encoding at a different size, replacing a master — needs
// to be reversible without archaeology through git history.
//
// So every animal declares its art as VERSIONED VARIANTS:
//
//   original  the artwork as supplied, encoded for the game
//   enhanced  a future redrawn/improved pass (none yet)
//   legacy    a superseded build kept for comparison or rollback
//
// `activeVersion` selects what the game renders. Switching a character back is a
// one-line change here, and `CHARACTER_ART_OVERRIDE` lets a developer flip the
// whole roster at runtime without touching source — deliberately not surfaced to
// players, because it is a development and rollback tool.
//
// THE EMPLOYEE ID IS AUTHORITATIVE
// --------------------------------
// Files are never matched to animals by filename. Each entry names the employee id
// from `content/employees.ts` and the species recorded in `art/critterShapes.ts`,
// and `tests/characterAssets.test.ts` asserts the two agree — so the cat can never
// end up wearing the owl's artwork because two files sorted next to each other.
//
// GEOMETRY CONTRACT
// -----------------
// `frameWidth` / `frameHeight` are the **@1x** pixel dimensions and are the ONLY
// source of a sprite's aspect ratio. `EmployeeSprite` derives width from height
// through them, which is what keeps a character from being squashed by the global
// `img { max-width: 100% }` guard. They must always match the real @1x file; a
// test checks every registered entry against the file on disk.
//
// SHARPNESS CONTRACT
// ------------------
// `frameHeight` also equals the character's RENDERED height, `presenceSize(
// officeHeight)`. That is the whole point: the @1x asset is encoded at the size it is
// actually drawn at, so on a DPR-1 display the frame maps 1:1 to device pixels and
// the browser resamples nothing. It did not use to hold — the assets were encoded at
// the pre-presence `officeHeight` while being drawn 20% larger, so the entire cast
// was enlarged ~1.16x (worst 1.26x) and read soft. `scripts/check-sprite-resampling.mjs`
// reports the ratios and `tests/spriteResampling.test.ts` fails if any of them
// regresses above 1.0.
//
// `srcWidth` / `srcHeight` are the real dimensions of the @2x animation. They exist
// so the renderer can state that file's srcSet density HONESTLY. It is no longer
// "twice the @1x asset": @1x is now the display size (officeHeight * 1.2) while the
// @2x build is unchanged at twice `officeHeight`, which makes its true density
// 2 / 1.2 = ~1.67x rather than 2x. It is left unchanged deliberately — reaching a
// genuine 2x of the new @1x would mean upscaling artwork, i.e. inventing pixels, and
// the masters that could supply them are not in the repository (and Pip's must not be
// re-imported at all).

/** Which build of an animal's artwork to render. */
export type CharacterArtVersion = 'original' | 'enhanced' | 'legacy';

export interface CharacterArtFiles {
  /** @2x animation, relative to BASE_URL. */
  src: string;
  /** @1x animation. Its dimensions are `frameWidth` x `frameHeight`. */
  src1x?: string;
  /** Static frame for reduced motion. */
  poster: string;
  /** @1x frame width — the aspect-ratio numerator. */
  frameWidth: number;
  /** @1x frame height — the aspect-ratio denominator, and the rendered height. */
  frameHeight: number;
  /** Real pixel width of the @2x animation (`src`). */
  srcWidth: number;
  /** Real pixel height of the @2x animation, for its true srcSet density. */
  srcHeight: number;
  /**
   * Rendered height in the office diorama, in CSS px, BEFORE the global presence
   * multiplier. `presenceSize(officeHeight)` is the on-screen height, and the @1x
   * asset is encoded at exactly that — so `frameHeight === presenceSize(officeHeight)`.
   *
   * This is a LAYOUT quantity, derived from each animal's `figureHeightFraction`
   * against the authored reference figure (92px of squirrel, see characterScale.ts).
   * It is deliberately NOT derived from any shipped canvas height: doing that made
   * the derivation circular once the @1x asset's height became a function of this
   * value. See scripts/measure-character-figures.py.
   */
  officeHeight: number;
  /** Rendered height on the roster card portrait. */
  cardHeight: number;
  /** 0..1 across the sprite that lines up with the character's visual centre. */
  anchorX: number;
  /** Dead transparent margin above the animal, as a fraction of canvas height. */
  figureTop: number;
  /** 0..1 up from the bottom edge where the character's contact line sits. */
  baseline: number;
  /**
   * TEMPORARY diagnostic: a hard-alpha variant used by the Ctrl+Alt+H halo A/B.
   * Only Pip has one; see art/haloTest.ts.
   */
  srcNoHalo?: string;
  /** Free-text note explaining anything unusual about this build. */
  note?: string;
}

export interface CharacterArtEntry {
  /** employee id in content/employees.ts — the authoritative link. */
  employee: string;
  /** species in art/critterShapes.ts, cross-checked by tests. */
  species: string;
  /** Which variant the game renders today. */
  activeVersion: CharacterArtVersion;
  variants: Partial<Record<CharacterArtVersion, CharacterArtFiles>>;
}

/**
 * Card portraits read a little larger than the office figure. Derived rather than
 * authored so a re-encode cannot leave the two silently inconsistent.
 */
const CARD_RATIO = 1.43;
const card = (officeHeight: number) => Math.round(officeHeight * CARD_RATIO);

/**
 * Visible-figure normalisation, per animal.
 *
 * These three numbers are NOT hand-tuned. They are measured off the shipped @1x
 * artwork by `scripts/measure-character-figures.py`, which records its findings in
 * `assets/sources/characters/figure-metrics.json`; `tests/characterAssets.test.ts`
 * reads that file back and fails if this table disagrees, so the registry cannot
 * drift away from the pixels.
 *
 * Why they are needed at all: sizing a character by its canvas height assumes every
 * canvas frames its animal equally tightly, and they do not. Pip's artwork fills
 * 98.9% of her canvas; Corvus fills 89.0%. Scaling both canvases to a similar height
 * therefore drew Corvus noticeably smaller than Pip — and made Pip, the intended
 * reference, the SMALLEST figure in the cast. `officeHeight` here is the canvas
 * height at which each animal's VISIBLE FIGURE is exactly as tall as Pip's, so the
 * roster finally reads as one cast at one scale.
 *
 *   figure    — the height of the canvas, chosen so figure height matches Pip's.
 *   baseline  — dead transparent margin below the animal, as a fraction of its own
 *               height. The sprite sinks by this much so the FEET reach the floor
 *               line instead of the canvas edge (Bea sat 5.2% of her height above
 *               the floor; Rosa 3.7%).
 *   anchorX   — where the figure actually sits across the canvas, so a character
 *               stands at their workstation rather than at the centre of their own
 *               padding.
 *   figureTop — dead transparent margin ABOVE the animal. The mood bubble hangs
 *               from the top of the HEAD; without this it hung from the top of the
 *               canvas, so it sat a different distance above every animal (Corvus
 *               carries 11% headroom, Pip 1%).
 *
 * Frame dimensions stay bound to the real files: they are the aspect-ratio source
 * `EmployeeSprite` derives width from, and deriving width is what stops Pip being
 * squashed. Nothing here re-encodes or reframes any artwork.
 */
interface FigureNorm {
  officeHeight: number;
  baseline: number;
  anchorX: number;
  figureTop: number;
}

/**
 * Shorthand for a straightforward @2x + @1x + poster set.
 *
 * `frameWidth`/`frameHeight` are the @1x file's real size; `src2x` is the @2x file's
 * real size, as `[width, height]`. Both are generated from the files on disk by
 * `scripts/sync-character-registry.py` rather than typed by hand.
 */
function art(
  asset: string,
  frameWidth: number,
  frameHeight: number,
  figure: FigureNorm,
  src2x: readonly [number, number],
  extra: Partial<CharacterArtFiles> = {},
): CharacterArtFiles {
  return {
    src: `employees/${asset}.png`,
    src1x: `employees/${asset}-1x.png`,
    poster: `employees/${asset}-poster.png`,
    frameWidth,
    frameHeight,
    srcWidth: src2x[0],
    srcHeight: src2x[1],
    officeHeight: figure.officeHeight,
    cardHeight: card(figure.officeHeight),
    anchorX: figure.anchorX,
    baseline: figure.baseline,
    figureTop: figure.figureTop,
    ...extra,
  };
}

export const CHARACTER_ART: readonly CharacterArtEntry[] = [
  {
    employee: 'pip',
    species: 'squirrel',
    // Deliberately the REPAIRED build, not a fresh import of the master.
    activeVersion: 'original',
    variants: {
      // The reference figure: 92px tall inside a 93px canvas. Every other animal is
      // scaled to match this, and Pip's own numbers are therefore unchanged.
      original: art(
        'pip',
        125,
        112,
        { officeHeight: 93, baseline: 0, anchorX: 0.521739, figureTop: 0.010753 },
        [207, 186],
        {
          srcNoHalo: '_diag/pip-nohalo.png',
          note:
            'Repaired build. 8 of the 242 master frames had their semi-transparent alpha ' +
            'collapsed ~52%, deflating the halo for one frame about once a second. Those ' +
            'frames were replaced with their nearest healthy neighbours, preserving timing, ' +
            'dimensions, loop and artwork. Measured alpha peak-to-peak 2.10 here versus ' +
            '16.95 in the raw master, so re-importing the master would reintroduce the bug. ' +
            'Guarded by npm run verify:assets.',
        },
      ),
    },
  },
  {
    employee: 'bea',
    species: 'beaver',
    activeVersion: 'original',
    variants: {
      original: art(
        'bea',
        139,
        122,
        { officeHeight: 102, baseline: 0.047414, anchorX: 0.5, figureTop: 0.051724 },
        [265, 232],
      ),
    },
  },
  {
    employee: 'rizzo',
    species: 'raccoon',
    activeVersion: 'original',
    variants: {
      original: art(
        'rizzo',
        126,
        115,
        { officeHeight: 96, baseline: 0, anchorX: 0.517544, figureTop: 0.043269 },
        [228, 208],
      ),
    },
  },
  {
    employee: 'corvus',
    species: 'crow',
    activeVersion: 'original',
    variants: {
      original: art(
        'corvus',
        124,
        124,
        { officeHeight: 103, baseline: 0, anchorX: 0.5175, figureTop: 0.11 },
        [200, 200],
      ),
    },
  },
  {
    employee: 'junie',
    species: 'rabbit',
    activeVersion: 'original',
    variants: {
      original: art(
        'junie',
        113,
        113,
        { officeHeight: 94, baseline: 0, anchorX: 0.517677, figureTop: 0.025253 },
        [198, 198],
      ),
    },
  },
  {
    employee: 'moss',
    species: 'owl',
    activeVersion: 'original',
    variants: {
      original: art(
        'moss',
        124,
        120,
        { officeHeight: 100, baseline: 0, anchorX: 0.511848, figureTop: 0.078431 },
        [211, 204],
      ),
    },
  },
  {
    employee: 'nino',
    species: 'cat',
    activeVersion: 'original',
    variants: {
      original: art(
        'nino',
        124,
        115,
        { officeHeight: 96, baseline: 0, anchorX: 0.504739, figureTop: 0.040816 },
        [211, 196],
      ),
    },
  },
  {
    employee: 'rosa',
    species: 'flamingo',
    activeVersion: 'original',
    variants: {
      original: art(
        'rosa',
        115,
        115,
        { officeHeight: 96, baseline: 0.037037, anchorX: 0.49537, figureTop: 0 },
        [216, 216],
      ),
    },
  },
  {
    employee: 'axel',
    species: 'axolotl',
    activeVersion: 'original',
    variants: {
      original: art(
        'axel',
        135,
        118,
        { officeHeight: 98, baseline: 0, anchorX: 0.515982, figureTop: 0.057292 },
        [219, 192],
      ),
    },
  },

  // ---------------------------------------------------------------------------
  // 2.0 cast expansion. Thirteen animals that until now rendered as vector
  // critters, imported through the same pipeline as the nine above:
  // scripts/import-character-assets.py (crop -> premultiplied LANCZOS downscale ->
  // full-canvas frames) then scripts/measure-character-figures.py for the figure
  // numbers below. Nothing here is hand-tuned; the measured values live in
  // assets/sources/characters/figure-metrics.json and a test fails on drift.
  // ---------------------------------------------------------------------------
  {
    employee: 'marlow',
    species: 'capybara',
    activeVersion: 'original',
    variants: {
      original: art(
        'marlow',
        129,
        119,
        { officeHeight: 99, baseline: 0.035, anchorX: 0.497696, figureTop: 0.04 },
        [217, 200],
      ),
    },
  },
  {
    employee: 'mina',
    species: 'mole',
    activeVersion: 'original',
    variants: {
      original: art(
        'mina',
        125,
        114,
        { officeHeight: 95, baseline: 0, anchorX: 0.504545, figureTop: 0.03 },
        [220, 200],
      ),
    },
  },
  {
    employee: 'nixie',
    species: 'mouse',
    activeVersion: 'original',
    variants: {
      original: art(
        'nixie',
        124,
        113,
        { officeHeight: 94, baseline: 0, anchorX: 0.511364, figureTop: 0.025 },
        [220, 200],
      ),
    },
  },
  {
    employee: 'otto',
    species: 'otter',
    activeVersion: 'original',
    variants: {
      original: art(
        'otto',
        127,
        115,
        { officeHeight: 96, baseline: 0, anchorX: 0.511312, figureTop: 0.04 },
        [221, 200],
      ),
    },
  },
  {
    employee: 'hazel',
    species: 'hedgehog',
    activeVersion: 'original',
    variants: {
      original: art(
        'hazel',
        120,
        115,
        { officeHeight: 96, baseline: 0, anchorX: 0.514354, figureTop: 0.04 },
        [209, 200],
      ),
    },
  },
  {
    employee: 'fenn',
    species: 'fox',
    activeVersion: 'original',
    variants: {
      original: art(
        'fenn',
        117,
        114,
        { officeHeight: 95, baseline: 0, anchorX: 0.509756, figureTop: 0.035 },
        [205, 200],
      ),
    },
  },
  {
    employee: 'pingo',
    species: 'penguin',
    activeVersion: 'original',
    variants: {
      original: art(
        'pingo',
        152,
        119,
        { officeHeight: 99, baseline: 0.035, anchorX: 0.501953, figureTop: 0.035 },
        [256, 200],
      ),
    },
  },
  {
    employee: 'canela',
    species: 'redpanda',
    activeVersion: 'original',
    variants: {
      original: art(
        'canela',
        120,
        115,
        { officeHeight: 96, baseline: 0, anchorX: 0.502404, figureTop: 0.04 },
        [208, 200],
      ),
    },
  },
  {
    employee: 'quincy',
    species: 'frog',
    activeVersion: 'original',
    variants: {
      original: art(
        'quincy',
        124,
        124,
        { officeHeight: 103, baseline: 0, anchorX: 0.525, figureTop: 0.11 },
        [200, 200],
      ),
    },
  },
  {
    employee: 'dorm',
    species: 'sloth',
    activeVersion: 'original',
    // 344 of the master's 586 frames were byte-identical repeats of a pose it was
    // already holding. The encoder now merges those runs into one longer delay,
    // which is lossless (verified pixel-identical at 5ms resolution across the whole
    // 19.3s loop) and took the sprite from 32.0 MB to 13.2 MB, in line with the cast.
    variants: {
      original: art(
        'dorm',
        116,
        114,
        { officeHeight: 95, baseline: 0, anchorX: 0.517241, figureTop: 0.03 },
        [203, 200],
      ),
    },
  },
  {
    employee: 'inky',
    species: 'octopus',
    activeVersion: 'original',
    variants: {
      original: art(
        'inky',
        126,
        126,
        { officeHeight: 105, baseline: 0, anchorX: 0.51, figureTop: 0.12 },
        [200, 200],
      ),
    },
  },
  {
    employee: 'echo',
    species: 'bat',
    activeVersion: 'original',
    variants: {
      original: art(
        'echo',
        114,
        114,
        { officeHeight: 95, baseline: 0, anchorX: 0.51, figureTop: 0.03 },
        [200, 200],
      ),
    },
  },
  {
    employee: 'perry',
    species: 'platypus',
    activeVersion: 'original',
    variants: {
      original: art(
        'perry',
        121,
        114,
        { officeHeight: 95, baseline: 0, anchorX: 0.504717, figureTop: 0.035 },
        [212, 200],
      ),
    },
  },

  // ---------------------------------------------------------------------------
  // The bear completes the cast: 23 of 23 animals now render photographic artwork
  // and nobody is left on the vector fallback.
  //
  // This entry existed for a long time as a comment explaining why it did NOT
  // exist — the master had not been authored, and inventing bear art or reusing
  // another animal's APNG would have been visibly wrong against a photographic
  // cast. URSO.png has now landed, so the placeholder reasoning is gone and the
  // bear went through exactly the same pipeline as the twenty-two before it. No
  // hand-tuned numbers: the figure block below is measured by
  // scripts/measure-character-figures.py and re-checked by a test.
  //
  // The master carried the same collapsed-alpha defect that produced Pip's halo
  // shimmer (8 of 134 frames deviating ~8.9/255 against a 0.07/255 median). It was
  // caught by the importer's repair pass rather than by hand — 5 frames rebuilt
  // from their nearest healthy neighbours — which is the whole reason that repair
  // was moved into the pipeline.
  // ---------------------------------------------------------------------------
  {
    employee: 'bia',
    species: 'bear',
    activeVersion: 'original',
    variants: {
      original: art(
        'bia',
        120,
        120,
        { officeHeight: 100, baseline: 0, anchorX: 0.5175, figureTop: 0.08 },
        [200, 200],
      ),
    },
  },
];

export const CHARACTER_ART_BY_EMPLOYEE: Record<string, CharacterArtEntry> = Object.fromEntries(
  CHARACTER_ART.map((entry) => [entry.employee, entry]),
);

/**
 * Development override for the whole roster, e.g. to preview an enhanced pass or
 * fall back after a bad art drop:
 *
 *   localStorage.setItem('wmno.characterArt', 'legacy')
 *
 * Not a player setting. Falls back per character when a variant is absent, so a
 * partially-complete art pass still renders.
 */
export const CHARACTER_ART_OVERRIDE_KEY = 'wmno.characterArt';

function overrideVersion(): CharacterArtVersion | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHARACTER_ART_OVERRIDE_KEY);
    return raw === 'original' || raw === 'enhanced' || raw === 'legacy' ? raw : null;
  } catch {
    return null; // storage can be denied; the default is always fine
  }
}

/**
 * The art an employee should render, honouring the dev override and degrading to
 * the entry's own active version when the requested variant does not exist.
 */
export function characterArt(employee: string): CharacterArtFiles | undefined {
  const entry = CHARACTER_ART_BY_EMPLOYEE[employee];
  if (!entry) return undefined;
  const requested = overrideVersion();
  return (
    (requested ? entry.variants[requested] : undefined) ??
    entry.variants[entry.activeVersion] ??
    entry.variants.original
  );
}

/** Which version an employee is actually rendering, for diagnostics. */
export function activeArtVersion(employee: string): CharacterArtVersion | undefined {
  const entry = CHARACTER_ART_BY_EMPLOYEE[employee];
  if (!entry) return undefined;
  const requested = overrideVersion();
  if (requested && entry.variants[requested]) return requested;
  return entry.variants[entry.activeVersion] ? entry.activeVersion : 'original';
}
