import { describe, it, expect } from 'vitest';
import {
  shellSequence,
  shellBinFor,
  shellScoreDelta,
  inventoryRound,
  coffeeFallDuration,
  coffeeSpawnInterval,
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
  it('maps kinds to the correct bin', () => {
    expect(shellBinFor('goodNut')).toBe('good');
    expect(shellBinFor('brokenShell')).toBe('shell');
  });
  it('rewards correct placements and grows with combo; wrong placements are neutral', () => {
    expect(shellScoreDelta(false, 5)).toBe(0);
    expect(shellScoreDelta(true, 0)).toBe(2);
    expect(shellScoreDelta(true, 6)).toBeGreaterThan(shellScoreDelta(true, 0));
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

describe('grading', () => {
  it('buckets scores sensibly', () => {
    expect(microGrade(0)).toBe('poor');
    expect(microGrade(10)).toBe('ok');
    expect(microGrade(20)).toBe('great');
    expect(microGrade(40)).toBe('perfect');
  });
});
