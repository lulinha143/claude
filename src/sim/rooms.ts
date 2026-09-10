import type { GameState } from './types';
import { ROOMS, ROOMS_BY_ID } from '../content/rooms';
import type { RoomDef } from '../content/types';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { affinityMultiplier } from './affinity';

export const DEFAULT_ROOM = 'founder-desk';

/**
 * How many teammates a room can hold. A HARD limit, not a visual preference:
 * every room composition is authored for one to four occupants, and a fifth
 * character would have nowhere designed to stand.
 *
 * It lives here, in the framework-free layer, because it has to be the same number
 * for the layout, the renderer, the assignment UI and the engine. It used to be a
 * private constant inside the office component, which is why the drag-and-drop path
 * respected it and the room dropdown, auto-arrange and the fallback resolution
 * below did not.
 */
export const ROOM_CAP = 4;

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

/** Whether a room has a free desk right now. */
export function roomHasSpace(state: GameState, roomId: string): boolean {
  return employeesInRoom(state, roomId).length < ROOM_CAP;
}

/** True when the player deliberately put this employee somewhere reachable. */
function hasExplicitRoom(state: GameState, employeeId: string): boolean {
  const room = state.employees[employeeId]?.room;
  return !!room && !!ROOMS_BY_ID[room] && isRoomIdUnlocked(state, room);
}

/**
 * The room an employee would most like, out of those with a free desk.
 *
 * Preference order is deliberate rather than arbitrary, because this is what runs
 * when the company outgrows a room and somebody has to move: their own department
 * first, then anywhere they work well, and only then the emptiest room going. Ties
 * break on floor then id so the same save always produces the same seating.
 */
export function bestRoomWithSpace(
  state: GameState,
  employeeId: string,
  occupancy?: Map<string, number>,
): string | null {
  const count = (roomId: string) =>
    occupancy ? (occupancy.get(roomId) ?? 0) : employeesInRoom(state, roomId).length;
  const open = unlockedRooms(state).filter((r) => count(r.id) < ROOM_CAP);
  if (open.length === 0) return null;

  const home = EMPLOYEES_BY_ID[employeeId]?.room;
  const homeRoom = open.find((r) => r.id === home);
  if (homeRoom) return homeRoom.id;

  const scored = open
    .map((room) => ({
      room,
      // How well they work there, then how much space it has left.
      affinity: affinityMultiplier(employeeId, room.id),
      free: ROOM_CAP - count(room.id),
    }))
    .sort(
      (a, b) =>
        b.affinity - a.affinity ||
        b.free - a.free ||
        a.room.floor - b.room.floor ||
        a.room.id.localeCompare(b.room.id),
    );
  return scored[0].room.id;
}

/**
 * Makes the room capacity true, by writing explicit assignments for anyone who
 * would otherwise be standing in an over-full room.
 *
 * This exists because occupancy is DERIVED, not stored: an employee with no
 * assignment (or one pointing at a room that is still locked) resolves to their
 * department, and failing that to the Founder's Desk. So a room could exceed the
 * cap without a single assignment ever being made — early on, every unassigned
 * hire resolves to the same desk. Enforcing the cap only where the player clicks
 * would leave that untouched.
 *
 * Returns the ids that were rehomed, and is safe to call repeatedly: once the
 * invariant holds it does nothing.
 */
export function enforceRoomCapacity(state: GameState): string[] {
  const moved: string[] = [];
  const open = unlockedRooms(state);
  if (open.length === 0) return moved;

  const occupancy = new Map<string, number>(open.map((r) => [r.id, 0]));
  const hired = Object.keys(state.employees).filter((id) => state.employees[id]?.hired);

  // Seat deliberate assignments first: when a room is over-full, the teammate who
  // is only there through the fallback is the one who should move, not the one the
  // player put there on purpose.
  const bySeniority = [
    ...hired.filter((id) => hasExplicitRoom(state, id)),
    ...hired.filter((id) => !hasExplicitRoom(state, id)),
  ];

  const overflow: string[] = [];
  for (const id of bySeniority) {
    const room = resolveEmployeeRoom(state, id);
    const seated = occupancy.get(room);
    if (seated === undefined || seated >= ROOM_CAP) {
      overflow.push(id);
      continue;
    }
    occupancy.set(room, seated + 1);
  }

  for (const id of overflow) {
    const target = bestRoomWithSpace(state, id, occupancy);
    // Nowhere to go at all (a pathological save with more teammates than desks):
    // leave them standing rather than deleting anyone. The layout still copes.
    if (!target) continue;
    state.employees[id]!.room = target;
    occupancy.set(target, (occupancy.get(target) ?? 0) + 1);
    moved.push(id);
  }
  return moved;
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
