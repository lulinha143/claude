// Scene depth (painter's order) for everything drawn inside a room stage.
//
// This module is the SINGLE place stacking order is decided. Every renderer that
// puts something on the floor stage must take its z-index from here rather than
// inventing a local number, because the bands below encode a hard product rule:
//
//   CHARACTERS ALWAYS PAINT IN FRONT OF DECORATIONS.
//
// An employee standing in front of a plant, walking past furniture, or
// overlapping signage must visually win — they are the foreground gameplay
// actors and the player must never lose one behind scenery they bought. That is
// guaranteed structurally, not per-object: every decoration band ends strictly
// below `SCENE_DEPTH.character.min`, so no combination of surface, perspective
// depth, room, or save data can ever lift a prop over a teammate. The invariant
// is asserted in `tests/depth.test.ts` so adding a band cannot silently break it.
//
// Within that constraint the bands still preserve meaningful depth *among*
// decorations: rugs lie under everything, wall art sits behind floor props,
// grounded floor props sort by perspective nearness (a prop at the front of the
// room paints over one at the back), and hanging/overhead pieces sit above the
// floor clutter.
//
// Bands are generously spaced so each has room to sort internally and so a new
// band can be inserted without renumbering the others.

export interface DepthBand {
  readonly min: number;
  readonly max: number;
}

export const SCENE_DEPTH = {
  /** Rugs and floor coverings: flat on the boards, beneath every other prop. */
  rug: { min: 0, max: 0 },
  /** Wall-mounted art, signage, shelves — behind anything standing on the floor. */
  wall: { min: 2, max: 9 },
  /** Free-standing floor props, sorted front-to-back by perspective nearness. */
  floor: { min: 10, max: 29 },
  /** Hanging / overhead pieces: above floor clutter, still behind characters. */
  ceiling: { min: 30, max: 39 },
  /**
   * Interactive room equipment (click stations). Above all scenery so the player
   * can always find and hit it, but still behind characters so employees are
   * never occluded by the machine they are operating.
   */
  station: { min: 40, max: 49 },
  /**
   * Characters. Starts well clear of every decoration band above. Sorted so a
   * teammate standing nearer the camera paints over one further back.
   */
  character: { min: 60, max: 159 },
  /** A character temporarily in the spotlight (visiting a prop, celebrating). */
  characterFocus: 170,
  /** The piece currently being dragged in arrange mode, so it is never lost. */
  arranging: 200,
} as const;

/** Highest z-index any decoration may ever occupy. */
export const DECORATION_DEPTH_CEILING = SCENE_DEPTH.station.max;

/** The decoration bands, keyed by the placement region kinds that use them. */
export type DecorationDepthKind = 'rug' | 'wall' | 'floor' | 'ceiling';

const DECORATION_BANDS: Record<DecorationDepthKind, DepthBand> = {
  rug: SCENE_DEPTH.rug,
  wall: SCENE_DEPTH.wall,
  floor: SCENE_DEPTH.floor,
  ceiling: SCENE_DEPTH.ceiling,
};

export function decorationBand(kind: DecorationDepthKind): DepthBand {
  return DECORATION_BANDS[kind];
}

const clampInt = (value: number, band: DepthBand): number =>
  Math.max(band.min, Math.min(band.max, Math.round(value)));

/**
 * Depth for a decoration within its band.
 *
 * `nearness` is 0..1 where 1 is closest to the camera (the front of the room).
 * Grounded floor props use the perspective position of their contact point, so
 * a prop dropped at the front of the room correctly paints over one at the back.
 */
export function decorationDepth(kind: DecorationDepthKind, nearness = 0.5): number {
  const band = DECORATION_BANDS[kind];
  if (band.min === band.max) return band.min;
  const t = Math.max(0, Math.min(1, nearness));
  return clampInt(band.min + (band.max - band.min) * t, band);
}

/** The resting depth for a decoration that has no perspective information. */
export function decorationDefaultDepth(kind: DecorationDepthKind): number {
  return decorationDepth(kind, kind === 'floor' ? 0.4 : 0.5);
}

/**
 * The vertical distance (in stage pixels) over which characters are sorted.
 * Slot depth offsets come from `characterSlots` and stay well inside this.
 */
const CHARACTER_DEPTH_SPAN = SCENE_DEPTH.character.max - SCENE_DEPTH.character.min;

/**
 * Depth for a character standing `bottomPx` up from the floor line.
 *
 * A larger `bottom` means further back in the room, so it maps to a LOWER
 * z-index: the teammate closest to the camera paints over the others. Two
 * characters at the same depth tie harmlessly — the layout guarantees they never
 * overlap horizontally.
 */
export function characterDepth(bottomPx: number): number {
  const back = Math.max(0, Math.min(CHARACTER_DEPTH_SPAN, Math.round(bottomPx)));
  return SCENE_DEPTH.character.max - back;
}

/** Depth for an interactive click station within the equipment band. */
export function stationDepth(nearness = 0.5): number {
  const band = SCENE_DEPTH.station;
  const t = Math.max(0, Math.min(1, nearness));
  return clampInt(band.min + (band.max - band.min) * t, band);
}
