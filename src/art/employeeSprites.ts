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
//
// Follow-up presence pass: Marlow, Pingo and Canela raised a further ~20% so
// they read as more present at their workstations, re-checked side-by-side in
// the office so they stay harmonious and never dominate the room.
export const EMPLOYEE_SPRITES: Record<string, EmployeeSpriteConfig> = {
  // Bea — Beaver, Construction. Refreshed workstation art (overalls, bonsai,
  // toolbox). Sized to the shared ~115px desk width.
  bea: {
    src: 'employees/bea.png',
    poster: 'employees/bea-poster.png',
    frameWidth: 335,
    frameHeight: 300,
    officeHeight: 116,
    cardHeight: 164,
    anchorX: 0.5,
    baseline: 0,
  },
  // Pip — Squirrel, Founder. FINAL animated workstation art (bespectacled
  // squirrel typing at a wooden desk: laptop, cocoa, pencil cup, books,
  // sticky notes, cactus). Source is a 960x960 / 242-frame / 30fps APNG; all
  // frames + timing are kept and it loops forever. A single premultiplied
  // LANCZOS downscale to 248x223 keeps it crisp with no edge halos or shimmer.
  // The frame is padded so the desk footprint is horizontally centred, and the
  // art carries its own soft grounded shadow (baseline 0). officeHeight is set
  // so the rendered DESK reads at ~92px — matching the previous Pip exactly so
  // he stays coherent with the other workstations.
  //
  // IMPORTANT (pip.png encoding): every APNG frame is stored as a FULL 248x223
  // canvas (dispose=NONE, blend=SOURCE) — do NOT re-encode with the usual
  // inter-frame sub-rectangle ("bbox diff") optimisation. Because the office
  // scales the sprite down, an oscillating dirty-rect leaves the soft halo/blur
  // alternately inside/outside the updated region, and Chromium/Electron's GPU
  // compositor resamples that moving boundary inconsistently → the halo flickers
  // frame to frame. Full frames give the compositor one stable rect to scale, so
  // the halo stays rock-steady. (Same decoded pixels either way; ~same size.)
  pip: {
    src: 'employees/pip.png',
    poster: 'employees/pip-poster.png',
    frameWidth: 248,
    frameHeight: 223,
    officeHeight: 93,
    cardHeight: 133,
    anchorX: 0.5,
    baseline: 0,
  },
  // Marlow — Capybara slot, refreshed test workstation art (all frames kept,
  // single premultiplied downscale to ~180px for sharp, stable animation).
  // Reduced ~20% from the previous rendered desk width.
  marlow: {
    src: 'employees/marlow.png',
    poster: 'employees/marlow-poster.png',
    frameWidth: 216,
    frameHeight: 180,
    officeHeight: 83,
    cardHeight: 119,
    anchorX: 0.5,
    baseline: 0,
  },
  // Pingo — Penguin, Logistics. Refreshed workstation art (cocoa, snow globe,
  // fan). Sized to the shared ~115px desk width.
  pingo: {
    src: 'employees/penguin.png',
    poster: 'employees/penguin-poster.png',
    frameWidth: 356,
    frameHeight: 300,
    officeHeight: 105,
    cardHeight: 149,
    anchorX: 0.5,
    baseline: 0,
  },
  // Canela — Red Panda, Research/Naturalist. Desk lamp, "OBSERVATIONS" pad.
  // Raised ~20%, then a further ~20% (81->97 / 117->140).
  canela: {
    src: 'employees/canela.png',
    poster: 'employees/canela-poster.png',
    frameWidth: 374,
    frameHeight: 300,
    officeHeight: 97,
    cardHeight: 140,
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
