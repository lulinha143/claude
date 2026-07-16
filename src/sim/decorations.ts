import type { GameState } from './types';
import { DECORATIONS, DECORATIONS_BY_ID } from '../content/decorations';
import type { DecorationDef } from '../content/types';
import {
  decorationSurface,
  defaultPlacement,
  isValidPlacement,
  clampToSurface,
  type DecorationPlacement,
  type DecorationSurface,
} from './surfaces';

// Decoration model
// ----------------
// Ownership lives in `collections.secrets` as `deco:<id>` (unchanged, so old
// saves keep their purchases). WHERE an owned decoration sits is a separate
// map, `state.placements` (decorationId -> { surface, x, y }) using room-local
// NORMALISED coordinates. An owned decoration with no placement entry is "in
// the inventory": bought but not currently shown in the office.
//
// Free placement replaces the old fixed-anchor system: the player chooses the
// exact spot inside a valid surface; the engine only clamps to the surface band
// and the room bounds.

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

/** Every decoration the player owns that belongs to this room. */
export function ownedDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return DECORATIONS.filter((d) => d.room === roomId && isDecorationOwned(state, d.id));
}

export interface PlacedDecoration {
  def: DecorationDef;
  placement: DecorationPlacement;
}

/** Owned + placed decorations in a room, each with its resolved placement. */
export function placedDecorationsInRoom(state: GameState, roomId: string): PlacedDecoration[] {
  const out: PlacedDecoration[] = [];
  for (const def of ownedDecorationsInRoom(state, roomId)) {
    const placement = placedPlacement(state, def.id);
    if (placement) out.push({ def, placement });
  }
  return out;
}

/** Owned decorations sitting in the inventory (not placed) for a room. */
export function inventoryDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return ownedDecorationsInRoom(state, roomId).filter((d) => !isDecorationPlaced(state, d.id));
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
export function placedCountOnSurface(state: GameState, roomId: string, surface: DecorationSurface): number {
  return placedDecorationsInRoom(state, roomId).filter((p) => p.placement.surface === surface).length;
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
    if (!isValidPlacement(id, p.surface, p.x, p.y)) {
      state.placements[id] = placementAt(id, Number.isFinite(p.x) ? p.x : 0.5, Number.isFinite(p.y) ? p.y : 0.1);
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
