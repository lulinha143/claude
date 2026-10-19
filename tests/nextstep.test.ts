import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { computeNextStep } from '../src/sim/nextStep';
import { employeeMood } from '../src/sim/mood';
import { DECORATION_ENSEMBLES } from '../src/content/decorationEnsembles';

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

describe('the guide reads the real state', () => {
  const ready = () => {
    const s = createInitialState(0);
    s.resources.nuts = 100000;
    s.stats.totalNutsEarned = 4_000_000;
    s.stats.playTimeSeconds = 600;
    s.stats.microgamesPlayed = 1;
    s.employees.pip.talks = { count: 1, lastAt: 0, seen: {} };
    s.collections.secrets.push('deco:potted-fern');
    return s;
  };

  it('says what is waiting: the golden nuts a finished challenge pays', () => {
    const s = createInitialState(0);
    s.daily.challenges = [
      { id: 'produceNuts', goal: 10, progress: 10, claimed: false },
      { id: 'completeFocus', goal: 1, progress: 1, claimed: false },
      { id: 'collectCrates', goal: 5, progress: 5, claimed: true },
    ];
    expect(computeNextStep(s)).toMatchObject({ key: 'claimDaily', amount: 3 });
  });

  it('puts something the building found ahead of the restructure, naming its room', () => {
    const s = ready();
    // The studio is open and its decoration set complete: its discovery comes forward.
    s.resources.reputation = 22;
    const set = DECORATION_ENSEMBLES.find((item) => item.id === 'broadcast-set')!;
    set.items.forEach((id, index) => {
      s.collections.secrets.push(`deco:${id}`);
      s.decorationInstances.push({
        instanceId: `deco-${id}-1`,
        decorationId: id,
        roomId: set.roomId,
        surfaceType: 'floor',
        normalizedX: 0.2 + index * 0.25,
        normalizedY: 0.1,
        depth: 200,
        flipped: false,
        rotation: 0,
        interactionState: {},
      });
    });
    expect(computeNextStep(s)).toMatchObject({
      key: 'investigate',
      view: 'office',
      roomId: 'broadcast',
    });
    // Once looked into, the restructure is next.
    s.flags['discovery.broadcast'] = 1;
    expect(computeNextStep(s)?.key).toBe('prestige');
  });

  it('offers the restructure with what it pays, once per cycle', () => {
    const s = ready();
    expect(computeNextStep(s)).toMatchObject({ key: 'prestige', view: 'prestige', amount: 2 });
    s.flags['restructure.reviewed'] = 1;
    expect(computeNextStep(s)?.key).toBe('upgrade');
  });

  it('stops inviting the player to try Focus Harvest once a session is done', () => {
    const s = createInitialState(0);
    s.stats.playTimeSeconds = 600;
    s.stats.microgamesPlayed = 1;
    s.employees.pip.talks = { count: 1, lastAt: 0, seen: {} };
    expect(computeNextStep(s)?.key).toBe('focus');
    s.focus.completedSessions = 1;
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
