import { DECORATIONS } from './decorations';
import { REGION_KIND_SURFACE, type PlacementAnchorMode } from '../sim/placementRegions';
import { DECORATIONS_BY_ID } from './decorations';

// Per-decoration placement specification.
// -----------------------------------------------------------------------------
// Every decoration declares INTENTIONAL placement metadata here instead of being
// classified by filename regex or a coarse "large item" set. This is the single
// source of truth for a decoration's physical footprint, where it visually
// contacts its support (baseline), how it anchors, how big it renders, and the
// clearances/permissions the placement system respects.
//
// What consumes each field today:
//   footprint  → preview geometry, pointer hit-testing, collision (placement.ts)
//   scale      → sprite render size (DecorationProp → DecoArt), placed + ghost
//   mirrorable → deterministic horizontal flip of the sprite for variety
//   anchor     → surface projection / contact-line CSS class (per surface)
//   baseline / minClearance / allowSceneryOverlap → authored intent consulted
//     where the surface model already encodes it (per-surface contact line,
//     region inset, rug scenery pass-through); kept explicit per item so the
//     placement system can tighten to them without re-deriving from filenames.
//
// Coordinate conventions (normalized to the room stage):
//   footprint.width/height  — fraction of room width / stage height the upright
//                             sprite occupies (its bounding box).
//   baseline                — fraction of the sprite's own height (0 = top,
//                             1 = bottom) that must sit ON the support point.
//                             Standing props contact near their feet (~0.94),
//                             hung/ceiling props near their top (~0.08), wall
//                             pieces at their centre (0.5), flat rugs at the
//                             centre of their ellipse (~0.82).
//   anchor                  — how the support point maps to the sprite: 'base'
//                             (stands on it), 'center' (mounted around it),
//                             'hanging' (drops from it).

export interface DecorationPlacementSpec {
  /** Normalized upright bounding box. */
  footprint: { width: number; height: number };
  /** How the support point maps to the sprite. */
  anchor: PlacementAnchorMode;
  /** Fraction of sprite height (0=top,1=bottom) that rests on the support. */
  baseline: number;
  /** Visual scale multiplier applied to the sprite (1 = catalogue default). */
  scale: number;
  /** Minimum normalized clearance to keep from the support region's edges. */
  minClearance: number;
  /** May sit over built-in scenery/fixtures (flat pieces like rugs). */
  allowSceneryOverlap: boolean;
  /** Whether the sprite may be horizontally mirrored for variety. */
  mirrorable: boolean;
}

// Baseline defaults per anchor mode; individual items may override.
const BASELINE: Record<PlacementAnchorMode, number> = {
  base: 0.94,
  center: 0.5,
  hanging: 0.08,
};

type SpecInput = {
  w: number;
  h: number;
  anchor: PlacementAnchorMode;
  baseline?: number;
  scale?: number;
  clearance?: number;
  sceneryOverlap?: boolean;
  mirror?: boolean;
};

function spec(input: SpecInput): DecorationPlacementSpec {
  return {
    footprint: { width: input.w, height: input.h },
    anchor: input.anchor,
    baseline: input.baseline ?? BASELINE[input.anchor],
    scale: input.scale ?? 1,
    minClearance: input.clearance ?? 0.02,
    allowSceneryOverlap: input.sceneryOverlap ?? false,
    mirrorable: input.mirror ?? false,
  };
}

// Explicit, hand-authored spec for every catalogue decoration. Footprints are
// tuned to how the redrawn pixel-art sprite actually reads on the stage.
export const DECORATION_PLACEMENT: Record<string, DecorationPlacementSpec> = {
  // Founder's Desk
  'potted-fern': spec({ w: 0.11, h: 0.18, anchor: 'base', mirror: true }),
  'desk-lamp': spec({ w: 0.08, h: 0.13, anchor: 'base', scale: 0.92, mirror: true }),
  'motivational-poster': spec({ w: 0.13, h: 0.16, anchor: 'center' }),
  'tiny-rug': spec({ w: 0.42, h: 0.06, anchor: 'base', baseline: 0.82, sceneryOverlap: true }),
  'window-view': spec({ w: 0.24, h: 0.2, anchor: 'center', scale: 1.1 }),
  // Sorting
  'sorting-bins': spec({ w: 0.16, h: 0.16, anchor: 'base', mirror: true }),
  'conveyor-plushie': spec({ w: 0.09, h: 0.11, anchor: 'base', scale: 0.85, mirror: true }),
  'label-maker': spec({ w: 0.07, h: 0.09, anchor: 'base', scale: 0.8, mirror: true }),
  // Coffee & Morale
  'beanbag-chairs': spec({ w: 0.22, h: 0.14, anchor: 'base', clearance: 0.03, mirror: true }),
  'snack-bar': spec({ w: 0.22, h: 0.2, anchor: 'base', clearance: 0.03 }),
  aquarium: spec({ w: 0.18, h: 0.16, anchor: 'base', clearance: 0.03 }),
  'mood-lighting': spec({ w: 0.16, h: 0.13, anchor: 'center' }),
  // Procurement / Finance
  'filing-cabinet': spec({ w: 0.13, h: 0.22, anchor: 'base' }),
  safe: spec({ w: 0.16, h: 0.18, anchor: 'base', clearance: 0.03 }),
  'security-cam': spec({ w: 0.08, h: 0.08, anchor: 'center', scale: 0.8, mirror: true }),
  // Construction
  'wooden-arch': spec({ w: 0.28, h: 0.24, anchor: 'center', scale: 1.15, clearance: 0.03 }),
  'blueprint-wall': spec({ w: 0.24, h: 0.2, anchor: 'center' }),
  'sawdust-pile': spec({ w: 0.16, h: 0.08, anchor: 'base', scale: 0.9, mirror: true }),
  // Lab
  'bubbling-beakers': spec({ w: 0.1, h: 0.12, anchor: 'base', scale: 0.9, mirror: true }),
  hologram: spec({ w: 0.16, h: 0.16, anchor: 'hanging' }),
  'lab-plants': spec({ w: 0.11, h: 0.16, anchor: 'base', mirror: true }),
  // Marketing
  billboard: spec({ w: 0.3, h: 0.22, anchor: 'center', scale: 1.15, clearance: 0.03 }),
  'neon-sign': spec({ w: 0.2, h: 0.12, anchor: 'center' }),
  'trophy-shelf': spec({ w: 0.18, h: 0.14, anchor: 'center' }),
  // Vault
  'gold-carpet': spec({ w: 0.42, h: 0.06, anchor: 'base', baseline: 0.82, sceneryOverlap: true }),
  'nut-statue': spec({ w: 0.14, h: 0.24, anchor: 'base', scale: 1.1, clearance: 0.03 }),
  chandelier: spec({ w: 0.2, h: 0.16, anchor: 'hanging' }),
  // Meeting
  'meeting-plant': spec({ w: 0.12, h: 0.18, anchor: 'base', mirror: true }),
  projector: spec({ w: 0.12, h: 0.1, anchor: 'base', scale: 0.9 }),
  // Nap
  hammock: spec({ w: 0.28, h: 0.14, anchor: 'base', baseline: 0.9, clearance: 0.03, mirror: true }),
  'star-ceiling': spec({ w: 0.34, h: 0.1, anchor: 'hanging', baseline: 0.12 }),
  // Rooftop
  'rooftop-garden-bed': spec({ w: 0.3, h: 0.12, anchor: 'base', baseline: 0.9, clearance: 0.03 }),
};

/** A safe fallback derived from the decoration's default region kind. */
function fallbackSpec(id: string): DecorationPlacementSpec {
  const def = DECORATIONS_BY_ID[id];
  const kind = def?.defaultRegionKind ?? 'floor';
  const surface = REGION_KIND_SURFACE[kind];
  if (kind === 'rug-plane') {
    return spec({ w: 0.34, h: 0.07, anchor: 'base', baseline: 0.82, sceneryOverlap: true });
  }
  if (kind === 'ceiling-rail') return spec({ w: 0.16, h: 0.14, anchor: 'hanging' });
  if (surface === 'wall') return spec({ w: 0.16, h: 0.16, anchor: 'center' });
  return spec({ w: 0.12, h: 0.16, anchor: 'base' });
}

/** Authoritative placement spec for a decoration (never throws). */
export function placementSpec(id: string): DecorationPlacementSpec {
  return DECORATION_PLACEMENT[id] ?? fallbackSpec(id);
}

/** Static audit: every catalogue decoration must declare an explicit spec. */
export function auditPlacementSpecs(): string[] {
  return DECORATIONS.filter((def) => !DECORATION_PLACEMENT[def.id]).map((def) => def.id);
}
