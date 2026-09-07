import { describe, it, expect } from 'vitest';
import {
  cablePuzzle,
  cablePositions,
  countCableConflicts,
  cableNodeCount,
  cableSolveScore,
  type CablePuzzle,
} from '../src/sim/minigames';

// Mirrors exactly how CableUntangle.tsx generates each consecutive board:
// puzzle N uses seed `${seed}-${solvedCount}` with cableNodeCount(solvedCount).
function boardFor(seed: string, solvedCount: number): CablePuzzle {
  return cablePuzzle(`${seed}-${solvedCount}`, cableNodeCount(solvedCount));
}

describe('consecutive cable round progression', () => {
  it('loads a fresh, initially tangled, always-solvable desk for many rounds in a row', () => {
    const seed = 'progression-seed';
    let solvedCount = 0;
    let totalScore = 0;
    const rounds: Array<{ level: string; nodes: number }> = [];

    // Well beyond the required five consecutive rounds.
    for (let round = 0; round < 12; round += 1) {
      const puzzle = boardFor(seed, solvedCount);

      // The board the player receives must start tangled (never auto-cleared,
      // which would otherwise chain-skip or flicker through rounds).
      const startConflicts = countCableConflicts(puzzle.edges, cablePositions(puzzle.points));
      expect(startConflicts).toBeGreaterThan(0);

      // The authored solution must be fully conflict-free so the round is
      // always completable and detection agrees with the visible layout.
      const solvedConflicts = countCableConflicts(puzzle.edges, cablePositions(puzzle.solution));
      expect(solvedConflicts).toBe(0);

      totalScore += cableSolveScore(puzzle.points.length);
      rounds.push({ level: puzzle.levelId, nodes: puzzle.points.length });
      solvedCount += 1;
    }

    expect(rounds).toHaveLength(12);
    // Every round awarded a positive score.
    expect(totalScore).toBeGreaterThan(0);
    // Node counts ramp then cap (5 → 6 → 7 → 8 → 9 → 9 …).
    expect(rounds.slice(0, 5).map((r) => r.nodes)).toEqual([5, 6, 7, 8, 9]);
    expect(rounds.slice(5).every((r) => r.nodes === 9)).toBe(true);
  });

  it('is deterministic: the same seed always yields the same round sequence', () => {
    const first = Array.from({ length: 6 }, (_, i) => boardFor('abc', i).levelId);
    const second = Array.from({ length: 6 }, (_, i) => boardFor('abc', i).levelId);
    expect(first).toEqual(second);
  });
});
