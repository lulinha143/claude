// Room painter order: architecture, employees, purchased furnishings, equipment.
// Each surface retains its own depth band; manipulating a piece lifts it temporarily.
// Furniture remains in front even while a colleague visits it.
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

export function stationDepth(nearness = 0.5): number {
  const band = SCENE_DEPTH.station;
  const t = Math.max(0, Math.min(1, nearness));
  return clampInt(band.min + (band.max - band.min) * t, band);
}
