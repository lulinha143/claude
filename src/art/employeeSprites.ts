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

import { isSpriteUnavailable } from './spriteAvailability';
import { presenceSize } from '../content/characterScale';

export interface EmployeeSpriteConfig {
  /** Animated APNG (autoplay + infinite loop), path relative to BASE_URL. This
   * is the @2x asset (twice the slot size); see `src1x`. */
  src: string;
  /**
   * Optional @1x variant of `src` (exactly the slot's CSS-pixel size). When
   * present the renderer emits `srcset` so the browser picks @1x on a DPR-1
   * display and @2x on DPR-2 — the frame then renders 1:1 at either ratio, so
   * the GPU never does a fractional per-frame downscale (which shimmers the
   * soft semi-transparent halo). frameWidth/frameHeight are the @1x dimensions.
   */
  src1x?: string;
  /**
   * TEMPORARY (halo-isolation diagnostic): a halo-stripped variant of the
   * animation — identical size / timing / motion but with hard (binary) alpha,
   * i.e. ZERO semi-transparent pixels. Toggled in-game with Ctrl+Alt+H (see
   * `haloTest.ts`) to prove whether the soft halo pixels are the source of the
   * real-GPU shimmer. Remove once the investigation concludes.
   */
  srcNoHalo?: string;
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

// The presence scale is authored data shared with the framework-free layout
// layer, so it lives in `content/`. Re-exported here because this module is the
// natural place renderers look for character sizing.
export { CHARACTER_PRESENCE_SCALE, presenceSize } from '../content/characterScale';

/**
 * Build a sprite config from its AUTHORED (pre-presence-scale) rendered heights.
 * Keeping the authored numbers in the table means the artwork-derived tuning
 * above stays readable and the presence pass remains a single reversible knob.
 */
function sprite(
  config: Omit<EmployeeSpriteConfig, 'officeHeight' | 'cardHeight'> & {
    officeHeight: number;
    cardHeight: number;
  },
): EmployeeSpriteConfig {
  return {
    ...config,
    officeHeight: presenceSize(config.officeHeight),
    cardHeight: presenceSize(config.cardHeight),
  };
}

export const EMPLOYEE_SPRITES: Record<string, EmployeeSpriteConfig> = {
  // Bea — Beaver, Construction. Refreshed workstation art (overalls, bonsai,
  // toolbox). Sized to the shared ~115px desk width.
  bea: sprite({
    src: 'employees/bea.png',
    poster: 'employees/bea-poster.png',
    frameWidth: 335,
    frameHeight: 300,
    officeHeight: 116,
    cardHeight: 164,
    anchorX: 0.5,
    baseline: 0,
  }),
  // Pip — Squirrel, Founder. FINAL animated workstation art (bespectacled
  // squirrel typing at a wooden desk: laptop, cocoa, pencil cup, books, sticky
  // notes, cactus). Source is a 960x960 / 242-frame / 30fps APNG; all frames +
  // timing are kept and it loops forever (full-frame encode, premultiplied
  // LANCZOS downscale — crisp, no edge halos). The desk footprint is centred and
  // the art carries its own soft grounded shadow (baseline 0).
  //
  // HALO SHIMMER — the cause was IN THE ARTWORK, not the renderer. 8 of the 242
  // frames (13, 67, 87, 94, 157, 158, 161, 210) had their semi-transparent alpha
  // collapsed ~52%, so the soft halo deflated for a single frame roughly once a
  // second while the near-opaque body barely moved — exactly the reported
  // symptom. Between healthy frames the mean alpha changes by only ~0.4/255, so
  // the dropouts stood out at ~24/255. Repaired in place by substituting the
  // nearest healthy frame (healthy frames left bit-identical, timing and loop
  // preserved); see docs/CHARACTER_SPRITES.md. `npm run verify:assets` now fails
  // if any character APNG regains this defect.
  //
  // The @1x/@2x pair below is kept only as a resolution hint so the frame maps
  // 1:1 to device pixels at integer DPR. It is NOT a shimmer fix, and it cannot
  // affect geometry: EmployeeSprite always sets the <img>'s CSS width AND height
  // from frameWidth/frameHeight, which are the @1x dimensions.
  pip: sprite({
    src: 'employees/pip.png', // @2x (206x186)
    src1x: 'employees/pip-1x.png', // @1x (103x93) — exact slot size
    srcNoHalo: '_diag/pip-nohalo.png', // TEMP halo-isolation A/B (Ctrl+Alt+H)
    poster: 'employees/pip-poster.png',
    frameWidth: 103,
    frameHeight: 93,
    officeHeight: 93,
    cardHeight: 133,
    anchorX: 0.5,
    baseline: 0,
  }),
  // Marlow — Capybara slot, refreshed test workstation art (all frames kept,
  // single premultiplied downscale to ~180px for sharp, stable animation).
  // Reduced ~20% from the previous rendered desk width.
  marlow: sprite({
    src: 'employees/marlow.png',
    poster: 'employees/marlow-poster.png',
    frameWidth: 216,
    frameHeight: 180,
    officeHeight: 83,
    cardHeight: 119,
    anchorX: 0.5,
    baseline: 0,
  }),
  // Pingo — Penguin, Logistics. Refreshed workstation art (cocoa, snow globe,
  // fan). Sized to the shared ~115px desk width.
  pingo: sprite({
    src: 'employees/penguin.png',
    poster: 'employees/penguin-poster.png',
    frameWidth: 356,
    frameHeight: 300,
    officeHeight: 105,
    cardHeight: 149,
    anchorX: 0.5,
    baseline: 0,
  }),
  // Canela — Red Panda, Research/Naturalist. Desk lamp, "OBSERVATIONS" pad.
  // Raised ~20%, then a further ~20% (81->97 / 117->140).
  canela: sprite({
    src: 'employees/canela.png',
    poster: 'employees/canela-poster.png',
    frameWidth: 374,
    frameHeight: 300,
    officeHeight: 97,
    cardHeight: 140,
    anchorX: 0.5,
    baseline: 0,
  }),
};

/**
 * The sprite to render for an employee, or `undefined` when they should fall back
 * to the code-drawn `Critter` SVG.
 *
 * A registered sprite whose artwork failed to load counts as unavailable, so a
 * missing asset degrades to the hand-drawn silhouette instead of leaving a broken
 * image standing at the workstation.
 */
export function employeeSprite(id: string): EmployeeSpriteConfig | undefined {
  const config = EMPLOYEE_SPRITES[id];
  if (!config) return undefined;
  return isSpriteUnavailable(config.src) ? undefined : config;
}

export function hasEmployeeSprite(id: string): boolean {
  return id in EMPLOYEE_SPRITES;
}
