import { createRng, hashStringToSeed } from './rng';

// Pure, deterministic logic for the micro-games. The React components own
// timing/DOM; this module owns the rules so they can be unit-tested and are
// reproducible from a seed (used by tests and the dev deterministic mode).

export type MicroMode = 'shellSort' | 'coffeeRescue' | 'procurement' | 'bugSquash' | 'cableUntangle';

// --- Conveyor Sort --------------------------------------------------------
// Items ride a conveyor: a good nut, a rare golden nut, or a broken shell. The
// player sorts each into the correct labelled bin. Categories are distinguished
// by icon + label + pattern, never colour alone (colourblind-safe).
export type ShellKind = 'goodNut' | 'goldenNut' | 'brokenShell';
export type ShellBin = 'good' | 'golden' | 'shell';

export interface ShellItem {
  id: number;
  kind: ShellKind;
}

export function shellSequence(seedStr: string, count: number): ShellItem[] {
  const rng = createRng(hashStringToSeed(`shell:${seedStr}`));
  const out: ShellItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const roll = rng.next();
    // ~12% golden, ~48% good, ~40% broken shell
    const kind: ShellKind = roll < 0.12 ? 'goldenNut' : roll < 0.6 ? 'goodNut' : 'brokenShell';
    out.push({ id: i, kind });
  }
  return out;
}

export function shellBinFor(kind: ShellKind): ShellBin {
  if (kind === 'goldenNut') return 'golden';
  if (kind === 'brokenShell') return 'shell';
  return 'good';
}

/**
 * Score for a placement: correct scales with the current combo; a golden nut is
 * worth more. Wrong placements score nothing (gentle, never negative).
 */
export function shellScoreDelta(correct: boolean, combo: number, kind: ShellKind = 'goodNut'): number {
  if (!correct) return 0;
  const base = kind === 'goldenNut' ? 5 : 2;
  return base + Math.floor(combo / 3);
}

// --- Coffee Rescue --------------------------------------------------------
// Drops fall; the mug catches them. Difficulty ramps gently with elapsed time,
// and consecutive catches build a combo multiplier.
export function coffeeFallDuration(elapsedSeconds: number): number {
  // seconds for a drop to fall top->bottom; starts slow, floors at 1.6s
  return Math.max(1.6, 3.2 - elapsedSeconds * 0.05);
}

export function coffeeSpawnInterval(elapsedSeconds: number): number {
  return Math.max(700, 1300 - elapsedSeconds * 20); // ms between drops
}

/** Combo multiplier tier from the current catch streak (1x → 3x). */
export function coffeeComboMultiplier(streak: number): number {
  if (streak >= 12) return 3;
  if (streak >= 6) return 2;
  return 1;
}

/** Points for a single catch given the current (already-incremented) streak. */
export function coffeeCatchScore(streak: number): number {
  return 2 * coffeeComboMultiplier(streak);
}

// --- Procurement Conveyor -------------------------------------------------
// Packages ride the intake conveyor and the player physically drags each one to
// the correct department chute. Departments are told apart by ICON + SHAPE +
// LABEL (never colour alone) for colourblind accessibility. Some packages arrive
// on their side and must be rotated upright before they fit; fragile/priority
// parcels reward careful, accurate handling. Fully deterministic from a seed so
// the rules are unit-testable and reproducible in the dev deterministic mode.
export type ProcurementDept = 'harvest' | 'roasting' | 'logistics' | 'research';
export const PROCUREMENT_DEPTS: ProcurementDept[] = ['harvest', 'roasting', 'logistics', 'research'];

export interface ProcurementPackage {
  id: number;
  /** the department this parcel is addressed to (shown as an icon on the box). */
  dept: ProcurementDept;
  /** tubes/flats arrive rotated; they must be turned upright to fit the chute. */
  sideways: boolean;
  /** fragile parcels are worth a small bonus for careful, correct handling. */
  fragile: boolean;
}

export function procurementSequence(seedStr: string, count: number): ProcurementPackage[] {
  const rng = createRng(hashStringToSeed(`proc:${seedStr}`));
  const out: ProcurementPackage[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      id: i,
      dept: PROCUREMENT_DEPTS[rng.int(0, PROCUREMENT_DEPTS.length)],
      sideways: rng.next() < 0.32,
      fragile: rng.next() < 0.22,
    });
  }
  return out;
}

export type ProcurementResult = 'correct' | 'wrongDept' | 'notUpright';

/**
 * Resolve dropping a package onto a department chute. A parcel only clears when
 * it is sent to the right department AND (if it arrived sideways) has already
 * been rotated upright — otherwise it simply "doesn't fit" and can be retried,
 * so the player is never soft-locked and mistakes are gentle.
 */
export function procurementResolve(
  pkg: ProcurementPackage,
  dept: ProcurementDept,
  upright: boolean,
): ProcurementResult {
  if (pkg.sideways && !upright) return 'notUpright';
  return pkg.dept === dept ? 'correct' : 'wrongDept';
}

/**
 * Gentle scoring: only a correct placement scores, scaling with the current
 * combo; fragile and rotated parcels add a small bonus for the extra care and
 * skill. Wrong placements score nothing (never negative).
 */
export function procurementScoreDelta(
  result: ProcurementResult,
  combo: number,
  pkg: ProcurementPackage,
): number {
  if (result !== 'correct') return 0;
  let base = 2;
  if (pkg.fragile) base += 2;
  if (pkg.sideways) base += 1;
  return base + Math.floor(Math.max(0, combo) / 3);
}

// --- Bug Squash -----------------------------------------------------------
// A reaction/precision "whack-a-mole": office pests pop out of a 3x3 grid of
// burrows for a shrinking window; tap them before they duck back. Speed and
// difficulty ramp with elapsed time; consecutive squashes build a combo.
export const BUG_HOLES = 9;

export function bugLifetime(elapsedSeconds: number): number {
  return Math.max(650, 1500 - elapsedSeconds * 26); // ms a pest stays up
}

export function bugSpawnInterval(elapsedSeconds: number): number {
  return Math.max(380, 900 - elapsedSeconds * 18); // ms between pests
}

export function bugScore(streak: number): number {
  return 2 + Math.min(6, Math.floor(streak / 2));
}

// --- Cable Untangle Desk --------------------------------------------------
// A messy workstation: computers (nodes) are wired together by cables (edges)
// that start out crossed. The player drags each computer until NO two cables
// cross. The graph is always a single loop (a Hamiltonian cycle), which is
// guaranteed to be untangle-able into a convex ring — so every puzzle is
// solvable and can never soft-lock. Positions are normalised 0..1 so the board
// scales to any window size; all rules are pure and unit-tested.
export interface CablePoint {
  id: number;
  x: number;
  y: number;
}
export interface CableEdge {
  a: number;
  b: number;
}
export interface CablePuzzle {
  points: CablePoint[];
  edges: CableEdge[];
}

/** Orientation of the ordered triplet (p, q, r): >0 ccw, <0 cw, 0 collinear. */
function orient(px: number, py: number, qx: number, qy: number, rx: number, ry: number): number {
  return (qx - px) * (ry - py) - (qy - py) * (rx - px);
}

/**
 * True only for a *proper* crossing of segments (p1,p2) and (p3,p4). Segments
 * that merely touch at a shared endpoint (adjacent cables) do NOT count, and
 * neither do collinear/degenerate touches — only a genuine X-crossing.
 */
export function segmentsCross(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const d1 = orient(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y);
  const d2 = orient(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y);
  const d3 = orient(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  const d4 = orient(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Count the pairs of non-adjacent cables that cross at the given positions. */
export function countCrossings(edges: CableEdge[], pos: Record<number, { x: number; y: number }>): number {
  let n = 0;
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const e1 = edges[i];
      const e2 = edges[j];
      // adjacent cables share a computer — a shared endpoint is never a crossing
      if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue;
      if (segmentsCross(pos[e1.a], pos[e1.b], pos[e2.a], pos[e2.b])) n += 1;
    }
  }
  return n;
}

export function cableSolved(edges: CableEdge[], pos: Record<number, { x: number; y: number }>): boolean {
  return countCrossings(edges, pos) === 0;
}

export function cablePositions(points: CablePoint[]): Record<number, { x: number; y: number }> {
  const out: Record<number, { x: number; y: number }> = {};
  for (const p of points) out[p.id] = { x: p.x, y: p.y };
  return out;
}

/**
 * Build a solvable, initially-tangled cable puzzle: a loop of `nodeCount`
 * computers scattered at deterministic random positions, guaranteeing at least
 * one crossing so there is always something to fix.
 */
export function cablePuzzle(seedStr: string, nodeCount: number): CablePuzzle {
  const n = Math.max(4, nodeCount);
  const rng = createRng(hashStringToSeed(`cable:${seedStr}`));
  const scatter = (): CablePoint[] =>
    Array.from({ length: n }, (_, id) => ({
      id,
      // keep a margin off the edges so nodes never sit on the board border
      x: 0.1 + rng.next() * 0.8,
      y: 0.1 + rng.next() * 0.8,
    }));
  const edges: CableEdge[] = Array.from({ length: n }, (_, i) => ({ a: i, b: (i + 1) % n }));

  let points = scatter();
  // ensure the puzzle actually starts tangled (retry a bounded number of times)
  for (let tries = 0; tries < 12 && countCrossings(edges, cablePositions(points)) === 0; tries += 1) {
    points = scatter();
  }
  return { points, edges };
}

/** Nodes for the Nth solved puzzle: starts at 5 and grows, capped for clarity. */
export function cableNodeCount(solved: number): number {
  return Math.min(9, 5 + Math.max(0, solved));
}

/** Reward for clearing a board of the given size; bigger tangles are worth more. */
export function cableSolveScore(nodeCount: number): number {
  return 3 + Math.max(0, nodeCount - 4);
}

// --- shared -------------------------------------------------------------
export function microGrade(score: number): 'poor' | 'ok' | 'great' | 'perfect' {
  if (score >= 30) return 'perfect';
  if (score >= 18) return 'great';
  if (score >= 8) return 'ok';
  return 'poor';
}
