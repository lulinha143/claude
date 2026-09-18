import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { computeNextStep } from '../src/sim/nextStep';
import { employeeMood } from '../src/sim/mood';

describe('recommended next step', () => {
  it('offers a return cycle before repeatable upgrades and retires the invitation after prestige', () => {
    const state = createInitialState(0);
    state.resources.nuts = 100000;
    state.stats.totalNutsEarned = 1000000;
    expect(computeNextStep(state)?.key).toBe('prestige');
    state.prestige.nutsAtLastPrestige = 1000000;
    expect(computeNextStep(state)?.key).toBe('upgrade');
  });
  it('introduces colleagues and activities even when upgrades remain affordable', () => {
    const state = createInitialState(0);
    state.resources.nuts = 100000;
    state.stats.playTimeSeconds = 180;
    expect(computeNextStep(state)?.key).toBe('firstConversation');
    state.employees.pip.talks = { count: 1, lastAt: 0, seen: {} };
    expect(computeNextStep(state)?.key).toBe('firstActivity');
    state.stats.microgamesPlayed = 1;
    expect(computeNextStep(state)?.key).toBe('firstDecoration');
    state.collections.secrets.push('deco:potted-fern');
    expect(computeNextStep(state)?.key).toBe('upgrade');
  });
  it('suggests buying an upgrade when one is affordable', () => {
    const s = createInitialState(0);
    s.resources.nuts = 100000;
    expect(computeNextStep(s)?.key).toBe('upgrade');
  });

  it('prioritises claiming a completed daily challenge', () => {
    const s = createInitialState(0);
    s.resources.nuts = 100000;
    s.daily.challenges = [{ id: 'produceNuts', goal: 10, progress: 10, claimed: false }];
    expect(computeNextStep(s)).toMatchObject({ key: 'claimDaily', view: 'company' });
  });

  it('suggests hiring an unlocked, affordable employee before upgrades', () => {
    const s = createInitialState(0);
    s.resources.reputation = 100; // unlocks marlow
    s.resources.nuts = 100000;
    const step = computeNextStep(s);
    expect(step?.key).toBe('hire');
    expect(step?.employeeId).toBeTruthy();
  });

  it('returns null when nothing is affordable and nothing is pending', () => {
    const s = createInitialState(0);
    expect(computeNextStep(s)).toBeNull();
  });
});

describe('employee mood', () => {
  it('is frustrated at very low morale', () => {
    const s = createInitialState(0);
    s.resources.morale = 10;
    expect(employeeMood(s, 'pip')).toBe('frustrated');
  });
  it('is focused during a focus session', () => {
    const s = createInitialState(0);
    s.focus.active = true;
    expect(employeeMood(s, 'pip')).toBe('focused');
  });
  it('is proud with high morale and friendship', () => {
    const s = createInitialState(0);
    s.resources.morale = 90;
    s.employees.pip.friendship = 80;
    expect(employeeMood(s, 'pip')).toBe('proud');
  });
});
