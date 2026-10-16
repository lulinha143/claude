import { describe, it, expect } from 'vitest';
import {
  BUG_FEATURE_PENALTY,
  BUG_INPUT_GRACE_MS,
  BUG_RESPAWN_GUARD_MS,
  BUG_SHIFTS,
  BUG_SPECIES_BY_ID,
  COFFEE_DROP_KINDS,
  COFFEE_KEY_SPEED,
  COFFEE_PHASES,
  COFFEE_VARIATIONS,
  MICRO_CALIBRATION,
  MICRO_MODES,
  advanceBugBoard,
  applyCoffeeHazard,
  bugAt,
  bugRunnerLegs,
  bugShiftAt,
  cableConflictMap,
  cableKnottedEdges,
  cableObstructingPlugs,
  cableParSeconds,
  cablePositions,
  cablePuzzle,
  cableNodeCount,
  cableSpeedBonus,
  coffeeComboMultiplier,
  coffeeKeyVelocity,
  coffeeKindCatchScore,
  coffeeKindFallDuration,
  coffeeOrder,
  coffeeOrderBonus,
  coffeePairX,
  coffeePhaseAt,
  coffeeSpawnGap,
  coffeeVariationFor,
  countCableConflicts,
  createBugBoard,
  fillCoffeeOrder,
  firstCoffeeDropKind,
  microComboMultiplier,
  microComboNext,
  microPayout,
  pickBugSpeciesForShift,
  pickCoffeeDropKind,
  whackBugBoard,
  type BugBoard,
  type CableEdge,
  type CoffeeDropKind,
  type CoffeeOrder,
} from '../src/sim/minigames';

/* ---------------------------------------------------------------------------
 * The combo the bar shows is the combo the score uses: one table, read by both.
 * ------------------------------------------------------------------------- */
describe('combo multipliers', () => {
  it('reaches x2 and x3 at the calibrated streaks, and names the next step', () => {
    for (const mode of ['coffeeRescue', 'bugSquash'] as const) {
      const [x2, x3] = MICRO_CALIBRATION[mode].combo!;
      expect(microComboMultiplier(mode, 0)).toBe(1);
      expect(microComboMultiplier(mode, x2 - 1)).toBe(1);
      expect(microComboMultiplier(mode, x2)).toBe(2);
      expect(microComboMultiplier(mode, x3 - 1)).toBe(2);
      expect(microComboMultiplier(mode, x3)).toBe(3);
      expect(microComboNext(mode, 0)).toBe(x2);
      expect(microComboNext(mode, x2)).toBe(x3);
      expect(microComboNext(mode, x3)).toBeNull();
    }
    // The cable desk has no streak, so it never shows a combo.
    expect(microComboMultiplier('cableUntangle', 99)).toBe(1);
    expect(microComboNext('cableUntangle', 0)).toBeNull();
  });

  it('scores a coffee catch with exactly the multiplier on screen', () => {
    const mug = COFFEE_DROP_KINDS.find((k) => k.id === 'mug')!;
    for (let streak = 1; streak <= 20; streak += 1) {
      expect(coffeeKindCatchScore(mug, streak)).toBe(2 * coffeeComboMultiplier(streak));
    }
  });

  it('scores a squash with exactly the multiplier on screen', () => {
    // Play a desk, squash pests in a row, and compare each hit with the displayed tier.
    let board = createBugBoard('combo-check');
    let clock = 0;
    let hits = 0;
    while (hits < 12 && clock < 30_000) {
      clock += 25;
      board = advanceBugBoard(board, clock).board;
      const pest = board.pests.find((p) => !BUG_SPECIES_BY_ID[p.species].hazard);
      if (!pest) continue;
      const result = whackBugBoard(board, pest.hole, clock);
      board = result.board;
      if (result.outcome.type !== 'hit') continue;
      hits += 1;
      const species = BUG_SPECIES_BY_ID[result.outcome.pest.species];
      expect(result.outcome.multiplier).toBe(
        microComboMultiplier('bugSquash', result.outcome.chain),
      );
      expect(result.outcome.points).toBe(
        Math.max(1, Math.round(2 * species.scoreScale * result.outcome.multiplier)),
      );
    }
    expect(hits).toBe(12);
  });
});

/* ---------------------------------------------------------------------------
 * Coffee Rescue: the day, the three beats, the orders and the keyboard.
 * ------------------------------------------------------------------------- */
describe('coffee rounds', () => {
  it('serves the four days in turn, so a replay is never the same day twice in a row', () => {
    for (const seed of [1, 777, 65_535]) {
      const days = Array.from({ length: 8 }, (_, round) => coffeeVariationFor(seed, round).id);
      for (let i = 1; i < days.length; i += 1) expect(days[i]).not.toBe(days[i - 1]);
      expect(new Set(days.slice(0, 4)).size).toBe(COFFEE_VARIATIONS.length);
      expect(coffeeVariationFor(seed, 3)).toBe(coffeeVariationFor(seed, 3));
    }
  });

  it('leans the mix toward the day without ever removing a kind', () => {
    const counts = (variation: (typeof COFFEE_VARIATIONS)[number]) => {
      const tally = new Map<string, number>();
      for (let i = 0; i < 4000; i += 1) {
        const id = pickCoffeeDropKind(i / 4000, variation, COFFEE_PHASES[1]).id;
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      return tally;
    };
    const base = counts(COFFEE_VARIATIONS.find((v) => v.id === 'morning')!);
    const espresso = counts(COFFEE_VARIATIONS.find((v) => v.id === 'espresso')!);
    const catering = counts(COFFEE_VARIATIONS.find((v) => v.id === 'catering')!);
    const audit = counts(COFFEE_VARIATIONS.find((v) => v.id === 'audit')!);
    expect(espresso.get('espresso')!).toBeGreaterThan(base.get('espresso')! * 1.8);
    expect(catering.get('carafe')!).toBeGreaterThan(base.get('carafe')! * 2);
    expect(audit.get('decaf')!).toBeGreaterThan(base.get('decaf')! * 1.8);
    for (const tally of [base, espresso, catering, audit]) expect(tally.size).toBe(4);
  });

  it('holds the decaf back for the warm-up and pairs drops only in the rush', () => {
    expect(coffeePhaseAt(0).id).toBe('warmup');
    expect(coffeePhaseAt(8).id).toBe('service');
    expect(coffeePhaseAt(29.9).id).toBe('rush');
    for (let i = 0; i < 2000; i += 1) {
      expect(pickCoffeeDropKind(i / 2000, undefined, coffeePhaseAt(3)).hazard).toBe(false);
    }
    expect(COFFEE_PHASES.filter((phase) => phase.pairChance > 0).map((p) => p.id)).toEqual([
      'rush',
    ]);
    expect(firstCoffeeDropKind().hazard).toBe(false);
  });

  it('spaces a rush pair too far apart for one mug to take both', () => {
    for (let i = 0; i < 400; i += 1) {
      const first = 8 + (84 * i) / 400;
      const second = coffeePairX(first, ((i * 37) % 100) / 100, 8, 92);
      expect(second).toBeGreaterThanOrEqual(8);
      expect(second).toBeLessThanOrEqual(92);
      // The widest catch (a compact counter) is ~±10%: a pair is always > 20% apart.
      expect(Math.abs(second - first)).toBeGreaterThan(22);
    }
  });

  it('keeps a busier day and a faster fall inside the reachable floor', () => {
    for (const variation of COFFEE_VARIATIONS) {
      for (const kind of COFFEE_DROP_KINDS) {
        for (const elapsed of [0, 15, 30]) {
          expect(coffeeKindFallDuration(kind, elapsed, variation)).toBeGreaterThanOrEqual(0.9);
        }
      }
      expect(coffeeSpawnGap(30, variation)).toBeGreaterThanOrEqual(600);
    }
  });

  it('grows orders from two drinks to four, deterministically, from the day mix', () => {
    const variation = COFFEE_VARIATIONS[0];
    const sizes = Array.from(
      { length: 6 },
      (_, index) => coffeeOrder('s', index, variation).items.length,
    );
    expect(sizes).toEqual([2, 3, 3, 4, 4, 4]);
    expect(coffeeOrder('s', 2, variation)).toEqual(coffeeOrder('s', 2, variation));
    for (let index = 0; index < 40; index += 1) {
      const order = coffeeOrder(`o-${index}`, index, variation);
      expect(order.items.some((item) => item === 'decaf')).toBe(false);
      // Past the first, an order always asks for something other than a plain mug.
      if (index > 0) expect(order.items.some((item) => item !== 'mug')).toBe(true);
      expect(order.filled.every((done) => !done)).toBe(true);
    }
  });

  it('ticks one slot per matching catch, ignores the rest, and pays a complete order once', () => {
    let order: CoffeeOrder = {
      index: 1,
      items: ['mug', 'mug', 'espresso'],
      filled: [false, false, false],
    };
    let result = fillCoffeeOrder(order, 'carafe');
    expect(result.matched).toBe(false);
    expect(result.order).toBe(order);
    result = fillCoffeeOrder(order, 'mug');
    expect(result.order.filled).toEqual([true, false, false]);
    result = fillCoffeeOrder(result.order, 'mug');
    expect(result.order.filled).toEqual([true, true, false]);
    expect(result.completed).toBe(false);
    // A third mug the order no longer needs changes nothing.
    expect(fillCoffeeOrder(result.order, 'mug').matched).toBe(false);
    result = fillCoffeeOrder(result.order, 'espresso');
    expect(result.completed).toBe(true);
    expect(coffeeOrderBonus(result.order)).toBe(9);
    order = { ...result.order };
    expect(fillCoffeeOrder(order, 'espresso').matched).toBe(false);
  });

  it('moves a held key at once and glides it, instead of waiting for key repeat', () => {
    // A press is never slower than ~45% of full speed, and full speed comes in 200ms.
    expect(coffeeKeyVelocity(0)).toBeCloseTo(COFFEE_KEY_SPEED * 0.45);
    expect(coffeeKeyVelocity(200)).toBe(COFFEE_KEY_SPEED);
    expect(coffeeKeyVelocity(5000)).toBe(COFFEE_KEY_SPEED);
    // Across the whole counter within a second of holding.
    let x = 0;
    for (let t = 0; t < 1000; t += 16) x += (coffeeKeyVelocity(t) * 16) / 1000;
    expect(x).toBeGreaterThan(100);
  });
});

/* ---------------------------------------------------------------------------
 * Bug Squash: a desk is one pure value, played with real rules.
 * ------------------------------------------------------------------------- */
function playDesk(seed: string, tap: (board: BugBoard, clock: number) => number | null) {
  let board = createBugBoard(seed);
  const events: string[] = [];
  const outcomes: string[] = [];
  let maxUp = 0;
  for (let clock = 0; clock <= 30_000; clock += 20) {
    const step = advanceBugBoard(board, clock);
    board = step.board;
    for (const event of step.events)
      events.push(event.type === 'shift' ? `shift:${event.shift.id}` : event.type);
    maxUp = Math.max(maxUp, board.pests.length);
    const hole = tap(board, clock);
    if (hole !== null) {
      const result = whackBugBoard(board, hole, clock);
      board = result.board;
      outcomes.push(result.outcome.type);
    }
  }
  return { board, events, outcomes, maxUp };
}

describe('bug desks', () => {
  it('opens on a lone worker at half a second, and replays the same from a seed', () => {
    const first = advanceBugBoard(createBugBoard('open'), 499);
    expect(first.board.pests).toHaveLength(0);
    const opened = advanceBugBoard(first.board, 500);
    expect(opened.board.pests).toHaveLength(1);
    expect(opened.board.pests[0].species).toBe('worker');
    const a = playDesk('same-seed', () => null);
    const b = playDesk('same-seed', () => null);
    expect(a.events).toEqual(b.events);
  });

  it('runs three shifts, each announced once, with more pests up as they go', () => {
    expect(BUG_SHIFTS.map((shift) => shift.maxActive)).toEqual([1, 2, 3]);
    const run = playDesk('shifts', () => null);
    expect(run.events.filter((e) => e.startsWith('shift:'))).toEqual([
      'shift:peak',
      'shift:closing',
    ]);
    expect(run.maxUp).toBe(3);
    // Nothing up in the first shift ever exceeds one pest.
    let board = createBugBoard('shift-one');
    for (let clock = 0; clock < BUG_SHIFTS[1].from * 1000; clock += 20) {
      board = advanceBugBoard(board, clock).board;
      expect(board.pests.length).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the feature out of the first shift and never sends two at once', () => {
    expect(BUG_SHIFTS[0].weights.feature ?? 0).toBe(0);
    for (const seed of ['f-1', 'f-2', 'f-3', 'f-4']) {
      let board = createBugBoard(seed);
      for (let clock = 0; clock <= 30_000; clock += 20) {
        board = advanceBugBoard(board, clock).board;
        const features = board.pests.filter((p) => BUG_SPECIES_BY_ID[p.species].hazard);
        expect(features.length).toBeLessThanOrEqual(1);
        if (clock < BUG_SHIFTS[1].from * 1000) expect(features).toHaveLength(0);
      }
    }
    for (let i = 0; i < 1000; i += 1) {
      expect(pickBugSpeciesForShift(i / 1000, bugShiftAt(0)).id).not.toBe('feature');
    }
  });

  it('always sends the golden bug in the closing shift', () => {
    for (let s = 0; s < 30; s += 1) {
      const run = playDesk(`gold-${s}`, (board) => {
        // Clear the desk so a slot is always free when the golden bug is due.
        const pest = board.pests.find((p) => !BUG_SPECIES_BY_ID[p.species].hazard);
        return pest ? pest.hole : null;
      });
      expect(run.board.rareSpawned, `seed gold-${s}`).toBe(true);
    }
  });

  it('hops a runner once to a free burrow, and forgives a tap on the burrow it left', () => {
    let board = createBugBoard('runner');
    let hop: { from: number; to: number; at: number } | null = null;
    for (let clock = 0; clock <= 30_000 && !hop; clock += 10) {
      const step = advanceBugBoard(board, clock);
      board = step.board;
      for (const event of step.events) {
        if (event.type === 'hop') {
          hop = { from: event.from, to: event.pest.hole, at: clock };
          expect(event.from).not.toBe(event.pest.hole);
          // It landed where nothing else was.
          expect(board.pests.filter((p) => p.hole === event.pest.hole)).toHaveLength(1);
          expect(event.pest.hopAt).toBeNull();
          expect(event.pest.hoppedFrom).toBe(event.from);
        }
      }
    }
    expect(hop).not.toBeNull();
    // A tap that chased it to its old burrow, inside the grace window: no penalty.
    const late = whackBugBoard(board, hop!.from, hop!.at + BUG_INPUT_GRACE_MS - 20);
    expect(late.outcome.type).toBe('grace');
    expect(late.board.score).toBe(board.score);
    // And it can still be squashed where it went.
    expect(whackBugBoard(board, hop!.to, hop!.at + 20).outcome.type).toBe('hit');
  });

  it('keeps both runner legs comfortably hittable all round', () => {
    for (const elapsed of [0, 10, 20, 30, 60]) {
      const legs = bugRunnerLegs(elapsed);
      expect(legs.before).toBeGreaterThanOrEqual(320);
      expect(legs.after).toBeGreaterThanOrEqual(340);
    }
  });

  it('cracks an armoured shell on the first tap and squashes it on the second', () => {
    let board = createBugBoard('armour');
    let clock = 0;
    let pest = null as ReturnType<typeof bugAt> | null;
    while (clock < 30_000) {
      clock += 20;
      board = advanceBugBoard(board, clock).board;
      pest = board.pests.find((p) => p.species === 'armoured') ?? null;
      if (pest) break;
      // Keep the desk clear of everything else so the armoured one gets a slot.
      const other = board.pests.find((p) => !BUG_SPECIES_BY_ID[p.species].hazard);
      if (other) board = whackBugBoard(board, other.hole, clock).board;
    }
    expect(pest).not.toBeNull();
    const before = board.score;
    // A crack at the very last moment still leaves time for the second tap.
    const crack = whackBugBoard(board, pest!.hole, pest!.endsAt - 1);
    expect(crack.outcome.type).toBe('crack');
    expect(crack.board.score).toBe(before);
    expect(bugAt(crack.board, pest!.hole)!.endsAt).toBeGreaterThanOrEqual(pest!.endsAt - 1 + 300);
    const squash = whackBugBoard(crack.board, pest!.hole, pest!.endsAt + 100);
    expect(squash.outcome.type).toBe('hit');
  });

  it('charges for squashing the feature, ends the streak, and never charges twice for one tap', () => {
    let board = createBugBoard('decoy');
    let clock = 0;
    let feature = null as ReturnType<typeof bugAt> | null;
    while (clock < 30_000 && !feature) {
      clock += 20;
      board = advanceBugBoard(board, clock).board;
      feature = board.pests.find((p) => p.species === 'feature') ?? null;
      const bug = board.pests.find((p) => !BUG_SPECIES_BY_ID[p.species].hazard);
      if (!feature && bug) board = whackBugBoard(board, bug.hole, clock).board;
    }
    expect(feature).not.toBeNull();
    const stocked = { ...board, score: 20, chain: 6 };
    const first = whackBugBoard(stocked, feature!.hole, clock);
    expect(first.outcome).toMatchObject({
      type: 'feature',
      lost: BUG_FEATURE_PENALTY,
      chainLost: 6,
    });
    expect(first.board.score).toBe(20 - BUG_FEATURE_PENALTY);
    expect(first.board.chain).toBe(0);
    // The same burrow tapped again a moment later is the same gesture, not a new mistake.
    const again = whackBugBoard(first.board, feature!.hole, clock + 60);
    expect(again.outcome.type).toBe('grace');
    expect(again.board.score).toBe(first.board.score);
    // Nothing goes below zero.
    expect(whackBugBoard({ ...stocked, score: 1 }, feature!.hole, clock).board.score).toBe(0);
  });

  it('lets a feature leave on its own without costing the streak', () => {
    let board = createBugBoard('leave-it');
    let left = false;
    for (let clock = 0; clock <= 30_000 && !left; clock += 20) {
      const step = advanceBugBoard({ ...board, chain: 5 }, clock);
      board = step.board;
      for (const event of step.events) {
        if (event.type === 'featureLeft') {
          left = true;
          expect(board.chain).toBe(5);
        }
      }
    }
    expect(left).toBe(true);
  });

  it('never lands a new pest under a late second tap', () => {
    // After a squash, that burrow stays empty past the grace window.
    for (const seed of ['guard-1', 'guard-2', 'guard-3']) {
      let board = createBugBoard(seed);
      const vacated = new Map<number, number>();
      for (let clock = 0; clock <= 30_000; clock += 10) {
        const step = advanceBugBoard(board, clock);
        board = step.board;
        for (const event of step.events) {
          if (event.type === 'spawn') {
            const at = vacated.get(event.pest.hole);
            if (at !== undefined) expect(clock - at).toBeGreaterThan(BUG_RESPAWN_GUARD_MS);
          }
        }
        const pest = board.pests[0];
        if (pest && clock - pest.bornAt > 120 && !BUG_SPECIES_BY_ID[pest.species].hazard) {
          const result = whackBugBoard(board, pest.hole, clock);
          board = result.board;
          if (result.outcome.type === 'hit') vacated.set(pest.hole, clock);
        }
      }
    }
  });

  it('makes mashing every burrow a losing strategy', () => {
    let k = 0;
    const mash = playDesk('mash', (_board, clock) => (clock % 100 === 0 ? k++ % 9 : null));
    const steady = playDesk('mash', (board) => {
      const pest = board.pests.find((p) => !BUG_SPECIES_BY_ID[p.species].hazard && p.tapsLeft > 0);
      return pest ? pest.hole : null;
    });
    expect(mash.board.score).toBeLessThan(MICRO_CALIBRATION.bugSquash.ok);
    expect(steady.board.score).toBeGreaterThan(mash.board.score * 4);
    expect(mash.outcomes.filter((o) => o === 'empty').length).toBeGreaterThan(100);
  });
});

/* ---------------------------------------------------------------------------
 * Cable Untangle: the number on the desk is the marks on the desk.
 * ------------------------------------------------------------------------- */
describe('cable conflict map', () => {
  it('draws a crossing at the crossing point', () => {
    const edges: CableEdge[] = [
      { a: 0, b: 1 },
      { a: 2, b: 3 },
    ];
    const pos = {
      0: { x: 0.2, y: 0.2 },
      1: { x: 0.8, y: 0.8 },
      2: { x: 0.2, y: 0.8 },
      3: { x: 0.8, y: 0.2 },
    };
    const map = cableConflictMap(edges, pos);
    expect(map).toHaveLength(1);
    expect(map[0].kind).toBe('crossing');
    expect(map[0].x).toBeCloseTo(0.5);
    expect(map[0].y).toBeCloseTo(0.5);
    expect([...cableKnottedEdges(map)].sort()).toEqual([0, 1]);
    expect(cableObstructingPlugs(map).size).toBe(0);
  });

  it('counts a plug resting on a cable once, at the plug, however many of its cables meet it', () => {
    // Plug 2 sits on cable 0-1 and has two cables of its own (2-3, 2-4).
    const edges: CableEdge[] = [
      { a: 0, b: 1 },
      { a: 2, b: 3 },
      { a: 2, b: 4 },
    ];
    const pos = {
      0: { x: 0.1, y: 0.5 },
      1: { x: 0.9, y: 0.5 },
      2: { x: 0.5, y: 0.5 },
      3: { x: 0.3, y: 0.2 },
      4: { x: 0.7, y: 0.2 },
    };
    const map = cableConflictMap(edges, pos);
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({ kind: 'touch', plugs: [2] });
    expect(map[0].x).toBeCloseTo(0.5);
    expect([...cableObstructingPlugs(map)]).toEqual([2]);
    expect(countCableConflicts(edges, pos)).toBe(1);
  });

  it('marks stacked plugs and doubled-back cables', () => {
    const edges: CableEdge[] = [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
    ];
    // 0-1 and 1-2 run back along each other from plug 1.
    const overlap = { 0: { x: 0.2, y: 0.5 }, 1: { x: 0.8, y: 0.5 }, 2: { x: 0.5, y: 0.5 } };
    const map = cableConflictMap(edges, overlap);
    expect(map.map((c) => c.kind)).toEqual(['overlap']);
    expect(map[0].x).toBeCloseTo(0.65);
    const stacked = { 0: { x: 0.2, y: 0.2 }, 1: { x: 0.8, y: 0.8 }, 2: { x: 0.21, y: 0.2 } };
    expect(cableConflictMap(edges, stacked).some((c) => c.kind === 'crowded')).toBe(true);
  });

  it('agrees with the count on every desk a player can be dealt, tangled and solved', () => {
    for (let round = 0; round < 60; round += 1) {
      const puzzle = cablePuzzle(`map-${round}`, cableNodeCount(round % 6));
      const tangled = cableConflictMap(puzzle.edges, cablePositions(puzzle.points));
      expect(tangled.length).toBe(countCableConflicts(puzzle.edges, cablePositions(puzzle.points)));
      expect(tangled.length).toBeGreaterThan(0);
      for (const conflict of tangled) {
        expect(conflict.x).toBeGreaterThanOrEqual(0);
        expect(conflict.x).toBeLessThanOrEqual(1);
        expect(conflict.y).toBeGreaterThanOrEqual(0);
        expect(conflict.y).toBeLessThanOrEqual(1);
        expect(conflict.edges.length + conflict.plugs.length).toBeGreaterThan(0);
      }
      expect(cableConflictMap(puzzle.edges, cablePositions(puzzle.solution))).toEqual([]);
    }
  });

  it('pays a speed bonus inside par, with par growing for bigger desks', () => {
    expect(cableParSeconds(9)).toBeGreaterThan(cableParSeconds(5));
    expect(cableSpeedBonus(5, cableParSeconds(5))).toBeGreaterThan(0);
    expect(cableSpeedBonus(5, cableParSeconds(5) + 0.1)).toBe(0);
    expect(cableSpeedBonus(9, 1)).toBeGreaterThan(cableSpeedBonus(5, 1));
    expect(cableSpeedBonus(9, Number.NaN)).toBe(0);
    expect(cableSpeedBonus(9, -1)).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
 * Calibration: bots that play the real rules hold the bands where they belong.
 * ------------------------------------------------------------------------- */
function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A coffee player: sees a drop after `reaction` s, moves at `speed`% per second and
 * misjudges a share `slip` of drops (chases a decaf, or steps away from good coffee).
 */
function coffeeRound(
  seed: number,
  round: number,
  reaction: number,
  speed: number,
  slip: number,
  idle = false,
) {
  const rand = mulberry(seed * 7919 + round);
  const judgement = mulberry(seed * 31 + 17);
  const variation = coffeeVariationFor(seed, round);
  const half = 6.8;
  const catchY = 76;
  type Drop = { x: number; y: number; kind: CoffeeDropKind; born: number; misread: boolean };
  let drops: Drop[] = [];
  let spawned = 0;
  let next = 0.5;
  let mug = 50;
  let streak = 0;
  let score = 0;
  let order = coffeeOrder(String(seed), 0, variation);
  const dt = 1 / 60;
  for (let t = 0; t < 30; t += dt) {
    if (t >= next) {
      const phase = coffeePhaseAt(t);
      const kind =
        spawned === 0 ? firstCoffeeDropKind() : pickCoffeeDropKind(rand(), variation, phase);
      const x = 8 + rand() * 84;
      drops.push({ x, y: 0, kind, born: t, misread: judgement() < slip });
      spawned += 1;
      if (phase.pairChance > 0 && rand() < phase.pairChance) {
        drops.push({
          x: coffeePairX(x, rand(), 8, 92),
          y: 0,
          kind: pickCoffeeDropKind(rand(), variation, phase),
          born: t,
          misread: judgement() < slip,
        });
      }
      next = t + coffeeSpawnGap(t, variation) / 1000;
    }
    if (!idle) {
      const eta = (d: Drop) =>
        (catchY - d.y) / (100 / coffeeKindFallDuration(d.kind, t, variation));
      // What the player BELIEVES is catchable: a misread flips the drop's meaning.
      const looksGood = (d: Drop) => d.kind.hazard === d.misread;
      const target = drops
        .filter(
          (d) => looksGood(d) && t - d.born >= reaction && Math.abs(d.x - mug) / speed <= eta(d),
        )
        .sort((a, b) => eta(a) - eta(b))[0];
      let goal = target ? target.x : mug;
      for (const h of drops.filter((d) => !looksGood(d))) {
        if (eta(h) < 0.45 && Math.abs(h.x - goal) <= half + 2)
          goal = h.x > 50 ? h.x - 18 : h.x + 18;
      }
      const step = speed * dt;
      mug = Math.abs(goal - mug) <= step ? goal : mug + Math.sign(goal - mug) * step;
      mug = Math.max(9, Math.min(91, mug));
    }
    const kept: Drop[] = [];
    for (const d of drops) {
      const y = d.y + (100 / coffeeKindFallDuration(d.kind, t, variation)) * dt;
      if (y < catchY) {
        kept.push({ ...d, y });
        continue;
      }
      if (Math.abs(d.x - mug) > half) {
        if (!d.kind.hazard) streak = 0;
        continue;
      }
      if (d.kind.hazard) {
        score = applyCoffeeHazard(score).score;
        streak = 0;
        continue;
      }
      streak += 1;
      score += coffeeKindCatchScore(d.kind, streak);
      const filled = fillCoffeeOrder(order, d.kind.id);
      order = filled.order;
      if (filled.completed) {
        score += coffeeOrderBonus(order);
        order = coffeeOrder(String(seed), order.index + 1, variation);
      }
    }
    drops = kept;
  }
  return score;
}

/**
 * A bug player: reacts after `reaction` ms, needs `aim` ms per burrow of travel and
 * `pause` ms between taps, lands a share `slip` of taps in the wrong drawer, and
 * mistakes a share `fooled` of features for bugs.
 */
function bugRound(
  seed: number,
  reaction: number,
  aim: number,
  pause: number,
  slip: number,
  fooled: number,
  idle = false,
) {
  let board = createBugBoard(`bot-${seed}`);
  const rand = mulberry(seed * 104_729 + 3);
  const misjudged = new Set<number>();
  const seen = new Set<number>();
  let busyUntil = 0;
  let last = 4;
  let aimingAt = -1;
  let readyAt = 0;
  for (let clock = 0; clock <= 30_000; clock += 16) {
    board = advanceBugBoard(board, clock).board;
    if (idle || clock < busyUntil) continue;
    for (const pest of board.pests) {
      if (seen.has(pest.token)) continue;
      seen.add(pest.token);
      if (BUG_SPECIES_BY_ID[pest.species].hazard && rand() < fooled) misjudged.add(pest.token);
    }
    const target = board.pests
      .filter(
        (p) =>
          (!BUG_SPECIES_BY_ID[p.species].hazard || misjudged.has(p.token)) &&
          clock - p.bornAt >= reaction,
      )
      .sort((a, b) => a.endsAt - b.endsAt)[0];
    if (!target) continue;
    if (aimingAt !== target.token) {
      aimingAt = target.token;
      const cells = Math.hypot(
        (last % 3) - (target.hole % 3),
        Math.floor(last / 3) - Math.floor(target.hole / 3),
      );
      readyAt = clock + aim * cells;
    }
    if (clock < readyAt) continue;
    const hole = rand() < slip ? (target.hole + 1 + Math.floor(rand() * 8)) % 9 : target.hole;
    board = whackBugBoard(board, hole, clock).board;
    last = hole;
    aimingAt = -1;
    busyUntil = clock + pause;
  }
  return board.score;
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe('calibration bots', () => {
  it('keeps an idle coffee player under "ok" and lets a good one reach mastery', () => {
    const cal = MICRO_CALIBRATION.coffeeRescue;
    const idle = Array.from({ length: 24 }, (_, i) => coffeeRound(100 + i, i % 4, 0, 0, 0, true));
    const steady = Array.from({ length: 24 }, (_, i) =>
      coffeeRound(200 + i, i % 4, 0.3, 190, 0.08),
    );
    const good = Array.from({ length: 24 }, (_, i) => coffeeRound(300 + i, i % 4, 0.24, 260, 0.04));
    expect(Math.max(...idle)).toBeLessThan(cal.ok);
    expect(median(steady)).toBeGreaterThanOrEqual(cal.great);
    expect(median(steady)).toBeLessThan(cal.mastery);
    expect(good.filter((score) => score >= cal.mastery).length).toBeGreaterThanOrEqual(8);
  });

  it('keeps an idle bug player at zero and lets a good one reach mastery', () => {
    const cal = MICRO_CALIBRATION.bugSquash;
    expect(bugRound(1, 0, 0, 0, 0, 0, true)).toBe(0);
    const steady = Array.from({ length: 24 }, (_, i) =>
      bugRound(400 + i, 400, 180, 240, 0.05, 0.15),
    );
    const good = Array.from({ length: 24 }, (_, i) => bugRound(500 + i, 340, 140, 200, 0.03, 0.07));
    expect(median(steady)).toBeGreaterThanOrEqual(cal.great);
    expect(median(steady)).toBeLessThan(cal.mastery);
    expect(good.filter((score) => score >= cal.mastery).length).toBeGreaterThanOrEqual(8);
  });

  it('pays every game the same for the same share of its mastery', () => {
    for (const fraction of [0.25, 0.5, 1, 1.4]) {
      const payouts = MICRO_MODES.map((mode) =>
        microPayout(mode, Math.round(MICRO_CALIBRATION[mode].mastery * fraction)),
      );
      for (const payout of payouts) {
        expect(payout.boostPercent).toBeCloseTo(payouts[0].boostPercent, -0.5);
        expect(payout.nutsFactor).toBeCloseTo(payouts[0].nutsFactor, 1);
      }
    }
    expect(microPayout('coffeeRescue', 0)).toEqual({ nutsFactor: 0, boostPercent: 0 });
    expect(microPayout('coffeeRescue', 10_000).boostPercent).toBe(50);
    expect(microPayout('coffeeRescue', Number.NaN)).toEqual({ nutsFactor: 0, boostPercent: 0 });
  });
});
