import type { GameState } from './types';
import { DECORATIONS, DECORATIONS_BY_ID } from '../content/decorations';
import type { DecorationDef } from '../content/types';
import { anchorsForRoom, anchorById, type DecorAnchor } from '../content/roomLayout';

// Decoration model
// ----------------
// Ownership lives in `collections.secrets` as `deco:<id>` (unchanged, so old
// saves keep their purchases). WHERE an owned decoration sits is a separate
// map, `state.placements` (decorationId -> anchorId within the decoration's
// room). An owned decoration that isn't in `placements` is "in the inventory":
// bought but not currently shown in the office.
//
// This split makes place / move / remove reliable and undoable, and keeps the
// morale-comfort readout tied to what is actually on display.

export function isDecorationOwned(state: GameState, id: string): boolean {
  return state.collections.secrets.includes(`deco:${id}`);
}

/** The anchor an owned decoration is placed at, if it is currently placed. */
export function placedAnchorId(state: GameState, id: string): string | null {
  if (!isDecorationOwned(state, id)) return null;
  const anchorId = state.placements?.[id];
  if (!anchorId) return null;
  const def = DECORATIONS_BY_ID[id];
  if (!def || !anchorById(def.room, anchorId)) return null;
  return anchorId;
}

export function isDecorationPlaced(state: GameState, id: string): boolean {
  return placedAnchorId(state, id) !== null;
}

/** Every decoration the player owns that belongs to this room. */
export function ownedDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return DECORATIONS.filter((d) => d.room === roomId && isDecorationOwned(state, d.id));
}

export interface PlacedDecoration {
  def: DecorationDef;
  anchor: DecorAnchor;
}

/** Owned + placed decorations in a room, each with its resolved anchor. */
export function placedDecorationsInRoom(state: GameState, roomId: string): PlacedDecoration[] {
  const out: PlacedDecoration[] = [];
  for (const def of ownedDecorationsInRoom(state, roomId)) {
    const anchorId = placedAnchorId(state, def.id);
    if (!anchorId) continue;
    const anchor = anchorById(roomId, anchorId);
    if (anchor) out.push({ def, anchor });
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

/** decorationId currently occupying a given anchor in a room, if any. */
export function decorationAtAnchor(state: GameState, roomId: string, anchorId: string): string | null {
  for (const def of ownedDecorationsInRoom(state, roomId)) {
    if (placedAnchorId(state, def.id) === anchorId) return def.id;
  }
  return null;
}

export function occupiedAnchorIds(state: GameState, roomId: string): Set<string> {
  const set = new Set<string>();
  for (const def of ownedDecorationsInRoom(state, roomId)) {
    const a = placedAnchorId(state, def.id);
    if (a) set.add(a);
  }
  return set;
}

export function freeAnchorsInRoom(state: GameState, roomId: string): DecorAnchor[] {
  const taken = occupiedAnchorIds(state, roomId);
  return anchorsForRoom(roomId).filter((a) => !taken.has(a.id));
}

export function firstFreeAnchorId(state: GameState, roomId: string): string | null {
  return freeAnchorsInRoom(state, roomId)[0]?.id ?? null;
}

/**
 * Normalizes `state.placements` in-place so rendering is always valid:
 *   - drops entries for decorations that don't exist / aren't owned
 *   - drops entries whose anchor isn't valid for the decoration's room
 *   - resolves anchor collisions (two decorations on one anchor) by moving the
 *     extra one to a free anchor, or to the inventory if none is free
 *   - migrates legacy saves: an owned decoration with no placement is auto-placed
 *     into a free anchor UNLESS it was explicitly hidden via the old
 *     `decohide:<id>` flag, in which case it stays in the inventory
 * Returns the ids whose placement changed (dev logging only).
 */
export function repairDecorations(state: GameState): string[] {
  if (!state.placements || typeof state.placements !== 'object') state.placements = {};
  const changed: string[] = [];
  const secrets = state.collections.secrets;

  // 1. drop invalid placement entries
  for (const [id, anchorId] of Object.entries(state.placements)) {
    const def = DECORATIONS_BY_ID[id];
    if (!def || !isDecorationOwned(state, id) || !anchorById(def.room, anchorId)) {
      delete state.placements[id];
      changed.push(id);
    }
  }

  // 2. resolve anchor collisions per room + migrate legacy owned decorations
  const rooms = new Set(DECORATIONS.map((d) => d.room));
  for (const roomId of rooms) {
    const used = new Set<string>();
    for (const def of ownedDecorationsInRoom(state, roomId)) {
      const current = state.placements[def.id];
      if (current) {
        if (used.has(current)) {
          // collision: move to a free anchor or fall back to inventory
          const free = anchorsForRoom(roomId).find((a) => !used.has(a.id));
          if (free) {
            state.placements[def.id] = free.id;
            used.add(free.id);
          } else {
            delete state.placements[def.id];
          }
          changed.push(def.id);
        } else {
          used.add(current);
        }
      }
    }
    // legacy migration for owned-but-unplaced decorations
    for (const def of ownedDecorationsInRoom(state, roomId)) {
      if (state.placements[def.id]) continue;
      const legacyHidden = secrets.includes(`decohide:${def.id}`);
      if (legacyHidden) continue; // respect old "hidden" choice -> stays in inventory
      const free = anchorsForRoom(roomId).find((a) => !used.has(a.id));
      if (free) {
        state.placements[def.id] = free.id;
        used.add(free.id);
        changed.push(def.id);
      }
    }
  }

  // 3. clear obsolete legacy hide flags now that placement is authoritative
  for (let i = secrets.length - 1; i >= 0; i--) {
    if (secrets[i].startsWith('decohide:')) secrets.splice(i, 1);
  }

  return changed;
}
