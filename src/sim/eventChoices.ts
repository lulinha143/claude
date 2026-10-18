import {
  EVENT_CONTENT_REPAIRS,
  createEventFallbackChoice,
  type EventFallbackKind,
} from '../content/events';
import type { EventChoice, GameEventDef } from '../content/types';
import { memoriesOf } from '../content/happenings';
import { ROOM_ROUTINES } from '../content/roomPlay';
import type { EmployeeMood, GameState } from './types';
import { CLICK } from './clickStations';
import { moraleCap } from './economy';
import { employeeMood } from './mood';
import { employeesInRoom } from './rooms';
import { eventRewardMultiplier } from './upgradeEffects';

export type EventRequirementKind = 'nuts' | 'goldenNuts' | 'reputation' | 'hiredEmployee' | 'flag';

export interface EventRequirementFailure {
  kind: EventRequirementKind;
  messageKey: string;
  required: number | string;
  current: number | boolean;
  employeeId?: string;
}

export interface EvaluatedEventChoice {
  choice: EventChoice;
  enabled: boolean;
  failures: readonly EventRequirementFailure[];
  fallback: boolean;
}

export interface EventChoiceSet {
  choices: readonly EvaluatedEventChoice[];
  repairs: readonly ('fewer-than-two' | 'no-actionable-choice' | 'duplicate-choice-id')[];
}

const reportedRepairs = new Set<string>();

export function authoredEventChoices(
  def: GameEventDef,
  step: string | null,
): readonly EventChoice[] {
  return step && def.steps?.[step] ? def.steps[step].choices : def.choices;
}

export function evaluateEventChoice(state: GameState, choice: EventChoice): EvaluatedEventChoice {
  const failures: EventRequirementFailure[] = [];
  const requires = choice.requires;

  if (requires?.nuts !== undefined && state.resources.nuts < requires.nuts) {
    failures.push({
      kind: 'nuts',
      messageKey: 'event.requirement.nuts',
      required: requires.nuts,
      current: state.resources.nuts,
    });
  }
  if (requires?.goldenNuts !== undefined && state.resources.goldenNuts < requires.goldenNuts) {
    failures.push({
      kind: 'goldenNuts',
      messageKey: 'event.requirement.goldenNuts',
      required: requires.goldenNuts,
      current: state.resources.goldenNuts,
    });
  }
  if (requires?.reputation !== undefined && state.resources.reputation < requires.reputation) {
    failures.push({
      kind: 'reputation',
      messageKey: 'event.requirement.reputation',
      required: requires.reputation,
      current: state.resources.reputation,
    });
  }
  if (requires?.hiredEmployee !== undefined) {
    const employee = state.employees[requires.hiredEmployee];
    if (!employee?.hired) {
      failures.push({
        kind: 'hiredEmployee',
        messageKey: 'event.requirement.employee',
        required: requires.hiredEmployee,
        current: false,
        employeeId: requires.hiredEmployee,
      });
    }
  }
  /* Consequence memory as a gate on a single CHOICE, not just a whole event.
     `requires.flag` has been part of the EventChoice type all along but was never
     evaluated here, so a choice authored as "only available if the company did X"
     was silently offered to everyone — content that looked gated and was not. It is
     what lets a callback event offer a different reply depending on what was said
     the first time. The flag id is deliberately NOT interpolated into the message:
     it is internal bookkeeping, not player-facing copy. */
  if (requires?.flag !== undefined && !(requires.flag in state.flags)) {
    failures.push({
      kind: 'flag',
      messageKey: 'event.requirement.flag',
      required: requires.flag,
      current: false,
    });
  }

  return {
    choice,
    enabled: failures.length === 0,
    failures,
    fallback: choice.id.startsWith('fallback-'),
  };
}

function unusedFallback(
  choices: readonly EventChoice[],
  preferred: EventFallbackKind,
): EventChoice {
  const order: readonly EventFallbackKind[] =
    preferred === 'decline' ? ['decline', 'postpone'] : ['postpone', 'decline'];
  for (const kind of order) {
    const fallback = createEventFallbackChoice(kind);
    if (!choices.some((choice) => choice.id === fallback.id)) return fallback;
  }
  const fallback = createEventFallbackChoice(preferred);
  return { ...fallback, id: `${fallback.id}-${choices.length + 1}` };
}

/**
 * Return the authoritative choice set used by both the renderer and engine.
 * Malformed/future content is repaired deterministically and always exposes an
 * immediately actionable path.
 */
export function eventChoicesForState(
  state: GameState,
  def: GameEventDef,
  step: string | null,
): EventChoiceSet {
  const authored = authoredEventChoices(def, step);
  const source = authored.filter(
    (choice, index) => authored.findIndex((candidate) => candidate.id === choice.id) === index,
  );
  const repairs: EventChoiceSet['repairs'][number][] = [];
  if (source.length !== authored.length) repairs.push('duplicate-choice-id');

  while (source.length < 2) {
    repairs.push('fewer-than-two');
    source.push(unusedFallback(source, source.length === 0 ? 'postpone' : 'decline'));
  }

  // If every authored path is conditional, keep a safe path present for the
  // whole event/step lifetime. Its identity must not disappear if resources
  // change during the popup's delayed exit animation.
  const hadActionableAuthoredChoice = source.some(
    (choice) => evaluateEventChoice(state, choice).enabled,
  );
  if (source.every((choice) => choice.requires !== undefined)) {
    source.push(unusedFallback(source, 'decline'));
  }

  let evaluated = source.map((choice) => evaluateEventChoice(state, choice));
  if (!hadActionableAuthoredChoice) repairs.push('no-actionable-choice');
  if (!evaluated.some((choice) => choice.enabled)) {
    source.push(unusedFallback(source, 'decline'));
    evaluated = source.map((choice) => evaluateEventChoice(state, choice));
  }

  return { choices: evaluated, repairs: [...new Set(repairs)] };
}

/** Log each invalid event location once, with enough context to fix its data. */
export function reportEventChoiceRepairs(
  def: GameEventDef,
  step: string | null,
  runtimeRepairs: EventChoiceSet['repairs'],
): void {
  const authoredRepairs = EVENT_CONTENT_REPAIRS.filter(
    (repair) => repair.eventId === def.id && repair.step === step,
  );
  const repairs = [...authoredRepairs.map((repair) => repair.reason), ...runtimeRepairs];
  if (repairs.length === 0) return;
  const key = `${def.id}:${step ?? 'root'}:${[...new Set(repairs)].sort().join(',')}`;
  if (reportedRepairs.has(key)) return;
  reportedRepairs.add(key);
  console.error('[events] repaired invalid choice content', {
    eventId: def.id,
    step: step ?? 'root',
    repairs: [...new Set(repairs)],
    originalChoiceCounts: authoredRepairs.map((repair) => repair.originalChoiceCount),
  });
}

// ---- what a choice will do ---------------------------------------------------

/** How a choice leaves one teammate (only teammates on the payroll). */
export interface ChoicePersonChange {
  id: string;
  /** friendship, as it will move (within 0..100). */
  friendship: number;
  /** the mood they will be in for a while (null: no new mood). */
  emotion: EmployeeMood | null;
}

/**
 * What taking a choice will do, read before it is taken: the same rules the
 * engine's `applyEffect` applies, on the company as it is now, so a card never
 * promises something the decision does not do. Gains include the negotiation
 * line's bonus; a cost is what will actually be taken (never below zero); morale
 * stays within its ceiling.
 *
 * Some of it is deliberately not spelled out. A secret or a new nut stays a
 * surprise, and what was set in motion is only `later` (that something will
 * come of it), never what: the outcome card says the same.
 */
export interface ChoicePreview {
  nuts: number;
  goldenNuts: number;
  morale: number;
  reputation: number;
  boost: { value: number; seconds: number } | null;
  /** the teammates it is about, in the order the content names them. */
  people: ChoicePersonChange[];
  /** friendship for everyone on the payroll. */
  everyone: number;
  /** rooms it changes: the mode a room runs, how its people feel, a rush. */
  rooms: Array<{ roomId: string; mode?: string; emotion?: EmployeeMood; rush?: number }>;
  /** a Moment Card for the collection. */
  souvenir: boolean;
  /** something will come of it later (a follow-up, a curiosity, a delayed effect). */
  later: boolean;
  /** who will bring it up later (a remembered choice, or a remark it leaves). */
  remembers: string[];
  /** the card goes on: this answer leads to another part of it. */
  continues: boolean;
}

export function previewEventChoice(
  state: GameState,
  def: GameEventDef,
  choice: EventChoice,
  now = Date.now(),
): ChoicePreview {
  const bonus = eventRewardMultiplier(state);
  const gain = (value: number | undefined) => {
    const raw = value ?? 0;
    return raw > 0 ? raw * bonus : raw;
  };
  const hired = (id: string | null | undefined): id is string =>
    Boolean(id && state.employees[id]?.hired);
  const cap = moraleCap(state);
  const start = state.resources;
  let { nuts, goldenNuts, morale, reputation } = start;
  let boost: ChoicePreview['boost'] = null;
  let everyone = 0;
  let souvenir = false;
  let later = false;
  const friendship = new Map<string, number>();
  const emotions = new Map<string, EmployeeMood>();
  const named: string[] = [];
  const rooms: ChoicePreview['rooms'] = [];
  const remembers = new Set<string>();
  const flags = new Set(Object.keys(state.flags));
  const fresh: string[] = [];
  const nowFriendship = (id: string) => friendship.get(id) ?? state.employees[id]?.friendship ?? 0;
  const mention = (id: string) => {
    if (!named.includes(id)) named.push(id);
  };

  for (const effect of choice.effects) {
    const value = effect.value;
    switch (effect.type) {
      case 'nuts': {
        if (!Number.isFinite(value ?? 0)) break;
        if ((value ?? 0) >= 0) {
          const amount = gain(value);
          if (amount > 0 && Number.isFinite(amount)) nuts += amount;
        } else nuts = Math.max(0, nuts + (value ?? 0));
        break;
      }
      case 'goldenNuts':
        goldenNuts = Math.max(0, goldenNuts + (value ?? 0));
        break;
      case 'morale':
        morale = Math.max(0, Math.min(cap, morale + (value ?? 0)));
        break;
      case 'reputation':
        reputation = Math.max(0, reputation + gain(value));
        break;
      case 'productionBoost': {
        const next = { value: value ?? 1.5, seconds: effect.durationSeconds ?? 60 };
        if (!boost || next.value > boost.value) boost = next;
        break;
      }
      case 'friendship': {
        const id = effect.employeeId ?? def.employeeId;
        if (!hired(id)) break;
        friendship.set(id, Math.max(0, Math.min(100, nowFriendship(id) + (value ?? 5))));
        mention(id);
        break;
      }
      case 'emotion': {
        const id = effect.employeeId ?? def.employeeId;
        if (!hired(id) || !effect.emotion) break;
        emotions.set(id, effect.emotion);
        mention(id);
        break;
      }
      case 'roomMood':
        if (!effect.roomId || !effect.emotion) break;
        for (const id of employeesInRoom(state, effect.roomId)) emotions.set(id, effect.emotion);
        rooms.push({ roomId: effect.roomId, emotion: effect.emotion });
        break;
      case 'roomMode': {
        const routine = effect.roomId ? ROOM_ROUTINES[effect.roomId] : undefined;
        if (routine?.kind === 'tune' && routine.modes.some((mode) => mode.id === effect.mode)) {
          rooms.push({ roomId: effect.roomId!, mode: effect.mode });
        }
        break;
      }
      case 'rush':
        if (effect.roomId && employeesInRoom(state, effect.roomId).length > 0) {
          rooms.push({ roomId: effect.roomId, rush: effect.durationSeconds ?? CLICK.rushSeconds });
        }
        break;
      case 'everyone':
        everyone += value ?? 1;
        for (const [id, rt] of Object.entries(state.employees)) {
          if (rt.hired)
            friendship.set(id, Math.max(0, Math.min(100, nowFriendship(id) + (value ?? 1))));
        }
        break;
      case 'momentCard':
        souvenir = true;
        break;
      case 'setFlag':
        if (effect.flagId && !flags.has(effect.flagId)) {
          flags.add(effect.flagId);
          fresh.push(effect.flagId);
        }
        break;
      case 'clearFlag':
        if (effect.flagId) flags.delete(effect.flagId);
        break;
      case 'schedule':
        if (effect.scheduled?.length) later = true;
        break;
      case 'incident':
      case 'oddity':
      case 'find':
        later = true;
        break;
      case 'remark': {
        const id = effect.employeeId ?? def.employeeId;
        if (hired(id) && effect.lineKey) remembers.add(id);
        break;
      }
      // A secret file or a new nut stays a surprise; a moment plays out on its own.
      default:
        break;
    }
  }

  const continues = Boolean(choice.next && def.steps?.[choice.next]);
  // A memorable event files its own souvenir when it closes, the first time.
  if (
    !continues &&
    def.momentWorthy &&
    !state.collections.moments.some((card) => card.eventId === def.id)
  ) {
    souvenir = true;
  }
  for (const flag of fresh) {
    for (const memory of memoriesOf(flag))
      if (hired(memory.employeeId)) remembers.add(memory.employeeId);
  }

  // A mood someone is already in is no change (the outcome lists only changes).
  const people: ChoicePersonChange[] = named.map((id) => {
    const emotion = emotions.get(id) ?? null;
    return {
      id,
      friendship: Math.round(
        (friendship.get(id) ?? state.employees[id].friendship) - state.employees[id].friendship,
      ),
      emotion: emotion && emotion !== employeeMood(state, id, now) ? emotion : null,
    };
  });
  for (const room of rooms) {
    if (
      room.emotion &&
      employeesInRoom(state, room.roomId).every(
        (id) => employeeMood(state, id, now) === room.emotion,
      )
    ) {
      delete room.emotion;
    }
  }
  return {
    nuts: nuts - start.nuts,
    goldenNuts: goldenNuts - start.goldenNuts,
    morale: morale - start.morale,
    reputation: reputation - start.reputation,
    boost,
    people,
    everyone,
    rooms,
    souvenir,
    later,
    remembers: [...remembers],
    continues,
  };
}
