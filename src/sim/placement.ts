// Decoration composition rules: keep free-placement from producing visually
// broken arrangements. Everything here is pure and room-local so it can be unit
// tested and reused by the drop handler.
//
// Positions are normalised to the room stage (see surfaces.ts):
//   x = centre across the width (0..1), y = bottom edge up from the floor line.
// A decoration occupies a bounding box `w` wide and `h` tall around that point.

import type { GameState } from './types';
import {
  pointOnRegion,
  regionContainsPoint,
  type NormalizedPoint,
  type PlacementRegion,
} from './placementRegions';
import { regionArea } from './placementRegions';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { placementSpec } from '../content/placementSpecs';
import { decorationSurface, isRug } from './surfaces';
import { employeesInRoom } from './rooms';
import { characterSlots } from '../content/roomLayout';
import { compatibleRegionsForProfile, defaultCompatiblePlacement } from '../content/roomSurfaces';
import type { DecorationDef } from '../content/types';

export interface PlacementCheck {
  ok: boolean;
  /** i18n key explaining why a placement was rejected. */
  reasonKey?: string;
}

/**
 * Normalised bounding-box footprint (width, height) for a decoration, taken
 * from its explicit per-item placement spec (never from filename regex).
 */
export function footprint(id: string): { w: number; h: number } {
  const { footprint: box } = placementSpec(id);
  return { w: box.width, h: box.height };
}

// How far (normalized room-stage units) a raw pointer may sit from the nearest
// valid support point and still count as an intentional, committable drop. A
// larger miss rolls back to the previous placement rather than snapping.
const RAW_POINTER_TOLERANCE = 0.08;

/**
 * Decide whether placing (or moving) decoration `id` to a final, already-clamped
 * position is a legal, readable composition. Returns a reason key when not.
 */
export function evaluatePlacement(
  state: GameState,
  id: string,
  x: number,
  _y: number,
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

  const fp = footprint(id);

  // Keep the complete visible width inside the room (allow a hair of bleed for
  // anti-aliasing). Overlap with other player-owned props is intentionally
  // unrestricted: layered, dense arrangements are a creative tool, not an
  // error state.
  if (x - fp.w / 2 < -0.02 || x + fp.w / 2 > 1.02) {
    return { ok: false, reasonKey: 'decorate.reject.moveInside' };
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
export function decorationPlaneFootprint(id: string): { width: number; depth: number } {
  const visible = footprint(id);
  if (isRug(id)) {
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
  const size = decorationPlaneFootprint(id);
  return footprintSamples(point, size).every((sample) => regionContainsPoint(region, sample));
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Continuously clamp a point so a footprint of `size` stays inside the region's
 * (possibly tapered) plane. O(1) and smooth: as the pointer moves, the result
 * glides along the plane instead of snapping to a discrete grid cell — this is
 * what keeps live dragging fluid. Exclusions are handled by the caller.
 */
function insetClampToPlane(
  region: PlacementRegion,
  size: { width: number; depth: number },
  point: NormalizedPoint,
): { point: NormalizedPoint; u: number; v: number } {
  const plane = region.plane;
  const minY = plane.bottomLeft.y;
  const maxY = plane.topLeft.y;
  const height = maxY - minY;
  const halfDepth = Math.min(size.depth / 2, Math.max(0, height / 2 - 1e-4));
  const y = Math.max(minY + halfDepth, Math.min(maxY - halfDepth, point.y));
  const v = height < Number.EPSILON ? 0 : (y - minY) / height;
  const leftX = lerp(plane.bottomLeft.x, plane.topLeft.x, v);
  const rightX = lerp(plane.bottomRight.x, plane.topRight.x, v);
  const width = rightX - leftX;
  const halfWidth = Math.min(size.width / 2, Math.max(0, width / 2 - 1e-4));
  const x = Math.max(leftX + halfWidth, Math.min(rightX - halfWidth, point.x));
  const u = width < Number.EPSILON ? 0 : (x - leftX) / width;
  return { point: { x, y }, u: clamp01(u), v: clamp01(v) };
}

/**
 * Find the anchor whose complete visible support footprint remains in the
 * authored region. The continuous inset clamp is the fast path used on every
 * pointer move (smooth, no jumps); only when it still overlaps an exclusion
 * (window / fixture) does a bounded region-local search nudge it clear.
 */
export function clampDecorationToRegion(
  id: string,
  region: PlacementRegion,
  point: NormalizedPoint,
): { point: NormalizedPoint; u: number; v: number } | null {
  const size = decorationPlaneFootprint(id);
  const inset = insetClampToPlane(region, size, point);
  if (decorationFootprintFitsRegion(id, region, inset.point)) return inset;

  // Fallback (rare — only near window/fixture exclusions): search from the
  // inset-clamped anchor outward for the nearest footprint-legal spot.
  let nearest: { point: NormalizedPoint; u: number; v: number; distance: number } | null = null;
  const steps = 20;
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      const u = column / steps;
      const v = row / steps;
      const candidate = pointOnRegion(region, u, v);
      if (!decorationFootprintFitsRegion(id, region, candidate)) continue;
      const distance = (candidate.x - inset.point.x) ** 2 + (candidate.y - inset.point.y) ** 2;
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
  // A drop is "on target" when the pointer is already on (or barely off) the
  // support: clamping it only nudged the position a little. A pointer far from
  // any valid spot (e.g. flung outside the room, or a floor item held high on
  // the wall) yields a large clamp distance and rolls back instead of teleport.
  const clampDistance = Math.hypot(
    constrained.point.x - rawPoint.x,
    constrained.point.y - rawPoint.y,
  );
  const rawFits = clampDistance <= RAW_POINTER_TOLERANCE;
  const collision = evaluatePlacement(state, id, constrained.point.x, constrained.point.y, roomId);
  return {
    region,
    point: constrained.point,
    u: constrained.u,
    v: constrained.v,
    // Rugs lie flat under everything else; other props take perspective depth.
    depth: isRug(id) ? 0 : depthAt(region, constrained.v),
    planeFootprint: decorationPlaneFootprint(id),
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



// --- unified region resolution -------------------------------------------
// A single authoritative entry point that turns a pointer (or a desired point)
// into a concrete support region for ANY category — floor, rug, wall, ceiling
// rail, tabletop, shelf, or a room-specific special surface. Preview, pointer
// hit-testing, drop commit, purchase/auto-place, Move To, and room reset all
// funnel through these so a decoration can never be previewed on one surface
// and then saved onto a different one.

/** The compatible region of a specific kind for a decoration in a room. */
export function resolveRegionByKind(
  roomId: string,
  def: DecorationDef,
  kind: PlacementRegion['kind'],
): PlacementRegion | null {
  return compatibleRegionsForProfile(roomId, def).find((region) => region.kind === kind) ?? null;
}

/**
 * Pick the support region under a raw pointer and evaluate the placement there.
 * The region the pointer is physically inside wins (highest priority, then
 * smallest area); otherwise the decoration's default-kind region is used and
 * the point is clamped, yielding a constrained-but-invalid preview so an
 * outside release rolls back cleanly instead of teleporting.
 */
export function pointerRegionPlacement(
  state: GameState,
  id: string,
  roomId: string,
  rawPoint: NormalizedPoint,
  preferKind?: PlacementRegion['kind'],
): RegionPlacementCheck | null {
  const def = DECORATIONS_BY_ID[id];
  if (!def) return null;
  const compatible = compatibleRegionsForProfile(roomId, def);
  if (compatible.length === 0) return null;
  const containing = compatible
    .filter((region) => regionContainsPoint(region, rawPoint))
    .sort((left, right) => right.priority - left.priority || regionArea(left) - regionArea(right));
  // Hysteresis: while a drag is already targeting a support and the pointer is
  // still inside it, keep it — this stops the preview flickering between
  // overlapping compatible planes (e.g. floor vs. tabletop) as the pointer
  // crosses their shared band.
  const sticky =
    preferKind !== undefined
      ? containing.find((region) => region.kind === preferKind)
      : undefined;
  const chosen =
    sticky ??
    containing[0] ??
    compatible.find((region) => region.kind === def.defaultRegionKind) ??
    [...compatible].sort((left, right) => right.priority - left.priority)[0];
  return evaluateRegionPlacement(state, id, roomId, chosen, rawPoint);
}

/**
 * Deterministically resolve a valid default placement for a decoration in a
 * room across every compatible region (used by purchase auto-place, Move To,
 * and room reset). Prefers the decoration's default region kind, then the
 * nearest collision-free spot on any other compatible support.
 */
export function defaultRegionPlacementFor(
  state: GameState,
  id: string,
  roomId: string,
  index = 0,
): RegionPlacementCheck | null {
  const def = DECORATIONS_BY_ID[id];
  if (!def) return null;
  const seed = defaultCompatiblePlacement(roomId, def, index);
  if (seed) {
    const direct = evaluateRegionPlacement(state, id, roomId, seed.region, seed.point);
    if (direct?.ok) return direct;
  }
  const desired = seed?.point ?? { x: 0.5, y: 0.12 };
  let nearest: { check: RegionPlacementCheck; distance: number } | null = null;
  for (const region of compatibleRegionsForProfile(roomId, def)) {
    const found = findValidRegionPlacement(state, id, roomId, region, desired);
    if (!found?.ok) continue;
    const distance = (found.point.x - desired.x) ** 2 + (found.point.y - desired.y) ** 2;
    if (!nearest || distance < nearest.distance) nearest = { check: found, distance };
  }
  return nearest?.check ?? null;
}
