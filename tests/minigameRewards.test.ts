import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';
import {
  MICRO_BOOST_SECONDS,
  MICRO_BOOST_SOURCE,
  MICRO_CALIBRATION,
  MICRO_MAX_SCORE,
  MICRO_MODES,
  MICRO_SOUVENIRS,
  isMicroMastered,
  microMasteryFlag,
  type MicroMode,
} from '../src/sim/minigames';
import type { GameState } from '../src/sim/types';

const start = 5_000_000;
const roundtrip = (state: GameState) =>
  gameStateSchema.parse(migrate(JSON.parse(JSON.stringify(state)))) as GameState;

function at(state = createInitialState(start), now = start) {
  let clock = now;
  state.settings.autoResolveEvents = false;
  const engine = new GameEngine(state, { deterministic: true, now: () => clock });
  return {
    engine,
    advance(ms: number) {
      clock += ms;
    },
    now: () => clock,
  };
}

/** A round as the shell plays it: ticket at the whistle, reward at the end. */
function playRound(engine: GameEngine, mode: MicroMode, score: number) {
  const ticket = engine.beginMicrogameRound(mode);
  return engine.rewardMicrogame(mode, score, ticket);
}

describe('minigame rounds are paid once', () => {
  it('pays a round on file exactly once, however often its end is reported', () => {
    const { engine } = at();
    const ticket = engine.beginMicrogameRound('coffeeRescue');
    const paid = engine.rewardMicrogame('coffeeRescue', 60, ticket);
    expect(paid?.nuts).toBeGreaterThan(0);
    const nuts = engine.state.resources.nuts;
    expect(engine.rewardMicrogame('coffeeRescue', 60, ticket)).toBeUndefined();
    expect(engine.state.resources.nuts).toBe(nuts);
    expect(engine.state.stats.microgamesPlayed).toBe(1);
  });

  it('pays nothing for a round that was left, or that was never started', () => {
    const env = at();
    const left = env.engine.beginMicrogameRound('bugSquash');
    env.engine.abandonMicrogameRound(left);
    expect(env.engine.rewardMicrogame('bugSquash', 90, left)).toBeUndefined();
    expect(env.engine.rewardMicrogame('bugSquash', 90, 'bugSquash:999:0')).toBeUndefined();
    // A ticket is for its own game only.
    const coffee = env.engine.beginMicrogameRound('coffeeRescue');
    expect(env.engine.rewardMicrogame('bugSquash', 90, coffee)).toBeUndefined();
    expect(env.engine.state.stats.microgamesPlayed).toBe(0);
  });

  it('still pays the next real round, and refuses a second completion inside one round', () => {
    const env = at();
    expect(playRound(env.engine, 'coffeeRescue', 50)).toBeDefined();
    // A second "round" ten seconds later cannot be a real 30-second shift.
    env.advance(10_000);
    expect(playRound(env.engine, 'coffeeRescue', 50)).toBeUndefined();
    env.advance(25_000);
    expect(playRound(env.engine, 'coffeeRescue', 50)).toBeDefined();
    expect(env.engine.state.microgames.coffeeRescue.plays).toBe(2);
  });

  it('forgets every open round on a reload, so a stale completion cannot be paid', () => {
    const env = at();
    const ticket = env.engine.beginMicrogameRound('cableUntangle');
    const reloaded = at(roundtrip(env.engine.state), start + 46_000);
    expect(reloaded.engine.rewardMicrogame('cableUntangle', 20, ticket)).toBeUndefined();
    expect(reloaded.engine.state.stats.microgamesPlayed).toBe(0);
  });

  it('keeps only a handful of unfinished tickets', () => {
    const { engine } = at();
    const tickets = Array.from({ length: 10 }, () => engine.beginMicrogameRound('bugSquash'));
    // The oldest were dropped; the newest is still good.
    expect(engine.rewardMicrogame('bugSquash', 10, tickets[0])).toBeUndefined();
    expect(engine.rewardMicrogame('bugSquash', 10, tickets[9])).toBeDefined();
  });

  it('caps an impossible score instead of paying it', () => {
    const { engine } = at();
    const reward = playRound(engine, 'coffeeRescue', 1e12);
    expect(reward?.best).toBe(MICRO_MAX_SCORE);
    expect(playRound(at().engine, 'coffeeRescue', Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(playRound(at().engine, 'coffeeRescue', -4)).toBeUndefined();
  });
});

describe('per-game mastery', () => {
  it('masters each game at its own line, once, with its prize', () => {
    for (const mode of MICRO_MODES) {
      const env = at();
      const line = MICRO_CALIBRATION[mode].mastery;
      const gold = env.engine.state.resources.goldenNuts;
      const below = playRound(env.engine, mode, line - 1);
      expect(below?.mastered).toBe(false);
      expect(below?.grade).toBe('great');
      env.advance(60_000);
      const reached = playRound(env.engine, mode, line);
      expect(reached).toMatchObject({ mastered: true, masteredBefore: false, goldenNuts: 1 });
      expect(reached?.grade).toBe('perfect');
      expect(reached?.decorationId).toBe(MICRO_SOUVENIRS[mode]);
      expect(env.engine.state.flags[microMasteryFlag(mode)]).toBeDefined();
      env.advance(60_000);
      const again = playRound(env.engine, mode, line * 2);
      expect(again).toMatchObject({ mastered: false, masteredBefore: true, goldenNuts: 0 });
      expect(again?.decorationId).toBeUndefined();
      expect(env.engine.state.resources.goldenNuts).toBe(gold + 1);
    }
  });

  it('does not master coffee with the old one-size-fits-all 30', () => {
    const { engine } = at();
    expect(playRound(engine, 'coffeeRescue', 35)?.mastered).toBe(false);
    expect(isMicroMastered(engine.state, 'coffeeRescue')).toBe(false);
  });

  it('keeps a mastery earned under the old line, without paying its prize again', () => {
    // A save from before calibration: coffee mastered at 35, flag and souvenir on file.
    const state = createInitialState(start);
    state.microgames.coffeeRescue = { best: 35, plays: 4, lastRewardAt: start - 3_600_000 };
    state.flags[microMasteryFlag('coffeeRescue')] = start - 3_600_000;
    state.collections.secrets.push(`deco:${MICRO_SOUVENIRS.coffeeRescue}`);
    const env = at(roundtrip(state));
    expect(isMicroMastered(env.engine.state, 'coffeeRescue')).toBe(true);
    const gold = env.engine.state.resources.goldenNuts;
    const reward = playRound(
      env.engine,
      'coffeeRescue',
      MICRO_CALIBRATION.coffeeRescue.mastery + 10,
    );
    expect(reward).toMatchObject({ mastered: false, masteredBefore: true, newBest: true });
    expect(env.engine.state.resources.goldenNuts).toBe(gold);
    expect(
      env.engine.state.collections.secrets.filter(
        (key) => key === `deco:${MICRO_SOUVENIRS.coffeeRescue}`,
      ),
    ).toHaveLength(1);
  });

  it('reads a record at or above today’s line as mastered even without the flag', () => {
    const state = createInitialState(start);
    state.microgames.cableUntangle = { best: 35, plays: 1, lastRewardAt: 0 };
    expect(isMicroMastered(state, 'cableUntangle')).toBe(true);
    const env = at(state);
    expect(playRound(env.engine, 'cableUntangle', 40)?.mastered).toBe(false);
  });

  it('remembers best, plays and mastery across a save', () => {
    const env = at();
    playRound(env.engine, 'bugSquash', MICRO_CALIBRATION.bugSquash.mastery + 3);
    const saved = roundtrip(env.engine.state);
    expect(saved.microgames.bugSquash).toMatchObject({
      best: MICRO_CALIBRATION.bugSquash.mastery + 3,
      plays: 1,
    });
    expect(isMicroMastered(saved, 'bugSquash')).toBe(true);
  });

  it('encourages the team from the game’s own "great" line', () => {
    for (const mode of MICRO_MODES) {
      const env = at();
      for (const id of ['marlow', 'quincy', 'nixie', 'bea']) {
        env.engine.state.employees[id].hired = true;
      }
      const great = MICRO_CALIBRATION[mode].great;
      expect(playRound(env.engine, mode, great - 1)?.employeeIds).toEqual([]);
      env.advance(60_000);
      expect(playRound(env.engine, mode, great)?.employeeIds.length).toBeGreaterThan(0);
    }
  });
});

describe('the minigame boost', () => {
  it('runs one minigame boost at a time instead of stacking three games', () => {
    const env = at();
    playRound(env.engine, 'coffeeRescue', MICRO_CALIBRATION.coffeeRescue.mastery);
    playRound(env.engine, 'bugSquash', MICRO_CALIBRATION.bugSquash.mastery);
    playRound(env.engine, 'cableUntangle', MICRO_CALIBRATION.cableUntangle.mastery);
    const minigame = env.engine.state.boosts.filter((b) => b.source === MICRO_BOOST_SOURCE);
    expect(minigame).toHaveLength(1);
    expect(env.engine.currentBoostMultiplier()).toBeCloseTo(minigame[0].multiplier, 6);
    expect(env.engine.currentBoostMultiplier()).toBeLessThanOrEqual(1.5);
  });

  it('turns a weaker round into exactly its own worth of extra time on a stronger boost', () => {
    const env = at();
    const strong = playRound(env.engine, 'bugSquash', MICRO_CALIBRATION.bugSquash.mastery * 1.5);
    expect(strong?.boost).toBe(1.5);
    env.advance(40_000);
    const weak = playRound(env.engine, 'coffeeRescue', 20);
    const own = weak!.ownBoost - 1;
    expect(own).toBeGreaterThan(0);
    expect(own).toBeLessThan(0.1);
    // The stronger boost keeps running, not watered down...
    expect(weak?.boost).toBe(1.5);
    // ...for its 50 s left plus the weak round's 90 s x bonus, paid at the 50% rate.
    const extra = (MICRO_BOOST_SECONDS * own) / 0.5;
    expect(weak?.boostSeconds).toBe(Math.round(50 + extra));
  });

  it('cannot keep a strong boost alive with a run of 1-point rounds', () => {
    const env = at();
    playRound(env.engine, 'bugSquash', MICRO_CALIBRATION.bugSquash.mastery * 1.5);
    for (let round = 0; round < 3; round += 1) {
      env.advance(31_000);
      const tiny = playRound(env.engine, 'coffeeRescue', 1);
      expect(tiny?.ownBoost).toBeCloseTo(1.01, 6);
    }
    // 93 s in: the strong boost has had a few seconds added, not three fresh 90s.
    expect(env.engine.currentBoostMultiplier()).toBeCloseTo(1.5, 6);
    env.advance(31_000);
    playRound(env.engine, 'coffeeRescue', 1);
    expect(env.engine.currentBoostMultiplier()).toBeCloseTo(1.01, 6);
  });

  it('lets a stronger round take the slot without ever shortening it', () => {
    const env = at();
    const weak = playRound(env.engine, 'coffeeRescue', 40);
    env.advance(10_000);
    const strong = playRound(env.engine, 'cableUntangle', MICRO_CALIBRATION.cableUntangle.mastery);
    expect(strong!.boost).toBeGreaterThan(weak!.boost);
    expect(strong?.boostSeconds).toBe(MICRO_BOOST_SECONDS);
  });

  it('starts fresh at the round’s own strength once the old one has run out', () => {
    const env = at();
    playRound(env.engine, 'bugSquash', MICRO_CALIBRATION.bugSquash.mastery * 1.5);
    env.advance((MICRO_BOOST_SECONDS + 5) * 1000);
    const weak = playRound(env.engine, 'coffeeRescue', 20);
    expect(weak?.boost).toBe(weak?.ownBoost);
  });

  it('never merges a minigame boost with an event boost of the same size', () => {
    const env = at();
    env.engine.addBoost(1.2, 180);
    // A coffee score that earns exactly +20%.
    const score = Math.round((20 / 35) * MICRO_CALIBRATION.coffeeRescue.mastery);
    const reward = playRound(env.engine, 'coffeeRescue', score);
    expect(reward?.ownBoost).toBeCloseTo(1.2, 6);
    expect(env.engine.state.boosts).toHaveLength(2);
    expect(env.engine.currentBoostMultiplier()).toBeCloseTo(1.4, 6);
  });

  it('pays no boost and no nuts for an empty round, but still files it', () => {
    const { engine } = at();
    const reward = playRound(engine, 'cableUntangle', 0);
    expect(reward).toMatchObject({ nuts: 0, ownBoost: 1, boost: 1, grade: 'poor' });
    expect(engine.state.boosts).toHaveLength(0);
    expect(engine.state.microgames.cableUntangle.plays).toBe(1);
  });

  it('keeps the boost tag through a save, and reads old untagged boosts', () => {
    const env = at();
    playRound(env.engine, 'coffeeRescue', 100);
    const saved = roundtrip(env.engine.state);
    expect(saved.boosts[0].source).toBe(MICRO_BOOST_SOURCE);
    const legacy = createInitialState(start) as GameState;
    legacy.boosts = [{ multiplier: 1.3, endsAt: start + 30_000 }];
    const parsed = roundtrip(legacy);
    expect(parsed.boosts).toEqual([{ multiplier: 1.3, endsAt: start + 30_000 }]);
    // A malformed tag costs the tag, never the boost.
    const odd = JSON.parse(JSON.stringify(legacy));
    odd.boosts[0].source = 42;
    expect(gameStateSchema.parse(migrate(odd)).boosts[0].multiplier).toBe(1.3);
  });

  it('pays the same share of production for the same share of mastery in every game', () => {
    const results = MICRO_MODES.map((mode) => {
      const env = at();
      env.engine.state.resources.nuts = 0;
      const reward = playRound(env.engine, mode, Math.round(MICRO_CALIBRATION[mode].mastery * 0.6));
      return { nuts: reward!.nuts, boost: reward!.ownBoost };
    });
    for (const result of results) {
      expect(result.boost).toBeCloseTo(results[0].boost, 2);
      expect(Math.abs(result.nuts - results[0].nuts) / results[0].nuts).toBeLessThan(0.05);
    }
  });
});
