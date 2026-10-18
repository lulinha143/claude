import type { EventRarity, GameState, HappeningsState, PendingIncident } from './types';
import type { EventChoice, GameEventDef } from '../content/types';
import {
  EVENT_MEMORIES,
  EVENT_PLACES,
  HAPPENINGS,
  WORLD_MOMENTS,
  type EventMemory,
  type WorldMomentDef,
} from '../content/happenings';
import { GAME_EVENTS } from '../content/events';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { ODDITIES, ODDITIES_BY_ID, oddityFlag, type OddityDef } from '../content/roomPlay';
import { ROOM_PROFILES_BY_ID } from '../content/roomProfiles';
import { employeesInRoom, isRoomIdUnlocked, resolveEmployeeRoom } from './rooms';
import { isNight, oddityNoticed } from './roomPlay';

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

// ---- discoveries lead somewhere ----------------------------------------------------
//
// The connections between what the player has noticed and what it led to, read
// from the content itself (what each curiosity and each incident needs before it
// can turn up) and from the company's own marks. Nothing here is stored: the
// curiosity log asks these questions of the save it is showing.

/** Every choice in an event, its steps' too, with the step it belongs to. */
function choicesOf(def: GameEventDef): Array<{ choice: EventChoice; step: string | null }> {
  return [
    ...def.choices.map((choice) => ({ choice, step: null })),
    ...Object.entries(def.steps ?? {}).flatMap(([step, part]) =>
      part.choices.map((choice) => ({ choice, step })),
    ),
  ];
}

/** The decision that leaves a mark (the first event and choice that sets it), if one does. */
export function decisionSetting(flag: string): { event: GameEventDef; choice: EventChoice } | null {
  for (const event of GAME_EVENTS) {
    for (const { choice } of choicesOf(event)) {
      if (choice.effects.some((effect) => effect.type === 'setFlag' && effect.flagId === flag)) {
        return { event, choice };
      }
    }
  }
  return null;
}

/** What made a curiosity possible at all: shown once it has been noticed, never before. */
export type CuriosityOrigin =
  /** it only turns up once another curiosity has been noticed. */
  | { kind: 'oddity'; def: OddityDef }
  /** it is the aftermath of a choice. */
  | { kind: 'decision'; event: GameEventDef; choice: EventChoice }
  /** a teammate showed the way in their story. */
  | { kind: 'story'; employeeId: string }
  /** something placed in the room brought it out. */
  | { kind: 'decoration'; decorationId: string }
  /** it needs someone on the payroll. */
  | { kind: 'hired'; employeeId: string }
  /** it only comes out after dark. */
  | { kind: 'night' };

export function curiosityOrigins(def: OddityDef): CuriosityOrigin[] {
  const needs = def.requires;
  const out: CuriosityOrigin[] = [];
  if (needs?.flag) {
    const story = /^([a-z]+)\.arc\.(?:\d|done)/.exec(needs.flag);
    const previous = needs.flag.startsWith('oddity.')
      ? ODDITIES_BY_ID[needs.flag.slice('oddity.'.length)]
      : undefined;
    const decision = previous || story ? null : decisionSetting(needs.flag);
    if (previous) out.push({ kind: 'oddity', def: previous });
    else if (story && EMPLOYEES_BY_ID[story[1]]) out.push({ kind: 'story', employeeId: story[1] });
    else if (decision) out.push({ kind: 'decision', ...decision });
  }
  if (needs?.decoration) out.push({ kind: 'decoration', decorationId: needs.decoration });
  if (needs?.hired) out.push({ kind: 'hired', employeeId: needs.hired });
  if (needs?.night) out.push({ kind: 'night' });
  return out;
}

/** Where a noticed curiosity leads, and how far the player has followed it. */
export type CuriosityLead =
  | {
      kind: 'oddity';
      def: OddityDef;
      /** found: noticed too; waiting: it has turned up in its room; open: not yet. */
      status: 'found' | 'waiting' | 'open';
    }
  | {
      kind: 'event';
      def: GameEventDef;
      /** decided: the player (or the team) made a call; happening: it is waiting now. */
      status: 'decided' | 'happening' | 'open';
      /** the call that was made, when the company's history still holds it. */
      choice?: EventChoice;
    };

export function curiosityLeads(state: GameState, id: string): CuriosityLead[] {
  const flag = oddityFlag(id);
  const oddities: CuriosityLead[] = ODDITIES.filter((other) => other.requires?.flag === flag).map(
    (other) => ({
      kind: 'oddity',
      def: other,
      status: oddityNoticed(state, other.id)
        ? 'found'
        : (state.office?.oddities ?? []).some((item) => item.id === other.id)
          ? 'waiting'
          : 'open',
    }),
  );
  const events: CuriosityLead[] = GAME_EVENTS.filter(
    (event) => event.requires?.flag === flag || event.requires?.flags?.includes(flag),
  ).map((event) => {
    const last = [...(state.eventHistory ?? [])]
      .reverse()
      .find((entry) => entry.eventId === event.id);
    const done = event.requires?.missingFlag
      ? event.requires.missingFlag in state.flags
      : Boolean(last);
    const happening =
      (state.happenings?.incidents ?? []).some((item) => item.eventId === event.id) ||
      state.eventInProgress?.eventId === event.id;
    const choice = last
      ? choicesOf(event).find((entry) => entry.choice.id === last.choiceId)?.choice
      : undefined;
    return {
      kind: 'event',
      def: event,
      status: done || last ? 'decided' : happening ? 'happening' : 'open',
      ...(choice ? { choice } : {}),
    };
  });
  return [...oddities, ...events];
}

/**
 * Leads the player is holding: noticed curiosities that point somewhere they have
 * not been yet. The clue is the curiosity's own lead line; where it points is
 * never named beyond what that line says.
 */
export function openLeads(state: GameState): OddityDef[] {
  return ODDITIES.filter(
    (def) =>
      def.lead &&
      oddityNoticed(state, def.id) &&
      curiosityLeads(state, def.id).some(
        (lead) => lead.status !== 'found' && lead.status !== 'decided',
      ),
  );
}

/**
 * Curiosities a lead points at, not noticed yet: the log marks their blank slot
 * ("a lead points here") without saying what is there.
 */
export function pointedAt(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const def of ODDITIES) {
    if (!oddityNoticed(state, def.id)) continue;
    for (const lead of curiosityLeads(state, def.id)) {
      if (lead.kind === 'oddity' && lead.status !== 'found') out.add(lead.def.id);
    }
  }
  return out;
}

/** The decision a secret file came out of (the first event and choice that files it). */
export function secretSource(
  secretId: string,
): { event: GameEventDef; choice: EventChoice } | null {
  for (const event of GAME_EVENTS) {
    for (const { choice } of choicesOf(event)) {
      if (
        choice.effects.some(
          (effect) => effect.type === 'unlockSecret' && effect.secretId === secretId,
        )
      ) {
        return { event, choice };
      }
    }
  }
  return null;
}
