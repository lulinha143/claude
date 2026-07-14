import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../src/content/events';

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
