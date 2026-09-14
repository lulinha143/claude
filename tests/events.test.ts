import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import {
  AUTHORED_GAME_EVENTS,
  EVENT_CONTENT_REPAIRS,
  GAME_EVENTS,
  GAME_EVENTS_BY_ID,
} from '../src/content/events';
import type { GameEventDef } from '../src/content/types';
import { EMPLOYEES, EMPLOYEES_BY_ID, FOUNDER_ID } from '../src/content/employees';
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

  // Every string a player can see in an event is a localisation KEY, and nothing
  // else checked that the keys resolve. A typo therefore shipped as the raw key
  // text on a modal button — invisible to typechecking, invisible to the engine
  // tests, and visible to the player. This walks every key an event can present,
  // in both complete locales.
  it('resolves every event string in every complete locale', () => {
    const localeDir = join(__dirname, '..', 'src', 'i18n', 'locales');
    const locales = ['en', 'pt-BR'].map((code) => ({
      code,
      data: JSON.parse(readFileSync(join(localeDir, `${code}.json`), 'utf8')) as unknown,
    }));
    const lookup = (data: unknown, key: string): unknown =>
      key.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
          return (node as Record<string, unknown>)[part];
        }
        return undefined;
      }, data);

    const keys = new Set<string>();
    const addChoice = (choice: (typeof GAME_EVENTS)[number]['choices'][number]) => {
      keys.add(choice.labelKey);
      if (choice.disabledKey) keys.add(choice.disabledKey);
      for (const reaction of choice.reactions ?? []) keys.add(reaction);
      for (const effect of choice.effects) {
        if (effect.scheduleTitleKey) keys.add(effect.scheduleTitleKey);
        if (effect.scheduleBodyKey) keys.add(effect.scheduleBodyKey);
      }
    };
    for (const event of GAME_EVENTS) {
      keys.add(event.titleKey);
      keys.add(event.bodyKey);
      for (const choice of event.choices) addChoice(choice);
      for (const step of Object.values(event.steps ?? {})) {
        keys.add(step.bodyKey);
        for (const choice of step.choices) addChoice(choice);
      }
    }

    const missing: string[] = [];
    for (const key of [...keys].sort()) {
      for (const locale of locales) {
        const value = lookup(locale.data, key);
        if (typeof value !== 'string' || value.length === 0) {
          missing.push(`${locale.code}: ${key}`);
        }
      }
    }
    expect(missing, `unresolved event strings:\n${missing.join('\n')}`).toEqual([]);
    // Sanity: the walk actually found the content rather than an empty set.
    expect(keys.size).toBeGreaterThan(300);
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
    expect(
      afterResourcesChange.choices.some(({ choice }) => choice.id === 'fallback-decline'),
    ).toBe(true);
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

describe('every member of the cast has the story event their data promises', () => {
  // This guard is the one that was missing. Each employee declares a `rareEventId`,
  // but nothing ever checked that the id resolved, and twelve of the twenty-three
  // pointed at events that were never written — a promise in the data with nothing
  // behind it, and no test to notice. `rareEventId` is read by no runtime code, so a
  // dangling id could never fail loudly on its own.
  it('resolves every declared rareEventId to a real event', () => {
    const dangling: string[] = [];
    for (const employee of EMPLOYEES) {
      if (!employee.rareEventId) continue;
      if (!GAME_EVENTS_BY_ID[employee.rareEventId]) {
        dangling.push(`${employee.id} -> ${employee.rareEventId}`);
      }
    }
    expect(
      dangling,
      `These employees promise a story event that does not exist:\n${dangling.join('\n')}`,
    ).toEqual([]);
  });

  it('gives every employee a story event, gated on and attributed to them', () => {
    const missing: string[] = [];
    for (const employee of EMPLOYEES) {
      const def = employee.rareEventId ? GAME_EVENTS_BY_ID[employee.rareEventId] : undefined;
      if (!def) {
        missing.push(`${employee.id} has no story event`);
        continue;
      }
      /* Gated on the employee, so it cannot fire before the player has met them.
         The founder is the one exception and deliberately so: Pip is hired before the
         first tick (`hired: e.id === FOUNDER_ID` in createInitialState), so a
         hiredEmployee gate on Pip could never exclude anything. Encoded as the founder
         rather than as the literal id, so the rule keeps meaning what it says if the
         starting character ever changes. */
      if (employee.id !== FOUNDER_ID && def.requires?.hiredEmployee !== employee.id) {
        missing.push(`${def.id} is not gated on ${employee.id}`);
      }
      // Attributed to them, so the moment card it leaves carries their face.
      if (def.employeeId !== employee.id) {
        missing.push(`${def.id} is not stamped with ${employee.id}`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
    // All 23 of the photographic cast, not just the early hires.
    expect(EMPLOYEES.filter((e) => e.rareEventId).length).toBe(EMPLOYEES.length);
  });

  it('never points two employees at the same story event', () => {
    const byEvent = new Map<string, string[]>();
    for (const employee of EMPLOYEES) {
      if (!employee.rareEventId) continue;
      byEvent.set(employee.rareEventId, [
        ...(byEvent.get(employee.rareEventId) ?? []),
        employee.id,
      ]);
    }
    const shared = [...byEvent.entries()].filter(([, owners]) => owners.length > 1);
    expect(shared.map(([id, owners]) => `${id}: ${owners.join(', ')}`)).toEqual([]);
  });
});

describe('a choice can be gated on what the company has already done', () => {
  // `EventChoice.requires.flag` was part of the type, and authored in content, but
  // `evaluateEventChoice` never looked at it — so a choice written as "only if the
  // company did X" was silently offered to everyone. These lock that in.
  it('hides a flag-gated choice until the mark exists', () => {
    const state = createInitialState(0);
    const choice = {
      id: 'gated',
      labelKey: 'x',
      effects: [],
      requires: { flag: 'intern-told-truth' },
    };
    expect(evaluateEventChoice(state, choice).enabled).toBe(false);
    expect(evaluateEventChoice(state, choice).failures[0]?.kind).toBe('flag');

    state.flags['intern-told-truth'] = 1;
    expect(evaluateEventChoice(state, choice).enabled).toBe(true);
    expect(evaluateEventChoice(state, choice).failures).toEqual([]);
  });

  it('never leaks the internal mark id into player-facing copy', () => {
    const state = createInitialState(0);
    const failure = evaluateEventChoice(state, {
      id: 'gated',
      labelKey: 'x',
      effects: [],
      requires: { flag: 'some-internal-bookkeeping-id' },
    }).failures[0];
    const en = JSON.parse(
      readFileSync(join(__dirname, '..', 'src', 'i18n', 'locales', 'en.json'), 'utf8'),
    );
    const message = failure.messageKey
      .split('.')
      .reduce((node: Record<string, unknown> | string, part) => (node as never)[part], en);
    expect(typeof message).toBe('string');
    // No interpolation slot means the flag id can never be rendered.
    expect(message as string).not.toContain('{{');
  });

  it('lets the returning intern quote the answer that was actually given', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    const def = GAME_EVENTS_BY_ID['intern-returns'];
    engine.state.resources.reputation = 500;

    // Told the truth: standing by it is available.
    engine.state.flags = { 'answered-the-intern': 1, 'intern-told-truth': 1 };
    const truthful = eventChoicesForState(engine.state, def, null);
    expect(truthful.choices.find((c) => c.choice.id === 'stand-by-the-truth')?.enabled).toBe(true);

    // Read them the brochure instead: that path is closed, and correcting is open.
    engine.state.flags = { 'answered-the-intern': 1, 'intern-told-brochure': 1 };
    const spun = eventChoicesForState(engine.state, def, null);
    expect(spun.choices.find((c) => c.choice.id === 'stand-by-the-truth')?.enabled).toBe(false);
    expect(spun.choices.find((c) => c.choice.id === 'correct-the-record')?.enabled).toBe(true);

    // Either way there is always an unconditional way out of the scene.
    for (const set of [truthful, spun]) {
      expect(set.choices.some((c) => c.enabled && c.choice.requires === undefined)).toBe(true);
    }
  });
});
