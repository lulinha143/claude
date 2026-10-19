import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { BALANCE } from '../src/sim/config';
import {
  CLICK,
  goldenBeat,
  previewClickValue,
  resolveClick,
  type ComboTracker,
} from '../src/sim/clickStations';
import { CLICK_STATIONS, CLICK_STATIONS_BY_ID } from '../src/content/clickStations';
import {
  clickPower,
  flatClickPower,
  moraleMultiplier,
  productionBreakdown,
  reputationRate,
  roomTapMultiplier,
  tapProductionShare,
  aggregatePassives,
} from '../src/sim/economy';
import { NEGLIGIBLE_TAP_GAIN, nextGoal } from '../src/sim/goals';
import { UPGRADES } from '../src/content/upgrades';
import { isRoomIdUnlocked } from '../src/sim/rooms';
import { formatNumber } from '../src/sim/format';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import type { GameState } from '../src/sim/types';

// Chapter 4: the clicker economy. Taps keep pace with a big company without
// replacing it, gold follows time rather than tap count, purchases do what they
// say (or are not sold), and balances stay whole and valid.

const START = 1_000_000;

function env(state: GameState = createInitialState(START)) {
  let now = START;
  const engine = new GameEngine(state, { deterministic: true, now: () => now });
  return {
    engine,
    advance(ms: number) {
      now += ms;
    },
    now: () => now,
  };
}

/** A company an hour or two in: a real team, several rooms, no click upgrades. */
function bigCompany(): GameState {
  const state = createInitialState(START);
  state.onboardingComplete = true;
  for (const id of ['pip', 'marlow', 'rizzo', 'bea', 'corvus', 'mina', 'nixie', 'otto']) {
    state.employees[id].hired = true;
    state.employees[id].level = 25;
  }
  for (const id of ['room-sorting', 'room-mailroom', 'room-lab']) state.upgrades[id] = 1;
  state.resources.reputation = 120;
  state.resources.morale = 80;
  return state;
}

function bestNutStation(engine: GameEngine, at: number) {
  return CLICK_STATIONS.filter(
    (s) => s.resource === 'nuts' && isRoomIdUnlocked(engine.state, s.roomId),
  ).reduce((best, s) =>
    previewClickValue(engine.state, s.id, null, at) >
    previewClickValue(engine.state, best.id, null, at)
      ? s
      : best,
  );
}

/** Nuts earned (crate included) over `seconds`, tapping `perSecond` times a second. */
function earn(state: GameState, seconds: number, perSecond: number): number {
  const e = env(JSON.parse(JSON.stringify(state)));
  e.engine.tapStation('nut-crate'); // both start from an empty crate
  const station = bestNutStation(e.engine, e.now());
  const start = e.engine.state.stats.totalNutsEarned;
  const stepMs = perSecond > 0 ? 1000 / perSecond : 200;
  for (let ms = 0; ms < seconds * 1000; ms += stepMs) {
    if (perSecond > 0) e.engine.tapStation(station.id);
    e.advance(stepMs);
    e.engine.tick(stepMs / 1000);
  }
  e.engine.tapStation('nut-crate');
  return e.engine.state.stats.totalNutsEarned - start;
}

describe('taps keep pace with the company', () => {
  it('leaves the opening untouched: a new founder taps for the hand alone', () => {
    const state = createInitialState(START);
    // The hand, sharpened by the founder desk, exactly as before the slice.
    expect(clickPower(state)).toBeCloseTo(flatClickPower(state) * roomTapMultiplier(state), 2);
  });

  it('lets a room that sharpens taps sharpen the whole tap, once the slice carries it too', () => {
    const plain = bigCompany();
    plain.employees.corvus.room = 'marketing';
    const buzzing: GameState = JSON.parse(JSON.stringify(plain));
    buzzing.office.rooms.marketing = { ...buzzing.office.rooms.marketing, mode: 'buzz' };
    expect(tapProductionShare(plain)).toBeGreaterThan(flatClickPower(plain));
    // Marketing on Buzz promises +10% tap power; it used to reach only the hand.
    expect(roomTapMultiplier(buzzing) - roomTapMultiplier(plain)).toBeCloseTo(0.1, 6);
    expect(clickPower(buzzing) / clickPower(plain)).toBeCloseTo(
      roomTapMultiplier(buzzing) / roomTapMultiplier(plain),
      6,
    );
  });

  it('keeps a tap worth a real slice of production once the team is big', () => {
    const { engine, now } = env(bigCompany());
    const nps = engine.productionPerSecond();
    const tap = previewClickValue(engine.state, 'nut-crate', null, now());
    // It used to be ~2 nuts against tens of thousands a second.
    expect(tap / nps).toBeGreaterThanOrEqual(BALANCE.tapProductionSeconds * 0.95);
    // A click upgrade still adds something on top of the slice.
    const upgraded = bigCompany();
    upgraded.upgrades['click-1'] = 10;
    expect(clickPower(upgraded)).toBeGreaterThan(clickPower(bigCompany()));
  });

  it('makes a short active burst clearly worth it, never a replacement for the team', () => {
    const passive = earn(bigCompany(), 30, 0);
    const active = earn(bigCompany(), 30, 5);
    expect(active / passive).toBeGreaterThan(1.5);
    expect(active / passive).toBeLessThan(4);
  });

  it('pays no more production for taps faster than a quick hand', () => {
    const quick = earn(bigCompany(), 10, 8) - earn(bigCompany(), 10, 0);
    const autoclicker = earn(bigCompany(), 10, 100) - earn(bigCompany(), 10, 0);
    // The hand's own strength still pays every tap, but the production slice is paced.
    expect(autoclicker / quick).toBeLessThan(1.6);
  });

  it('widens the real combo, not just its readout, when the window is bought', () => {
    const def = CLICK_STATIONS_BY_ID['nut-crate'];
    const tracker: ComboTracker = { stationId: def.id, streak: 4, lastTapAt: 0 };
    const at = CLICK.comboWindowMs + 200; // just past the base window
    const plain = resolveClick(createInitialState(0), def, tracker, at, {
      critical: false,
      golden: false,
    });
    const trained = createInitialState(0);
    trained.upgrades['muscle-memory'] = 5;
    const wide = resolveClick(trained, def, tracker, at, { critical: false, golden: false });
    expect(plain.streak).toBe(1);
    expect(wide.streak).toBe(5);
  });
});

describe('gold follows time, not tap count', () => {
  function podCompany() {
    const state = bigCompany();
    state.resources.reputation = 400; // the incubator
    state.employees.dorm.hired = true;
    state.employees.dorm.level = 4;
    state.employees.dorm.room = 'incubator';
    return state;
  }
  function goldFrom(state: GameState, gapMs: number, seconds = 60) {
    const e = env(state);
    for (let ms = 0; ms < seconds * 1000; ms += gapMs) {
      e.engine.tapStation('incubation-pod');
      e.advance(gapMs);
    }
    const c = e.engine.state;
    return c.resources.goldenNuts + (c.clicker.goldenDust ?? 0);
  }

  it('refines the same gold whether the pod is mashed or tapped in rhythm', () => {
    // The rule itself, without the crit lottery: dust over a minute of tapping.
    const def = CLICK_STATIONS_BY_ID['incubation-pod'];
    const dustOver = (gapMs: number) => {
      const state = podCompany();
      let total = 0;
      // Both end with a tap on the minute mark, so neither leaves time unrefined.
      for (let at = START; at <= START + 60_000; at += gapMs) {
        total += resolveClick(state, def, null, at, { critical: false, golden: false }).amount;
        state.clicker.premiumAt = { ...state.clicker.premiumAt, [def.id]: at };
      }
      return total;
    };
    const rhythm = dustOver(CLICK.premiumRecoveryMs);
    const mashed = dustOver(100);
    // A minute at the pod refines the same gold, however hard it was hit.
    expect(rhythm).toBeGreaterThan(0);
    expect(mashed).toBeCloseTo(rhythm, 6);
    // In play, crits included: mashing used to mint ~40 golden nuts a minute.
    expect(goldFrom(podCompany(), 100)).toBeLessThan(3);
  });

  it('keeps golden nuts whole, with the remainder saved as dust across a reload', () => {
    const e = env(podCompany());
    e.engine.tapStation('incubation-pod');
    expect(Number.isInteger(e.engine.state.resources.goldenNuts)).toBe(true);
    const saved = gameStateSchema.parse(JSON.parse(JSON.stringify(e.engine.state)));
    expect(saved.clicker.goldenDust).toBeGreaterThan(0);
    // Reloading is no shortcut: the station's clock came along.
    const reloadedAt = START + 100;
    const reloaded = new GameEngine(saved as GameState, {
      deterministic: true,
      now: () => reloadedAt,
    });
    const before = saved.clicker.goldenDust ?? 0;
    const tap = reloaded.tapStation('incubation-pod');
    expect(tap?.amount ?? 1).toBeLessThan(0.01);
    expect((reloaded.state.clicker.goldenDust ?? 0) - before).toBeLessThan(0.01);
  });

  it('rolls the golden drop per second of tapping, however fast the taps', () => {
    const sum = (gap: number) => {
      let tracker: ComboTracker | null = null;
      let total = 0;
      for (let at = 0; at < 60_000; at += gap) {
        total += goldenBeat(tracker, at);
        tracker = { stationId: 'nut-crate', streak: 1, lastTapAt: at };
      }
      return total;
    };
    // Ten taps a second roll the same as one a second (the first tap aside).
    expect(sum(100)).toBeLessThanOrEqual(sum(1_000) + 1);
    expect(sum(100)).toBeGreaterThanOrEqual(sum(1_000) - 1);
  });

  it('turns a fractional golden balance from an older save into whole nuts and dust', () => {
    const old = { version: 12, resources: { goldenNuts: 3.97, nuts: 10 }, clicker: {} };
    const migrated = migrate(old) as {
      resources: { goldenNuts: number };
      clicker: { goldenDust: number };
    };
    expect(migrated.resources.goldenNuts).toBe(3);
    expect(migrated.clicker.goldenDust).toBeCloseTo(0.97, 5);
  });
});

describe('purchases do what they say', () => {
  it('lets morale above 100 keep raising production (the Morale Ceiling pays)', () => {
    expect(moraleMultiplier(110)).toBeGreaterThan(moraleMultiplier(100));
  });

  it('never sells a level of automation that would change nothing', () => {
    const state = createInitialState(START);
    state.upgrades['auto-collector'] = 4; // 100% banked already
    state.resources.nuts = 1e12;
    const { engine } = env(state);
    expect(engine.buyUpgrade('auto-collector')).toBe(false);
    expect(engine.state.upgrades['auto-collector']).toBe(4);
    expect(nextGoal(engine.state)?.id).not.toBe('auto-collector');
  });

  /** A big company with everything bought out but the hand's own upgrades. */
  function onlyTheHandLeft(clickLevel: number): GameState {
    const state = bigCompany();
    for (const u of UPGRADES) {
      if (u.resource !== 'nuts') continue;
      state.upgrades[u.id] = u.effect.kind === 'clickPower' ? clickLevel : u.maxLevel;
    }
    for (const rt of Object.values(state.employees)) {
      rt.hired = true;
      rt.level = Math.max(25, rt.level);
    }
    return state;
  }

  it('never points the company at a click level that would change next to nothing', () => {
    // Every hand tier bought once: the cheapest thing on sale is the next level of
    // the first one, worth a rounding error beside the production slice.
    const state = onlyTheHandLeft(1);
    const tap = clickPower(state);
    const next = { ...state, upgrades: { ...state.upgrades, 'click-1': 2 } };
    expect(clickPower(next) - tap).toBeLessThan(tap * NEGLIGIBLE_TAP_GAIN);
    const goal = nextGoal(state);
    expect(goal?.kind).toBe('level');
    // A new founder, where the hand is the whole tap, is still pointed at it.
    const fresh = createInitialState(START);
    fresh.upgrades['prod-1'] = 30; // nothing cheaper left in the way but the hand
    expect(nextGoal(fresh)?.id).toBe('click-1');
    expect(nextGoal(fresh)?.opens).toBeUndefined();
  });

  it('still points at a first hand level for what it opens, and says so', () => {
    // A big company that never bought the hand: its gain is negligible, but the
    // next tier and the crit and combo lines behind it would otherwise stay hidden.
    const goal = nextGoal(onlyTheHandLeft(0));
    expect(goal?.id).toBe('click-1');
    expect(goal?.opens).toBe(true);
  });

  it('keeps the Reputation Engine an accelerator, not a skip of the whole ladder', () => {
    const state = createInitialState(START);
    const base = reputationRate(state, aggregatePassives(state));
    state.upgrades['reputation-engine'] = 1;
    expect(reputationRate(state, aggregatePassives(state))).toBeLessThanOrEqual(base * 2.5);
  });

  it('adds a rushing room to the breakdown so its total is the HUD rate', () => {
    const { engine, advance } = env(bigCompany());
    for (let i = 0; i < CLICK.rushStreak; i += 1) {
      engine.tapStation('nut-crate');
      advance(150);
    }
    expect(engine.currentRushMultiplier()).toBeGreaterThan(1);
    const total =
      productionBreakdown(engine.state, engine.isFocusActive()).total *
      engine.currentBoostMultiplier() *
      engine.currentRushMultiplier();
    expect(total).toBeCloseTo(engine.productionPerSecond(), 6);
  });
});

describe('balances stay whole and valid', () => {
  it('claims a daily reward exactly once and saves it at once', () => {
    const { engine } = env();
    let saves = 0;
    engine.onSave(() => {
      saves += 1;
    });
    const challenge = engine.state.daily.challenges[0];
    challenge.progress = challenge.goal;
    const gold = engine.state.resources.goldenNuts;
    expect(engine.claimDaily(challenge.id)).toBe(true);
    expect(engine.claimDaily(challenge.id)).toBe(false);
    expect(engine.state.resources.goldenNuts).toBeGreaterThan(gold);
    expect(engine.state.resources.goldenNuts - gold).toBeLessThanOrEqual(2);
    expect(saves).toBeGreaterThan(0);
  });

  it('ignores a malformed nut reward instead of corrupting the balance', () => {
    const { engine } = env();
    engine.state.resources.nuts = 50;
    engine.applyEffect({ type: 'nuts', value: Number.NaN });
    engine.applyEffect({ type: 'nuts', value: Number.POSITIVE_INFINITY });
    expect(engine.state.resources.nuts).toBe(50);
  });

  it('shows a balance rounded down and in the player’s own decimal mark', () => {
    expect(formatNumber(49.97, 'pt-BR', 'floor')).toBe('49,9');
    expect(formatNumber(0.2, 'pt-BR')).toBe('0,2');
    expect(formatNumber(9_999, 'en', 'floor')).toBe('9.99K');
    expect(formatNumber(999_960, 'en')).toBe('1M');
  });
});
