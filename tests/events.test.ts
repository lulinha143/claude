import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../src/content/events';

function engineAt(t: { v: number }) {
  const state = createInitialState(t.v);
  return new GameEngine(state, { now: () => t.v, deterministic: true, seed: 7 });
}

describe('random events', () => {
  it('has at least 25 events and at least 5 multi-step chains', () => {
    expect(GAME_EVENTS.length).toBeGreaterThanOrEqual(25);
    const chained = GAME_EVENTS.filter((e) => e.steps && Object.keys(e.steps).length > 0);
    expect(chained.length).toBeGreaterThanOrEqual(5);
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
