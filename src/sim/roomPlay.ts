import type { GameState, RoomPlayState } from './types';
import {
  ODDITIES,
  ROOM_PLAY,
  ROOM_ROUTINES,
  odditiesInRoom,
  oddityFlag,
  type OddityDef,
  type RoutineKind,
  type TuneMode,
} from '../content/roomPlay';
import { ROOM_PROFILES_BY_ID } from '../content/roomProfiles';
import { BOND_THRESHOLDS } from '../content/stories';
import { decorationEnsembles } from './decorationEnsembles';
import { employeesInRoom, isRoomIdUnlocked } from './rooms';

// Room play, read from state. Pure: the engine owns every change and the dice;
// this module answers "what can be done in this room right now, and who helps".

export type HelperReason = 'specialist' | 'close' | 'set';

/** Someone (or something) making a room's routine better. */
export interface RoomHelper {
  /** an employee id, or a decoration set id. */
  id: string;
  reason: HelperReason;
}

/**
 * Who helps here: the room's specialists and the player's close friends working
 * in it, and a complete decoration set arranged in it. Shown in the routine's
 * tooltip, so the rule is never hidden.
 */
export function roomHelpers(state: GameState, roomId: string): RoomHelper[] {
  const out: RoomHelper[] = [];
  const specialists = new Set(ROOM_PROFILES_BY_ID[roomId]?.specialists ?? []);
  for (const id of employeesInRoom(state, roomId)) {
    if (specialists.has(id)) out.push({ id, reason: 'specialist' });
    else if ((state.employees[id]?.friendship ?? 0) >= BOND_THRESHOLDS.close) {
      out.push({ id, reason: 'close' });
    }
  }
  for (const set of decorationEnsembles(state)) {
    if (set.active && set.definition.roomId === roomId) {
      out.push({ id: set.definition.id, reason: 'set' });
    }
  }
  return out;
}

/** Helpers who are people (only people can free a stuck machine). */
export function peopleHelpers(state: GameState, roomId: string): RoomHelper[] {
  return roomHelpers(state, roomId).filter((helper) => helper.reason !== 'set');
}

export function roomPlayState(state: GameState, roomId: string): RoomPlayState {
  return state.office?.rooms?.[roomId] ?? {};
}

/** How long a brew takes here right now, helpers counted. */
export function brewSeconds(state: GameState, roomId: string): number {
  const routine = ROOM_ROUTINES[roomId];
  if (routine?.kind !== 'brew') return 0;
  const helpers = Math.min(2, roomHelpers(state, roomId).length);
  return Math.round(routine.seconds * (1 - ROOM_PLAY.brewHelperCut * helpers));
}

/** How long a blip stays on this room's screen, helpers counted. */
export function watchSeconds(state: GameState, roomId: string): number {
  const routine = ROOM_ROUTINES[roomId];
  if (routine?.kind !== 'watch') return 0;
  const helped = roomHelpers(state, roomId).length > 0;
  return Math.round(routine.seconds * (helped ? 1 + ROOM_PLAY.watchHelperBonus : 1));
}

export type RoutineStatus =
  /** brew: ready to start. */
  | 'idle'
  /** brew (a dream needs a sleeper) / tune: nobody works here. */
  | 'needsSomeone'
  /** brew: on its way. */
  | 'running'
  /** brew: done, waiting to be shared out. */
  | 'ready'
  /** tend / watch / deliver: nothing right now. */
  | 'quiet'
  /** tend: the machine needs a hand. */
  | 'jammed'
  /** watch: something is on the screen. */
  | 'blip'
  /** deliver: something is waiting. */
  | 'parcel'
  /** tune: the room's mode (or none chosen yet). */
  | 'mode';

export interface RoutineView {
  roomId: string;
  kind: RoutineKind;
  status: RoutineStatus;
  helpers: RoomHelper[];
  /** times the routine has been done here. */
  done: number;
  /** brew: 0..1 and seconds left. */
  progress?: number;
  remaining?: number;
  /** tend: taps taken and needed. */
  taps?: number;
  needed?: number;
  /** watch: when it goes. */
  until?: number;
  /** watch: seconds it was on screen for, in total. */
  window?: number;
  /** deliver: who it is for ('' = the company). */
  parcelFor?: string;
  /** tune. */
  mode?: string | null;
  modes?: readonly TuneMode[];
}

/** What a room's routine looks like right now, or null when the room has none (or is locked). */
export function routineView(state: GameState, roomId: string, now: number): RoutineView | null {
  const routine = ROOM_ROUTINES[roomId];
  if (!routine || !isRoomIdUnlocked(state, roomId)) return null;
  const rs = roomPlayState(state, roomId);
  const base = {
    roomId,
    kind: routine.kind,
    helpers: roomHelpers(state, roomId),
    done: rs.done ?? 0,
  };
  const staffed = employeesInRoom(state, roomId).length > 0;
  switch (routine.kind) {
    case 'brew': {
      if (rs.readyAt) {
        if (now >= rs.readyAt) return { ...base, status: 'ready', progress: 1, remaining: 0 };
        const started = rs.startedAt ?? rs.readyAt - routine.seconds * 1000;
        const total = Math.max(1, rs.readyAt - started);
        return {
          ...base,
          status: 'running',
          progress: Math.max(0, Math.min(1, (now - started) / total)),
          remaining: Math.ceil((rs.readyAt - now) / 1000),
        };
      }
      if (routine.needsSomeone && !staffed) return { ...base, status: 'needsSomeone' };
      return { ...base, status: 'idle' };
    }
    case 'tend':
      return rs.jamAt
        ? { ...base, status: 'jammed', taps: rs.taps ?? 0, needed: routine.taps }
        : { ...base, status: 'quiet' };
    case 'watch':
      return rs.blipUntil && rs.blipUntil > now
        ? {
            ...base,
            status: 'blip',
            until: rs.blipUntil,
            window: Math.max(1, Math.round((rs.blipUntil - (rs.blipAt ?? now)) / 1000)),
          }
        : { ...base, status: 'quiet' };
    case 'deliver':
      return rs.parcelAt
        ? { ...base, status: 'parcel', parcelFor: rs.parcelFor ?? '' }
        : { ...base, status: 'quiet' };
    case 'tune':
      return {
        ...base,
        status: staffed ? 'mode' : 'needsSomeone',
        mode: rs.mode ?? null,
        modes: routine.modes,
      };
  }
}

/** Something in this room wants the player now (shown on the elevator's floor list). */
export function routineWantsYou(view: RoutineView | null): boolean {
  return (
    view !== null &&
    (view.status === 'ready' ||
      view.status === 'jammed' ||
      view.status === 'blip' ||
      view.status === 'parcel')
  );
}

/**
 * The steady bonuses the rooms' chosen modes give right now. A mode works while
 * someone works in its room, which is the whole rule.
 */
export function activeModeEffects(state: GameState): Array<{ roomId: string; mode: TuneMode }> {
  const out: Array<{ roomId: string; mode: TuneMode }> = [];
  const rooms = state.office?.rooms;
  if (!rooms) return out;
  for (const [roomId, rs] of Object.entries(rooms)) {
    if (!rs?.mode) continue;
    const routine = ROOM_ROUTINES[roomId];
    if (routine?.kind !== 'tune') continue;
    const mode = routine.modes.find((candidate) => candidate.id === rs.mode);
    if (!mode || !isRoomIdUnlocked(state, roomId)) continue;
    if (employeesInRoom(state, roomId).length === 0) continue;
    out.push({ roomId, mode });
  }
  return out;
}

// ---- curiosities -------------------------------------------------------------

export function oddityNoticed(state: GameState, id: string): boolean {
  return oddityFlag(id) in state.flags;
}

/** Evening and night in the player's own time zone (some things only come out then). */
export function isNight(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= 20 || hour < 6;
}

function decorationIn(state: GameState, decorationId: string, roomId: string): boolean {
  return state.decorationInstances.some(
    (item) => item.decorationId === decorationId && item.roomId === roomId,
  );
}

/** Whether this curiosity could turn up now (unnoticed, its room open, its conditions met). */
export function oddityAvailable(state: GameState, def: OddityDef, now: number): boolean {
  if (!isRoomIdUnlocked(state, def.roomId) || oddityNoticed(state, def.id)) return false;
  const needs = def.requires;
  if (!needs) return true;
  if (needs.flag && !(needs.flag in state.flags)) return false;
  if (needs.hired && !state.employees[needs.hired]?.hired) return false;
  if (needs.decoration && !decorationIn(state, needs.decoration, def.roomId)) return false;
  if (needs.night && !isNight(now)) return false;
  return true;
}

/** Curiosities that can turn up on their own somewhere in the building right now. */
export function spontaneousOddities(state: GameState, now: number): OddityDef[] {
  const waiting = new Set((state.office?.oddities ?? []).map((item) => item.id));
  return ODDITIES.filter(
    (def) => def.anchor !== null && !waiting.has(def.id) && oddityAvailable(state, def, now),
  );
}

/** Curiosities this room's routine can still bring out. */
export function routineOddities(state: GameState, roomId: string, now: number): OddityDef[] {
  return odditiesInRoom(roomId).filter(
    (def) => def.anchor === null && oddityAvailable(state, def, now),
  );
}

/** How much of a room's curiosities the player has noticed. */
export function curiosityProgress(
  state: GameState,
  roomId: string,
): { noticed: number; total: number } {
  const all = odditiesInRoom(roomId);
  return {
    noticed: all.filter((def) => oddityNoticed(state, def.id)).length,
    total: all.length,
  };
}

/** The same, for the whole building. */
export function curiosityTotals(state: GameState): { noticed: number; total: number } {
  return {
    noticed: ODDITIES.filter((def) => oddityNoticed(state, def.id)).length,
    total: ODDITIES.length,
  };
}

/**
 * Who in a room reacts to what just happened there: a helper if there is one,
 * otherwise anyone working in it. `pick(n)` chooses an index (the engine's dice).
 */
export function speakerFor(
  state: GameState,
  roomId: string,
  pick: (n: number) => number,
): string | null {
  const helpers = peopleHelpers(state, roomId).map((helper) => helper.id);
  const pool = helpers.length > 0 ? helpers : employeesInRoom(state, roomId);
  if (pool.length === 0) return null;
  return pool[Math.max(0, Math.min(pool.length - 1, pick(pool.length)))];
}
