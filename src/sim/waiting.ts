import type { GameState } from './types';
import { wavingTeammates } from './bonds';
import { availableFacilityDiscoveries } from './facilityDiscoveries';
import { resolveEmployeeRoom, unlockedRooms } from './rooms';
import { routineView } from './roomPlay';

// What is waiting in the office for the player right now, in its own room: the
// same things the floors mark (a ticket held up, a find, a waving teammate, a
// curiosity, a routine that is done) and nothing else. Read from state only, so
// a welcome-back note can point at them without inventing anything.

export type WaitingKind =
  'incident' | 'story' | 'find' | 'discovery' | 'ready' | 'parcel' | 'oddity';

export interface WaitingThing {
  kind: WaitingKind;
  roomId: string;
  employeeId?: string;
  /** finds: how many are waiting. */
  count?: number;
}

/**
 * Most worth noticing first: something happening (it will not wait forever),
 * someone with something to tell, a find, a thing to investigate, a routine that
 * is done or a delivery, a curiosity. A machine that needs a hand is left out: a
 * returning player is not handed a chore (the team frees it themselves).
 */
export function waitingInOffice(state: GameState, now: number): WaitingThing[] {
  const out: WaitingThing[] = [];
  for (const incident of state.happenings?.incidents ?? []) {
    out.push({ kind: 'incident', roomId: incident.roomId, employeeId: incident.employeeId });
  }
  for (const employeeId of wavingTeammates(state, now).keys()) {
    out.push({ kind: 'story', roomId: resolveEmployeeRoom(state, employeeId), employeeId });
  }
  const finds = state.finds ?? [];
  if (finds.length) {
    const first = finds[0];
    out.push({
      kind: 'find',
      roomId: resolveEmployeeRoom(state, first.employeeId),
      employeeId: first.employeeId,
      count: finds.length,
    });
  }
  for (const discovery of availableFacilityDiscoveries(state)) {
    out.push({ kind: 'discovery', roomId: discovery.roomId });
  }
  for (const room of unlockedRooms(state)) {
    const status = routineView(state, room.id, now)?.status;
    if (status === 'ready') out.push({ kind: 'ready', roomId: room.id });
    else if (status === 'parcel') out.push({ kind: 'parcel', roomId: room.id });
  }
  for (const oddity of state.office?.oddities ?? []) {
    out.push({ kind: 'oddity', roomId: oddity.roomId });
  }
  return out;
}
