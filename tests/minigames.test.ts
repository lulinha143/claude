import { describe, it, expect } from 'vitest';
import {
  cablePuzzle,
  cablePositions,
  countCrossings,
  cableSolved,
  segmentsCross,
  cableNodeCount,
  cableSolveScore,
  coffeeFallDuration,
  coffeeSpawnInterval,
  coffeeComboMultiplier,
  coffeeCatchScore,
  bugLifetime,
  bugSpawnInterval,
  bugScore,
  microGrade,
} from '../src/sim/minigames';

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

describe('Cable Untangle logic', () => {
  it('detects a proper segment crossing but not a shared endpoint or a miss', () => {
    // an X crossing
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }),
    ).toBe(true);
    // parallel, no crossing
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }),
    ).toBe(false);
    // shared endpoint (adjacent cables) is not a crossing
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }),
    ).toBe(false);
  });

  it('counts zero crossings for a convex ring layout', () => {
    // 4 nodes at square corners, wired as a loop 0-1-2-3-0 → no crossings
    const edges = [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 0 },
    ];
    const convex = { 0: { x: 0, y: 0 }, 1: { x: 1, y: 0 }, 2: { x: 1, y: 1 }, 3: { x: 0, y: 1 } };
    expect(countCrossings(edges, convex)).toBe(0);
    expect(cableSolved(edges, convex)).toBe(true);
    // swapping two adjacent-in-space nodes creates a bow-tie with one crossing
    const tangled = { 0: { x: 0, y: 0 }, 1: { x: 1, y: 1 }, 2: { x: 1, y: 0 }, 3: { x: 0, y: 1 } };
    expect(countCrossings(edges, tangled)).toBeGreaterThan(0);
    expect(cableSolved(edges, tangled)).toBe(false);
  });

  it('generates a deterministic, solvable, initially-tangled loop', () => {
    const a = cablePuzzle('seed-1', 6);
    const b = cablePuzzle('seed-1', 6);
    expect(a).toEqual(b); // deterministic
    expect(a.points).toHaveLength(6);
    // edges form a single closed loop
    expect(a.edges).toHaveLength(6);
    expect(a.edges).toEqual([
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 4, b: 5 },
      { a: 5, b: 0 },
    ]);
    // starts tangled (there is something to solve)
    expect(countCrossings(a.edges, cablePositions(a.points))).toBeGreaterThan(0);
  });

  it('grows the board and rewards bigger tangles more', () => {
    expect(cableNodeCount(0)).toBe(5);
    expect(cableNodeCount(3)).toBe(8);
    expect(cableNodeCount(99)).toBe(9); // capped
    expect(cableSolveScore(8)).toBeGreaterThan(cableSolveScore(5));
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
