import { hashStringToSeed } from './rng';

// Pure, deterministic logic for the micro-games. The React components own
// timing/DOM; this module owns the rules so they can be unit-tested and are
// reproducible from a seed (used by tests and the dev deterministic mode).

export type MicroMode = 'coffeeRescue' | 'bugSquash' | 'cableUntangle';

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

export interface CoffeeCatchGeometry {
  minMugX: number;
  maxMugX: number;
  halfCatchWidth: number;
  catchY: number;
}

/** Normalize rendered mug dimensions into the same 0..100 space as drops. */
export function coffeeCatchGeometry(
  areaWidth: number,
  areaHeight: number,
  mugWidth: number,
  mugTop: number,
  handleWidth = 23,
): CoffeeCatchGeometry {
  const safeWidth = Math.max(1, areaWidth);
  const safeHeight = Math.max(1, areaHeight);
  return {
    minMugX: ((mugWidth / 2 + 10) / safeWidth) * 100,
    maxMugX: 100 - ((mugWidth / 2 + handleWidth) / safeWidth) * 100,
    halfCatchWidth: Math.max(3.5, ((mugWidth / 2 - 5) / safeWidth) * 100),
    catchY: ((mugTop + 4) / safeHeight) * 100,
  };
}

/** Resolve a coffee drop atomically; stale/duplicate ids cannot score twice. */
export function resolveCoffeeDrop<T extends { id: number }>(
  drops: readonly T[],
  id: number,
): { resolved: boolean; drops: T[] } {
  if (!drops.some((drop) => drop.id === id)) return { resolved: false, drops: [...drops] };
  return { resolved: true, drops: drops.filter((drop) => drop.id !== id) };
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

export const BUG_EMPTY_PENALTY = 2;
export const BUG_INPUT_GRACE_MS = 180;

export interface RecentBugTarget {
  hole: number;
  at: number;
}

/**
 * Resolve one activation against the exact spawn token captured at pointer
 * down. A target that disappeared in the short input grace window is ignored,
 * never turned into an unfair penalty by an expiry/hit race.
 */
export function resolveBugWhack(
  active: { hole: number; token: number } | null,
  hole: number,
  capturedToken: number | null,
  recent: RecentBugTarget | null,
  now: number,
): 'hit' | 'grace' | 'empty' {
  if (capturedToken !== null && active?.hole === hole && active.token === capturedToken)
    return 'hit';
  if (recent?.hole === hole && now - recent.at <= BUG_INPUT_GRACE_MS) return 'grace';
  return 'empty';
}

/** Empty clicks deduct a small fixed amount without ever creating debt. */
export function applyBugEmptyPenalty(score: number): { score: number; lost: number } {
  const next = Math.max(0, score - BUG_EMPTY_PENALTY);
  return { score: next, lost: score - next };
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
export type CableDifficulty = 'easy' | 'medium' | 'hard';

export interface CablePuzzle {
  points: CablePoint[];
  edges: CableEdge[];
  /** Authored, crossing-free matching-port locations. */
  solution: CablePoint[];
  difficulty: CableDifficulty;
  levelId: string;
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

const CABLE_EPSILON = 1e-7;
const MIN_PLUG_DISTANCE = 0.085;

function pointOnSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  if (Math.abs(orient(start.x, start.y, end.x, end.y, point.x, point.y)) > CABLE_EPSILON) {
    return false;
  }
  return (
    point.x >= Math.min(start.x, end.x) - CABLE_EPSILON &&
    point.x <= Math.max(start.x, end.x) + CABLE_EPSILON &&
    point.y >= Math.min(start.y, end.y) - CABLE_EPSILON &&
    point.y <= Math.max(start.y, end.y) + CABLE_EPSILON
  );
}

/** Visible conflict between non-adjacent cables, including touching/overlap. */
export function cableSegmentsConflict(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  return (
    segmentsCross(p1, p2, p3, p4) ||
    pointOnSegment(p1, p3, p4) ||
    pointOnSegment(p2, p3, p4) ||
    pointOnSegment(p3, p1, p2) ||
    pointOnSegment(p4, p1, p2)
  );
}

/** Count the pairs of non-adjacent cables that cross at the given positions. */
export function countCrossings(
  edges: CableEdge[],
  pos: Record<number, { x: number; y: number }>,
): number {
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

/** Count every visible cable conflict and overlapping pair of plugs. */
export function countCableConflicts(
  edges: CableEdge[],
  pos: Record<number, { x: number; y: number }>,
): number {
  let conflicts = 0;
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const e1 = edges[i];
      const e2 = edges[j];
      const shared =
        e1.a === e2.a || e1.a === e2.b ? e1.a : e1.b === e2.a || e1.b === e2.b ? e1.b : null;
      if (shared != null) {
        const other1 = e1.a === shared ? e1.b : e1.a;
        const other2 = e2.a === shared ? e2.b : e2.a;
        const centre = pos[shared];
        const first = pos[other1];
        const second = pos[other2];
        const overlap =
          Math.abs(orient(centre.x, centre.y, first.x, first.y, second.x, second.y)) <=
            CABLE_EPSILON &&
          (first.x - centre.x) * (second.x - centre.x) +
            (first.y - centre.y) * (second.y - centre.y) >
            CABLE_EPSILON;
        if (overlap) conflicts += 1;
        continue;
      }
      if (cableSegmentsConflict(pos[e1.a], pos[e1.b], pos[e2.a], pos[e2.b])) conflicts += 1;
    }
  }

  const ids = Object.keys(pos).map(Number);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      if (
        Math.hypot(pos[ids[i]].x - pos[ids[j]].x, pos[ids[i]].y - pos[ids[j]].y) < MIN_PLUG_DISTANCE
      ) {
        conflicts += 1;
      }
    }
  }
  return conflicts;
}

export function cableSolved(
  edges: CableEdge[],
  pos: Record<number, { x: number; y: number }>,
): boolean {
  return countCableConflicts(edges, pos) === 0;
}

export function cablePositions(points: CablePoint[]): Record<number, { x: number; y: number }> {
  const out: Record<number, { x: number; y: number }> = {};
  for (const p of points) out[p.id] = { x: p.x, y: p.y };
  return out;
}

interface AuthoredCableLevel {
  id: string;
  difficulty: CableDifficulty;
  slots: readonly { x: number; y: number }[];
  /** Node ids arranged around the desk perimeter in their tangled order. */
  tangledOrder: readonly number[];
}

// Hand-authored desk layouts. Every solution puts cable ids in perimeter order,
// while each opening order creates a deliberate readable tangle. Mirroring from
// the seed adds variety without surrendering solvability or visual composition.
const AUTHORED_CABLE_LEVELS: readonly AuthoredCableLevel[] = [
  {
    id: 'starter-star',
    difficulty: 'easy',
    slots: [
      { x: 0.18, y: 0.2 },
      { x: 0.5, y: 0.11 },
      { x: 0.82, y: 0.2 },
      { x: 0.84, y: 0.72 },
      { x: 0.5, y: 0.88 },
    ],
    tangledOrder: [0, 2, 4, 1, 3],
  },
  {
    id: 'meeting-loop',
    difficulty: 'medium',
    slots: [
      { x: 0.16, y: 0.22 },
      { x: 0.48, y: 0.1 },
      { x: 0.82, y: 0.2 },
      { x: 0.86, y: 0.7 },
      { x: 0.53, y: 0.89 },
      { x: 0.14, y: 0.7 },
    ],
    tangledOrder: [0, 3, 1, 4, 2, 5],
  },
  {
    id: 'support-heptagon',
    difficulty: 'medium',
    slots: [
      { x: 0.14, y: 0.3 },
      { x: 0.3, y: 0.12 },
      { x: 0.65, y: 0.1 },
      { x: 0.86, y: 0.32 },
      { x: 0.82, y: 0.7 },
      { x: 0.52, y: 0.89 },
      { x: 0.16, y: 0.72 },
    ],
    tangledOrder: [0, 3, 6, 2, 5, 1, 4],
  },
  {
    id: 'server-octagon',
    difficulty: 'hard',
    slots: [
      { x: 0.14, y: 0.28 },
      { x: 0.29, y: 0.11 },
      { x: 0.66, y: 0.1 },
      { x: 0.86, y: 0.28 },
      { x: 0.86, y: 0.7 },
      { x: 0.66, y: 0.89 },
      { x: 0.3, y: 0.9 },
      { x: 0.13, y: 0.7 },
    ],
    tangledOrder: [0, 4, 1, 5, 2, 6, 3, 7],
  },
  {
    id: 'launch-day',
    difficulty: 'hard',
    slots: [
      { x: 0.12, y: 0.32 },
      { x: 0.24, y: 0.13 },
      { x: 0.51, y: 0.08 },
      { x: 0.78, y: 0.14 },
      { x: 0.89, y: 0.37 },
      { x: 0.83, y: 0.7 },
      { x: 0.61, y: 0.9 },
      { x: 0.32, y: 0.89 },
      { x: 0.12, y: 0.68 },
    ],
    tangledOrder: [0, 4, 8, 3, 7, 2, 6, 1, 5],
  },
] as const;

/**
 * Select a handcrafted, guaranteed-solvable cable desk. The seed only mirrors
 * the authored composition, so difficulty and crossing guarantees never rely
 * on lucky random scatter.
 */
export function cablePuzzle(seedStr: string, nodeCount: number): CablePuzzle {
  const n = Math.max(5, Math.min(9, nodeCount));
  const level = AUTHORED_CABLE_LEVELS[n - 5];
  const mirrored = hashStringToSeed(`cable:${seedStr}:${level.id}`) % 2 === 1;
  const mapPoint = (point: { x: number; y: number }) => ({
    x: mirrored ? 1 - point.x : point.x,
    y: point.y,
  });
  const solution = level.slots.map((slot, id) => ({ id, ...mapPoint(slot) }));
  const points = level.tangledOrder.map((id, slotIndex) => ({
    id,
    ...mapPoint(level.slots[slotIndex]),
  }));
  const edges: CableEdge[] = Array.from({ length: n }, (_, index) => ({
    a: index,
    b: (index + 1) % n,
  }));
  return {
    points: points.sort((a, b) => a.id - b.id),
    edges,
    solution,
    difficulty: level.difficulty,
    levelId: level.id,
  };
}

/** Nodes for the Nth solved puzzle: starts at 5 and caps at 7 for clarity. */
export function cableNodeCount(solved: number): number {
  return Math.min(7, 5 + Math.max(0, solved));
}

/**
 * The conflict-free perimeter slots for an authored level, in node-id order
 * (i.e. node `id` is solved when placed at `slots[id]`), before any seed
 * mirroring. Exposed for end-to-end tests that need to drive a board to its
 * solution without knowing the runtime seed.
 */
export function cableLevelSlots(levelId: string): readonly { x: number; y: number }[] {
  const level = AUTHORED_CABLE_LEVELS.find((entry) => entry.id === levelId);
  return level ? level.slots : [];
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
