import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import {
  AUTHORED_GAME_EVENTS,
  EVENT_CONTENT_REPAIRS,
  GAME_EVENTS,
  GAME_EVENTS_BY_ID,
} from '../src/content/events';
import type { GameEventDef } from '../src/content/types';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import {
  evaluateEventChoice,
  eventChoicesForState,
  reportEventChoiceRepairs,
} from '../src/sim/eventChoices';

function engineAt(t: { v: number }) {
  const state = createInitialState(t.v);
  return new GameEngine(state, { now: () => t.v, deterministic: true, seed: 7 });
}

describe('random events', () => {
  it('has a large event set and multiple multi-step chains', () => {
    expect(GAME_EVENTS.length).toBeGreaterThanOrEqual(40);
    const chained = GAME_EVENTS.filter((e) => e.steps && Object.keys(e.steps).length > 0);
    expect(chained.length).toBeGreaterThanOrEqual(8);
  });

  it('every choice/step references localizable keys and valid next steps', () => {
    for (const ev of GAME_EVENTS) {
      for (const c of ev.choices) {
        expect(typeof c.labelKey).toBe('string');
        if (c.next) expect(ev.steps?.[c.next], `${ev.id} bad next ${c.next}`).toBeTruthy();
      }
      for (const step of Object.values(ev.steps ?? {})) {
        for (const c of step.choices) expect(typeof c.labelKey).toBe('string');
      }
    }
  });

  it('audits every event location for two displayed choices and an actionable path', () => {
    const state = createInitialState(0);
    // Audit the hostile case: no employee is owned and no spendable resource is
    // available. A normal event must still expose a deterministic safe path.
    for (const employee of Object.values(state.employees)) employee.hired = false;
    state.resources.nuts = 0;
    state.resources.goldenNuts = 0;
    state.resources.reputation = 0;

    for (const event of AUTHORED_GAME_EVENTS) {
      const locations: Array<[string | null, GameEventDef['choices']]> = [
        [null, event.choices],
        ...Object.entries(event.steps ?? {}).map(
          ([stepId, step]) => [stepId, step.choices] as [string, GameEventDef['choices']],
        ),
      ];
      for (const [step, authoredChoices] of locations) {
        expect(
          authoredChoices.length,
          `${event.id}:${step ?? 'root'} has fewer than two displayed choices`,
        ).toBeGreaterThanOrEqual(2);
        expect(new Set(authoredChoices.map((choice) => choice.id)).size).toBe(
          authoredChoices.length,
        );
        for (const choice of authoredChoices) {
          const employeeId = choice.requires?.hiredEmployee;
          if (employeeId) {
            expect(
              EMPLOYEES_BY_ID[employeeId],
              `${event.id}:${choice.id} references unknown employee ${employeeId}`,
            ).toBeTruthy();
          }
        }
        expect(
          authoredChoices.some((choice) => evaluateEventChoice(state, choice).enabled),
          `${event.id}:${step ?? 'root'} can disable every authored choice`,
        ).toBe(true);
        const choiceSet = eventChoicesForState(state, event, step);
        expect(choiceSet.choices.length).toBeGreaterThanOrEqual(2);
        expect(choiceSet.choices.some((choice) => choice.enabled)).toBe(true);
      }
    }

    // Runtime normalization remains a safety net, but authored content must be
    // clean so CI fails instead of silently accepting a new one-option event.
    expect(EVENT_CONTENT_REPAIRS).toEqual([]);
  });

  it('repairs empty and all-unavailable malformed content deterministically', () => {
    const state = createInitialState(0);
    state.resources.nuts = 0;
    const malformed: GameEventDef = {
      id: 'malformed-test',
      titleKey: 'event.audit.title',
      bodyKey: 'event.audit.body',
      rarity: 'common',
      weight: 1,
      cooldownSeconds: 1,
      choices: [],
    };
    const empty = eventChoicesForState(state, malformed, null);
    expect(empty.choices.map(({ choice }) => choice.id)).toEqual([
      'fallback-postpone',
      'fallback-decline',
    ]);
    expect(empty.choices.every((choice) => choice.enabled)).toBe(true);
    expect(empty.repairs).toContain('fewer-than-two');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    reportEventChoiceRepairs(malformed, null, empty.repairs);
    expect(error).toHaveBeenCalledWith(
      '[events] repaired invalid choice content',
      expect.objectContaining({ eventId: 'malformed-test', step: 'root' }),
    );
    error.mockRestore();

    malformed.choices = [
      {
        id: 'expensive-a',
        labelKey: 'event.audit.comply',
        requires: { nuts: 500 },
        effects: [{ type: 'reputation', value: 1 }],
      },
      {
        id: 'expensive-b',
        labelKey: 'event.audit.hide',
        requires: { nuts: 600 },
        effects: [{ type: 'morale', value: 1 }],
      },
    ];
    const unavailable = eventChoicesForState(state, malformed, null);
    expect(unavailable.choices).toHaveLength(3);
    expect(unavailable.choices.filter((choice) => choice.enabled)).toHaveLength(1);
    expect(unavailable.choices.at(-1)?.choice.id).toBe('fallback-decline');
    expect(unavailable.repairs).toContain('no-actionable-choice');
    state.resources.nuts = 1_000;
    const afterResourcesChange = eventChoicesForState(state, malformed, null);
    expect(afterResourcesChange.choices.some(({ choice }) => choice.id === 'fallback-decline')).toBe(
      true,
    );
    state.resources.nuts = 0;

    malformed.choices = [
      {
        id: 'duplicate',
        labelKey: 'event.audit.comply',
        effects: [{ type: 'morale', value: 1 }],
      },
      {
        id: 'duplicate',
        labelKey: 'event.audit.hide',
        effects: [{ type: 'reputation', value: 1 }],
      },
    ];
    const deduplicated = eventChoicesForState(state, malformed, null);
    expect(deduplicated.choices.map(({ choice }) => choice.id)).toEqual([
      'duplicate',
      'fallback-decline',
    ]);
    expect(deduplicated.repairs).toContain('duplicate-choice-id');
    expect(deduplicated.repairs).toContain('fewer-than-two');
  });

  it('enforces choice eligibility in the engine rather than trusting the UI', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('technically-on-fire');
    const active = engine.activeEvent!;
    const historyBefore = engine.state.eventHistory.length;

    expect(
      engine.resolveEventChoice('contain', {
        eventInstanceId: active.instanceId,
        step: active.step,
      }),
    ).toBe(false);
    expect(engine.activeEvent?.instanceId).toBe(active.instanceId);
    expect(engine.state.eventHistory).toHaveLength(historyBefore);
  });

  it('includes the six new employee story events (gated on their employee)', () => {
    const map: Record<string, string> = {
      'nixie-machine': 'nixie',
      'otto-audit': 'otto',
      'hazel-loophole': 'hazel',
      'junie-schedule': 'junie',
      'moss-night': 'moss',
      'fenn-deal': 'fenn',
    };
    for (const [eventId, employee] of Object.entries(map)) {
      const def = GAME_EVENTS_BY_ID[eventId];
      expect(def, `missing event ${eventId}`).toBeTruthy();
      expect(def.requires?.hiredEmployee).toBe(employee);
      expect(def.choices.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolving a choice applies effects and closes the event', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('casual-friday');
    expect(engine.activeEvent).toBeTruthy();
    const before = engine.state.resources.morale;
    engine.resolveEventChoice('ok');
    expect(engine.activeEvent).toBeNull();
    expect(engine.state.resources.morale).toBeGreaterThan(before);
  });

  it('advances multi-step chains before closing', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('printer-demands');
    engine.resolveEventChoice('negotiate'); // -> step "peace"
    expect(engine.activeEvent).toBeTruthy();
    expect(engine.activeEvent?.step).toBe('peace');
    engine.resolveEventChoice('ok');
    expect(engine.activeEvent).toBeNull();
  });

  it('respects requirement conditions (hired employee)', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    // rizzo-found requires rizzo hired
    const def = GAME_EVENTS_BY_ID['rizzo-found'];
    expect(def.requires?.hiredEmployee).toBe('rizzo');
    // force roll should skip it while rizzo not hired
    engine.maybeRollEvent(true);
    if (engine.activeEvent) expect(engine.activeEvent.def.id).not.toBe('rizzo-found');
  });

  it('sets a cooldown after an event resolves', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('casual-friday');
    engine.resolveEventChoice('ok');
    expect(engine.state.eventCooldowns['casual-friday']).toBeGreaterThan(0);
  });

  it('creates a moment card when an effect requests one', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('golden-acorn');
    engine.resolveEventChoice('grab');
    expect(engine.state.collections.moments.length).toBe(1);
    expect(engine.state.collections.nuts).toContain('executive-hazelnut');
  });
});
