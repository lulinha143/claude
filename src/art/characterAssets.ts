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
  /** @1x frame height — the aspect-ratio denominator. */
  frameHeight: number;
  /**
   * Rendered height in the office diorama, in CSS px, BEFORE the global presence
   * multiplier. Encoded to equal `frameHeight` so @1x maps 1:1 to CSS pixels.
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

/** Shorthand for a straightforward @2x + @1x + poster set. */
function art(
  asset: string,
  frameWidth: number,
  frameHeight: number,
  figure: FigureNorm,
  extra: Partial<CharacterArtFiles> = {},
): CharacterArtFiles {
  return {
    src: `employees/${asset}.png`,
    src1x: `employees/${asset}-1x.png`,
    poster: `employees/${asset}-poster.png`,
    frameWidth,
    frameHeight,
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
      original: art('pip', 103, 93, { officeHeight: 93, baseline: 0, anchorX: 0.524272, figureTop: 0.010753 }, {
        srcNoHalo: '_diag/pip-nohalo.png',
        note:
          'Repaired build. 8 of the 242 master frames had their semi-transparent alpha ' +
          'collapsed ~52%, deflating the halo for one frame about once a second. Those ' +
          'frames were replaced with their nearest healthy neighbours, preserving timing, ' +
          'dimensions, loop and artwork. Measured alpha peak-to-peak 2.10 here versus ' +
          '16.95 in the raw master, so re-importing the master would reintroduce the bug. ' +
          'Guarded by npm run verify:assets.',
      }),
    },
  },
  {
    employee: 'bea',
    species: 'beaver',
    activeVersion: 'original',
    variants: { original: art('bea', 132, 116, { officeHeight: 103, baseline: 0.051724, anchorX: 0.5, figureTop: 0.051724 }) },
  },
  {
    employee: 'rizzo',
    species: 'raccoon',
    activeVersion: 'original',
    variants: { original: art('rizzo', 114, 104, { officeHeight: 96, baseline: 0.0, anchorX: 0.517544, figureTop: 0.038462 }) },
  },
  {
    employee: 'corvus',
    species: 'crow',
    activeVersion: 'original',
    variants: { original: art('corvus', 100, 100, { officeHeight: 103, baseline: 0.0, anchorX: 0.515, figureTop: 0.11 }) },
  },
  {
    employee: 'junie',
    species: 'rabbit',
    activeVersion: 'original',
    variants: { original: art('junie', 99, 99, { officeHeight: 94, baseline: 0.0, anchorX: 0.520202, figureTop: 0.020202 }) },
  },
  {
    employee: 'moss',
    species: 'owl',
    activeVersion: 'original',
    variants: { original: art('moss', 105, 102, { officeHeight: 100, baseline: 0.0, anchorX: 0.514286, figureTop: 0.078431 }) },
  },
  {
    employee: 'nino',
    species: 'cat',
    activeVersion: 'original',
    variants: { original: art('nino', 105, 98, { officeHeight: 96, baseline: 0.0, anchorX: 0.504762, figureTop: 0.040816 }) },
  },
  {
    employee: 'rosa',
    species: 'flamingo',
    activeVersion: 'original',
    variants: { original: art('rosa', 108, 108, { officeHeight: 96, baseline: 0.037037, anchorX: 0.5, figureTop: 0.0 }) },
  },
  {
    employee: 'axel',
    species: 'axolotl',
    activeVersion: 'original',
    variants: { original: art('axel', 109, 96, { officeHeight: 98, baseline: 0.0, anchorX: 0.513761, figureTop: 0.0625 }) },
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
    variants: { original: art('marlow', 108, 100, { officeHeight: 100, baseline: 0.04, anchorX: 0.49537, figureTop: 0.04 }) },
  },
  {
    employee: 'mina',
    species: 'mole',
    activeVersion: 'original',
    variants: { original: art('mina', 110, 100, { officeHeight: 95, baseline: 0, anchorX: 0.504545, figureTop: 0.03 }) },
  },
  {
    employee: 'nixie',
    species: 'mouse',
    activeVersion: 'original',
    variants: { original: art('nixie', 110, 100, { officeHeight: 94, baseline: 0, anchorX: 0.513636, figureTop: 0.02 }) },
  },
  {
    employee: 'otto',
    species: 'otter',
    activeVersion: 'original',
    variants: { original: art('otto', 111, 100, { officeHeight: 96, baseline: 0, anchorX: 0.509009, figureTop: 0.04 }) },
  },
  {
    employee: 'hazel',
    species: 'hedgehog',
    activeVersion: 'original',
    variants: { original: art('hazel', 104, 100, { officeHeight: 96, baseline: 0, anchorX: 0.514423, figureTop: 0.04 }) },
  },
  {
    employee: 'fenn',
    species: 'fox',
    activeVersion: 'original',
    variants: { original: art('fenn', 103, 100, { officeHeight: 95, baseline: 0, anchorX: 0.509709, figureTop: 0.03 }) },
  },
  {
    employee: 'pingo',
    species: 'penguin',
    activeVersion: 'original',
    variants: { original: art('pingo', 128, 100, { officeHeight: 99, baseline: 0.04, anchorX: 0.5, figureTop: 0.03 }) },
  },
  {
    employee: 'canela',
    species: 'redpanda',
    activeVersion: 'original',
    variants: { original: art('canela', 104, 100, { officeHeight: 96, baseline: 0, anchorX: 0.504808, figureTop: 0.04 }) },
  },
  {
    employee: 'quincy',
    species: 'frog',
    activeVersion: 'original',
    variants: { original: art('quincy', 100, 100, { officeHeight: 103, baseline: 0, anchorX: 0.525, figureTop: 0.11 }) },
  },
  {
    employee: 'dorm',
    species: 'sloth',
    activeVersion: 'original',
    // 344 of the master's 586 frames were byte-identical repeats of a pose it was
    // already holding. The encoder now merges those runs into one longer delay,
    // which is lossless (verified pixel-identical at 5ms resolution across the whole
    // 19.3s loop) and took the sprite from 32.0 MB to 13.2 MB, in line with the cast.
    variants: { original: art('dorm', 101, 100, { officeHeight: 95, baseline: 0, anchorX: 0.514851, figureTop: 0.03 }) },
  },
  {
    employee: 'inky',
    species: 'octopus',
    activeVersion: 'original',
    variants: { original: art('inky', 100, 100, { officeHeight: 105, baseline: 0, anchorX: 0.51, figureTop: 0.12 }) },
  },
  {
    employee: 'echo',
    species: 'bat',
    activeVersion: 'original',
    variants: { original: art('echo', 100, 100, { officeHeight: 95, baseline: 0, anchorX: 0.51, figureTop: 0.03 }) },
  },
  {
    employee: 'perry',
    species: 'platypus',
    activeVersion: 'original',
    variants: { original: art('perry', 106, 100, { officeHeight: 95, baseline: 0, anchorX: 0.504717, figureTop: 0.03 }) },
  },

  // NOT REGISTERED, DELIBERATELY: 'bia' (bear).
  //
  // The bear master has not been authored yet. There is no entry here because the
  // absence is the correct behaviour: an employee with no registered art renders as
  // the vector Critter, which is a complete, shipping fallback rather than a hole.
  // Do NOT satisfy this by generating placeholder bear art, reusing another animal's
  // APNG, or approximating one -- the cast is photographic and a substitute would be
  // visibly wrong. assets/sources/characters/manifest.json carries the pending entry
  // with the exact steps to finish it once URSO.png exists.
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
