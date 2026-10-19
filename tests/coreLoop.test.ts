import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { BALANCE } from '../src/sim/config';
import { CLICK } from '../src/sim/clickStations';
import { crateCapacity, crateOverflowRate, splitAway, splitProduction } from '../src/sim/crate';
import { computeAway, applyOffline } from '../src/sim/offline';
import { nextFloor, nextGoal } from '../src/sim/goals';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';

function makeEngine(start = 1_000_000) {
  let now = start;
  const engine = new GameEngine(createInitialState(now), { deterministic: true, now: () => now });
  return {
    engine,
    advance(ms: number) {
      now += ms;
    },
    at: () => now,
  };
}

/** Run the company for `seconds` of open play in `step`-second ticks. */
function run(env: ReturnType<typeof makeEngine>, seconds: number, step: number) {
  for (let t = 0; t < seconds; t += step) {
    env.advance(step * 1000);
    env.engine.tick(step);
  }
}

describe('the crate: production becomes something to collect', () => {
  it('sends half to the vault and packs half into the crate', () => {
    const split = splitProduction(0, 1_000, 100, 0);
    expect(split.banked).toBeCloseTo(100 * (1 - BALANCE.crate.share));
    expect(split.packed).toBeCloseTo(100 * BALANCE.crate.share);
  });

  it('never banks less with the game open than offline, even with a full crate', () => {
    for (const auto of [0, 0.25, 0.5, 1]) {
      const full = splitProduction(1_000, 1_000, 100, auto);
      expect(full.packed).toBe(0);
      expect(full.banked).toBeGreaterThanOrEqual(100 * BALANCE.offline.efficiency - 1e-9);
    }
    expect(crateOverflowRate(0)).toBeLessThan(crateOverflowRate(1));
    expect(crateOverflowRate(1)).toBe(1);
  });

  it('fills to its capacity and pays it all out when collected', () => {
    const env = makeEngine();
    env.engine.state.employees.marlow.hired = true;
    env.engine.state.employees.marlow.level = 3;
    run(env, BALANCE.crate.capacityMinutes * 60 + 120, 1);
    const capacity = env.engine.crateCapacity();
    expect(env.engine.state.crate.nuts).toBeCloseTo(capacity, 0);
    expect(env.engine.crateFill()).toBeCloseTo(1, 2);
    const before = env.engine.state.resources.nuts;
    const result = env.engine.collectCrate();
    expect(result.gained).toBeGreaterThanOrEqual(capacity * 0.99);
    expect(env.engine.state.resources.nuts).toBeCloseTo(before + result.gained, 3);
    expect(env.engine.state.crate.nuts).toBe(0);
    // An empty crate pays nothing.
    expect(env.engine.collectCrate().gained).toBe(0);
  });

  it('is collected by tapping the founder crate, alongside the tap payout', () => {
    const env = makeEngine();
    run(env, 120, 1);
    const stored = env.engine.state.crate.nuts;
    expect(stored).toBeGreaterThan(0);
    const result = env.engine.tapStation('nut-crate')!;
    expect(result.crate).toBeCloseTo(stored, 5);
    expect(env.engine.state.crate.nuts).toBe(0);
  });

  it('makes collecting worth it: a collecting player earns more than an idle one', () => {
    const idle = makeEngine();
    const active = makeEngine();
    for (const env of [idle, active]) {
      env.engine.state.employees.marlow.hired = true;
      env.engine.state.employees.marlow.level = 5;
    }
    for (let minute = 0; minute < 40; minute += 1) {
      run(idle, 60, 1);
      run(active, 60, 1);
      if (minute % 8 === 7) active.engine.collectCrate();
    }
    active.engine.collectCrate();
    expect(active.engine.state.stats.totalNutsEarned).toBeGreaterThan(
      idle.engine.state.stats.totalNutsEarned * 1.2,
    );
  });
});

describe('keeping the game open is never punished', () => {
  it('credits a throttled minute-long tick exactly like a minute of fast ticks', () => {
    const fast = makeEngine();
    const slow = makeEngine();
    for (const env of [fast, slow]) {
      env.engine.state.employees.marlow.hired = true;
      env.engine.state.employees.marlow.level = 4;
    }
    run(fast, 120, 0.1);
    run(slow, 120, 60); // a hidden window ticked once a minute
    const a = fast.engine.state.resources.nuts + fast.engine.state.crate.nuts;
    const b = slow.engine.state.resources.nuts + slow.engine.state.crate.nuts;
    expect(b).toBeGreaterThan(a * 0.97);
    expect(b).toBeLessThan(a * 1.03);
  });

  it('settles a sleep gap like time away: offline rules, crate filled, finds waiting', () => {
    const env = makeEngine();
    env.engine.state.employees.marlow.hired = true;
    env.engine.state.employees.marlow.level = 4;
    env.engine.state.stats.playTimeSeconds = 600;
    const rate = env.engine.productionPerSecond();
    const hours = 2;
    env.advance(hours * 3600 * 1000);
    const result = env.engine.settleAway(hours * 3600);
    expect(result.ignored).toBe(false);
    expect(result.crateFilled).toBeGreaterThan(0);
    // Banked: everything that did not fit in the crate, at offline efficiency.
    const produced = rate * hours * 3600;
    expect(result.nutsEarned).toBeCloseTo(
      (produced - result.crateFilled!) * BALANCE.offline.efficiency,
      0,
    );
    expect(env.engine.state.crate.nuts).toBeCloseTo(result.crateFilled!, 3);
    expect(env.engine.waitingFinds().length).toBeGreaterThan(0);
    expect(env.engine.waitingFinds().length).toBeLessThanOrEqual(BALANCE.finds.maxWaiting);
  });

  it('never invents time: away beyond the offline cap is not paid', () => {
    const state = createInitialState(0);
    const capSeconds = BALANCE.offline.defaultCapHours * 3600;
    const atCap = computeAway(state, capSeconds);
    const beyond = computeAway(state, capSeconds * 3);
    expect(beyond.nutsEarned).toBeCloseTo(atCap.nutsEarned, 6);
    expect(beyond.wasCapped).toBe(true);
    expect(computeAway(state, -50).ignored).toBe(true);
  });

  it('fills the crate while closed, banking the rest at offline efficiency', () => {
    const state = createInitialState(0);
    const result = computeAway(state, 3600);
    const rate = result.ratePerSecond;
    const capacity = crateCapacity(rate);
    expect(result.crateFilled).toBeCloseTo(Math.min(capacity, rate * 3600 * BALANCE.crate.share));
    applyOffline(state, result);
    expect(state.crate.nuts).toBeCloseTo(result.crateFilled!);
    const away = splitAway(0, capacity, rate * 3600);
    expect(away.banked).toBeCloseTo(result.nutsEarned);
  });
});

describe('rushes: a short burst of rhythm scales with the company', () => {
  it('starts when the combo reaches the rush streak and doubles the room', () => {
    const env = makeEngine();
    const before = env.engine.productionPerSecond();
    let started = false;
    for (let i = 0; i < CLICK.rushStreak; i += 1) {
      env.advance(400);
      const result = env.engine.tapStation('nut-crate')!;
      if (result.rush === 'started') started = true;
    }
    expect(started).toBe(true);
    expect(env.engine.rushEndsAt('founder-desk')).toBeGreaterThan(env.at());
    // The founder works alone here, so the whole company doubles.
    expect(env.engine.productionPerSecond()).toBeCloseTo(before * CLICK.rushMultiplier, 6);
    expect(env.engine.state.clicker.rushes).toBe(1);
    // It ends on its own.
    env.advance(CLICK.rushSeconds * 1000 + 10);
    env.engine.tick(0.1);
    expect(env.engine.rushEndsAt('founder-desk')).toBe(0);
    expect(env.engine.productionPerSecond()).toBeCloseTo(before, 1);
  });

  it('only speeds up the share of the company working in that room', () => {
    const env = makeEngine();
    const s = env.engine.state;
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 6;
    s.employees.marlow.room = 'founder-desk';
    const share = env.engine.roomShare('founder-desk');
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThanOrEqual(1);
    expect(env.engine.roomShare('lab')).toBe(0);
  });

  it('a slow, lapsed rhythm never rushes', () => {
    const env = makeEngine();
    for (let i = 0; i < CLICK.rushStreak * 2; i += 1) {
      env.advance(CLICK.comboWindowMs + 100);
      expect(env.engine.tapStation('nut-crate')!.rush).toBeUndefined();
    }
  });
});

describe('finds: teammates hand the player something', () => {
  it('appear while the company runs, never more than the limit', () => {
    const env = makeEngine();
    env.engine.state.employees.marlow.hired = true;
    env.engine.state.employees.marlow.level = 2;
    run(env, 3600, 5);
    const finds = env.engine.waitingFinds();
    expect(finds.length).toBeGreaterThan(0);
    expect(finds.length).toBeLessThanOrEqual(BALANCE.finds.maxWaiting);
    // One per teammate at a time.
    expect(new Set(finds.map((find) => find.employeeId)).size).toBe(finds.length);
  });

  it('wait a new founder out for the first minute', () => {
    const env = makeEngine();
    run(env, BALANCE.finds.firstAfterSeconds - 5, 1);
    expect(env.engine.waitingFinds()).toHaveLength(0);
  });

  it('pay out production, please the finder, and are gone once taken', () => {
    const env = makeEngine();
    env.engine.state.stats.playTimeSeconds = 600;
    env.engine.catchUpFinds(BALANCE.finds.meanIntervalSeconds);
    const [find] = env.engine.waitingFinds();
    expect(find).toBeTruthy();
    const friendship = env.engine.state.employees[find.employeeId].friendship;
    const before = env.engine.state.resources.nuts;
    const reward = env.engine.collectFind(find.id)!;
    expect(reward.nuts).toBeGreaterThanOrEqual(BALANCE.finds.minReward);
    expect(env.engine.state.resources.nuts).toBeCloseTo(before + reward.nuts, 6);
    expect(env.engine.state.employees[find.employeeId].friendship).toBe(friendship + 1);
    expect(env.engine.state.employees[find.employeeId].emotion?.id).toBe('happy');
    expect(env.engine.waitingFinds()).toHaveLength(0);
    expect(env.engine.collectFind(find.id)).toBeNull();
  });
});

describe('goals: there is always a next thing to work toward', () => {
  it('starts a new company on a cheap, measurable first goal', () => {
    const state = createInitialState(0);
    const goal = nextGoal(state)!;
    expect(goal).toBeTruthy();
    expect(goal.cost).toBeGreaterThan(0);
    expect(goal.gain.perSecond + goal.gain.perTap).toBeGreaterThan(0);
  });

  it('measures exactly what the purchase changes', () => {
    const env = makeEngine();
    env.engine.state.resources.nuts = 1e9;
    const goal = nextGoal(env.engine.state)!;
    const before = env.engine.productionPerSecond();
    expect(
      goal.kind === 'hire' || goal.kind === 'level'
        ? env.engine.hireOrLevelEmployee(goal.id)
        : env.engine.buyUpgrade(goal.id),
    ).toBe(true);
    expect(env.engine.productionPerSecond() - before).toBeCloseTo(goal.gain.perSecond, 6);
  });

  it('builds toward the floor the company can open soonest', () => {
    const state = createInitialState(0);
    const floor = nextFloor(state)!;
    expect(floor).toBeTruthy();
    expect(Number.isFinite(floor.eta)).toBe(true);
    state.resources.nuts = 1e12;
    const purchasable = nextFloor(state)!;
    expect(purchasable.eta).toBe(0);
  });
});

describe('saves', () => {
  it('loads a save from before the crate and finds', () => {
    const old = JSON.parse(JSON.stringify(createInitialState(0)));
    delete old.crate;
    delete old.finds;
    delete old.clicker.rushes;
    delete old.clicker.findsCollected;
    const parsed = gameStateSchema.parse(migrate(old));
    expect(parsed.crate).toEqual({ nuts: 0 });
    expect(parsed.finds).toEqual([]);
    expect(parsed.clicker.rushes).toBe(0);
  });

  it('keeps waiting finds and the crate across a reload, dropping broken entries', () => {
    const env = makeEngine();
    env.engine.state.stats.playTimeSeconds = 600;
    env.engine.state.crate.nuts = 123;
    env.engine.catchUpFinds(BALANCE.finds.meanIntervalSeconds * 2);
    const saved = JSON.parse(JSON.stringify(env.engine.state));
    saved.finds.push({ id: 'broken', kind: 'nope' });
    const parsed = gameStateSchema.parse(migrate(saved));
    expect(parsed.crate.nuts).toBe(123);
    expect(parsed.finds).toHaveLength(env.engine.waitingFinds().length);
  });
});
