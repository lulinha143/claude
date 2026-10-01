import type { DecorationLayer } from './types';

// Room painter order: architecture, the pieces BEHIND the team (rugs, wall art,
// anything the player sent back), employees, the pieces IN FRONT of the team
// (free-standing floor furniture, hanging ceiling pieces), then equipment.
//
// `SCENE_DEPTH.rug/wall/floor/ceiling` are the STORED depth scale: placement
// writes a piece's nearness on its surface into `DecorationInstance.depth` in
// these bands, and old saves carry values on the same scale. Which side of the
// team a piece is painted on is decided separately, by its surface and the
// player's layer choice (`decorationRenderZ`).
export interface DepthBand {
  readonly min: number;
  readonly max: number;
}

export const SCENE_DEPTH = {
  rug: { min: 180, max: 180 },

  wall: { min: 182, max: 189 },

  floor: { min: 190, max: 219 },

  ceiling: { min: 220, max: 239 },

  station: { min: 240, max: 249 },

  character: { min: 60, max: 159 },

  characterFocus: 170,

  arranging: 300,

  /** Emotion stickers: above every piece and every character, so a feeling is never hidden. */
  sticker: 260,
} as const;

export const DECORATION_DEPTH_CEILING = SCENE_DEPTH.station.max;

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

export function decorationDepth(kind: DecorationDepthKind, nearness = 0.5): number {
  const band = DECORATION_BANDS[kind];
  if (band.min === band.max) return band.min;
  const t = Math.max(0, Math.min(1, nearness));
  return clampInt(band.min + (band.max - band.min) * t, band);
}

export function decorationDefaultDepth(kind: DecorationDepthKind): number {
  return decorationDepth(kind, kind === 'floor' ? 0.4 : 0.5);
}

const CHARACTER_DEPTH_SPAN = SCENE_DEPTH.character.max - SCENE_DEPTH.character.min;

export function characterDepth(bottomPx: number): number {
  const back = Math.max(0, Math.min(CHARACTER_DEPTH_SPAN, Math.round(bottomPx)));
  return SCENE_DEPTH.character.max - back;
}

// ---- front / back -----------------------------------------------------------

/** Painter bands for pieces drawn BEHIND every employee. */
export const BACK_DEPTH: Record<DecorationDepthKind, DepthBand> = {
  rug: { min: 20, max: 20 },
  wall: { min: 22, max: 29 },
  floor: { min: 30, max: 55 },
  ceiling: { min: 56, max: 59 },
};

/**
 * The natural side for a kind of piece: art on the back wall and rugs under the
 * team's feet sit behind employees; free-standing floor furniture and hanging
 * ceiling pieces sit in front of them.
 */
export function defaultDecorationLayer(kind: DecorationDepthKind): DecorationLayer {
  return kind === 'wall' || kind === 'rug' ? 'back' : 'front';
}

/**
 * Whether the player can swap a piece's side. Wall and floor pieces can; a rug is
 * always under everyone's feet and a ceiling piece always hangs over their heads.
 */
export function decorationLayerAdjustable(kind: DecorationDepthKind): boolean {
  return kind === 'wall' || kind === 'floor';
}

/** The side a piece is painted on, honouring the player's choice where allowed. */
export function decorationSide(
  kind: DecorationDepthKind,
  layer?: DecorationLayer,
): DecorationLayer {
  return layer && decorationLayerAdjustable(kind) ? layer : defaultDecorationLayer(kind);
}

// A stored depth's nearness (0 = back of its surface, 1 = front) on the stored
// scale. Anything outside the band (an ancient save) reads as the default spot.
function storedNearness(kind: DecorationDepthKind, stored: number | undefined): number {
  const band = DECORATION_BANDS[kind];
  if (band.max === band.min) return 0.5;
  if (stored === undefined || !Number.isFinite(stored) || stored < band.min || stored > band.max)
    return kind === 'floor' ? 0.4 : 0.5;
  return (stored - band.min) / (band.max - band.min);
}

/**
 * The z-index a placed decoration is painted at: its side of the team (surface
 * default or the player's choice), ordered within that side by how near the
 * front of its surface it stands.
 */
export function decorationRenderZ(
  kind: DecorationDepthKind,
  stored?: number,
  layer?: DecorationLayer,
): number {
  const band = decorationSide(kind, layer) === 'back' ? BACK_DEPTH[kind] : DECORATION_BANDS[kind];
  const t = storedNearness(kind, stored);
  return clampInt(band.min + (band.max - band.min) * t, band);
}

export function stationDepth(nearness = 0.5): number {
  const band = SCENE_DEPTH.station;
  const t = Math.max(0, Math.min(1, nearness));
  return clampInt(band.min + (band.max - band.min) * t, band);
}
