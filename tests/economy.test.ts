import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import {
  computeProduction,
  upgradeCost,
  employeeLevelCost,
  moraleMultiplier,
  aggregatePassives,
} from '../src/sim/economy';
import { UPGRADES_BY_ID } from '../src/content/upgrades';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import { BALANCE } from '../src/sim/config';

describe('economy: production', () => {
  it('produces the founder base rate for a fresh company', () => {
    const s = createInitialState(0);
    const prod = computeProduction(s, false);
    // base + pip level 1 contribution, times morale multiplier
    expect(prod.nutsPerSecond).toBeGreaterThan(0);
    expect(prod.breakdown.find((b) => b.source === 'employee:pip')).toBeTruthy();
  });

  it('hiring and leveling an employee increases production', () => {
    const s = createInitialState(0);
    const before = computeProduction(s, false).nutsPerSecond;
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 3;
    const after = computeProduction(s, false).nutsPerSecond;
    expect(after).toBeGreaterThan(before);
  });

  it('production upgrades multiply output', () => {
    const s = createInitialState(0);
    const before = computeProduction(s, false).nutsPerSecond;
    s.upgrades['prod-1'] = 5;
    const after = computeProduction(s, false).nutsPerSecond;
    expect(after).toBeGreaterThan(before);
  });

  it('focus mode applies the focus multiplier', () => {
    const s = createInitialState(0);
    const normal = computeProduction(s, false).nutsPerSecond;
    const focus = computeProduction(s, true).nutsPerSecond;
    expect(focus / normal).toBeCloseTo(BALANCE.focus.productionMultiplier, 4);
  });
});

describe('economy: costs', () => {
  it('upgrade cost grows geometrically', () => {
    const def = UPGRADES_BY_ID['prod-1'];
    const c0 = upgradeCost(def, 0);
    const c1 = upgradeCost(def, 1);
    const c2 = upgradeCost(def, 2);
    expect(c1).toBeGreaterThan(c0);
    expect(c2).toBeGreaterThan(c1);
    expect(c1 / c0).toBeCloseTo(def.costMult, 1);
  });

  it('cost reduction lowers cost but never below 1', () => {
    const def = UPGRADES_BY_ID['prod-1'];
    const full = upgradeCost(def, 3, 0);
    const reduced = upgradeCost(def, 3, 0.5);
    expect(reduced).toBeLessThan(full);
    expect(reduced).toBeGreaterThanOrEqual(1);
  });

  it('employee level cost uses hire cost for the first level', () => {
    const def = EMPLOYEES_BY_ID['marlow'];
    expect(employeeLevelCost(def, 0)).toBe(def.hireCost.amount);
  });
});

describe('economy: modifiers', () => {
  it('morale multiplier is monotonic between min and max', () => {
    expect(moraleMultiplier(0)).toBeCloseTo(BALANCE.morale.minMultiplier, 5);
    expect(moraleMultiplier(100)).toBeCloseTo(BALANCE.morale.maxMultiplier, 5);
    expect(moraleMultiplier(50)).toBeGreaterThan(moraleMultiplier(0));
  });

  it('aggregates employee passives correctly', () => {
    const s = createInitialState(0);
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 2;
    const p = aggregatePassives(s);
    expect(p.moraleBonus).toBeGreaterThan(0);
    expect(p.costReduction).toBeLessThanOrEqual(0.75);
  });
});
