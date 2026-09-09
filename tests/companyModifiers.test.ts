import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import {
  aggregateCompanyModifiers,
  emptyModifiers,
  idleRooms,
  roomContributions,
  roomIsRunning,
  roomStaffing,
} from '../src/sim/companyModifiers';
import {
  ROOM_FULL_STAFF,
  ROOM_PROFILES,
  ROOM_PROFILES_BY_ID,
  roomsDependingOn,
} from '../src/content/roomProfiles';
import { ROOMS_BY_ID } from '../src/content/rooms';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import {
  computeProduction,
  productionBreakdown,
  clickPower,
  autoCollectRate,
} from '../src/sim/economy';
import type { GameState } from '../src/sim/types';

function fresh() {
  return new GameEngine(createInitialState(0), { deterministic: true });
}

/** Unlock every room so synergies can be exercised. */
function openTheBuilding(state: GameState) {
  state.resources.reputation = 100_000;
  for (const room of Object.values(ROOMS_BY_ID)) {
    if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  }
}

/** Put `n` employees into a room (hiring them as needed). */
function staff(state: GameState, roomId: string, n: number, preferred: string[] = []) {
  const ids = [
    ...preferred,
    ...Object.keys(state.employees).filter((id) => !preferred.includes(id)),
  ];
  let placed = 0;
  for (const id of ids) {
    if (placed >= n) break;
    const rt = state.employees[id];
    if (!rt) continue;
    // Skip anyone already placed elsewhere by a previous call.
    if (rt.hired && rt.room && rt.room !== roomId) continue;
    rt.hired = true;
    if (rt.level < 1) rt.level = 1;
    rt.room = roomId;
    placed += 1;
  }
  return placed;
}

describe('room profile content', () => {
  it('describes a real room', () => {
    for (const p of ROOM_PROFILES) {
      expect(ROOMS_BY_ID[p.roomId], `${p.roomId} is not a real room`).toBeDefined();
    }
  });

  it('covers every room in the game', () => {
    for (const id of Object.keys(ROOMS_BY_ID)) {
      expect(ROOM_PROFILES_BY_ID[id], `${id} has no profile`).toBeDefined();
    }
  });

  it('only names real rooms as dependencies', () => {
    for (const p of ROOM_PROFILES) {
      for (const e of [...p.effects, ...p.tradeoffs]) {
        if (e.requiresRoom) expect(ROOMS_BY_ID[e.requiresRoom]).toBeDefined();
      }
    }
  });

  it('only names real employees as specialists', () => {
    for (const p of ROOM_PROFILES) {
      for (const id of p.specialists ?? []) {
        expect(EMPLOYEES_BY_ID[id], `${p.roomId} specialist ${id}`).toBeDefined();
      }
    }
  });

  it('gives the building a mix of tempers, not one repeated personality', () => {
    const tempers = new Set(ROOM_PROFILES.map((p) => p.temper));
    expect(tempers.size).toBeGreaterThanOrEqual(5);
  });

  it('makes the strongest production rooms carry a real cost', () => {
    // The design promise: whichever room gives the most production must also hurt.
    const best = [...ROOM_PROFILES]
      .map((p) => ({
        p,
        gain: p.effects.filter((e) => e.kind === 'production').reduce((s, e) => s + e.value, 0),
      }))
      .sort((a, b) => b.gain - a.gain)[0];
    expect(best.gain).toBeGreaterThan(0);
    expect(best.p.tradeoffs.length).toBeGreaterThan(0);
  });

  it('has at least one room whose morale gain offsets another room’s penalty', () => {
    const givers = ROOM_PROFILES.filter((p) =>
      p.effects.some((e) => e.kind === 'moraleTarget' && e.value > 0),
    );
    const takers = ROOM_PROFILES.filter((p) =>
      p.tradeoffs.some((e) => e.kind === 'moraleTarget' && e.value < 0),
    );
    expect(givers.length).toBeGreaterThan(0);
    expect(takers.length).toBeGreaterThan(0);
    const biggestGain = Math.max(
      ...givers.map((p) =>
        p.effects.filter((e) => e.kind === 'moraleTarget').reduce((s, e) => s + e.value, 0),
      ),
    );
    const biggestLoss = Math.min(
      ...takers.map((p) =>
        p.tradeoffs.filter((e) => e.kind === 'moraleTarget').reduce((s, e) => s + e.value, 0),
      ),
    );
    // A single social room can cancel a single output room's morale hit.
    expect(biggestGain).toBeGreaterThanOrEqual(Math.abs(biggestLoss) * 0.7);
  });

  it('exposes the reverse dependency map for the synergy UI', () => {
    // Construction is named by Procurement's conditional production effect.
    expect(roomsDependingOn('construction').map((p) => p.roomId)).toContain('procurement');
  });
});

describe('staffing drives everything', () => {
  it('reports an unlocked but empty room as idle and inert', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    expect(idleRooms(engine.state)).toContain('lab');
    expect(roomStaffing(engine.state, 'lab')).toBe(0);
    expect(roomIsRunning(engine.state, 'lab')).toBe(false);
  });

  it('scales a room’s staffed effects with how many people work there', () => {
    const one = fresh();
    openTheBuilding(one.state);
    staff(one.state, 'sorting', 1);
    const partial = aggregateCompanyModifiers(one.state).production;

    const full = fresh();
    openTheBuilding(full.state);
    staff(full.state, 'sorting', ROOM_FULL_STAFF);
    const complete = aggregateCompanyModifiers(full.state).production;

    expect(complete).toBeGreaterThan(partial);
  });

  it('caps staffing at full strength', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    staff(engine.state, 'sorting', ROOM_FULL_STAFF + 3);
    expect(roomStaffing(engine.state, 'sorting')).toBe(1);
  });

  it('still applies structural (fixed) effects with nobody in the room', () => {
    const engine = fresh();
    // founder-desk is unlocked from the start and its effects are structural.
    const mods = aggregateCompanyModifiers(engine.state);
    expect(mods.clickPower).toBeGreaterThan(0);
  });

  it('gives a specialist more weight than a generalist', () => {
    const generalist = fresh();
    openTheBuilding(generalist.state);
    // Bea is the Construction specialist, so keep her out of this one.
    staff(generalist.state, 'construction', 1, ['pip']);
    const withoutSpecialist = aggregateCompanyModifiers(generalist.state).automation;

    const specialist = fresh();
    openTheBuilding(specialist.state);
    staff(specialist.state, 'construction', 1, ['bea']);
    const withSpecialist = aggregateCompanyModifiers(specialist.state).automation;

    expect(withSpecialist).toBeGreaterThan(withoutSpecialist);
  });
});

describe('synergy chains', () => {
  it('keeps a partner-gated effect dormant until the partner room runs', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    staff(engine.state, 'procurement', ROOM_FULL_STAFF);

    const before = roomContributions(engine.state).find((c) => c.roomId === 'procurement')!;
    // Procurement's production effect needs Construction staffed.
    expect(before.dormant.some((d) => d.requiresRoom === 'construction')).toBe(true);
    const productionBefore = aggregateCompanyModifiers(engine.state).production;

    staff(engine.state, 'construction', ROOM_FULL_STAFF);
    const after = roomContributions(engine.state).find((c) => c.roomId === 'procurement')!;
    expect(after.dormant.some((d) => d.requiresRoom === 'construction')).toBe(false);
    expect(aggregateCompanyModifiers(engine.state).production).toBeGreaterThan(productionBefore);
  });

  it('keeps a morale-gated effect dormant while morale is low', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    staff(engine.state, 'marketing', ROOM_FULL_STAFF);

    engine.state.resources.morale = 10;
    const low = aggregateCompanyModifiers(engine.state).reputationRate;
    const lowContribution = roomContributions(engine.state).find((c) => c.roomId === 'marketing')!;
    expect(lowContribution.dormant.some((d) => d.reason === 'low-morale')).toBe(true);

    engine.state.resources.morale = 100;
    const high = aggregateCompanyModifiers(engine.state).reputationRate;
    // Marketing converts a happy company into standing.
    expect(high).toBeGreaterThan(low);
  });

  it('lets a social room cancel the Lab’s morale penalty', () => {
    const labOnly = fresh();
    openTheBuilding(labOnly.state);
    staff(labOnly.state, 'lab', ROOM_FULL_STAFF);
    const penalty = aggregateCompanyModifiers(labOnly.state).moraleTarget;
    expect(penalty).toBeLessThan(0);

    const balanced = fresh();
    openTheBuilding(balanced.state);
    staff(balanced.state, 'lab', ROOM_FULL_STAFF);
    staff(balanced.state, 'nap', ROOM_FULL_STAFF);
    // Adding the Nap Room is the intended answer to running a Lab.
    expect(aggregateCompanyModifiers(balanced.state).moraleTarget).toBeGreaterThan(penalty);
  });

  it('builds a full chain: output room + support room beats output room alone', () => {
    const raw = fresh();
    openTheBuilding(raw.state);
    staff(raw.state, 'lab', ROOM_FULL_STAFF);
    raw.tick(30);
    const rawProduction = computeProduction(raw.state, false).nutsPerSecond;

    const chained = fresh();
    openTheBuilding(chained.state);
    staff(chained.state, 'lab', ROOM_FULL_STAFF);
    staff(chained.state, 'research', ROOM_FULL_STAFF);
    staff(chained.state, 'nap', ROOM_FULL_STAFF);
    chained.tick(30);

    // Research compounds on the Lab, and the Nap Room protects morale, so the
    // same Lab produces more inside a designed building.
    expect(computeProduction(chained.state, false).nutsPerSecond).toBeGreaterThan(rawProduction);
  });
});

describe('the network actually reaches the simulation', () => {
  it('feeds the production multiplier and is reported in the breakdown', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    staff(engine.state, 'sorting', ROOM_FULL_STAFF);
    const breakdown = productionBreakdown(engine.state, false);
    expect(breakdown.roomBonus).toBeGreaterThan(0);
    // The explain panel must not under-report: recompute the total from parts.
    const recomputed =
      breakdown.rawPerSecond *
      (1 + breakdown.upgradeBonus + breakdown.passiveBonus + breakdown.roomBonus) *
      breakdown.moraleMult *
      breakdown.prestigeMult *
      breakdown.focusMult *
      breakdown.moodMult;
    expect(recomputed).toBeCloseTo(breakdown.total, 6);
    expect(breakdown.total).toBeCloseTo(computeProduction(engine.state, false).nutsPerSecond, 6);
  });

  it('raises tap value through the click-power lever', () => {
    const plain = fresh();
    const basePower = clickPower(plain.state);

    const wired = fresh();
    openTheBuilding(wired.state);
    staff(wired.state, 'sorting', ROOM_FULL_STAFF);
    expect(clickPower(wired.state)).toBeGreaterThan(basePower);
  });

  it('grants automation from the workshop and company standing', () => {
    const engine = fresh();
    const before = autoCollectRate(engine.state);
    openTheBuilding(engine.state);
    staff(engine.state, 'construction', ROOM_FULL_STAFF, ['bea']);
    expect(autoCollectRate(engine.state)).toBeGreaterThan(before);
  });

  it('moves the morale equilibrium the company settles at', () => {
    const grim = fresh();
    openTheBuilding(grim.state);
    staff(grim.state, 'basement', ROOM_FULL_STAFF);
    grim.state.resources.morale = 70;
    grim.tick(120);

    const kind = fresh();
    openTheBuilding(kind.state);
    staff(kind.state, 'morale', ROOM_FULL_STAFF);
    kind.state.resources.morale = 70;
    kind.tick(120);

    expect(kind.state.resources.morale).toBeGreaterThan(grim.state.resources.morale);
  });

  it('can drive reputation negative-rate with an unpleasant building', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    staff(engine.state, 'basement', ROOM_FULL_STAFF);
    staff(engine.state, 'lab', ROOM_FULL_STAFF);
    const mods = aggregateCompanyModifiers(engine.state);
    expect(mods.reputationRate).toBeLessThan(0);
  });

  it('never lets reputation go below zero even with a hostile building', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    staff(engine.state, 'basement', ROOM_FULL_STAFF);
    engine.state.resources.reputation = 0.05;
    engine.tick(600);
    expect(engine.state.resources.reputation).toBeGreaterThanOrEqual(0);
  });
});

describe('modifier guard rails', () => {
  it('starts from a zeroed set', () => {
    const mods = emptyModifiers();
    for (const value of Object.values(mods)) expect(value).toBe(0);
  });

  it('keeps every lever inside a sane range for any staffing of every room', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    // Cram everyone into every room in turn and check nothing inverts.
    for (const profile of ROOM_PROFILES) {
      const probe = fresh();
      openTheBuilding(probe.state);
      staff(probe.state, profile.roomId, 6);
      for (const morale of [0, 50, 100]) {
        probe.state.resources.morale = morale;
        const mods = aggregateCompanyModifiers(probe.state);
        expect(mods.production, `${profile.roomId} production`).toBeGreaterThan(-1);
        expect(mods.clickPower, `${profile.roomId} clickPower`).toBeGreaterThan(-1);
        expect(mods.costReduction).toBeGreaterThanOrEqual(0);
        expect(mods.costReduction).toBeLessThanOrEqual(0.75);
        expect(mods.automation).toBeGreaterThanOrEqual(0);
        expect(mods.automation).toBeLessThanOrEqual(1);
        expect(mods.goldenChance).toBeGreaterThanOrEqual(0);
        expect(mods.critChance).toBeGreaterThanOrEqual(0);
        expect(mods.eventLuck).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never produces a negative nuts-per-second, however bad the building', () => {
    const engine = fresh();
    openTheBuilding(engine.state);
    for (const room of ['nap', 'meeting', 'marketing']) staff(engine.state, room, 2);
    engine.state.resources.morale = 0;
    expect(computeProduction(engine.state, false).nutsPerSecond).toBeGreaterThan(0);
  });
});
