import type { EventRarity, GameState, HappeningsState, PendingIncident } from './types';
import type { GameEventDef } from '../content/types';
import {
  EVENT_MEMORIES,
  EVENT_PLACES,
  HAPPENINGS,
  WORLD_MOMENTS,
  type EventMemory,
  type WorldMomentDef,
} from '../content/happenings';
import { ROOM_PROFILES_BY_ID } from '../content/roomProfiles';
import { employeesInRoom, isRoomIdUnlocked, resolveEmployeeRoom } from './rooms';
import { isNight } from './roomPlay';

// Happenings, read from state. Pure: the engine owns every change and the dice.
// See content/happenings.ts for what an incident, a moment and a remembered
// choice are.

export function emptyHappenings(): HappeningsState {
  return { incidents: [], remarks: [], diary: [], sinceRare: 0 };
}

const hired = (state: GameState, id: string) => Boolean(state.employees[id]?.hired);

/**
 * The requirements this chapter added to events (the engine checks the older
 * ones itself): a whole cast on the payroll, several marks, someone in a room,
 * a room's routine done enough times, the night.
 */
export function meetsHappeningRequirements(
  state: GameState,
  def: GameEventDef,
  now: number,
): boolean {
  const needs = def.requires;
  if (!needs) return true;
  if (needs.hiredAll && !needs.hiredAll.every((id) => hired(state, id))) return false;
  if (needs.flags && !needs.flags.every((flag) => flag in state.flags)) return false;
  if (needs.staffed && employeesInRoom(state, needs.staffed).length === 0) return false;
  if (needs.roomDone) {
    const done = state.office?.rooms?.[needs.roomDone.room]?.done ?? 0;
    if (done < needs.roomDone.count) return false;
  }
  if (needs.night && !isNight(now)) return false;
  return true;
}

/** Where an event happens, and who points it out: as specific as the content allows. */
export function eventPlace(
  state: GameState,
  def: GameEventDef,
): { roomId: string; employeeId?: string } {
  const open = (roomId: string | undefined): roomId is string =>
    Boolean(roomId) && isRoomIdUnlocked(state, roomId as string);
  // The teammate it is about presents it, wherever they work (unless the event
  // names its own room, in which case they go there to show you).
  const subject = def.employeeId && hired(state, def.employeeId) ? def.employeeId : undefined;
  const named = [def.room, def.requires?.room].find(open);
  if (subject) return { roomId: named ?? resolveEmployeeRoom(state, subject), employeeId: subject };
  const roomId = named ?? EVENT_PLACES[def.id]?.find(open) ?? 'founder-desk';
  // Otherwise whoever knows the room best points it out: a specialist, else anyone there.
  const people = employeesInRoom(state, roomId);
  const specialists = new Set(ROOM_PROFILES_BY_ID[roomId]?.specialists ?? []);
  const presenter = people.find((id) => specialists.has(id)) ?? people[0];
  return presenter ? { roomId, employeeId: presenter } : { roomId };
}

/**
 * How likely each rarity is right now. Rare and legendary grow with the
 * company's event luck and through a long run of incidents without one, so a
 * rare event is genuinely rare but never out of reach.
 */
export function rarityOdds(luck: number, sinceRare: number): Record<EventRarity, number> {
  const base = HAPPENINGS.tierOdds;
  const lucky = 1 + Math.min(HAPPENINGS.maxLuck, Math.max(0, luck)) * HAPPENINGS.luckScale;
  const drought = 1 + Math.max(0, sinceRare - HAPPENINGS.droughtAfter) * HAPPENINGS.droughtStep;
  return {
    common: base.common,
    uncommon: base.uncommon,
    rare: base.rare * lucky * drought,
    legendary: base.legendary * lucky * drought,
  };
}

const TIERS: EventRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/**
 * Pick an incident: a rarity first (by its odds, among the rarities that have
 * something eligible), then an event within it by the events' own weights.
 * `roll` returns a number in [0, 1).
 */
export function pickIncident(
  pool: readonly GameEventDef[],
  odds: Record<EventRarity, number>,
  roll: () => number,
): GameEventDef | null {
  const byTier = new Map<EventRarity, GameEventDef[]>();
  for (const def of pool) {
    if (def.weight <= 0) continue;
    byTier.set(def.rarity, [...(byTier.get(def.rarity) ?? []), def]);
  }
  const tiers = TIERS.filter((tier) => byTier.has(tier));
  if (!tiers.length) return null;
  const totalOdds = tiers.reduce((sum, tier) => sum + odds[tier], 0);
  let pickTier = roll() * totalOdds;
  const tier = tiers.find((candidate) => (pickTier -= odds[candidate]) < 0) ?? tiers[0];
  const events = byTier.get(tier)!;
  let pick = roll() * events.reduce((sum, def) => sum + def.weight, 0);
  return events.find((def) => (pick -= def.weight) < 0) ?? events[0];
}

/** Who is in an event's scene: whoever presents it, then the rest of its cast on the payroll. */
export function eventCast(
  state: GameState,
  def: GameEventDef,
  place?: { employeeId?: string },
): string[] {
  const people = [place?.employeeId, def.employeeId, ...(def.cast ?? [])].filter(
    (id): id is string => typeof id === 'string' && hired(state, id),
  );
  return [...new Set(people)];
}

/** Incidents waiting in a room. */
export function incidentsIn(state: GameState, roomId: string): PendingIncident[] {
  return (state.happenings?.incidents ?? []).filter((item) => item.roomId === roomId);
}

/** Small moments that could play out now. */
export function eligibleMoments(state: GameState, now: number): WorldMomentDef[] {
  return WORLD_MOMENTS.filter((def) => {
    if (def.weight <= 0) return false;
    if ((state.eventCooldowns[`moment:${def.id}`] ?? 0) > now) return false;
    if (!def.cast.every((id) => hired(state, id))) return false;
    const needs = def.requires;
    if (!needs) return true;
    if (needs.night && !isNight(now)) return false;
    if (needs.flag && !(needs.flag in state.flags)) return false;
    const rooms = def.cast.map((id) => resolveEmployeeRoom(state, id));
    if (needs.together && new Set(rooms).size > 1) return false;
    if (needs.room && !rooms.includes(needs.room)) return false;
    return true;
  });
}

/** What a teammate remembers of the player's choices (lines for `memory.<key>`). */
export function memoriesFor(state: GameState, employeeId: string): EventMemory[] {
  return EVENT_MEMORIES.filter(
    (memory) => memory.employeeId === employeeId && memory.flag in state.flags,
  );
}

/** Remarks a teammate has waiting (said when the player is next around). */
export function remarksDue(
  state: GameState,
  now: number,
): Array<{ employeeId: string; key: string }> {
  return (state.happenings?.remarks ?? []).filter(
    (remark) => remark.at <= now && hired(state, remark.employeeId),
  );
}

/**
 * What happened in the office since `since`: the foundation a returning player
 * is told from (the incidents waiting, what the team handled or let pass,
 * moments, consequences that arrived, and who has something to say).
 */
export function happenedSince(state: GameState, since: number) {
  const diary = (state.happenings?.diary ?? []).filter((entry) => entry.at > since);
  const count = (kind: string) => diary.filter((entry) => entry.kind === kind).length;
  return {
    entries: diary,
    started: count('incident'),
    handled: count('handled'),
    faded: count('faded'),
    moments: count('moment'),
    landed: count('landed'),
    waiting: state.happenings?.incidents.length ?? 0,
    remarks: state.happenings?.remarks.length ?? 0,
  };
}
