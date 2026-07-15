import { describe, it, expect } from 'vitest';
import {
  shellSequence,
  shellBinFor,
  shellScoreDelta,
  inventoryRound,
  inventorySize,
  inventoryScoreDelta,
  coffeeFallDuration,
  coffeeSpawnInterval,
  coffeeComboMultiplier,
  coffeeCatchScore,
  bugLifetime,
  bugSpawnInterval,
  bugScore,
  microGrade,
  INVENTORY_ITEMS,
} from '../src/sim/minigames';

describe('Shell Sort logic', () => {
  it('is deterministic for a given seed', () => {
    expect(shellSequence('abc', 10)).toEqual(shellSequence('abc', 10));
  });
  it('differs across seeds', () => {
    expect(shellSequence('abc', 20)).not.toEqual(shellSequence('xyz', 20));
  });
  it('maps all three kinds to the correct bin', () => {
    expect(shellBinFor('goodNut')).toBe('good');
    expect(shellBinFor('goldenNut')).toBe('golden');
    expect(shellBinFor('brokenShell')).toBe('shell');
  });
  it('produces golden nuts as a minority of the sequence', () => {
    const seq = shellSequence('mixed', 200);
    const golden = seq.filter((s) => s.kind === 'goldenNut').length;
    expect(golden).toBeGreaterThan(0);
    expect(golden).toBeLessThan(seq.length / 2);
  });
  it('rewards correct placements, grows with combo, and values golden higher', () => {
    expect(shellScoreDelta(false, 5)).toBe(0);
    expect(shellScoreDelta(true, 0)).toBe(2);
    expect(shellScoreDelta(true, 6)).toBeGreaterThan(shellScoreDelta(true, 0));
    expect(shellScoreDelta(true, 0, 'goldenNut')).toBeGreaterThan(shellScoreDelta(true, 0, 'goodNut'));
  });
});

describe('Coffee Rescue difficulty', () => {
  it('drops fall faster over time but never below the floor', () => {
    expect(coffeeFallDuration(0)).toBeGreaterThan(coffeeFallDuration(20));
    expect(coffeeFallDuration(1000)).toBeGreaterThanOrEqual(1.6);
  });
  it('spawns more frequently over time but never below the floor', () => {
    expect(coffeeSpawnInterval(0)).toBeGreaterThan(coffeeSpawnInterval(20));
    expect(coffeeSpawnInterval(1000)).toBeGreaterThanOrEqual(700);
  });
  it('builds a combo multiplier from the catch streak', () => {
    expect(coffeeComboMultiplier(0)).toBe(1);
    expect(coffeeComboMultiplier(6)).toBe(2);
    expect(coffeeComboMultiplier(12)).toBe(3);
    expect(coffeeCatchScore(12)).toBeGreaterThan(coffeeCatchScore(0));
  });
});

describe('Raccoon Inventory logic', () => {
  it('is deterministic for a given seed', () => {
    expect(inventoryRound('r1')).toEqual(inventoryRound('r1'));
  });
  it('produces a valid round: changed slot differs and is in range', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const round = inventoryRound(seed, 5);
      expect(round.items).toHaveLength(5);
      expect(round.changedIndex).toBeGreaterThanOrEqual(0);
      expect(round.changedIndex).toBeLessThan(5);
      expect(round.after).not.toBe(round.before);
      // the "after" item sits at the changed slot
      expect(round.items[round.changedIndex]).toBe(round.after);
      // all items come from the known pool and are distinct
      expect(new Set(round.items).size).toBe(5);
      for (const it of round.items) expect(INVENTORY_ITEMS).toContain(it);
    }
  });
});

describe('Raccoon Inventory progression', () => {
  it('grows the shelf as rounds are cleared and caps at the pool size', () => {
    expect(inventorySize(0)).toBe(5);
    expect(inventorySize(1)).toBe(5);
    expect(inventorySize(2)).toBe(6);
    expect(inventorySize(4)).toBe(7);
    expect(inventorySize(999)).toBe(INVENTORY_ITEMS.length);
  });
  it('produces a valid larger round with distinct items', () => {
    const round = inventoryRound('big', 7);
    expect(round.items).toHaveLength(7);
    expect(new Set(round.items).size).toBe(7);
    expect(round.items[round.changedIndex]).toBe(round.after);
  });
  it('rewards longer streaks more', () => {
    expect(inventoryScoreDelta(5)).toBeGreaterThan(inventoryScoreDelta(0));
  });
});

describe('Bug Squash difficulty', () => {
  it('pests stay up for less time as the game speeds up, with a floor', () => {
    expect(bugLifetime(0)).toBeGreaterThan(bugLifetime(20));
    expect(bugLifetime(1000)).toBeGreaterThanOrEqual(650);
  });
  it('pests spawn faster over time, with a floor', () => {
    expect(bugSpawnInterval(0)).toBeGreaterThan(bugSpawnInterval(20));
    expect(bugSpawnInterval(1000)).toBeGreaterThanOrEqual(380);
  });
  it('rewards longer squash streaks more, up to a cap', () => {
    expect(bugScore(6)).toBeGreaterThan(bugScore(0));
    expect(bugScore(999)).toBeLessThanOrEqual(8);
  });
});

describe('grading', () => {
  it('buckets scores sensibly', () => {
    expect(microGrade(0)).toBe('poor');
    expect(microGrade(10)).toBe('ok');
    expect(microGrade(20)).toBe('great');
    expect(microGrade(40)).toBe('perfect');
  });
});
