// Decoration composition rules: keep free-placement from producing visually
// broken arrangements. Everything here is pure and room-local so it can be unit
// tested and reused by the drop handler.
//
// Positions are normalised to the room stage (see surfaces.ts):
//   x = centre across the width (0..1), y = bottom edge up from the floor line.
// A decoration occupies a bounding box `w` wide and `h` tall around that point.

import type { GameState } from './types';
import {
  clampPointToValidRegion,
  pointOnRegion,
  projectPointToRegion,
  regionContainsPoint,
  type NormalizedPoint,
  type PlacementRegion,
} from './placementRegions';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { decorationSurface, isRug } from './surfaces';
import { placedDecorationsInRoom } from './decorations';
import { employeesInRoom } from './rooms';
import { characterSlots } from '../content/roomLayout';

export interface PlacementCheck {
  ok: boolean;
  /** i18n key explaining why a placement was rejected. */
  reasonKey?: string;
}

// Decorations that read as physically large and should demand real space.
const LARGE_DECOS = new Set([
  'safe',
  'aquarium',
  'nut-statue',
  'snack-bar',
  'beanbag-chairs',
  'hammock',
  'wooden-arch',
  'billboard',
  'blueprint-wall',
  'window-view',
  'projector',
  'chandelier',
  'hologram',
  'star-ceiling',
  'rooftop-garden-bed',
  'trophy-shelf',
]);

/** Normalised bounding-box footprint (width, height) for a decoration. */
export function footprint(id: string): { w: number; h: number } {
  if (isRug(id)) return { w: 0.42, h: 0.06 }; // wide + flat, lies under everything
  const surface = decorationSurface(id);
  const large = LARGE_DECOS.has(id);
  if (surface === 'ceiling') return large ? { w: 0.4, h: 0.14 } : { w: 0.16, h: 0.1 };
  if (surface === 'wall') return large ? { w: 0.26, h: 0.2 } : { w: 0.14, h: 0.14 };
  return large ? { w: 0.22, h: 0.24 } : { w: 0.12, h: 0.16 };
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function boxOf(id: string, x: number, y: number): Box {
  const fp = footprint(id);
  return { x0: x - fp.w / 2, x1: x + fp.w / 2, y0: y, y1: y + fp.h };
}

function overlapRatio(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
  const minArea = Math.min(areaA, areaB);
  return minArea > 0 ? inter / minArea : 0;
}

// A small, natural-looking overlap is fine (a plant tucked beside a cabinet);
// beyond this fraction of the smaller object it reads as "stacked/broken".
const MAX_OVERLAP = 0.34;
// Centres closer than this are effectively the same spot.
const STACK_DIST = 0.03;

/**
 * Decide whether placing (or moving) decoration `id` to a final, already-clamped
 * position is a legal, readable composition. Returns a reason key when not.
 */
export function evaluatePlacement(
  state: GameState,
  id: string,
  x: number,
  y: number,
  roomId?: string,
): PlacementCheck {
  const def = DECORATIONS_BY_ID[id];
  if (!def) return { ok: false, reasonKey: 'decorate.reject.invalid' };
  const destinationRoom = roomId ?? def.room;
  if (!def.compatibleRooms.includes(destinationRoom)) {
    return { ok: false, reasonKey: 'decorate.reject.incompatibleRoom' };
  }
  const surface = decorationSurface(id);

  // Rugs lie flat on the floor under everything else — they never block.
  if (isRug(id)) return { ok: true };

  const box = boxOf(id, x, y);
  const fp = footprint(id);

  // Must sit fully inside the room (allow a hair of bleed for anti-aliasing).
  if (box.x0 < -0.02 || box.x1 > 1.02) return { ok: false, reasonKey: 'decorate.reject.moveInside' };

  // No severe overlap with another object on the same surface.
  for (const other of placedDecorationsInRoom(state, destinationRoom)) {
    if (other.def.id === id) continue;
    if (other.placement.surface !== surface) continue;
    if (isRug(other.def.id)) continue;
    const dist = Math.hypot(x - other.placement.x, y - other.placement.y);
    if (dist < STACK_DIST) return { ok: false, reasonKey: 'decorate.reject.stacked' };
    if (overlapRatio(box, boxOf(other.def.id, other.placement.x, other.placement.y)) > MAX_OVERLAP) {
      return { ok: false, reasonKey: 'decorate.reject.occupied' };
    }
  }

  // A large floor object must not sit on top of a teammate (covering the face).
  if (surface === 'floor' && (fp.w >= 0.18 || fp.h >= 0.2)) {
    const occupants = employeesInRoom(state, destinationRoom);
    const slots = characterSlots(occupants.length, destinationRoom);
    for (const slot of slots) {
      if (Math.abs(slot.x - x) < fp.w / 2 + 0.03) {
        return { ok: false, reasonKey: 'decorate.reject.coversTeammate' };
      }
    }
  }

  return { ok: true };
}



export interface RegionPlacementCheck extends PlacementCheck {
  region: PlacementRegion;
  point: NormalizedPoint;
  /** Region-local coordinates, useful for perspective depth and diagnostics. */
  u: number;
  v: number;
  depth: number;
  /** Normalized footprint projected onto the support plane. */
  planeFootprint: { width: number; depth: number };
}

/**
 * The support-plane footprint differs from the visible upright bounding box:
 * standing objects contact the floor through a shallow base, while rugs use
 * their complete flat footprint. Keeping this pure makes live preview and drop
 * validation use exactly the same geometry.
 */
export function decorationPlaneFootprint(
  id: string,
  region: Pick<PlacementRegion, 'kind'>,
): { width: number; depth: number } {
  const visible = footprint(id);
  if (region.kind === 'rug-plane' || isRug(id)) {
    return { width: visible.w, depth: Math.max(visible.h, 0.06) };
  }
  return {
    width: visible.w,
    depth: Math.max(0.025, Math.min(0.065, visible.h * 0.2)),
  };
}

function footprintSamples(
  point: NormalizedPoint,
  size: { width: number; depth: number },
): NormalizedPoint[] {
  const halfWidth = size.width / 2;
  const halfDepth = size.depth / 2;
  return [
    point,
    { x: point.x - halfWidth, y: point.y - halfDepth },
    { x: point.x, y: point.y - halfDepth },
    { x: point.x + halfWidth, y: point.y - halfDepth },
    { x: point.x - halfWidth, y: point.y },
    { x: point.x + halfWidth, y: point.y },
    { x: point.x - halfWidth, y: point.y + halfDepth },
    { x: point.x, y: point.y + halfDepth },
    { x: point.x + halfWidth, y: point.y + halfDepth },
  ];
}

export function decorationFootprintFitsRegion(
  id: string,
  region: PlacementRegion,
  point: NormalizedPoint,
): boolean {
  const size = decorationPlaneFootprint(id, region);
  return footprintSamples(point, size).every((sample) => regionContainsPoint(region, sample));
}

/**
 * Find the nearest anchor whose complete visible support footprint remains in
 * the authored region. Direct placements retain full precision; only an
 * outside/edge pointer uses the deterministic region-local search fallback.
 */
export function clampDecorationToRegion(
  id: string,
  region: PlacementRegion,
  point: NormalizedPoint,
): { point: NormalizedPoint; u: number; v: number } | null {
  const direct = clampPointToValidRegion(region, point);
  if (!direct) return null;
  if (decorationFootprintFitsRegion(id, region, direct.point)) return direct;

  let nearest: { point: NormalizedPoint; u: number; v: number; distance: number } | null = null;
  const steps = 28;
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      const u = column / steps;
      const v = row / steps;
      const candidate = pointOnRegion(region, u, v);
      if (!decorationFootprintFitsRegion(id, region, candidate)) continue;
      const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
      if (!nearest || distance < nearest.distance) nearest = { point: candidate, u, v, distance };
    }
  }
  return nearest ? { point: nearest.point, u: nearest.u, v: nearest.v } : null;
}

function depthAt(region: PlacementRegion, v: number): number {
  if (region.depth.min === region.depth.max) return region.depth.default;
  // Region v grows from the near/bottom edge toward the far/top edge. Higher
  // z-index values must belong to nearer props so they paint over back-row
  // props and, where appropriate, employees.
  return Math.round(region.depth.max - (region.depth.max - region.depth.min) * v);
}

/**
 * Shared live-preview/drop transaction check for one semantic support region.
 * The returned point is always constrained; `ok` additionally records whether
 * the raw pointer footprint was legal and collision-free.
 */
export function evaluateRegionPlacement(
  state: GameState,
  id: string,
  roomId: string,
  region: PlacementRegion,
  rawPoint: NormalizedPoint,
): RegionPlacementCheck | null {
  const def = DECORATIONS_BY_ID[id];
  if (
    !def ||
    region.roomId !== roomId ||
    !def.compatibleRooms.includes(roomId) ||
    !def.compatibleRegionKinds.includes(region.kind) ||
    !def.compatibleRegionSurfaces.includes(region.surfaceType)
  ) {
    return null;
  }

  const constrained = clampDecorationToRegion(id, region, rawPoint);
  if (!constrained) return null;
  const rawProjection = projectPointToRegion(region, rawPoint);
  const rawFits = rawProjection.inside && decorationFootprintFitsRegion(id, region, rawPoint);
  const occupants = placedDecorationsInRoom(state, roomId).filter(
    (other) => other.def.id !== id && other.def.defaultRegionKind === region.kind,
  );
  const capacityReached =
    region.capacity !== undefined && occupants.length >= region.capacity;
  const collision = capacityReached
    ? { ok: false, reasonKey: 'decorate.reject.occupied' }
    : evaluatePlacement(state, id, constrained.point.x, constrained.point.y, roomId);
  return {
    region,
    point: constrained.point,
    u: constrained.u,
    v: constrained.v,
    depth: depthAt(region, constrained.v),
    planeFootprint: decorationPlaneFootprint(id, region),
    ok: rawFits && collision.ok,
    reasonKey: rawFits ? collision.reasonKey : 'decorate.reject.moveInside',
  };
}


/**
 * Deterministically find a legal support point for non-pointer placement flows
 * such as purchase fallback, Move To, and room reset. Pointer drags still use
 * evaluateRegionPlacement directly so an invalid release never auto-teleports.
 */
export function findValidRegionPlacement(
  state: GameState,
  id: string,
  roomId: string,
  region: PlacementRegion,
  desired: NormalizedPoint,
): RegionPlacementCheck | null {
  const constrained = clampDecorationToRegion(id, region, desired);
  if (constrained) {
    const direct = evaluateRegionPlacement(state, id, roomId, region, constrained.point);
    if (direct?.ok) return direct;
  }

  const steps = 12;
  let nearest: { check: RegionPlacementCheck; distance: number } | null = null;
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      const point = pointOnRegion(region, column / steps, row / steps);
      const check = evaluateRegionPlacement(state, id, roomId, region, point);
      if (!check?.ok) continue;
      const distance = (check.point.x - desired.x) ** 2 + (check.point.y - desired.y) ** 2;
      if (!nearest || distance < nearest.distance) nearest = { check, distance };
    }
  }
  return nearest?.check ?? null;
}
