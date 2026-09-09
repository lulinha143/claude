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

/** Shorthand for a straightforward @2x + @1x + poster set. */
function art(
  asset: string,
  frameWidth: number,
  frameHeight: number,
  extra: Partial<CharacterArtFiles> = {},
): CharacterArtFiles {
  return {
    src: `employees/${asset}.png`,
    src1x: `employees/${asset}-1x.png`,
    poster: `employees/${asset}-poster.png`,
    frameWidth,
    frameHeight,
    // The importer encodes @1x at the authored office height, so they are equal.
    officeHeight: frameHeight,
    cardHeight: card(frameHeight),
    anchorX: 0.5,
    baseline: 0,
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
      original: art('pip', 103, 93, {
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
    variants: { original: art('bea', 132, 116) },
  },
  {
    employee: 'rizzo',
    species: 'raccoon',
    activeVersion: 'original',
    variants: { original: art('rizzo', 114, 104) },
  },
  {
    employee: 'corvus',
    species: 'crow',
    activeVersion: 'original',
    variants: { original: art('corvus', 100, 100) },
  },
  {
    employee: 'junie',
    species: 'rabbit',
    activeVersion: 'original',
    variants: { original: art('junie', 99, 99) },
  },
  {
    employee: 'moss',
    species: 'owl',
    activeVersion: 'original',
    variants: { original: art('moss', 105, 102) },
  },
  {
    employee: 'nino',
    species: 'cat',
    activeVersion: 'original',
    variants: { original: art('nino', 105, 98) },
  },
  {
    employee: 'rosa',
    species: 'flamingo',
    activeVersion: 'original',
    variants: { original: art('rosa', 108, 108) },
  },
  {
    employee: 'axel',
    species: 'axolotl',
    activeVersion: 'original',
    variants: { original: art('axel', 109, 96) },
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
