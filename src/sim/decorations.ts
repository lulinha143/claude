import type { DecorationInstance, DecorationSurfaceType, GameState } from './types';
import { DECORATIONS, DECORATIONS_BY_ID } from '../content/decorations';
import { ROOMS_BY_ID } from '../content/rooms';
import type { DecorationDef } from '../content/types';
import {
  decorationSurface,
  defaultPlacement,
  isValidPlacement,
  clampToSurface,
  projectSurfaceType,
  surfaceZ,
  type DecorationPlacement,
  type DecorationSurface,
} from './surfaces';
import { compatibleRegionsForProfile, defaultCompatiblePlacement } from '../content/roomSurfaces';
import {
  clampPointToValidRegion,
  projectPointToRegion,
  type PlacementRegionKind,
} from './placementRegions';

// Decoration model
// ----------------
// Ownership remains in `collections.secrets` as `deco:<id>` so old purchases
// survive upgrades. Since save v7, stable identity, room/inventory state,
// normalized coordinates, variants, and interaction state live in
// `state.decorationInstances`. `state.placements` is retained as a v6
// compatibility projection for current renderers and placement controls.
//
// Free placement replaces the old fixed-anchor system: the player chooses the
// exact spot inside a valid surface; the engine clamps it to safe room bounds.

export function isDecorationOwned(state: GameState, id: string): boolean {
  return state.collections.secrets.includes(`deco:${id}`);
}

/** The placement of an owned decoration, if it is currently placed. */
export function placedPlacement(state: GameState, id: string): DecorationPlacement | null {
  if (!isDecorationOwned(state, id)) return null;
  const p = state.placements?.[id];
  if (!p || typeof p !== 'object') return null;
  return p;
}

export function isDecorationPlaced(state: GameState, id: string): boolean {
  return placedPlacement(state, id) !== null;
}

export function decorationInstance(state: GameState, id: string): DecorationInstance | null {
  return state.decorationInstances?.find((instance) => instance.decorationId === id) ?? null;
}

/** Current destination room, or null while the owned item is in storage. */
export function decorationRoom(state: GameState, id: string): string | null {
  const instance = decorationInstance(state, id);
  if (instance) return instance.roomId;
  return placedPlacement(state, id) ? (DECORATIONS_BY_ID[id]?.room ?? null) : null;
}

/**
 * Owned items associated with a room. Placed items follow their instance room;
 * stowed legacy items remain grouped under their catalogue default so Tidy can
 * retain its existing restore-from-storage behavior.
 */
export function ownedDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return DECORATIONS.filter((def) => {
    if (!isDecorationOwned(state, def.id)) return false;
    const currentRoom = decorationRoom(state, def.id);
    return currentRoom === roomId || (currentRoom === null && def.room === roomId);
  });
}

export interface PlacedDecoration {
  def: DecorationDef;
  placement: DecorationPlacement;
}

/** Owned + placed decorations in their authoritative instance room. */
export function placedDecorationsInRoom(state: GameState, roomId: string): PlacedDecoration[] {
  const out: PlacedDecoration[] = [];
  for (const def of DECORATIONS) {
    if (!isDecorationOwned(state, def.id) || decorationRoom(state, def.id) !== roomId) continue;
    const placement = placedPlacement(state, def.id);
    if (placement) out.push({ def, placement });
  }
  return out;
}

/** Stowed owned items whose catalogue default is this room (legacy grouping). */
export function inventoryDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return DECORATIONS.filter(
    (def) =>
      def.room === roomId &&
      isDecorationOwned(state, def.id) &&
      decorationRoom(state, def.id) === null,
  );
}

/** Placed decorations, as plain defs (kept for morale/comfort + compatibility). */
export function visibleDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return placedDecorationsInRoom(state, roomId).map((p) => p.def);
}

/** Sum of morale bonuses from currently-placed decorations (room comfort). */
export function roomComfort(state: GameState, roomId: string): number {
  return placedDecorationsInRoom(state, roomId).reduce((s, p) => s + p.def.moraleBonus, 0);
}

/** How many decorations of a given surface are already placed in a room. */
export function placedCountOnSurface(
  state: GameState,
  roomId: string,
  surface: DecorationSurface,
): number {
  return placedDecorationsInRoom(state, roomId).filter((p) => p.placement.surface === surface)
    .length;
}

/**
 * Build a valid placement for a decoration at a desired normalised position.
 * The surface is fixed by the decoration; y is clamped into that surface's band
 * and x/y are kept inside the room bounds. This is the "controlled" in
 * controlled free placement — the player picks the spot, we keep it legal.
 */
export function placementAt(id: string, x: number, y: number): DecorationPlacement {
  const surface = decorationSurface(id);
  return {
    surface,
    x: Math.max(0.04, Math.min(0.96, x)),
    y: clampToSurface(surface, y),
  };
}

/**
 * Normalizes `state.placements` in-place so rendering is always valid:
 *   - drops entries for decorations that don't exist / aren't owned
 *   - repairs entries with a wrong surface or out-of-bounds coordinates
 *   - auto-places an owned-but-unplaced decoration at a tidy default spot,
 *     UNLESS it was explicitly stowed via the legacy `decohide:<id>` flag
 * Returns the ids whose placement changed (dev logging only).
 */
export function repairDecorations(state: GameState): string[] {
  if (!state.placements || typeof state.placements !== 'object') state.placements = {};
  const changed: string[] = [];
  const secrets = state.collections.secrets;

  // 1. drop invalid entries + repair bad coordinates/surface
  for (const [id, p] of Object.entries(state.placements)) {
    const def = DECORATIONS_BY_ID[id];
    if (!def || !isDecorationOwned(state, id) || !p || typeof p !== 'object') {
      delete state.placements[id];
      changed.push(id);
      continue;
    }
    // A v7+ instance is authoritative for placement and its projection has
    // already been rebuilt (region model). Never second-guess it with the
    // legacy regex surface, which can disagree for tabletop/shelf props.
    if (state.decorationInstances?.some((instance) => instance.decorationId === id)) continue;
    if (!isValidPlacement(id, p.surface, p.x, p.y)) {
      state.placements[id] = placementAt(
        id,
        Number.isFinite(p.x) ? p.x : 0.5,
        Number.isFinite(p.y) ? p.y : 0.1,
      );
      changed.push(id);
    }
  }

  // 2. auto-place owned-but-unplaced decorations (respecting the legacy hide flag)
  const perRoomSurfaceIndex: Record<string, number> = {};
  const rooms = new Set(DECORATIONS.map((d) => d.room));
  for (const roomId of rooms) {
    for (const def of ownedDecorationsInRoom(state, roomId)) {
      if (state.placements[def.id]) continue;
      if (secrets.includes(`decohide:${def.id}`)) continue; // respect old "stowed" choice
      // A v7 inventory instance is an explicit storage choice. Do not revive a
      // stale/missing legacy projection and accidentally place it on load.
      const instance = state.decorationInstances?.find((item) => item.decorationId === def.id);
      if (instance?.roomId === null) continue;
      const key = `${roomId}:${decorationSurface(def.id)}`;
      const idx = perRoomSurfaceIndex[key] ?? 0;
      perRoomSurfaceIndex[key] = idx + 1;
      state.placements[def.id] = defaultPlacement(def.id, idx);
      changed.push(def.id);
    }
  }

  // 3. clear obsolete legacy hide flags now that placement is authoritative
  for (let i = secrets.length - 1; i >= 0; i--) {
    if (secrets[i].startsWith('decohide:')) secrets.splice(i, 1);
  }

  return changed;
}

export function legacyDecorationInstanceId(decorationId: string): string {
  return `deco-${decorationId}-1`;
}

const LEGACY_SURFACES = new Set<DecorationSurfaceType>(['floor', 'wall', 'ceiling']);

function isLegacySurface(surface: DecorationSurfaceType): surface is DecorationSurface {
  return LEGACY_SURFACES.has(surface);
}

function uniqueInstanceId(
  state: GameState,
  preferred: string,
  except?: DecorationInstance,
): string {
  const used = new Set(
    state.decorationInstances
      .filter((instance) => instance !== except)
      .map((instance) => instance.instanceId),
  );
  if (!used.has(preferred)) return preferred;
  let suffix = 2;
  while (used.has(`${preferred}-${suffix}`)) suffix += 1;
  return `${preferred}-${suffix}`;
}

/** Keep the compatibility placement projection synchronized after a player action. */
export function syncDecorationInstanceFromPlacement(
  state: GameState,
  decorationId: string,
): DecorationInstance | null {
  const def = DECORATIONS_BY_ID[decorationId];
  if (!def || !isDecorationOwned(state, decorationId)) return null;
  if (!Array.isArray(state.decorationInstances)) state.decorationInstances = [];
  const placement = state.placements[decorationId];
  let instance = state.decorationInstances.find((item) => item.decorationId === decorationId);
  if (!instance) {
    const fallback = placement ?? defaultPlacement(decorationId);
    instance = {
      instanceId: uniqueInstanceId(state, legacyDecorationInstanceId(decorationId)),
      decorationId,
      roomId: placement ? def.room : null,
      surfaceType: fallback.surface,
      regionKind: def.defaultRegionKind,
      normalizedX: fallback.x,
      normalizedY: fallback.y,
      depth: surfaceZ(decorationId, fallback.surface),
      flipped: false,
      rotation: 0,
      interactionState: {},
    };
    state.decorationInstances.push(instance);
  }
  if (placement) {
    // Preserve a future cross-room assignment when one already exists; legacy
    // placement data has no room field and therefore cannot improve it.
    instance.roomId ??= def.room;
    instance.surfaceType = placement.surface;
    instance.normalizedX = placement.x;
    instance.normalizedY = placement.y;
    // Existing v7 instances carry authoritative semantic depth. Placement is a
    // legacy compatibility projection and has no depth field, so syncing it
    // must never flatten a valid front/back ordering during load or repair.
  } else {
    instance.roomId = null;
  }
  return instance;
}

/** Synchronize every known owned item after undo/redo replaces the placement map. */
export function syncDecorationInstancesFromPlacements(state: GameState): void {
  for (const def of DECORATIONS) {
    if (isDecorationOwned(state, def.id)) syncDecorationInstanceFromPlacement(state, def.id);
  }
}

export type DecorationAuditCode =
  | 'duplicate-ownership'
  | 'unknown-owned-decoration'
  | 'missing-instance'
  | 'duplicate-instance-id'
  | 'duplicate-decoration-instance'
  | 'unknown-instance-decoration'
  | 'unowned-instance'
  | 'invalid-instance-room'
  | 'incompatible-instance-room'
  | 'incompatible-instance-surface'
  | 'invalid-instance-coordinates'
  | 'invalid-instance-depth'
  | 'inventory-placement-conflict'
  | 'missing-placement-projection'
  | 'mismatched-placement-projection'
  | 'unknown-placement-decoration'
  | 'unowned-placement'
  | 'invalid-placement-projection';

export interface DecorationAuditIssue {
  code: DecorationAuditCode;
  decorationId: string;
  instanceId?: string;
}

/**
 * Non-mutating integrity audit used by migrations/tests and development tools.
 * Unknown content is reported rather than silently deleted so removed or
 * temporarily unavailable catalogue entries can survive a save round-trip.
 */
export function auditDecorationState(state: GameState): DecorationAuditIssue[] {
  const issues: DecorationAuditIssue[] = [];
  const ownershipCounts = new Map<string, number>();
  for (const secret of state.collections.secrets) {
    if (!secret.startsWith('deco:')) continue;
    const decorationId = secret.slice(5);
    ownershipCounts.set(decorationId, (ownershipCounts.get(decorationId) ?? 0) + 1);
  }
  for (const [decorationId, count] of ownershipCounts) {
    if (!DECORATIONS_BY_ID[decorationId])
      issues.push({ code: 'unknown-owned-decoration', decorationId });
    if (count > 1) issues.push({ code: 'duplicate-ownership', decorationId });
  }

  const instanceIds = new Set<string>();
  const decorationIds = new Set<string>();
  for (const instance of state.decorationInstances ?? []) {
    const { instanceId, decorationId } = instance;
    if (instanceIds.has(instanceId))
      issues.push({ code: 'duplicate-instance-id', decorationId, instanceId });
    instanceIds.add(instanceId);
    if (decorationIds.has(decorationId)) {
      issues.push({ code: 'duplicate-decoration-instance', decorationId, instanceId });
    }
    decorationIds.add(decorationId);

    const def = DECORATIONS_BY_ID[decorationId];
    if (!def) {
      issues.push({ code: 'unknown-instance-decoration', decorationId, instanceId });
      continue;
    }
    if (!ownershipCounts.has(decorationId))
      issues.push({ code: 'unowned-instance', decorationId, instanceId });
    if (instance.roomId !== null) {
      if (!ROOMS_BY_ID[instance.roomId])
        issues.push({ code: 'invalid-instance-room', decorationId, instanceId });
      else if (!def.compatibleRooms.includes(instance.roomId)) {
        issues.push({ code: 'incompatible-instance-room', decorationId, instanceId });
      }
    }
    if (!def.compatibleSurfaces.includes(instance.surfaceType)) {
      issues.push({ code: 'incompatible-instance-surface', decorationId, instanceId });
    }
    if (
      !Number.isFinite(instance.normalizedX) ||
      !Number.isFinite(instance.normalizedY) ||
      instance.normalizedX < 0 ||
      instance.normalizedX > 1 ||
      instance.normalizedY < 0 ||
      instance.normalizedY > 1
    ) {
      issues.push({ code: 'invalid-instance-coordinates', decorationId, instanceId });
    }
    if (!Number.isFinite(instance.depth))
      issues.push({ code: 'invalid-instance-depth', decorationId, instanceId });

    const projection = state.placements?.[decorationId];
    if (instance.roomId === null && projection) {
      issues.push({ code: 'inventory-placement-conflict', decorationId, instanceId });
    } else if (instance.roomId !== null && !projection) {
      issues.push({ code: 'missing-placement-projection', decorationId, instanceId });
    } else if (
      instance.roomId !== null &&
      projection &&
      (projection.surface !== instance.surfaceType ||
        projection.x !== instance.normalizedX ||
        projection.y !== instance.normalizedY)
    ) {
      issues.push({ code: 'mismatched-placement-projection', decorationId, instanceId });
    }
  }
  for (const [decorationId, placement] of Object.entries(state.placements ?? {})) {
    const def = DECORATIONS_BY_ID[decorationId];
    if (!def) {
      issues.push({ code: 'unknown-placement-decoration', decorationId });
      continue;
    }
    if (!ownershipCounts.has(decorationId))
      issues.push({ code: 'unowned-placement', decorationId });
    if (!isValidPlacement(decorationId, placement.surface, placement.x, placement.y)) {
      issues.push({ code: 'invalid-placement-projection', decorationId });
    }
  }
  for (const decorationId of ownershipCounts.keys()) {
    if (DECORATIONS_BY_ID[decorationId] && !decorationIds.has(decorationId)) {
      issues.push({ code: 'missing-instance', decorationId });
    }
  }
  return issues;
}

/**
 * Reconcile a decoration instance with the authoritative room-region model:
 * ensure it carries a valid semantic `regionKind`, and RELOCATE any placed item
 * whose stored point is on the wrong support (e.g. a legacy save with a wall
 * item saved onto the floor band, or a floor item drifted onto the ceiling).
 * Items that already sit on one of their compatible support planes keep their
 * exact coordinates — only genuinely misplaced pieces move. Returns whether the
 * instance changed. Inventory items only record a sensible kind.
 */
function reconcileInstanceRegion(
  instance: DecorationInstance,
  def: DecorationDef,
  /** the next free default spot in a room, so pieces relocated together never stack. */
  nextSlot: (roomId: string) => number = () => 0,
): boolean {
  const desiredKind: PlacementRegionKind =
    instance.regionKind && def.compatibleRegionKinds.includes(instance.regionKind)
      ? instance.regionKind
      : def.defaultRegionKind;

  if (instance.roomId === null) {
    if (instance.regionKind === desiredKind) return false;
    instance.regionKind = desiredKind;
    return true;
  }

  const compatible = compatibleRegionsForProfile(instance.roomId, def);
  const point = { x: instance.normalizedX, y: instance.normalizedY };
  const preferred = compatible.find((region) => region.kind === desiredKind);
  const onPlane =
    preferred && projectPointToRegion(preferred, point).inside
      ? preferred
      : compatible.find((region) => projectPointToRegion(region, point).inside);

  if (onPlane) {
    const surface = projectSurfaceType(onPlane.surfaceType);
    const changed = instance.regionKind !== onPlane.kind || instance.surfaceType !== surface;
    instance.regionKind = onPlane.kind;
    instance.surfaceType = surface;
    return changed;
  }

  // Near-edge preservation: an item saved at a legacy band edge can fall just
  // outside the (slightly tighter) v8 plane. If it only needs a small nudge back
  // onto a compatible support, clamp it there and keep it rather than yanking it
  // to a default slot — this protects the exact positions in existing saves.
  const target = preferred ?? compatible[0];
  if (target) {
    const clamped = clampPointToValidRegion(target, point);
    if (clamped && Math.hypot(clamped.point.x - point.x, clamped.point.y - point.y) <= 0.06) {
      const surface = projectSurfaceType(target.surfaceType);
      const changed =
        instance.regionKind !== target.kind ||
        instance.surfaceType !== surface ||
        instance.normalizedX !== clamped.point.x ||
        instance.normalizedY !== clamped.point.y;
      instance.regionKind = target.kind;
      instance.surfaceType = surface;
      instance.normalizedX = clamped.point.x;
      instance.normalizedY = clamped.point.y;
      return changed;
    }
  }

  // The stored point is genuinely on the wrong surface. Relocate it onto a tidy
  // default of its default kind (each relocated piece in a room on its own spot).
  const fallback = defaultCompatiblePlacement(instance.roomId, def, nextSlot(instance.roomId));
  if (!fallback) {
    if (instance.regionKind === desiredKind) return false;
    instance.regionKind = desiredKind;
    return true;
  }
  instance.regionKind = fallback.region.kind;
  instance.surfaceType = projectSurfaceType(fallback.region.surfaceType);
  instance.normalizedX = fallback.point.x;
  instance.normalizedY = fallback.point.y;
  instance.depth = fallback.region.depth.default;
  return true;
}

/**
 * Repair the v7 source model deterministically and rebuild the v6 compatibility
 * projection. Valid ownership is never discarded: an orphaned known instance
 * restores its ownership token, while every owned catalogue item gets exactly
 * one stable instance. Unknown catalogue instances are retained in inventory.
 */
export function repairDecorationInstances(state: GameState): string[] {
  if (!Array.isArray(state.decorationInstances)) state.decorationInstances = [];
  if (!state.placements || typeof state.placements !== 'object') state.placements = {};
  const changed = new Set<string>();
  const mark = (id: string) => changed.add(id);
  // Pieces moved off a wrong surface in one pass take a room's default spots in
  // turn instead of piling onto its first one.
  const relocated = new Map<string, number>();
  const nextSlot = (roomId: string) => {
    const index = relocated.get(roomId) ?? 0;
    relocated.set(roomId, index + 1);
    return index;
  };

  // Collapse duplicate known ownership flags without touching unrelated or
  // unknown secrets, which may belong to newer content.
  const seenOwnership = new Set<string>();
  state.collections.secrets = state.collections.secrets.filter((secret) => {
    if (!secret.startsWith('deco:')) return true;
    const id = secret.slice(5);
    if (!DECORATIONS_BY_ID[id] || !seenOwnership.has(id)) {
      seenOwnership.add(id);
      return true;
    }
    mark(id);
    return false;
  });

  // A known instance is stronger recovery evidence than a missing token.
  for (const instance of state.decorationInstances) {
    if (
      !DECORATIONS_BY_ID[instance.decorationId] ||
      isDecorationOwned(state, instance.decorationId)
    )
      continue;
    state.collections.secrets.push(`deco:${instance.decorationId}`);
    seenOwnership.add(instance.decorationId);
    mark(instance.decorationId);
  }

  const repaired: DecorationInstance[] = [];
  const usedIds = new Set<string>();
  const represented = new Set<string>();
  for (const instance of state.decorationInstances) {
    const def = DECORATIONS_BY_ID[instance.decorationId];
    if (!def) {
      // Preserve unknown/newer content without interpreting its room or
      // metadata. Rename only colliding ids, which cannot both be stable.
      if (usedIds.has(instance.instanceId)) {
        instance.instanceId = uniqueInstanceId(
          { ...state, decorationInstances: repaired } as GameState,
          instance.instanceId,
        );
        mark(instance.decorationId);
      }
      usedIds.add(instance.instanceId);
      repaired.push(instance);
      continue;
    }
    // The legacy ownership format supports one copy per catalogue item. Keep
    // the first stable instance and discard only invalid duplicates.
    if (represented.has(instance.decorationId)) {
      mark(instance.decorationId);
      continue;
    }
    represented.add(instance.decorationId);

    if (!instance.instanceId || usedIds.has(instance.instanceId)) {
      instance.instanceId = uniqueInstanceId(
        { ...state, decorationInstances: repaired } as GameState,
        legacyDecorationInstanceId(instance.decorationId),
      );
      mark(instance.decorationId);
    }
    usedIds.add(instance.instanceId);

    if (
      instance.roomId !== null &&
      (!ROOMS_BY_ID[instance.roomId] || !def.compatibleRooms.includes(instance.roomId))
    ) {
      instance.roomId = null;
      mark(instance.decorationId);
    }
    if (!def.compatibleSurfaces.includes(instance.surfaceType)) {
      instance.surfaceType = decorationSurface(instance.decorationId);
      mark(instance.decorationId);
    }
    const fallback = defaultPlacement(instance.decorationId);
    const x = Number.isFinite(instance.normalizedX) ? instance.normalizedX : fallback.x;
    const y = Number.isFinite(instance.normalizedY) ? instance.normalizedY : fallback.y;
    const nextX = Math.max(0.04, Math.min(0.96, x));
    // When the item carries a semantic regionKind the region model owns its
    // placement, so only keep the coordinate in-bounds and let
    // reconcileInstanceRegion fit it to the correct plane. Clamping to the
    // legacy floor band here would wrongly drag tabletop/shelf items (whose
    // projected surface is "floor" but which sit high up) down onto the floor.
    const nextY = instance.regionKind
      ? Math.max(0, Math.min(1, y))
      : isLegacySurface(instance.surfaceType)
        ? clampToSurface(instance.surfaceType, y)
        : Math.max(0, Math.min(1, y));
    if (nextX !== instance.normalizedX || nextY !== instance.normalizedY)
      mark(instance.decorationId);
    instance.normalizedX = nextX;
    instance.normalizedY = nextY;
    if (!Number.isFinite(instance.depth)) {
      instance.depth = isLegacySurface(instance.surfaceType)
        ? surfaceZ(instance.decorationId, instance.surfaceType)
        : 0;
      mark(instance.decorationId);
    }
    if (reconcileInstanceRegion(instance, def, nextSlot)) mark(instance.decorationId);
    repaired.push(instance);
  }
  state.decorationInstances = repaired;

  // Backfill every valid purchase, deriving placed/inventory state from the
  // legacy projection exactly once. This preserves v6 stowed items.
  for (const def of DECORATIONS) {
    if (!isDecorationOwned(state, def.id) || represented.has(def.id)) continue;
    const placement = state.placements[def.id];
    const fallback = placement ?? defaultPlacement(def.id);
    let instanceId = legacyDecorationInstanceId(def.id);
    if (usedIds.has(instanceId)) {
      let suffix = 2;
      while (usedIds.has(`${instanceId}-${suffix}`)) suffix += 1;
      instanceId = `${instanceId}-${suffix}`;
    }
    usedIds.add(instanceId);
    const backfilled: DecorationInstance = {
      instanceId,
      decorationId: def.id,
      roomId: placement ? def.room : null,
      surfaceType: fallback.surface,
      regionKind: def.defaultRegionKind,
      normalizedX: fallback.x,
      normalizedY: fallback.y,
      depth: surfaceZ(def.id, fallback.surface),
      flipped: false,
      rotation: 0,
      interactionState: {},
    };
    reconcileInstanceRegion(backfilled, def, nextSlot);
    state.decorationInstances.push(backfilled);
    represented.add(def.id);
    mark(def.id);
  }

  // The instance model is authoritative on load; regenerate the old map used
  // by current renderers. Unknown projection entries are left for the legacy
  // repair pass, which already removes them safely.
  for (const instance of state.decorationInstances) {
    const def = DECORATIONS_BY_ID[instance.decorationId];
    if (!def) continue;
    if (instance.roomId === null || !isLegacySurface(instance.surfaceType)) {
      if (state.placements[instance.decorationId]) mark(instance.decorationId);
      delete state.placements[instance.decorationId];
      continue;
    }
    const projection: DecorationPlacement = {
      surface: instance.surfaceType,
      x: instance.normalizedX,
      y: instance.normalizedY,
    };
    const previous = state.placements[instance.decorationId];
    if (
      !previous ||
      previous.surface !== projection.surface ||
      previous.x !== projection.x ||
      previous.y !== projection.y
    ) {
      state.placements[instance.decorationId] = projection;
      mark(instance.decorationId);
    }
  }

  return [...changed];
}
