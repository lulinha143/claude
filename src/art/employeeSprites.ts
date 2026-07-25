// Per-employee FINAL animated artwork ("workstation sprites").
//
// This is the reusable pipeline for assigning a unique animated asset to each
// animal. Each entry points at an optimized, looping APNG (served verbatim from
// `public/` via BASE_URL, exactly like the office background) plus a matching
// static poster frame used when the player prefers reduced motion.
//
// The renderer (see `EmployeeSprite`) prefers a sprite when one is registered
// for an employee id and otherwise falls back to the code-drawn `Critter` SVG,
// so animals without final art keep their placeholder silhouette. Adding a new
// animal's art is purely additive: drop the files in `public/employees/` and
// register a config here — no per-employee code anywhere else.

export interface EmployeeSpriteConfig {
  /** Animated APNG (autoplay + infinite loop), path relative to BASE_URL. */
  src: string;
  /** Static frame shown when the player enables reduced motion. */
  poster: string;
  /** Intrinsic frame dimensions of the source art (drives the aspect ratio). */
  frameWidth: number;
  frameHeight: number;
  /**
   * Rendered height (px, before `--asset-scale`) inside the office diorama.
   * Tuned so the character's body reads at the same scale as the SVG critters
   * while the surrounding workstation furniture extends naturally around it.
   */
  officeHeight: number;
  /** Rendered height (px) inside the employee roster card portrait. */
  cardHeight: number;
  /**
   * Fraction of the sprite width (0..1) that lines up with the character's
   * visual centre. The office anchors sprites by this point so a teammate
   * stands exactly on their floor slot even when the art is padded off-centre.
   */
  anchorX: number;
  /**
   * Fraction of the sprite height (0..1, measured from the bottom edge) where
   * the character's contact/floor line sits. Lets us compensate for any
   * transparent padding baked into the art via configuration rather than
   * ad-hoc CSS offsets. 0 = contact is exactly at the bottom edge.
   */
  baseline: number;
}

// Scale normalization: every final workstation sprite is a "seated animal at a
// desk (with chair)" composition. Each is sized so its DESK reads at a shared
// apparent width, derived from the asset's measured desk pixels so the desks
// line up regardless of how much the animal, chair or props extend above. All
// assets are pre-trimmed to their content, centred (anchorX 0.5) and rest on
// the bottom edge (baseline 0).
//
// Scale refinement pass: Bea (beaver) was raised ~15% and Marlow (capybara),
// Pingo (penguin) and Canela (red panda) ~20% over their previous rendered
// size, then eyeballed together in-office for harmony. Pip (squirrel) is
// intentionally left untouched from the previous pass.
export const EMPLOYEE_SPRITES: Record<string, EmployeeSpriteConfig> = {
  // Bea — Beaver, Construction. Reference desk, raised ~15% (70->80 / 101->116).
  bea: {
    src: 'employees/bea.png',
    poster: 'employees/bea-poster.png',
    frameWidth: 384,
    frameHeight: 336,
    officeHeight: 80,
    cardHeight: 116,
    anchorX: 0.5,
    baseline: 0,
  },
  // Pip — Squirrel, Founder. Reading glasses, acorns, laptop; bushy tail rises
  // above the desk so the frame is nearly square. (Unchanged this pass.)
  pip: {
    src: 'employees/pip.png',
    poster: 'employees/pip-poster.png',
    frameWidth: 320,
    frameHeight: 300,
    officeHeight: 73,
    cardHeight: 105,
    anchorX: 0.5,
    baseline: 0,
  },
  // Marlow — Capybara, Morale/HR. Teal chair, scarf, calm desk. Raised ~20%.
  marlow: {
    src: 'employees/marlow.png',
    poster: 'employees/marlow-poster.png',
    frameWidth: 366,
    frameHeight: 300,
    officeHeight: 79,
    cardHeight: 114,
    anchorX: 0.5,
    baseline: 0,
  },
  // Pingo — Penguin, Logistics. Purple chair, scarf, "LOGISTICS / DATA / NAP".
  // Raised ~20%.
  pingo: {
    src: 'employees/penguin.png',
    poster: 'employees/penguin-poster.png',
    frameWidth: 371,
    frameHeight: 300,
    officeHeight: 82,
    cardHeight: 118,
    anchorX: 0.5,
    baseline: 0,
  },
  // Canela — Red Panda, Research/Naturalist. Desk lamp, "OBSERVATIONS" pad.
  // Raised ~20%.
  canela: {
    src: 'employees/canela.png',
    poster: 'employees/canela-poster.png',
    frameWidth: 374,
    frameHeight: 300,
    officeHeight: 81,
    cardHeight: 117,
    anchorX: 0.5,
    baseline: 0,
  },
};

export function employeeSprite(id: string): EmployeeSpriteConfig | undefined {
  return EMPLOYEE_SPRITES[id];
}

export function hasEmployeeSprite(id: string): boolean {
  return id in EMPLOYEE_SPRITES;
}
