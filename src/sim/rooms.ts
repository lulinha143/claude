import type { GameState } from './types';
import { ROOMS, ROOMS_BY_ID } from '../content/rooms';
import type { RoomDef } from '../content/types';
import { EMPLOYEES_BY_ID } from '../content/employees';

export const DEFAULT_ROOM = 'founder-desk';

export function isRoomUnlocked(state: GameState, room: RoomDef): boolean {
  if (room.id === 'founder-desk') return true;
  if (room.unlock.upgradeId && (state.upgrades[room.unlock.upgradeId] ?? 0) > 0) return true;
  if (room.unlock.reputation && state.resources.reputation >= room.unlock.reputation) return true;
  return false;
}

export function isRoomIdUnlocked(state: GameState, roomId: string): boolean {
  const room = ROOMS_BY_ID[roomId];
  return !!room && isRoomUnlocked(state, room);
}

export function unlockedRooms(state: GameState): RoomDef[] {
  return ROOMS.filter((r) => isRoomUnlocked(state, r)).sort((a, b) => a.floor - b.floor);
}

export function countUnlockedRooms(state: GameState): number {
  return unlockedRooms(state).length;
}

/**
 * The room an employee is actually shown in. Resolution order:
 *   1. an explicit player assignment (rt.room), if that room exists AND is unlocked
 *   2. the employee's default department, if unlocked
 *   3. the Founder's Desk (always unlocked) as a guaranteed-valid fallback
 * This guarantees every hired employee is ALWAYS visible somewhere — the fix
 * for characters disappearing when their department isn't unlocked yet.
 */
export function resolveEmployeeRoom(state: GameState, employeeId: string): string {
  const rt = state.employees[employeeId];
  const def = EMPLOYEES_BY_ID[employeeId];
  if (rt && rt.room && ROOMS_BY_ID[rt.room] && isRoomIdUnlocked(state, rt.room)) {
    return rt.room;
  }
  if (def && ROOMS_BY_ID[def.room] && isRoomIdUnlocked(state, def.room)) {
    return def.room;
  }
  return DEFAULT_ROOM;
}

/** Hired employees currently displayed in a given room (after resolution). */
export function employeesInRoom(state: GameState, roomId: string): string[] {
  return Object.keys(state.employees).filter(
    (id) => state.employees[id]?.hired && resolveEmployeeRoom(state, id) === roomId,
  );
}

/**
 * Repairs invalid persisted placement data in-place. Clears any `room`
 * assignment that points at a nonexistent room so it falls back cleanly. Returns
 * the ids that were repaired (for dev-only logging). Never removes an employee.
 */
export function repairPlacements(state: GameState): string[] {
  const repaired: string[] = [];
  for (const [id, rt] of Object.entries(state.employees)) {
    if (!rt) continue;
    if (rt.room !== null && rt.room !== undefined && !ROOMS_BY_ID[rt.room]) {
      rt.room = null;
      repaired.push(id);
    }
  }
  return repaired;
}
