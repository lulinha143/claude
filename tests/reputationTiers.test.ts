import { describe, it, expect } from 'vitest';
import {
  REPUTATION_TIERS,
  nextReputationTier,
  reputationTier,
  reputationTierIndex,
  reputationTierProgress,
} from '../src/content/reputationTiers';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { aggregateCompanyModifiers } from '../src/sim/companyModifiers';
import { nextReputationUnlock } from '../src/sim/economy';

describe('the reputation ladder', () => {
  it('starts at the bottom rung for a brand-new company', () => {
    expect(reputationTier(0).id).toBe(REPUTATION_TIERS[0].id);
    expect(REPUTATION_TIERS[0].at).toBe(0);
  });

  it('is authored in ascending order with unique ids', () => {
    const ids = REPUTATION_TIERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < REPUTATION_TIERS.length; i += 1) {
      expect(REPUTATION_TIERS[i].at).toBeGreaterThan(REPUTATION_TIERS[i - 1].at);
    }
  });

  it('picks the highest tier the company has actually reached', () => {
    const second = REPUTATION_TIERS[1];
    expect(reputationTier(second.at).id).toBe(second.id);
    expect(reputationTier(second.at - 0.01).id).toBe(REPUTATION_TIERS[0].id);
  });

  it('never falls off the top of the ladder', () => {
    const top = REPUTATION_TIERS[REPUTATION_TIERS.length - 1];
    expect(reputationTier(top.at * 100).id).toBe(top.id);
    expect(nextReputationTier(top.at)).toBeNull();
    expect(reputationTierProgress(top.at)).toBe(1);
  });

  it('reports progress through the current rung', () => {
    const a = REPUTATION_TIERS[0];
    const b = REPUTATION_TIERS[1];
    expect(reputationTierProgress(a.at)).toBeCloseTo(0, 5);
    expect(reputationTierProgress((a.at + b.at) / 2)).toBeCloseTo(0.5, 5);
  });

  it('reports a stable index for display', () => {
    expect(reputationTierIndex(0)).toBe(0);
    expect(reputationTierIndex(REPUTATION_TIERS[2].at)).toBe(2);
  });

  it('makes standing progressively more rewarding', () => {
    // Each tier that grants a discount must grant at least as much as the one
    // below it, so climbing never feels like a downgrade.
    let best = 0;
    for (const tier of REPUTATION_TIERS) {
      const value = tier.perk?.costReduction ?? 0;
      if (value > 0) {
        expect(value).toBeGreaterThanOrEqual(best);
        best = value;
      }
    }
    expect(best).toBeGreaterThan(0);
  });

  it('feeds its perk into the live company modifiers', () => {
    const low = new GameEngine(createInitialState(0), { deterministic: true });
    low.state.resources.reputation = 0;
    const lowMods = aggregateCompanyModifiers(low.state);

    const high = new GameEngine(createInitialState(0), { deterministic: true });
    high.state.resources.reputation = REPUTATION_TIERS[REPUTATION_TIERS.length - 1].at;
    const highMods = aggregateCompanyModifiers(high.state);

    expect(highMods.costReduction).toBeGreaterThan(lowMods.costReduction);
    expect(highMods.automation).toBeGreaterThan(lowMods.automation);
  });

  it('is offered as something reputation is working toward', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.state.resources.reputation = 1;
    const next = nextReputationUnlock(engine.state);
    expect(next).not.toBeNull();
    // The nearest goal must be a real threshold above where the company is now.
    expect(next!).toBeGreaterThan(1);
  });

  it('gives every tier a name and a flavour line', () => {
    for (const tier of REPUTATION_TIERS) {
      expect(tier.nameKey).toMatch(/^repTier\./);
      expect(tier.blurbKey).toMatch(/^repTier\./);
    }
  });
});
