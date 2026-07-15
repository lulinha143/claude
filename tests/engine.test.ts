import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';

function makeEngine(startTime = 0) {
  let t = startTime;
  const state = createInitialState(t);
  const engine = new GameEngine(state, { now: () => t, deterministic: true, seed: 42 });
  return {
    engine,
    advance(ms: number) {
      t += ms;
    },
    setTime(ms: number) {
      t = ms;
    },
  };
}

describe('GameEngine core actions', () => {
  it('click adds nuts and counts a click', () => {
    const { engine } = makeEngine();
    const before = engine.state.resources.nuts;
    const gained = engine.click();
    expect(gained).toBeGreaterThan(0);
    expect(engine.state.resources.nuts).toBeCloseTo(before + gained, 5);
    expect(engine.state.stats.totalClicks).toBe(1);
  });

  it('collecting a crate grants crate value', () => {
    const { engine } = makeEngine();
    const before = engine.state.resources.nuts;
    const res = engine.collectCrate();
    expect(res.gained).toBeGreaterThan(0);
    expect(engine.state.resources.nuts).toBeGreaterThan(before);
    expect(engine.state.stats.cratesCollected).toBe(1);
  });

  it('tick accumulates production over time', () => {
    const { engine, advance } = makeEngine();
    engine.state.employees.marlow.hired = true;
    engine.state.employees.marlow.level = 5;
    const before = engine.state.resources.nuts;
    advance(1000);
    engine.tick(1);
    expect(engine.state.resources.nuts).toBeGreaterThan(before);
  });

  it('buying an upgrade requires and spends nuts', () => {
    const { engine } = makeEngine();
    expect(engine.buyUpgrade('prod-1')).toBe(false); // cannot afford
    engine.state.resources.nuts = 1_000_000;
    expect(engine.buyUpgrade('prod-1')).toBe(true);
    expect(engine.state.upgrades['prod-1']).toBe(1);
    expect(engine.state.resources.nuts).toBeLessThan(1_000_000);
  });

  it('hiring an employee needs the unlock and the cost', () => {
    const { engine } = makeEngine();
    engine.state.resources.reputation = 100;
    engine.state.resources.nuts = 1_000_000;
    expect(engine.hireOrLevelEmployee('marlow')).toBe(true);
    expect(engine.state.employees.marlow.hired).toBe(true);
    expect(engine.state.employees.marlow.level).toBe(1);
  });

  it('temporary boosts expire', () => {
    const { engine, advance } = makeEngine();
    engine.addBoost(2, 10);
    expect(engine.currentBoostMultiplier()).toBeCloseTo(2, 5);
    advance(11_000);
    expect(engine.currentBoostMultiplier()).toBeCloseTo(1, 5);
  });
});
