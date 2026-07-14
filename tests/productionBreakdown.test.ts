import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { productionBreakdown, computeProduction } from '../src/sim/economy';

describe('production breakdown', () => {
  it('itemises base + employees and matches computeProduction total', () => {
    const s = createInitialState(0);
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 4;
    s.upgrades['prod-1'] = 3;
    const b = productionBreakdown(s, false);
    const prod = computeProduction(s, false);
    expect(b.total).toBeCloseTo(prod.nutsPerSecond, 4);
    expect(b.employees.find((e) => e.id === 'marlow')).toBeTruthy();
    expect(b.upgradeBonus).toBeGreaterThan(0);
    // raw output is base + all employee contributions
    const rawSum = b.base + b.employees.reduce((sum, e) => sum + e.rate, 0);
    expect(b.rawPerSecond).toBeCloseTo(rawSum, 4);
  });

  it('applies the focus multiplier in the breakdown', () => {
    const s = createInitialState(0);
    const normal = productionBreakdown(s, false);
    const focus = productionBreakdown(s, true);
    expect(focus.focusMult).toBeGreaterThan(1);
    expect(focus.total).toBeGreaterThan(normal.total);
  });

  it('low morale reduces the total via the morale multiplier', () => {
    const s = createInitialState(0);
    s.resources.morale = 100;
    const high = productionBreakdown(s, false).total;
    s.resources.morale = 0;
    const low = productionBreakdown(s, false).total;
    expect(low).toBeLessThan(high);
  });
});
