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

/* --- coffee drop kinds ----------------------------------------------------
 * Coffee Rescue had exactly one kind of falling thing. Every drop fell at the same
 * speed and paid the same score, so the whole game was "keep the mug under the next
 * one" — there was never a decision, only execution. Bug Squash had the same problem
 * and the same fix works here: make the falling things behave differently.
 *
 * The important addition is the HAZARD. A game where you catch everything only asks
 * you to track one position; a game where one drop must be DODGED asks you to read
 * what is falling and decide. That is the difference between a reflex test and a
 * small game, and it costs one boolean.
 *
 *   mug       the baseline, and most of what falls
 *   carafe    slower and worth double — easy to reach, so the pressure is that it
 *             occupies the mug while faster things arrive
 *   espresso  falls fast for the best score of the three catchables
 *   decaf     do NOT catch it. Breaks the streak and takes points.
 * ------------------------------------------------------------------------- */

export type CoffeeDropKindId = 'mug' | 'carafe' | 'espresso' | 'decaf';

export interface CoffeeDropKind {
  id: CoffeeDropKindId;
  /** Multiplier on fall duration. Above 1 falls slower. */
  fallScale: number;
  /** Multiplier on catch score. Ignored for hazards. */
  scoreScale: number;
  /** Relative spawn frequency. */
  weight: number;
  /** Catching this is a mistake. */
  hazard: boolean;
}

export const COFFEE_DROP_KINDS: readonly CoffeeDropKind[] = [
  { id: 'mug', fallScale: 1, scoreScale: 1, weight: 60, hazard: false },
  { id: 'carafe', fallScale: 1.35, scoreScale: 2, weight: 18, hazard: false },
  { id: 'espresso', fallScale: 0.65, scoreScale: 2.5, weight: 16, hazard: false },
  { id: 'decaf', fallScale: 1.05, scoreScale: 0, weight: 6, hazard: true },
];

export const COFFEE_DROP_KINDS_BY_ID: Record<CoffeeDropKindId, CoffeeDropKind> = Object.fromEntries(
  COFFEE_DROP_KINDS.map((k) => [k.id, k]),
) as Record<CoffeeDropKindId, CoffeeDropKind>;

/** Points deducted for catching something the office did not order. */
export const COFFEE_HAZARD_PENALTY = 3;

/**
 * Choose a drop kind from a 0..1 roll. Takes the roll rather than owning an RNG so
 * the caller's seeded generator stays the only source of randomness.
 */
export function pickCoffeeDropKind(roll: number): CoffeeDropKind {
  const total = COFFEE_DROP_KINDS.reduce((sum, k) => sum + k.weight, 0);
  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const kind of COFFEE_DROP_KINDS) {
    cursor -= kind.weight;
    if (cursor < 0) return kind;
  }
  return COFFEE_DROP_KINDS[0];
}

/**
 * The first thing that falls in a round is always an ordinary mug.
 *
 * Same reasoning as `firstBugSpecies`: a short round has to teach its own rules
 * before it starts asking for judgement, and opening on a hazard would read as the
 * game punishing the player for doing the obvious thing. It also keeps the opening
 * of a seeded round deterministic.
 */
export function firstCoffeeDropKind(): CoffeeDropKind {
  return COFFEE_DROP_KINDS_BY_ID.mug;
}

/** How long this kind takes to fall, on the shared difficulty curve. */
export function coffeeKindFallDuration(kind: CoffeeDropKind, elapsedSeconds: number): number {
  // Floored so the fastest kind stays reachable at the end of a long round rather
  // than becoming a coin flip.
  return Math.max(0.9, coffeeFallDuration(elapsedSeconds) * kind.fallScale);
}

/** What catching this kind is worth at the current streak. */
export function coffeeKindCatchScore(kind: CoffeeDropKind, streak: number): number {
  if (kind.hazard) return 0;
  return Math.max(1, Math.round(coffeeCatchScore(streak) * kind.scoreScale));
}

/** Applying a caught hazard: the streak dies and a few points go with it. */
export function applyCoffeeHazard(score: number): { score: number; lost: number } {
  const next = Math.max(0, score - COFFEE_HAZARD_PENALTY);
  return { score: next, lost: score - next };
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

/* --- bug species ----------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------
 * Bug Squash drew three bug "variants" and they were purely cosmetic: different
 * colours and a decorative flourish on an otherwise identical pest. Every bug had
 * the same lifetime, the same score and the same one-tap resolution, and only one
 * was ever on screen at a time. So the whole game was "wait, tap, wait" — it LOOKED
 * varied and PLAYED identically, which is the definition of shallow.
 *
 * A species is now a behaviour, not a palette. The table is the only place the
 * differences live, so adding one is data, and the numbers are all multipliers on
 * the existing difficulty curve rather than a second curve to keep in sync.
 *
 * The four are chosen to ask genuinely different things of the player:
 *   worker    the baseline. Most of what you see.
 *   runner    a window roughly half as long, worth double. Pure reaction.
 *   armoured  needs TWO taps and stays up longer. A commitment: while you finish
 *             it you are not watching the rest of the desk.
 *   rare      the shortest window in the game for four times the score. The one
 *             you drop everything for.
 * ------------------------------------------------------------------------- */

export type BugSpeciesId = 'worker' | 'runner' | 'armoured' | 'rare';

export interface BugSpecies {
  id: BugSpeciesId;
  /** Multiplier on `bugLifetime` — how long the window stays open. */
  lifetimeScale: number;
  /** Multiplier on `bugScore` — what squashing it is worth. */
  scoreScale: number;
  /** Taps required before it is squashed. */
  taps: number;
  /** Relative spawn frequency. */
  weight: number;
}

export const BUG_SPECIES: readonly BugSpecies[] = [
  { id: 'worker', lifetimeScale: 1, scoreScale: 1, taps: 1, weight: 58 },
  { id: 'runner', lifetimeScale: 0.55, scoreScale: 2, taps: 1, weight: 22 },
  { id: 'armoured', lifetimeScale: 1.6, scoreScale: 1.6, taps: 2, weight: 15 },
  { id: 'rare', lifetimeScale: 0.45, scoreScale: 4, taps: 1, weight: 5 },
];

export const BUG_SPECIES_BY_ID: Record<BugSpeciesId, BugSpecies> = Object.fromEntries(
  BUG_SPECIES.map((s) => [s.id, s]),
) as Record<BugSpeciesId, BugSpecies>;

/**
 * Choose a species from a 0..1 roll.
 *
 * Takes the roll rather than owning an RNG so the caller's seeded generator stays
 * the single source of randomness — which is what keeps a run reproducible from its
 * seed, and what makes this function trivially testable at its boundaries.
 */
export function pickBugSpecies(roll: number): BugSpecies {
  const total = BUG_SPECIES.reduce((sum, s) => sum + s.weight, 0);
  // Clamp rather than trust: a roll of exactly 1 (or a hair over) must not fall
  // through the loop and return undefined.
  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const species of BUG_SPECIES) {
    cursor -= species.weight;
    if (cursor < 0) return species;
  }
  return BUG_SPECIES[0];
}

/**
 * The pest that opens a round.
 *
 * Always the plain one-tap worker, deliberately. A round is short, and the first
 * thing a player meets has to teach the basic interaction — tap it, it dies — before
 * the game asks for two taps on an armoured shell or expects a reaction to a runner
 * that is gone in half the time. Leading with an armoured pest reads as an
 * unresponsive game rather than as a harder target.
 *
 * It also removes real non-determinism from the opening of every round: with a
 * weighted first spawn, the same seed could open four different ways, which made the
 * first hit worth 2, 4, 8 or nothing at all.
 */
export function firstBugSpecies(): BugSpecies {
  return BUG_SPECIES_BY_ID.worker;
}

/** How long this species stays up, on the shared difficulty curve. */
export function bugSpeciesLifetime(species: BugSpecies, elapsedSeconds: number): number {
  // Floored well above the input grace window so even the shortest-lived species is
  // always genuinely hittable rather than a coin flip.
  return Math.max(320, Math.round(bugLifetime(elapsedSeconds) * species.lifetimeScale));
}

/** What squashing this species is worth at the current streak. */
export function bugSpeciesScore(species: BugSpecies, streak: number): number {
  return Math.max(1, Math.round(bugScore(streak) * species.scoreScale));
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
  mirrored: boolean;
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

interface CableLayoutProfile {
  id: string;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  phase: number;
}

interface CableLayout {
  id: string;
  nodeCount: number;
  difficulty: CableDifficulty;
  slots: readonly { x: number; y: number }[];
}

// Eight desk silhouettes are generated for every supported size. Each profile
// is an ellipse (therefore convex), so placing node ids around its perimeter is
// always a valid crossing-free solution. Different proportions, offsets, and
// phases make the desk read differently without sacrificing responsiveness.
const CABLE_LAYOUT_PROFILES: readonly CableLayoutProfile[] = [
  { id: 'classic', centerX: 0.5, centerY: 0.5, radiusX: 0.36, radiusY: 0.36, phase: -0.5 },
  { id: 'wide', centerX: 0.5, centerY: 0.5, radiusX: 0.4, radiusY: 0.3, phase: -0.5 },
  { id: 'tall', centerX: 0.5, centerY: 0.5, radiusX: 0.31, radiusY: 0.38, phase: -0.5 },
  { id: 'tilted-left', centerX: 0.5, centerY: 0.5, radiusX: 0.38, radiusY: 0.33, phase: -0.61 },
  { id: 'tilted-right', centerX: 0.5, centerY: 0.5, radiusX: 0.38, radiusY: 0.33, phase: -0.39 },
  { id: 'high-arc', centerX: 0.5, centerY: 0.47, radiusX: 0.37, radiusY: 0.34, phase: -0.5 },
  { id: 'low-arc', centerX: 0.5, centerY: 0.53, radiusX: 0.39, radiusY: 0.33, phase: -0.5 },
  { id: 'offset', centerX: 0.48, centerY: 0.5, radiusX: 0.38, radiusY: 0.35, phase: -0.56 },
] as const;

function roundCableCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function cableDifficulty(nodeCount: number): CableDifficulty {
  if (nodeCount <= 5) return 'easy';
  if (nodeCount <= 7) return 'medium';
  return 'hard';
}

function buildCableSlots(
  nodeCount: number,
  profile: CableLayoutProfile,
): readonly { x: number; y: number }[] {
  const phase = profile.phase * Math.PI;
  return Array.from({ length: nodeCount }, (_, index) => {
    const angle = phase + (index * Math.PI * 2) / nodeCount;
    return {
      x: roundCableCoordinate(profile.centerX + Math.cos(angle) * profile.radiusX),
      y: roundCableCoordinate(profile.centerY + Math.sin(angle) * profile.radiusY),
    };
  });
}

const CABLE_LAYOUTS: readonly CableLayout[] = Array.from(
  { length: 5 },
  (_, index) => index + 5,
).flatMap((nodeCount) =>
  CABLE_LAYOUT_PROFILES.map((profile) => ({
    id: `${nodeCount}-${profile.id}`,
    nodeCount,
    difficulty: cableDifficulty(nodeCount),
    slots: buildCableSlots(nodeCount, profile),
  })),
);

const FALLBACK_TANGLE_ORDERS: Readonly<Record<number, readonly number[]>> = {
  5: [0, 2, 4, 1, 3],
  6: [0, 3, 1, 4, 2, 5],
  7: [0, 3, 6, 2, 5, 1, 4],
  8: [0, 4, 1, 5, 2, 6, 3, 7],
  9: [0, 4, 8, 3, 7, 2, 6, 1, 5],
};

function cableRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffledCableOrder(nodeCount: number, random: () => number): number[] {
  const order = Array.from({ length: nodeCount }, (_, id) => id);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [order[index], order[target]] = [order[target], order[index]];
  }
  return order;
}

function pointsForCableOrder(
  order: readonly number[],
  slots: readonly { x: number; y: number }[],
): CablePoint[] {
  return order
    .map((id, slotIndex) => ({ id, ...slots[slotIndex] }))
    .sort((left, right) => left.id - right.id);
}

function cableEdges(nodeCount: number): CableEdge[] {
  return Array.from({ length: nodeCount }, (_, index) => ({
    a: index,
    b: (index + 1) % nodeCount,
  }));
}

/** Pick a readable tangle near the target crossing count, never a lucky clear board. */
function cableTangleOrder(
  seedStr: string,
  layout: CableLayout,
  slots: readonly { x: number; y: number }[],
): readonly number[] {
  const random = cableRng(hashStringToSeed(`cable-tangle:${seedStr}:${layout.id}`));
  const edges = cableEdges(layout.nodeCount);
  const targetConflicts = Math.max(3, layout.nodeCount - 2);
  let best = FALLBACK_TANGLE_ORDERS[layout.nodeCount];
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestConflicts = -1;

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = shuffledCableOrder(layout.nodeCount, random);
    const conflicts = countCableConflicts(
      edges,
      cablePositions(pointsForCableOrder(candidate, slots)),
    );
    if (conflicts === 0) continue;
    const distance = Math.abs(conflicts - targetConflicts);
    if (distance < bestDistance || (distance === bestDistance && conflicts > bestConflicts)) {
      best = candidate;
      bestDistance = distance;
      bestConflicts = conflicts;
      if (distance === 0) break;
    }
  }

  return best;
}

/**
 * Select a deterministic, guaranteed-solvable cable desk. Callers may pass
 * recently shown layout ids; whenever another profile is available it is
 * chosen instead, preventing the capped late-game boards from repeating.
 */
export function cablePuzzle(
  seedStr: string,
  nodeCount: number,
  recentLevelIds: readonly string[] = [],
): CablePuzzle {
  const n = Math.max(5, Math.min(9, nodeCount));
  const candidates = CABLE_LAYOUTS.filter((layout) => layout.nodeCount === n);
  const recent = new Set(recentLevelIds);
  const available = candidates.filter((layout) => !recent.has(layout.id));
  const pool = available.length > 0 ? available : candidates;
  const level = pool[hashStringToSeed(`cable-layout:${seedStr}:${n}`) % pool.length];
  const mirrored = hashStringToSeed(`cable-mirror:${seedStr}:${level.id}`) % 2 === 1;
  const mapPoint = (point: { x: number; y: number }) => ({
    x: mirrored ? roundCableCoordinate(1 - point.x) : point.x,
    y: point.y,
  });
  const mappedSlots = level.slots.map(mapPoint);
  const order = cableTangleOrder(seedStr, level, mappedSlots);
  const solution = mappedSlots.map((slot, id) => ({ id, ...slot }));
  const points = pointsForCableOrder(order, mappedSlots);
  return {
    points,
    edges: cableEdges(n),
    solution,
    difficulty: level.difficulty,
    levelId: level.id,
    mirrored,
  };
}

/** Nodes for the Nth solved puzzle: starts at 5 and grows to the nine-node cap. */
export function cableNodeCount(solved: number): number {
  return Math.min(9, 5 + Math.max(0, solved));
}

/**
 * The conflict-free perimeter slots for an authored level, in node-id order
 * (i.e. node `id` is solved when placed at `slots[id]`), before any seed
 * mirroring. Exposed for end-to-end tests that need to drive a board to its
 * solution without knowing the runtime seed.
 */
export function cableLevelSlots(levelId: string): readonly { x: number; y: number }[] {
  const level = CABLE_LAYOUTS.find((entry) => entry.id === levelId);
  return level ? level.slots : [];
}

/** Stable catalogue ids for diagnostics, progression tests, and anti-repeat checks. */
export function cableLayoutIds(nodeCount: number): readonly string[] {
  const n = Math.max(5, Math.min(9, nodeCount));
  return CABLE_LAYOUTS.filter((entry) => entry.nodeCount === n).map((entry) => entry.id);
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
