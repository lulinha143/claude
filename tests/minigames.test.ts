import { describe, it, expect } from 'vitest';
import {
  cablePuzzle,
  cablePositions,
  countCrossings,
  countCableConflicts,
  cableSolved,
  segmentsCross,
  cableNodeCount,
  cableLayoutIds,
  cableSolveScore,
  coffeeFallDuration,
  coffeeSpawnInterval,
  coffeeComboMultiplier,
  coffeeCatchScore,
  coffeeCatchGeometry,
  resolveCoffeeDrop,
  bugLifetime,
  bugSpawnInterval,
  bugScore,
  applyBugEmptyPenalty,
  resolveBugWhack,
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

  it('derives honest mug bounds from the rendered playfield width', () => {
    const compact = coffeeCatchGeometry(280, 240, 62, 178);
    const desktop = coffeeCatchGeometry(1000, 390, 62, 294);
    expect(compact.minMugX).toBeGreaterThan(desktop.minMugX);
    expect(compact.maxMugX).toBeLessThan(desktop.maxMugX);
    expect(compact.halfCatchWidth).toBeGreaterThan(desktop.halfCatchWidth);
    expect(compact.catchY).toBeCloseTo((182 / 240) * 100);
  });

  it('resolves each drop id at most once across tap and expiry races', () => {
    const first = resolveCoffeeDrop([{ id: 7, x: 50 }], 7);
    expect(first.resolved).toBe(true);
    expect(first.drops).toEqual([]);
    const stale = resolveCoffeeDrop(first.drops, 7);
    expect(stale.resolved).toBe(false);
    expect(stale.drops).toEqual([]);
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

  it('deducts empty clicks without creating negative score', () => {
    expect(applyBugEmptyPenalty(9)).toEqual({ score: 7, lost: 2 });
    expect(applyBugEmptyPenalty(1)).toEqual({ score: 0, lost: 1 });
    expect(applyBugEmptyPenalty(0)).toEqual({ score: 0, lost: 0 });
  });

  it('claims exact spawn tokens and forgives expiry races only in the grace window', () => {
    const active = { hole: 4, token: 12 };
    expect(resolveBugWhack(active, 4, 12, null, 500)).toBe('hit');
    expect(resolveBugWhack(active, 4, 11, null, 500)).toBe('empty');
    expect(resolveBugWhack(null, 4, 12, { hole: 4, at: 450 }, 500)).toBe('grace');
    expect(resolveBugWhack(null, 4, 12, { hole: 4, at: 100 }, 500)).toBe('empty');
  });
});

describe('Cable Untangle logic', () => {
  it('detects a proper segment crossing but not a shared endpoint or a miss', () => {
    // an X crossing
    expect(segmentsCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toBe(
      true,
    );
    // parallel, no crossing
    expect(segmentsCross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(
      false,
    );
    // shared endpoint (adjacent cables) is not a crossing
    expect(segmentsCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(
      false,
    );
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

  it('rejects collapsed plugs and collinear or overlapping cable layouts', () => {
    const edges = Array.from({ length: 5 }, (_, id) => ({ a: id, b: (id + 1) % 5 }));
    const collapsed = Object.fromEntries(
      Array.from({ length: 5 }, (_, id) => [id, { x: 0.5, y: 0.5 }]),
    );
    expect(countCrossings(edges, collapsed)).toBe(0);
    expect(countCableConflicts(edges, collapsed)).toBeGreaterThan(0);
    expect(cableSolved(edges, collapsed)).toBe(false);

    const collinear = {
      0: { x: 0.1, y: 0.5 },
      1: { x: 0.3, y: 0.5 },
      2: { x: 0.5, y: 0.5 },
      3: { x: 0.7, y: 0.5 },
      4: { x: 0.9, y: 0.5 },
    };
    expect(countCrossings(edges, collinear)).toBe(0);
    expect(countCableConflicts(edges, collinear)).toBeGreaterThan(0);
    expect(cableSolved(edges, collinear)).toBe(false);

    const overlappingPlugs = {
      0: { x: 0.2, y: 0.2 },
      1: { x: 0.8, y: 0.2 },
      2: { x: 0.8, y: 0.8 },
      3: { x: 0.2, y: 0.8 },
      4: { x: 0.2, y: 0.2 },
    };
    expect(countCableConflicts(edges, overlappingPlugs)).toBeGreaterThan(0);
    expect(cableSolved(edges, overlappingPlugs)).toBe(false);
  });

  it.each([
    { nodes: 5, difficulty: 'easy' },
    { nodes: 6, difficulty: 'medium' },
    { nodes: 7, difficulty: 'medium' },
    { nodes: 8, difficulty: 'hard' },
    { nodes: 9, difficulty: 'hard' },
  ] as const)(
    'generates deterministic, initially tangled, solvable $nodes-node desks',
    ({ nodes, difficulty }) => {
      const a = cablePuzzle('seed-1', nodes);
      const b = cablePuzzle('seed-1', nodes);
      expect(a).toEqual(b);
      expect(a.difficulty).toBe(difficulty);
      expect(cableLayoutIds(nodes)).toContain(a.levelId);
      expect(a.points).toHaveLength(nodes);
      expect(a.solution).toHaveLength(nodes);
      expect(a.edges).toHaveLength(nodes);
      expect(a.points.map((point) => point.id)).toEqual(
        Array.from({ length: nodes }, (_, id) => id),
      );
      expect(a.solution.map((point) => point.id)).toEqual(
        Array.from({ length: nodes }, (_, id) => id),
      );
      expect(a.edges).toEqual(
        Array.from({ length: nodes }, (_, id) => ({ a: id, b: (id + 1) % nodes })),
      );
      expect(countCableConflicts(a.edges, cablePositions(a.points))).toBeGreaterThan(0);
      expect(countCableConflicts(a.edges, cablePositions(a.solution))).toBe(0);
      expect(cableSolved(a.edges, cablePositions(a.solution))).toBe(true);
      for (const point of [...a.points, ...a.solution]) {
        expect(point.x).toBeGreaterThanOrEqual(0.085);
        expect(point.x).toBeLessThanOrEqual(0.915);
        expect(point.y).toBeGreaterThanOrEqual(0.12);
        expect(point.y).toBeLessThanOrEqual(0.88);
      }
    },
  );

  it('offers eight responsive layout profiles at every supported board size', () => {
    for (let nodes = 5; nodes <= 9; nodes += 1) {
      expect(cableLayoutIds(nodes)).toHaveLength(8);
      expect(new Set(cableLayoutIds(nodes)).size).toBe(8);
    }
  });

  it('varies layouts across seeds and excludes recent profiles deterministically', () => {
    const layouts = new Set(
      Array.from({ length: 64 }, (_, index) => cablePuzzle(`variety-${index}`, 9).levelId),
    );
    expect(layouts.size).toBeGreaterThanOrEqual(6);

    let recent: string[] = [];
    for (let round = 0; round < 32; round += 1) {
      const puzzle = cablePuzzle(`run-${round}`, 9, recent);
      expect(recent).not.toContain(puzzle.levelId);
      expect(cablePuzzle(`run-${round}`, 9, recent)).toEqual(puzzle);
      recent = [puzzle.levelId, ...recent].slice(0, 3);
    }
  });

  it('clamps authored board sizes to the supported five-to-nine node range', () => {
    expect(cablePuzzle('small', -20).points).toHaveLength(5);
    expect(cablePuzzle('large', 200).points).toHaveLength(9);
  });

  it('grows gently through all supported sizes and caps at nine nodes', () => {
    expect(cableNodeCount(0)).toBe(5);
    expect(cableNodeCount(2)).toBe(7);
    expect(cableNodeCount(4)).toBe(9);
    expect(cableNodeCount(99)).toBe(9);
    expect(cableSolveScore(9)).toBeGreaterThan(cableSolveScore(5));
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
