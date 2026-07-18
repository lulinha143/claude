import type { DecorationSurfaceType } from './types';

/** Semantic supports used by the room editor. Persisted surfaces stay stable. */
export type PlacementRegionKind =
  'floor' | 'rug-plane' | 'wall' | 'ceiling-rail' | 'tabletop' | 'shelf' | 'special';

export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * A room-local horizontal trapezoid. Coordinates use the office stage system:
 * x grows left-to-right and y grows from the floor line toward the ceiling.
 * Trapezoids let floor/rug/table planes express perspective without tying
 * placement data to pixels or a particular Electron window size.
 */
export interface NormalizedPlacementPlane {
  bottomLeft: NormalizedPoint;
  bottomRight: NormalizedPoint;
  topLeft: NormalizedPoint;
  topRight: NormalizedPoint;
}

export type PlacementAnchorMode = 'base' | 'center' | 'hanging';

export interface PlacementExclusion {
  id: string;
  plane: NormalizedPlacementPlane;
}

export interface PlacementRegion {
  id: string;
  roomId: string;
  kind: PlacementRegionKind;
  surfaceType: DecorationSurfaceType;
  plane: NormalizedPlacementPlane;
  anchorMode: PlacementAnchorMode;
  depth: { min: number; max: number; default: number };
  priority: number;
  capacity?: number;
  tags: readonly string[];
  exclusions: readonly PlacementExclusion[];
}

export interface RegionProjection {
  /** Region-local horizontal coordinate. */
  u: number;
  /** Region-local depth/vertical coordinate, bottom-to-top. */
  v: number;
  inside: boolean;
}

export const REGION_KIND_SURFACE: Record<PlacementRegionKind, DecorationSurfaceType> = {
  floor: 'floor',
  'rug-plane': 'floor',
  wall: 'wall',
  'ceiling-rail': 'ceiling',
  tabletop: 'table',
  shelf: 'shelf',
  special: 'floor',
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export function placementPlane(
  left: number,
  right: number,
  bottom: number,
  top: number,
  topInset = 0,
): NormalizedPlacementPlane {
  return {
    bottomLeft: { x: left, y: bottom },
    bottomRight: { x: right, y: bottom },
    topLeft: { x: left + topInset, y: top },
    topRight: { x: right - topInset, y: top },
  };
}

/** Map stable region-local coordinates into normalized room-stage coordinates. */
export function pointOnRegion(
  region: Pick<PlacementRegion, 'plane'>,
  u: number,
  v: number,
): NormalizedPoint {
  const depth = clamp01(v);
  const horizontal = clamp01(u);
  const leftX = lerp(region.plane.bottomLeft.x, region.plane.topLeft.x, depth);
  const rightX = lerp(region.plane.bottomRight.x, region.plane.topRight.x, depth);
  return {
    x: lerp(leftX, rightX, horizontal),
    y: lerp(region.plane.bottomLeft.y, region.plane.topLeft.y, depth),
  };
}

/** Project a room-stage point into a region without clamping the local result. */
export function projectPointToRegion(
  region: Pick<PlacementRegion, 'plane'>,
  point: NormalizedPoint,
  tolerance = 0,
): RegionProjection {
  const height = region.plane.topLeft.y - region.plane.bottomLeft.y;
  const v = Math.abs(height) < Number.EPSILON ? 0 : (point.y - region.plane.bottomLeft.y) / height;
  const leftX = lerp(region.plane.bottomLeft.x, region.plane.topLeft.x, v);
  const rightX = lerp(region.plane.bottomRight.x, region.plane.topRight.x, v);
  const width = rightX - leftX;
  const u = Math.abs(width) < Number.EPSILON ? 0 : (point.x - leftX) / width;
  return {
    u,
    v,
    inside: u >= -tolerance && u <= 1 + tolerance && v >= -tolerance && v <= 1 + tolerance,
  };
}

export function regionContainsPoint(
  region: Pick<PlacementRegion, 'plane' | 'exclusions'>,
  point: NormalizedPoint,
  tolerance = 0,
): boolean {
  if (!projectPointToRegion(region, point, tolerance).inside) return false;
  return !region.exclusions.some(
    (exclusion) => projectPointToRegion({ plane: exclusion.plane }, point, tolerance).inside,
  );
}

/** Clamp to the nearest valid point on a region's normalized plane. */
export function clampPointToRegion(
  region: Pick<PlacementRegion, 'plane'>,
  point: NormalizedPoint,
): { point: NormalizedPoint; u: number; v: number } {
  const projected = projectPointToRegion(region, point);
  const v = clamp01(projected.v);
  // Clamp depth first, then solve horizontal position against that edge span.
  // Extrapolating a tapered floor far beyond its top can invert the left/right
  // edges and choose the wrong corner for an outside pointer.
  const leftX = lerp(region.plane.bottomLeft.x, region.plane.topLeft.x, v);
  const rightX = lerp(region.plane.bottomRight.x, region.plane.topRight.x, v);
  const width = rightX - leftX;
  const u = clamp01(Math.abs(width) < Number.EPSILON ? 0 : (point.x - leftX) / width);
  return { point: pointOnRegion(region, u, v), u, v };
}

/** Clamp to the plane and move out of fixture/window exclusions when needed. */
export function clampPointToValidRegion(
  region: Pick<PlacementRegion, 'plane' | 'exclusions'>,
  point: NormalizedPoint,
): { point: NormalizedPoint; u: number; v: number } | null {
  const direct = clampPointToRegion(region, point);
  if (regionContainsPoint(region, direct.point)) return direct;

  let nearest: { point: NormalizedPoint; u: number; v: number; distance: number } | null = null;
  const steps = 12;
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      const u = column / steps;
      const v = row / steps;
      const candidate = pointOnRegion(region, u, v);
      if (!regionContainsPoint(region, candidate)) continue;
      const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
      if (!nearest || distance < nearest.distance) nearest = { point: candidate, u, v, distance };
    }
  }
  return nearest ? { point: nearest.point, u: nearest.u, v: nearest.v } : null;
}

export function regionArea(region: Pick<PlacementRegion, 'plane'>): number {
  const bottomWidth = region.plane.bottomRight.x - region.plane.bottomLeft.x;
  const topWidth = region.plane.topRight.x - region.plane.topLeft.x;
  const height = region.plane.topLeft.y - region.plane.bottomLeft.y;
  return ((bottomWidth + topWidth) / 2) * height;
}

export function isNormalizedPlane(plane: NormalizedPlacementPlane): boolean {
  const points = [plane.bottomLeft, plane.bottomRight, plane.topLeft, plane.topRight];
  return (
    points.every(
      ({ x, y }) =>
        Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1,
    ) &&
    plane.bottomLeft.x < plane.bottomRight.x &&
    plane.topLeft.x < plane.topRight.x &&
    plane.bottomLeft.y < plane.topLeft.y &&
    plane.bottomLeft.y === plane.bottomRight.y &&
    plane.topLeft.y === plane.topRight.y
  );
}
