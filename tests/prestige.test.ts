import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { canPrestige, kernelsFromPrestige, performPrestige, buyPrestigeSkill } from '../src/sim/prestige';
import { BALANCE } from '../src/sim/config';

describe('prestige', () => {
  it('is locked until the lifetime nut threshold', () => {
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
    expect(next.decorationInstances[0].interactionState).not.toBe(s.decorationInstances[0].interactionState);
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
