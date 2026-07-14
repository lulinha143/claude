import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';

describe('focus sessions', () => {
  it('starts a focus session with the requested duration', () => {
    const t = 0;
    const engine = new GameEngine(createInitialState(0), { now: () => t, deterministic: true });
    engine.startFocus(25);
    expect(engine.state.focus.active).toBe(true);
    expect(engine.state.focus.durationSeconds).toBe(25 * 60);
    expect(engine.isFocusActive()).toBe(true);
  });

  it('completes and rewards when the timer elapses', () => {
    let t = 0;
    const engine = new GameEngine(createInitialState(0), { now: () => t, deterministic: true });
    const goldBefore = engine.state.resources.goldenNuts;
    engine.startFocus(25);
    t = 25 * 60 * 1000 + 1;
    engine.tick(1);
    expect(engine.state.focus.active).toBe(false);
    expect(engine.state.focus.completedSessions).toBe(1);
    expect(engine.state.resources.goldenNuts).toBeGreaterThan(goldBefore);
  });

  it('cancelling never penalizes the player', () => {
    const t = 0;
    const engine = new GameEngine(createInitialState(0), { now: () => t, deterministic: true });
    const nutsBefore = engine.state.resources.nuts;
    engine.startFocus(45);
    engine.cancelFocus();
    expect(engine.state.focus.active).toBe(false);
    expect(engine.state.resources.nuts).toBe(nutsBefore);
  });
});
