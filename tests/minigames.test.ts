import { describe, it, expect } from 'vitest';
import {
  BUG_SPECIES,
  BUG_SPECIES_BY_ID,
  BUG_INPUT_GRACE_MS,
  pickBugSpecies,
  firstBugSpecies,
  bugSpeciesLifetime,
  bugSpeciesScore,
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
  COFFEE_DROP_KINDS,
  COFFEE_DROP_KINDS_BY_ID,
  COFFEE_HAZARD_PENALTY,
  pickCoffeeDropKind,
  firstCoffeeDropKind,
  coffeeKindFallDuration,
  coffeeKindCatchScore,
  applyCoffeeHazard,
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

/**
 * BUG SPECIES.
 *
 * The three bug "variants" used to be paint: different colours on a pest with the
 * same lifetime, the same score and the same one-tap resolution. The game looked
 * varied and played identically. These tests pin the properties that make a species
 * a BEHAVIOUR, because they are exactly what a careless tuning edit would flatten
 * back into cosmetics.
 */
describe('bug species', () => {
  it('spans a 0..1 roll without ever falling through', () => {
    // Including the boundaries: a roll of exactly 1 must not return undefined, which
    // is the classic weighted-pick bug.
    for (const roll of [0, 0.0001, 0.25, 0.5, 0.75, 0.999999, 1]) {
      const species = pickBugSpecies(roll);
      expect(species, `roll ${roll} produced nothing`).toBeDefined();
      expect(BUG_SPECIES.map((s) => s.id)).toContain(species.id);
    }
  });

  it('is deterministic for a given roll', () => {
    for (const roll of [0.1, 0.42, 0.87]) {
      expect(pickBugSpecies(roll).id).toBe(pickBugSpecies(roll).id);
    }
  });

  it('reaches every species across the roll space', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(pickBugSpecies(i / 2000).id);
    // A species that no roll can produce is dead content.
    expect(seen.size).toBe(BUG_SPECIES.length);
  });

  it('keeps the common pest common and the prize rare', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i += 1) {
      const id = pickBugSpecies(i / 10_000).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.get('worker') ?? 0).toBeGreaterThan(counts.get('runner') ?? 0);
    expect(counts.get('runner') ?? 0).toBeGreaterThan(counts.get('rare') ?? 0);
    // The prize must actually be scarce, or it stops being a prize.
    expect((counts.get('rare') ?? 0) / 10_000).toBeLessThan(0.1);
  });

  it('trades window length against reward, so the species ask different things', () => {
    const worker = BUG_SPECIES_BY_ID.worker;
    const runner = BUG_SPECIES_BY_ID.runner;
    const rare = BUG_SPECIES_BY_ID.rare;
    const armoured = BUG_SPECIES_BY_ID.armoured;

    // A shorter window must pay more, or nobody would want the harder target.
    expect(bugSpeciesLifetime(runner, 0)).toBeLessThan(bugSpeciesLifetime(worker, 0));
    expect(bugSpeciesScore(runner, 0)).toBeGreaterThan(bugSpeciesScore(worker, 0));
    expect(bugSpeciesLifetime(rare, 0)).toBeLessThan(bugSpeciesLifetime(runner, 0));
    expect(bugSpeciesScore(rare, 0)).toBeGreaterThan(bugSpeciesScore(runner, 0));

    // The armoured pest buys its extra tap with a longer window.
    expect(armoured.taps).toBe(2);
    expect(bugSpeciesLifetime(armoured, 0)).toBeGreaterThan(bugSpeciesLifetime(worker, 0));
    // Everything else resolves in one tap.
    for (const id of ['worker', 'runner', 'rare'] as const) {
      expect(BUG_SPECIES_BY_ID[id].taps).toBe(1);
    }
  });

  it('never opens a window too short to actually hit', () => {
    // A species whose window approaches the input grace period is a coin flip, not a
    // skill test. Checked across the whole difficulty ramp, not just at t=0.
    for (const species of BUG_SPECIES) {
      for (const elapsed of [0, 15, 30, 45, 60, 120]) {
        expect(
          bugSpeciesLifetime(species, elapsed),
          `${species.id} at ${elapsed}s`,
        ).toBeGreaterThan(BUG_INPUT_GRACE_MS * 1.5);
      }
    }
  });

  it('still gets harder over time for every species', () => {
    for (const species of BUG_SPECIES) {
      expect(bugSpeciesLifetime(species, 60)).toBeLessThanOrEqual(bugSpeciesLifetime(species, 0));
    }
  });

  it('keeps a squash worth at least a point at any streak', () => {
    for (const species of BUG_SPECIES) {
      for (const streak of [0, 1, 5, 20]) {
        expect(bugSpeciesScore(species, streak)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('the pest that opens a round', () => {
  it('is always a plain one-tap worker', () => {
    // A round is short and the first pest has to teach the interaction. It is also
    // what makes the opening of a round deterministic: with a weighted first spawn
    // the same seed could open four different ways and the first hit was worth 2, 4,
    // 8 or nothing, depending on which species happened to appear.
    const first = firstBugSpecies();
    expect(first.taps).toBe(1);
    expect(first.id).toBe('worker');
    expect(first.scoreScale).toBe(1);
  });

  it('opens on the full-length window rather than a short one', () => {
    expect(bugSpeciesLifetime(firstBugSpecies(), 0)).toBe(bugLifetime(0));
  });
});

/**
 * COFFEE DROP KINDS.
 *
 * Coffee Rescue had one kind of falling thing, so it only ever asked "is the mug
 * under it" — execution with no decision. The hazard is what turns it into a game,
 * and it is also the thing most likely to be made unfair by a careless tuning edit,
 * so these tests pin its properties specifically.
 */
describe('coffee drop kinds', () => {
  it('spans a 0..1 roll without ever falling through', () => {
    for (const roll of [0, 0.0001, 0.3, 0.6, 0.999999, 1]) {
      const kind = pickCoffeeDropKind(roll);
      expect(kind, `roll ${roll} produced nothing`).toBeDefined();
      expect(COFFEE_DROP_KINDS.map((k) => k.id)).toContain(kind.id);
    }
  });

  it('reaches every kind and keeps the plain mug the common case', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i += 1) {
      const id = pickCoffeeDropKind(i / 10_000).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.size).toBe(COFFEE_DROP_KINDS.length);
    for (const id of ['carafe', 'espresso', 'decaf']) {
      expect(counts.get('mug') ?? 0, `mug should outnumber ${id}`).toBeGreaterThan(
        counts.get(id) ?? 0,
      );
    }
    // The hazard must be a surprise, not a constant tax.
    expect((counts.get('decaf') ?? 0) / 10_000).toBeLessThan(0.12);
  });

  it('opens a round on a plain mug so the round teaches its own rule', () => {
    const first = firstCoffeeDropKind();
    expect(first.id).toBe('mug');
    expect(first.hazard).toBe(false);
    // Opening on a hazard would punish the player for doing the obvious thing.
  });

  it('trades fall speed against value', () => {
    const mug = COFFEE_DROP_KINDS_BY_ID.mug;
    const carafe = COFFEE_DROP_KINDS_BY_ID.carafe;
    const espresso = COFFEE_DROP_KINDS_BY_ID.espresso;
    // The fast one pays the most of the catchables; the slow one still pays a premium
    // for occupying the mug while other things are falling.
    expect(coffeeKindFallDuration(espresso, 0)).toBeLessThan(coffeeKindFallDuration(mug, 0));
    expect(coffeeKindFallDuration(carafe, 0)).toBeGreaterThan(coffeeKindFallDuration(mug, 0));
    expect(coffeeKindCatchScore(espresso, 1)).toBeGreaterThan(coffeeKindCatchScore(mug, 1));
    expect(coffeeKindCatchScore(carafe, 1)).toBeGreaterThan(coffeeKindCatchScore(mug, 1));
  });

  it('never makes a drop fall too fast to reach, at any point in a round', () => {
    for (const kind of COFFEE_DROP_KINDS) {
      for (const elapsed of [0, 20, 40, 60, 120]) {
        expect(
          coffeeKindFallDuration(kind, elapsed),
          `${kind.id} at ${elapsed}s`,
        ).toBeGreaterThanOrEqual(0.9);
      }
    }
  });

  it('scores the hazard at nothing and takes points for catching it', () => {
    const decaf = COFFEE_DROP_KINDS_BY_ID.decaf;
    expect(decaf.hazard).toBe(true);
    expect(coffeeKindCatchScore(decaf, 10)).toBe(0);
    // It costs points, but can never push the player into debt.
    expect(applyCoffeeHazard(10).score).toBe(10 - COFFEE_HAZARD_PENALTY);
    expect(applyCoffeeHazard(1).score).toBe(0);
    expect(applyCoffeeHazard(1).lost).toBe(1);
    expect(applyCoffeeHazard(0).score).toBe(0);
    expect(applyCoffeeHazard(0).lost).toBe(0);
  });

  it('keeps exactly one hazard, so dodging stays a clear rule', () => {
    // Two different "do not catch" kinds would make the read ambiguous mid-round.
    expect(COFFEE_DROP_KINDS.filter((k) => k.hazard)).toHaveLength(1);
  });
});
