import {
  EVENT_CONTENT_REPAIRS,
  createEventFallbackChoice,
  type EventFallbackKind,
} from '../content/events';
import type { EventChoice, GameEventDef } from '../content/types';
import type { GameState } from './types';

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
