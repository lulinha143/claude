import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import {
  canPrestige,
  kernelsFromPrestige,
  performPrestige,
  buyPrestigeSkill,
} from '../src/sim/prestige';
import { gameStateSchema } from '../src/save/schema';
import { BALANCE } from '../src/sim/config';
import { GameEngine } from '../src/sim/engine';
import { moraleCap, prestigeMoraleBonus, prestigeRareEventChance } from '../src/sim/economy';
import { PRESTIGE_BRANCHES_BY_ID } from '../src/content/prestige';
import type { PrestigeBranchId } from '../src/sim/types';
import { createRng } from '../src/sim/rng';
import { pickIncident } from '../src/sim/happenings';
import { GAME_EVENTS } from '../src/content/events';

describe('prestige', () => {
  it('cannot pay twice from lifetime production, including after save reload', () => {
    const state = createInitialState(0);
    state.stats.totalNutsEarned = 4_000_000;
    const earned = kernelsFromPrestige(state);
    const first = performPrestige(state, 'cooperative', 1000);
    const loaded = gameStateSchema.parse(first) as unknown as import('../src/sim/types').GameState;
    expect(loaded.stats.totalNutsEarned).toBe(4_000_000);
    expect(canPrestige(loaded)).toBe(false);
    expect(kernelsFromPrestige(loaded)).toBe(0);
    expect(performPrestige(loaded, 'industrial', 2000)).toBe(loaded);
    expect(loaded.resources.permanentKernels).toBe(earned);
    loaded.stats.totalNutsEarned += BALANCE.prestige.unlockAtTotalNuts;
    expect(canPrestige(loaded)).toBe(true);
    const second = performPrestige(loaded, 'science', 3000);
    expect(second.prestige.count).toBe(2);
    expect(canPrestige(second)).toBe(false);
  });
  it('is locked until the current run reaches the nut threshold', () => {
    const s = createInitialState(0);
    expect(canPrestige(s)).toBe(false);
    s.stats.totalNutsEarned = BALANCE.prestige.unlockAtTotalNuts;
    expect(canPrestige(s)).toBe(true);
  });

  it('awards at least one kernel at the threshold and scales up', () => {
    const s = createInitialState(0);
    s.stats.totalNutsEarned = BALANCE.prestige.unlockAtTotalNuts;
    const k1 = kernelsFromPrestige(s);
    s.stats.totalNutsEarned = BALANCE.prestige.unlockAtTotalNuts * 100;
    const k2 = kernelsFromPrestige(s);
    expect(k1).toBeGreaterThanOrEqual(1);
    expect(k2).toBeGreaterThan(k1);
  });

  it('resets progress but preserves permanent progression', () => {
    const s = createInitialState(0);
    s.stats.totalNutsEarned = 4_000_000;
    s.resources.nuts = 4_000_000;
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 5;
    s.employees.marlow.friendship = 60;
    s.collections.nuts.push('intern-acorn');
    s.achievements['first-day'] = 123;

    const earned = kernelsFromPrestige(s);
    const next = performPrestige(s, 'cooperative', 1000);

    expect(next.prestige.count).toBe(1);
    expect(next.prestige.branch).toBe('cooperative');
    expect(next.resources.permanentKernels).toBe(earned);
    // company progress reset
    expect(next.employees.marlow.hired).toBe(false);
    expect(next.employees.marlow.level).toBe(0);
    // memories preserved
    expect(next.employees.marlow.friendship).toBe(60);
    expect(next.collections.nuts).toContain('intern-acorn');
    expect(next.achievements['first-day']).toBe(123);
  });

  it('preserves stable decoration identity, placement, and interaction state', () => {
    const s = createInitialState(0);
    s.stats.totalNutsEarned = BALANCE.prestige.unlockAtTotalNuts;
    s.collections.secrets.push('deco:potted-fern');
    s.placements['potted-fern'] = { surface: 'floor', x: 0.72, y: 0.08 };
    s.decorationInstances.push({
      instanceId: 'stable-fern',
      decorationId: 'potted-fern',
      roomId: 'founder-desk',
      surfaceType: 'floor',
      normalizedX: 0.72,
      normalizedY: 0.08,
      depth: 2,
      variantId: 'blue-pot',
      flipped: true,
      rotation: 4,
      interactionState: { watered: true },
    });

    const next = performPrestige(s, 'cooperative', 1000);
    expect(next.decorationInstances).toEqual(s.decorationInstances);
    expect(next.placements).toEqual(s.placements);
    expect(next.decorationInstances).not.toBe(s.decorationInstances);
    expect(next.decorationInstances[0].interactionState).not.toBe(
      s.decorationInstances[0].interactionState,
    );
    expect(next.placements['potted-fern']).not.toBe(s.placements['potted-fern']);
  });

  it('head-start skill grants starting nuts on prestige', () => {
    const s = createInitialState(0);
    s.stats.totalNutsEarned = 4_000_000;
    s.prestige.skills['head-start'] = 2; // 2 * 500 = 1000
    const next = performPrestige(s, 'industrial', 0);
    expect(next.resources.nuts).toBe(1000);
  });

  it('buying a skill spends kernels and increases level', () => {
    const s = createInitialState(0);
    s.resources.permanentKernels = 10;
    expect(buyPrestigeSkill(s, 'compound-nuts')).toBe(true);
    expect(s.prestige.skills['compound-nuts']).toBe(1);
    expect(s.resources.permanentKernels).toBe(8);
  });

  it('cannot buy a skill without enough kernels', () => {
    const s = createInitialState(0);
    s.resources.permanentKernels = 0;
    expect(buyPrestigeSkill(s, 'compound-nuts')).toBe(false);
  });
});

/*
 * A branch has to actually DO what its card says.
 *
 * `PrestigeBranchDef` carries three effects and only `productionMultiplier` was ever
 * applied, which made three of the five branch descriptions false: "Everyone's happy.
 * High morale", "More rare events" and "Big rare-event chance" all described numbers
 * that were authored and then ignored. Because the branch is chosen once per run and is
 * permanent, that is a worse defect than a normal unused field — the player commits to
 * it on the strength of the description.
 *
 * These tests are written against the described BEHAVIOUR rather than against the
 * accessors, so that re-breaking the wiring fails here even if the helpers survive.
 */
describe('a prestige branch delivers every effect its card advertises', () => {
  const settleMorale = (branch: PrestigeBranchId | null) => {
    const state = createInitialState(0);
    state.prestige.branch = branch;
    const engine = new GameEngine(state, { deterministic: true });
    // Morale drifts toward its target, so run enough seconds to arrive.
    for (let i = 0; i < 400; i += 1) engine.tick(1);
    return state.resources.morale;
  };

  it('lets Cozy Cooperative settle the company at higher morale than no branch', () => {
    const neutral = settleMorale(null);
    const cosy = settleMorale('cooperative');
    expect(PRESTIGE_BRANCHES_BY_ID.cooperative.moraleBonus).toBeGreaterThan(0);
    expect(cosy).toBeGreaterThan(neutral);
  });

  it('makes Industrial Nuts cost the morale its own description promises', () => {
    const neutral = settleMorale(null);
    const industrial = settleMorale('industrial');
    expect(PRESTIGE_BRANCHES_BY_ID.industrial.moraleBonus).toBeLessThan(0);
    expect(industrial).toBeLessThan(neutral);
  });

  it('keeps the morale shift inside the game bounds instead of overflowing the cap', () => {
    const cosy = settleMorale('cooperative');
    expect(cosy).toBeLessThanOrEqual(moraleCap(createInitialState(0)));
    expect(settleMorale('industrial')).toBeGreaterThanOrEqual(BALANCE.morale.min);
  });

  it('raises the rare-event chance for the two branches that sell rare events', () => {
    const base = prestigeRareEventChance(createInitialState(0));
    expect(base).toBe(0);
    for (const branch of ['science', 'marketing'] as PrestigeBranchId[]) {
      const state = createInitialState(0);
      state.prestige.branch = branch;
      expect(prestigeRareEventChance(state)).toBeGreaterThan(0);
      expect(prestigeRareEventChance(state)).toBe(PRESTIGE_BRANCHES_BY_ID[branch].rareEventChance);
    }
  });

  it('actually makes rare events likelier on the branch that promises them', () => {
    // Same company, only the branch differs: the rare-event term has to be the
    // thing that changes which incidents turn up. It promises rarer events, not
    // more of them, so the ordinary tiers stay where they were.
    const odds = (branch: PrestigeBranchId | null) => {
      const state = createInitialState(0);
      state.prestige.branch = branch;
      return new GameEngine(state, { deterministic: true, seed: 0 }).rarityOdds();
    };
    const base = odds(null);
    const marketing = odds('marketing');
    expect(marketing.rare).toBeGreaterThan(base.rare);
    expect(marketing.legendary).toBeGreaterThan(base.legendary);
    expect(marketing.common).toBe(base.common);
    // Marketing carries the largest bonus (+10%), so it moves the odds the most.
    expect(marketing.rare).toBeGreaterThan(odds('underground').rare);

    // And the odds really decide the pick: with the same dice, more rare events.
    const rarePicks = (branchOdds: typeof base) => {
      const rng = createRng(7);
      let rare = 0;
      for (let i = 0; i < 2000; i += 1) {
        const def = pickIncident(GAME_EVENTS, branchOdds, () => rng.next());
        if (def?.rarity === 'rare' || def?.rarity === 'legendary') rare += 1;
      }
      return rare;
    };
    expect(rarePicks(marketing)).toBeGreaterThan(rarePicks(base));
  });

  it('survives a save that predates branch effects, and a branch id it does not know', () => {
    const state = createInitialState(0);
    state.prestige.branch = null;
    expect(prestigeMoraleBonus(state)).toBe(0);
    expect(prestigeRareEventChance(state)).toBe(0);
    // A save written by a later version, or a corrupted one, must not throw.
    state.prestige.branch = 'not-a-branch' as PrestigeBranchId;
    expect(prestigeMoraleBonus(state)).toBe(0);
    expect(prestigeRareEventChance(state)).toBe(0);
  });
});
