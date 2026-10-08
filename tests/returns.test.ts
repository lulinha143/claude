import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { BALANCE } from '../src/sim/config';
import { addAway, leaveTally, summarizeReturn, tallyFromAway } from '../src/state/returns';
import { waitingInOffice } from '../src/sim/waiting';
import { GAME_EVENTS } from '../src/content/events';

// The welcome back reports what really happened between leaving and coming back,
// by the rule it was paid by, and nothing for a glance away.

const START = 1_800_000_000_000;

function env() {
  let now = START;
  const state = createInitialState(START);
  state.onboardingComplete = true;
  state.stats.playTimeSeconds = 4000;
  for (const id of ['pip', 'marlow', 'rizzo']) {
    state.employees[id].hired = true;
    state.employees[id].level = 8;
  }
  const engine = new GameEngine(state, { deterministic: true, now: () => now });
  return {
    engine,
    advance(ms: number) {
      now += ms;
    },
    now: () => now,
  };
}

describe('the welcome back', () => {
  it('reports a closed game by what the vault and crate gained, at the away rules', () => {
    const e = env();
    e.engine.save();
    e.advance(2 * 3_600_000);
    const left = leaveTally(e.engine.state, e.engine.state.lastSaved);
    const settled = e.engine.settleClosedTime()!;
    const summary = summarizeReturn(addAway(left, settled, 'closed'), e.engine.state, e.now(), 1)!;
    expect(summary.mode).toBe('closed');
    expect(summary.awaySeconds).toBeCloseTo(7200, 3);
    expect(summary.banked).toBeCloseTo(settled.nutsEarned, 6);
    expect(summary.packed).toBeCloseTo(settled.crateFilled!, 6);
    expect(summary.capped).toBe(false);
  });

  it('reports a minimized stretch as open play, every nut of it', () => {
    const e = env();
    const tally = leaveTally(e.engine.state, e.now());
    const rate = e.engine.productionPerSecond();
    for (let minute = 0; minute < 10; minute += 1) {
      e.advance(60_000);
      e.engine.catchUp();
    }
    const summary = summarizeReturn(tally, e.engine.state, e.now(), 2)!;
    expect(summary.mode).toBe('open');
    expect(summary.offlineSeconds).toBe(0);
    // Open rules: the whole of production, between the vault and the crate.
    expect(summary.banked + summary.packed).toBeGreaterThan(rate * 600 * 0.95);
  });

  it('tells a sleep apart from the open time around it', () => {
    const e = env();
    let tally = leaveTally(e.engine.state, e.now());
    e.advance(60_000);
    e.engine.catchUp();
    e.advance(3_600_000); // the computer slept with the window minimized
    const slept = e.engine.catchUp()!;
    tally = addAway(tally, slept, 'asleep');
    const summary = summarizeReturn(tally, e.engine.state, e.now(), 3)!;
    expect(summary.mode).toBe('asleep');
    expect(summary.offlineSeconds).toBeCloseTo(3600, 3);
    expect(summary.awaySeconds).toBeCloseTo(3660, 3);
  });

  it('measures a sleep in front of the player from just before it', () => {
    const e = env();
    const before = e.engine.state.stats.totalNutsEarned;
    e.advance(3_600_000);
    const slept = e.engine.catchUp()!;
    const tally = tallyFromAway(e.engine.state, slept, e.now());
    expect(tally.earned).toBeCloseTo(before, 6);
    expect(summarizeReturn(tally, e.engine.state, e.now(), 4)?.banked).toBeCloseTo(
      slept.nutsEarned,
      6,
    );
  });

  it('says nothing about a glance away', () => {
    const e = env();
    const tally = leaveTally(e.engine.state, e.now());
    e.advance((BALANCE.offline.minModalSeconds - 5) * 1000);
    e.engine.catchUp();
    expect(summarizeReturn(tally, e.engine.state, e.now(), 5)).toBeNull();
  });

  it('points only at what is really waiting, where it is', () => {
    const e = env();
    expect(waitingInOffice(e.engine.state, e.now()).filter((w) => w.kind === 'incident')).toEqual(
      [],
    );
    const def = GAME_EVENTS.find((ev) => ev.rarity === 'common' && !ev.requires && !ev.employeeId)!;
    e.engine.queueIncident(def.id);
    const incident = e.engine.state.happenings.incidents[0];
    const waiting = waitingInOffice(e.engine.state, e.now());
    expect(waiting[0]).toMatchObject({ kind: 'incident', roomId: incident.roomId });
  });
});
