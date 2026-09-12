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
import { CHARACTER_ART, characterArt, type CharacterArtFiles } from './characterAssets';

// The presence scale is authored data shared with the framework-free layout layer,
// so it lives in `content/`. Re-exported here because this module is where
// renderers look for character sizing.
export {
  CHARACTER_PRESENCE_SCALE,
  presenceSize,
  VECTOR_CRITTER_OFFICE_SIZE,
  VECTOR_CRITTER_CARD_SIZE,
} from '../content/characterScale';

export interface EmployeeSpriteConfig {
  /** Animated APNG (autoplay + infinite loop), path relative to BASE_URL. This
   * is the @2x asset (twice the slot size); see `src1x`. */
  src: string;
  /**
   * Optional @1x variant of `src`, encoded at EXACTLY the rendered CSS size. When
   * present the renderer emits `srcset` so a DPR-1 display gets this file and maps
   * it 1:1 to device pixels — no resample at all, which is both the sharpest a
   * bitmap can be and the case that never risks shimmering the soft
   * semi-transparent halo. frameWidth/frameHeight are the @1x dimensions.
   */
  src1x?: string;
  /** Real pixel width of the @2x animation. */
  srcWidth: number;
  /**
   * Real pixel height of the @2x animation. Divided by `frameHeight` this is that
   * file's TRUE srcSet density (~1.6-1.9x, not 2x — see characterAssets.ts).
   */
  srcHeight: number;
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
  /** Dead transparent margin above the animal, as a fraction of canvas height. */
  figureTop: number;
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

// Sprite configs are DERIVED from the versioned character-art registry
// (`characterAssets.ts`) rather than hand-authored here. That registry is the one
// place an animal's art build is chosen, so a rollback or an enhanced pass is a
// single-line change there and cannot drift out of sync with this table.
//
// The presence multiplier is applied to the RENDERED heights only. `frameWidth` /
// `frameHeight` stay at the artwork's intrinsic @1x values because they are the
// aspect-ratio source `EmployeeSprite` derives width from — the property that
// keeps a character from being squashed by the global `img { max-width: 100% }`
// guard. Scaling those would break the geometry contract.
function configFor(files: CharacterArtFiles): EmployeeSpriteConfig {
  return {
    src: files.src,
    src1x: files.src1x,
    srcNoHalo: files.srcNoHalo,
    poster: files.poster,
    frameWidth: files.frameWidth,
    frameHeight: files.frameHeight,
    srcWidth: files.srcWidth,
    srcHeight: files.srcHeight,
    officeHeight: presenceSize(files.officeHeight),
    cardHeight: presenceSize(files.cardHeight),
    anchorX: files.anchorX,
    baseline: files.baseline,
    figureTop: files.figureTop,
  };
}

export const EMPLOYEE_SPRITES: Record<string, EmployeeSpriteConfig> = Object.fromEntries(
  CHARACTER_ART.map((entry) => {
    const files = entry.variants[entry.activeVersion] ?? entry.variants.original;
    if (!files) throw new Error(`character art for "${entry.employee}" has no usable variant`);
    return [entry.employee, configFor(files)];
  }),
);

export function employeeSprite(id: string): EmployeeSpriteConfig | undefined {
  // Resolved through the registry so a development art override takes effect
  // everywhere at once.
  const files = characterArt(id);
  if (!files) return undefined;
  if (isSpriteUnavailable(files.src)) return undefined;
  return configFor(files);
}

export function hasEmployeeSprite(id: string): boolean {
  return id in EMPLOYEE_SPRITES;
}
