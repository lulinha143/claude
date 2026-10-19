import { hashStringToSeed } from './rng';

// Pure, deterministic logic for the micro-games. The React components own
// timing/DOM; this module owns the rules so they can be unit-tested and are
// reproducible from a seed (used by tests and the dev deterministic mode).

export type MicroMode = 'coffeeRescue' | 'bugSquash' | 'cableUntangle';

export const MICRO_MODES: readonly MicroMode[] = ['coffeeRescue', 'bugSquash', 'cableUntangle'];

export const MICRO_SOUVENIRS: Record<MicroMode, string> = {
  coffeeRescue: 'menu-chalkboard',
  bugSquash: 'specimen-shelf',
  cableUntangle: 'pipe-cluster',
};

export const MICRO_TEAM: Record<MicroMode, readonly string[]> = {
  coffeeRescue: ['marlow', 'pip'],
  bugSquash: ['quincy', 'nixie'],
  cableUntangle: ['nixie', 'bea'],
};

/* --- calibration ------------------------------------------------------------
 * One table per game, because the three games do not score on the same scale.
 *
 * They used to share one: "poor/ok/great/perfect" at 8/18/30 and mastery at 30
 * for all three. A coffee mug parked in the middle of the counter, never moved,
 * scored about 14 — almost an "ok" — while 30 on the cable desk needed four
 * clean desks in 45 seconds. Mastery was a formality in one game and a feat in
 * another, and the reward (which grew with the raw score) paid the coffee
 * counter several times what the cable desk paid for the same effort.
 *
 * The bands below come from the bots in tests/minigameRounds.test.ts, which play each
 * game with the real rules: a player who does nothing stays under "ok", steady
 * play lands "great", and mastery asks for a good round, not a perfect one.
 * Rewards read a score as a fraction of its own game's mastery, so the economy
 * pays the same for the same skill whichever game the player prefers.
 * ------------------------------------------------------------------------- */

export interface MicroCalibration {
  /** Seconds a round lasts once the countdown ends. */
  duration: number;
  /** Lowest score of each grade above "poor". `mastery` is also the first-mastery prize line. */
  ok: number;
  great: number;
  mastery: number;
  /**
   * Successes in a row at which the combo reaches ×2 and ×3. The multiplier on
   * screen and the multiplier in the score are this one table, so they cannot drift.
   * Null for a game with no streak (the cable desk pays for speed instead).
   */
  combo: readonly [number, number] | null;
}

export const MICRO_CALIBRATION: Readonly<Record<MicroMode, MicroCalibration>> = {
  coffeeRescue: { duration: 30, ok: 55, great: 115, mastery: 170, combo: [6, 12] },
  bugSquash: { duration: 30, ok: 40, great: 115, mastery: 200, combo: [4, 9] },
  cableUntangle: { duration: 45, ok: 10, great: 20, mastery: 32, combo: null },
};

export type MicroGradeId = 'poor' | 'ok' | 'great' | 'perfect';

export function microGrade(mode: MicroMode, score: number): MicroGradeId {
  const cal = MICRO_CALIBRATION[mode];
  if (score >= cal.mastery) return 'perfect';
  if (score >= cal.great) return 'great';
  if (score >= cal.ok) return 'ok';
  return 'poor';
}

/** The multiplier earned by `chain` successes in a row, including the latest one. */
export function microComboMultiplier(mode: MicroMode, chain: number): number {
  const tiers = MICRO_CALIBRATION[mode].combo;
  if (!tiers) return 1;
  if (chain >= tiers[1]) return 3;
  if (chain >= tiers[0]) return 2;
  return 1;
}

/** The chain length that reaches the next multiplier, or null once at the top. */
export function microComboNext(mode: MicroMode, chain: number): number | null {
  const tiers = MICRO_CALIBRATION[mode].combo;
  if (!tiers) return null;
  if (chain < tiers[0]) return tiers[0];
  if (chain < tiers[1]) return tiers[1];
  return null;
}

/** How far a score went toward its own game's mastery (1 = exactly mastery). */
export function microPerformance(mode: MicroMode, score: number): number {
  if (!(score > 0)) return 0;
  return score / MICRO_CALIBRATION[mode].mastery;
}

/** Seconds a minigame's production encouragement lasts. */
export const MICRO_BOOST_SECONDS = 90;
/** Source tag shared by every minigame boost: one runs at a time, never three stacked. */
export const MICRO_BOOST_SOURCE = 'microgame';
/** Two completions of the same game closer than this are the same round twice. */
export const MICRO_MIN_ROUND_GAP_MS = 25_000;
/** No real round reaches this; anything above it is not a score. */
export const MICRO_MAX_SCORE = 5_000;

export interface MicroPayout {
  /** Nuts paid, as a multiple of a crate's worth of unboosted production. */
  nutsFactor: number;
  /** Production encouragement earned by this score, in whole percent. */
  boostPercent: number;
}

/**
 * What a score pays. Read against the game's own mastery, so a mastered coffee
 * round and a mastered cable desk pay alike; capped a little past mastery so the
 * reward rewards skill without turning one game into the only one worth playing.
 */
export function microPayout(mode: MicroMode, score: number): MicroPayout {
  if (!(score > 0) || !Number.isFinite(score)) return { nutsFactor: 0, boostPercent: 0 };
  const performance = Math.min(1.6, microPerformance(mode, score));
  return {
    nutsFactor: 0.5 + 1.5 * performance,
    boostPercent: Math.min(50, Math.max(1, Math.round(35 * performance))),
  };
}

export function microMasteryFlag(mode: MicroMode): string {
  return `microgame.${mode}.mastered`;
}

/**
 * Whether this game is mastered. The flag is the record (it is what the office's
 * callbacks and discoveries read, and it survives restructures); a best at or
 * above today's line also counts, so a record that predates the flag still reads
 * as what it is.
 */
export function isMicroMastered(
  state: {
    flags: Readonly<Record<string, number>>;
    microgames: Readonly<Record<string, { best: number } | undefined>>;
  },
  mode: MicroMode,
): boolean {
  if (state.flags[microMasteryFlag(mode)] !== undefined) return true;
  return (state.microgames[mode]?.best ?? 0) >= MICRO_CALIBRATION[mode].mastery;
}

export interface MicroReward {
  nuts: number;
  /** The minigame production multiplier now running: this round's, or a stronger one it renewed. */
  boost: number;
  /** Seconds left on that multiplier. */
  boostSeconds: number;
  /** What this round's own score earned, before meeting a running boost. */
  ownBoost: number;
  best: number;
  previousBest: number;
  newBest: boolean;
  /** Mastery reached for the first time with this round. */
  mastered: boolean;
  /** Mastery was already on file before this round. */
  masteredBefore: boolean;
  grade: MicroGradeId;
  goldenNuts: number;
  employeeIds: string[];
  decorationId?: string;
}

/** One well-mixed seeded stream (mulberry32), shared by every rule below. */
function seededStream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The same generator as a pure step, for state that has to stay serialisable. */
function streamStep(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let value = Math.imul(next ^ (next >>> 15), 1 | next);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return [((value ^ (value >>> 14)) >>> 0) / 4_294_967_296, next];
}

function weightedIndex(roll: number, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (!(total > 0)) return 0;
  // Clamp rather than trust: a roll of exactly 1 must not fall through.
  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= Math.max(0, weights[index]);
    if (cursor < 0) return index;
  }
  return weights.findIndex((weight) => weight > 0);
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
  return microComboMultiplier('coffeeRescue', streak);
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

/* --- the day's menu ---------------------------------------------------------
 * Replaying used to serve the same round again: the same mix, the same tempo.
 * Each round now opens on one of four days, in turn, so a second round in a row is
 * never the first one again. A day leans the mix (and the orders, which are drawn
 * from it) one way; it never removes a kind, so the rules a player learned hold.
 * ------------------------------------------------------------------------- */

export type CoffeeVariationId = 'morning' | 'espresso' | 'catering' | 'audit';

export interface CoffeeVariation {
  id: CoffeeVariationId;
  /** Per-kind multiplier on the spawn weight. */
  weight: Readonly<Record<CoffeeDropKindId, number>>;
  /** Multiplier on the gap between drops: below 1 is a busier counter. */
  tempo: number;
  /** Multiplier on the fall: below 1 falls faster. */
  fall: number;
}

export const COFFEE_VARIATIONS: readonly CoffeeVariation[] = [
  {
    id: 'morning',
    weight: { mug: 1.3, carafe: 0.8, espresso: 0.8, decaf: 1 },
    tempo: 0.88,
    fall: 1,
  },
  {
    id: 'espresso',
    weight: { mug: 0.85, carafe: 0.7, espresso: 2.2, decaf: 1 },
    tempo: 1,
    fall: 0.94,
  },
  {
    id: 'catering',
    weight: { mug: 0.9, carafe: 2.4, espresso: 0.7, decaf: 1 },
    tempo: 1.06,
    fall: 1.04,
  },
  { id: 'audit', weight: { mug: 1, carafe: 1, espresso: 1, decaf: 2.3 }, tempo: 1, fall: 1 },
];

/** Round `round` of a sitting whose shell seed is `seed`: the days come in turn. */
export function coffeeVariationFor(seed: number | string, round: number): CoffeeVariation {
  const start = hashStringToSeed(`coffee-day:${seed}`);
  const index = (start + Math.max(0, Math.floor(round))) % COFFEE_VARIATIONS.length;
  return COFFEE_VARIATIONS[index];
}

/* --- the round's three beats ------------------------------------------------
 * A 30-second round has a shape now instead of one slope: a warm-up with nothing
 * to dodge, the service where decaf starts turning up, and a rush where two
 * things fall at once and the player has to pick one.
 * ------------------------------------------------------------------------- */

export type CoffeePhaseId = 'warmup' | 'service' | 'rush';

export interface CoffeePhase {
  id: CoffeePhaseId;
  index: number;
  /** Seconds into the round. */
  from: number;
  /** Whether decaf can fall yet. */
  hazards: boolean;
  /** Chance that a drop arrives with a second one beside it. */
  pairChance: number;
}

export const COFFEE_PHASES: readonly CoffeePhase[] = [
  { id: 'warmup', index: 0, from: 0, hazards: false, pairChance: 0 },
  { id: 'service', index: 1, from: 8, hazards: true, pairChance: 0 },
  { id: 'rush', index: 2, from: 20, hazards: true, pairChance: 0.4 },
];

export function coffeePhaseAt(elapsedSeconds: number): CoffeePhase {
  let phase = COFFEE_PHASES[0];
  for (const candidate of COFFEE_PHASES) if (elapsedSeconds >= candidate.from) phase = candidate;
  return phase;
}

/**
 * Choose a drop kind from a 0..1 roll. Takes the roll rather than owning an RNG so
 * the caller's seeded generator stays the only source of randomness. The day leans
 * the mix; the warm-up holds the hazard back.
 */
export function pickCoffeeDropKind(
  roll: number,
  variation?: CoffeeVariation,
  phase?: CoffeePhase,
): CoffeeDropKind {
  const weights = COFFEE_DROP_KINDS.map(
    (kind) =>
      kind.weight *
      (variation?.weight[kind.id] ?? 1) *
      (kind.hazard && phase && !phase.hazards ? 0 : 1),
  );
  return COFFEE_DROP_KINDS[weightedIndex(roll, weights)] ?? COFFEE_DROP_KINDS[0];
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
export function coffeeKindFallDuration(
  kind: CoffeeDropKind,
  elapsedSeconds: number,
  variation?: CoffeeVariation,
): number {
  // Floored so the fastest kind stays reachable at the end of a long round rather
  // than becoming a coin flip.
  return Math.max(
    0.9,
    coffeeFallDuration(elapsedSeconds) * kind.fallScale * (variation?.fall ?? 1),
  );
}

/** Milliseconds until the next drop, on the day's tempo. */
export function coffeeSpawnGap(elapsedSeconds: number, variation?: CoffeeVariation): number {
  return coffeeSpawnInterval(elapsedSeconds) * (variation?.tempo ?? 1);
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

/**
 * Where the second drop of a rush pair falls: far enough from the first that one
 * mug cannot take both, so the pair is a choice rather than a bonus.
 */
export function coffeePairX(firstX: number, roll: number, minX: number, maxX: number): number {
  const span = Math.max(1, maxX - minX);
  const gap = Math.min(span * 0.5, Math.max(24, span * 0.32));
  const left = firstX - gap;
  const right = firstX + gap;
  const canLeft = left >= minX;
  const canRight = right <= maxX;
  const goRight = canRight && (!canLeft || roll >= 0.5);
  const base = goRight ? right : left;
  const room = goRight ? maxX - right : left - minX;
  const offset = Math.max(0, room) * ((roll * 997) % 1) * 0.6;
  return Math.max(minX, Math.min(maxX, goRight ? base + offset : base - offset));
}

/* --- orders -------------------------------------------------------------------
 * The ticket on the counter is a real order now. It lists two to four drinks from
 * the day's menu; catching what it asks for ticks it off, and a complete order pays
 * a bonus on top of the catches. It gives the round something to aim at beyond
 * "catch whatever is lowest": an espresso the order needs is worth leaving a mug
 * for. Orders never expire and a mistake never spoils one — the decaf already costs
 * the streak, and one error should not cost three things.
 * ------------------------------------------------------------------------- */

export interface CoffeeOrder {
  index: number;
  items: readonly CoffeeDropKindId[];
  filled: readonly boolean[];
}

export const COFFEE_ORDER_POINTS_PER_ITEM = 3;

/** Orders grow: two drinks, then three, then four. */
export function coffeeOrderSize(index: number): number {
  if (index <= 0) return 2;
  if (index < 3) return 3;
  return 4;
}

const ORDER_SEQUENCE: readonly CoffeeDropKindId[] = ['mug', 'carafe', 'espresso'];

export function coffeeOrder(seed: string, index: number, variation?: CoffeeVariation): CoffeeOrder {
  const random = seededStream(hashStringToSeed(`coffee-order:${seed}:${index}`));
  const catchable = COFFEE_DROP_KINDS.filter((kind) => !kind.hazard);
  const weights = catchable.map((kind) => kind.weight * (variation?.weight[kind.id] ?? 1));
  const size = coffeeOrderSize(index);
  const items: CoffeeDropKindId[] = [];
  for (let slot = 0; slot < size; slot += 1) {
    items.push(catchable[weightedIndex(random(), weights)].id);
  }
  // An order of nothing but plain mugs asks no question; past the first, make sure
  // it names at least one of the drinks that behave differently.
  const distinctive = items.filter((item) => item !== 'mug').length;
  if (index > 0 && distinctive === 0) {
    items[items.length - 1] = random() < 0.5 ? 'carafe' : 'espresso';
  }
  items.sort((left, right) => ORDER_SEQUENCE.indexOf(left) - ORDER_SEQUENCE.indexOf(right));
  return { index, items, filled: items.map(() => false) };
}

/** Tick off one drink. A drink the order does not need changes nothing. */
export function fillCoffeeOrder(
  order: CoffeeOrder,
  kind: CoffeeDropKindId,
): { order: CoffeeOrder; matched: boolean; completed: boolean } {
  const slot = order.items.findIndex((item, index) => item === kind && !order.filled[index]);
  if (slot < 0) return { order, matched: false, completed: false };
  const filled = order.filled.map((done, index) => done || index === slot);
  return { order: { ...order, filled }, matched: true, completed: filled.every(Boolean) };
}

export function coffeeOrderBonus(order: CoffeeOrder): number {
  return COFFEE_ORDER_POINTS_PER_ITEM * order.items.length;
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

/**
 * Keyboard mug speed, in percent of the counter per second. Held keys move the mug
 * every frame (the browser's key repeat waits ~0.5 s and then steps), easing in over
 * the first fifth of a second so a tap is a nudge and a hold is a glide.
 */
export const COFFEE_KEY_SPEED = 165;
export const COFFEE_KEY_TAP = 2.5;

export function coffeeKeyVelocity(heldMs: number): number {
  const ease = Math.min(1, Math.max(0, heldMs) / 200);
  return COFFEE_KEY_SPEED * (0.45 + 0.55 * ease);
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

export const BUG_BASE_POINTS = 2;

/** A plain squash at this chain length (the combo's own multiplier, nothing hidden). */
export function bugScore(streak: number): number {
  return BUG_BASE_POINTS * microComboMultiplier('bugSquash', streak);
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
 * A species is a behaviour, not a palette. The table is the only place the
 * differences live, so adding one is data, and the numbers are all multipliers on
 * the existing difficulty curve rather than a second curve to keep in sync.
 *
 *   worker    the baseline. Most of what you see.
 *   runner    worth double, and it does not sit still: partway through its window it
 *             hops to another burrow. Hit it early or follow it.
 *   armoured  needs TWO taps and stays up longer. A commitment: while you finish
 *             it you are not watching the rest of the desk.
 *   rare      the shortest window in the game for five times the score. The one
 *             you drop everything for — the closing shift always sends one.
 *   feature   not a bug. It looks busy and it is on the desk with the others, and
 *             squashing it costs points and the streak. It is what makes mashing a
 *             losing strategy: a player has to look before they tap.
 * ------------------------------------------------------------------------- */

export type BugSpeciesId = 'worker' | 'runner' | 'armoured' | 'rare' | 'feature';

export interface BugSpecies {
  id: BugSpeciesId;
  /** Multiplier on `bugLifetime` — how long the window stays open. */
  lifetimeScale: number;
  /** Multiplier on the squash score. Zero for the hazard. */
  scoreScale: number;
  /** Taps required before it is squashed. */
  taps: number;
  /** Relative spawn frequency outside the shifts (see BUG_SHIFTS for the round's own). */
  weight: number;
  /** Squashing this is the mistake. */
  hazard: boolean;
  /** Hops once to another burrow partway through its window. */
  hops: boolean;
}

export const BUG_SPECIES: readonly BugSpecies[] = [
  {
    id: 'worker',
    lifetimeScale: 1,
    scoreScale: 1,
    taps: 1,
    weight: 58,
    hazard: false,
    hops: false,
  },
  {
    id: 'runner',
    lifetimeScale: 0.8,
    scoreScale: 2,
    taps: 1,
    weight: 22,
    hazard: false,
    hops: true,
  },
  {
    id: 'armoured',
    lifetimeScale: 1.6,
    scoreScale: 2,
    taps: 2,
    weight: 15,
    hazard: false,
    hops: false,
  },
  { id: 'rare', lifetimeScale: 0.5, scoreScale: 5, taps: 1, weight: 5, hazard: false, hops: false },
  {
    id: 'feature',
    lifetimeScale: 1.25,
    scoreScale: 0,
    taps: 1,
    weight: 8,
    hazard: true,
    hops: false,
  },
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
  return (
    BUG_SPECIES[
      weightedIndex(
        roll,
        BUG_SPECIES.map((s) => s.weight),
      )
    ] ?? BUG_SPECIES[0]
  );
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

/** What squashing this species is worth at the current streak. The feature pays nothing. */
export function bugSpeciesScore(species: BugSpecies, streak: number): number {
  if (species.hazard) return 0;
  return Math.max(1, Math.round(bugScore(streak) * species.scoreScale));
}

/** A runner's two legs, before and after its hop. Each stays comfortably hittable. */
export function bugRunnerLegs(elapsedSeconds: number): { before: number; after: number } {
  const total = bugSpeciesLifetime(BUG_SPECIES_BY_ID.runner, elapsedSeconds);
  return {
    before: Math.max(320, Math.round(total * 0.45)),
    after: Math.max(340, Math.round(total * 0.55)),
  };
}

export const BUG_EMPTY_PENALTY = 2;
/** Squashing the feature costs more than an empty drawer: it was a choice. */
export const BUG_FEATURE_PENALTY = 4;
export const BUG_INPUT_GRACE_MS = 180;
/** A burrow just vacated stays empty this long, so a late second tap can never land on a newcomer. */
export const BUG_RESPAWN_GUARD_MS = BUG_INPUT_GRACE_MS + 140;

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

/* --- the round's three shifts -------------------------------------------------
 * One pest at a time made every round "wait, tap, wait", however varied the pests
 * were. A round now runs three shifts. The first teaches the desk with one pest at
 * a time; the second brings two at once, the armoured ones and the first feature;
 * the third keeps three up and always sends the golden bug once. Each shift is
 * announced on the desk as it starts.
 * ------------------------------------------------------------------------- */

export type BugShiftId = 'sorting' | 'peak' | 'closing';

export interface BugShift {
  id: BugShiftId;
  index: number;
  /** Seconds into the round. */
  from: number;
  /** Pests up at once. */
  maxActive: number;
  /** Spawn weights in this shift. */
  weights: Readonly<Partial<Record<BugSpeciesId, number>>>;
  /** Multiplier on the spawn gap. */
  tempo: number;
}

export const BUG_SHIFTS: readonly BugShift[] = [
  { id: 'sorting', index: 0, from: 0, maxActive: 1, weights: { worker: 72, runner: 28 }, tempo: 1 },
  {
    id: 'peak',
    index: 1,
    from: 9,
    maxActive: 2,
    weights: { worker: 46, runner: 24, armoured: 18, feature: 12 },
    tempo: 0.95,
  },
  {
    id: 'closing',
    index: 2,
    from: 20,
    maxActive: 3,
    weights: { worker: 38, runner: 24, armoured: 16, feature: 16, rare: 6 },
    tempo: 0.9,
  },
];

export function bugShiftAt(elapsedSeconds: number): BugShift {
  let shift = BUG_SHIFTS[0];
  for (const candidate of BUG_SHIFTS) if (elapsedSeconds >= candidate.from) shift = candidate;
  return shift;
}

export function pickBugSpeciesForShift(roll: number, shift: BugShift): BugSpecies {
  const weights = BUG_SPECIES.map((species) => shift.weights[species.id] ?? 0);
  return BUG_SPECIES[weightedIndex(roll, weights)] ?? BUG_SPECIES[0];
}

/* --- the desk as one pure state ----------------------------------------------
 * Several pests at once, hops, an armoured shell and a decoy is too much state to
 * keep honest in component refs, so the desk is a value: `advanceBugBoard` moves it
 * to a moment, `whackBugBoard` applies one tap. The component renders it and feeds
 * it input; tests play whole rounds with it.
 * ------------------------------------------------------------------------- */

export interface BugPest {
  token: number;
  hole: number;
  species: BugSpeciesId;
  bornAt: number;
  /** When it ducks back into its burrow (moves when a runner hops). */
  endsAt: number;
  tapsLeft: number;
  /** A runner's hop, while it is still to come. */
  hopAt: number | null;
  /** The burrow a runner hopped from. */
  hoppedFrom: number | null;
}

export interface BugBoard {
  /** Active milliseconds since the round began (pauses do not count). */
  clock: number;
  pests: readonly BugPest[];
  nextSpawnAt: number;
  nextToken: number;
  spawned: number;
  lastHole: number;
  recent: readonly RecentBugTarget[];
  /** When the closing shift's golden bug is due. */
  rareAt: number;
  rareSpawned: boolean;
  shift: number;
  chain: number;
  score: number;
  /** The board's own random stream, so the whole desk replays from its seed. */
  rng: number;
}

export type BugBoardEvent =
  | { type: 'spawn'; pest: BugPest }
  | { type: 'hop'; pest: BugPest; from: number }
  | { type: 'escape'; pest: BugPest; chainLost: number }
  | { type: 'featureLeft'; pest: BugPest }
  | { type: 'shift'; shift: BugShift };

export type BugWhackOutcome =
  | { type: 'hit'; pest: BugPest; points: number; chain: number; multiplier: number }
  | { type: 'crack'; pest: BugPest }
  | { type: 'feature'; pest: BugPest; lost: number; chainLost: number }
  | { type: 'empty'; hole: number; lost: number; chainLost: number }
  | { type: 'grace'; hole: number };

export const BUG_FIRST_SPAWN_MS = 500;

export function createBugBoard(seed: string): BugBoard {
  const random = seededStream(hashStringToSeed(`bug-board:${seed}`));
  const closing = BUG_SHIFTS[2].from * 1000;
  return {
    clock: 0,
    pests: [],
    nextSpawnAt: BUG_FIRST_SPAWN_MS,
    nextToken: 1,
    spawned: 0,
    lastHole: -1,
    recent: [],
    rareAt: closing + 500 + Math.floor(random() * 5_500),
    rareSpawned: false,
    shift: 0,
    chain: 0,
    score: 0,
    rng: hashStringToSeed(`bug-stream:${seed}`) | 0,
  };
}

function recentlyVacated(board: BugBoard, hole: number, at: number, window: number): boolean {
  return board.recent.some((entry) => entry.hole === hole && at - entry.at <= window);
}

/** Burrows a newcomer may use: empty, not just vacated, and not the last one if avoidable. */
function freeHoles(board: BugBoard, at: number, avoid: number): number[] {
  const taken = new Set(board.pests.map((pest) => pest.hole));
  const open = Array.from({ length: BUG_HOLES }, (_, hole) => hole).filter(
    (hole) => !taken.has(hole) && !recentlyVacated(board, hole, at, BUG_RESPAWN_GUARD_MS),
  );
  const preferred = open.filter((hole) => hole !== avoid);
  return preferred.length > 0 ? preferred : open;
}

/** Move the desk forward to `clock` (ms of active play). Spawns at most one pest per call. */
export function advanceBugBoard(
  board: BugBoard,
  clock: number,
): { board: BugBoard; events: BugBoardEvent[] } {
  const now = Math.max(board.clock, clock);
  const events: BugBoardEvent[] = [];
  let rng = board.rng;
  const roll = () => {
    const [value, next] = streamStep(rng);
    rng = next;
    return value;
  };
  let chain = board.chain;
  let recent = board.recent.filter((entry) => now - entry.at <= BUG_RESPAWN_GUARD_MS * 2);
  let nextSpawnAt = board.nextSpawnAt;
  const pests: BugPest[] = [];
  const seconds = now / 1000;

  // Hops first, so a runner that hops and expires in one long frame does both.
  const occupied = () => new Set([...pests.map((p) => p.hole), ...board.pests.map((p) => p.hole)]);
  for (const pest of board.pests) {
    let current = pest;
    if (current.hopAt !== null && now >= current.hopAt) {
      const taken = occupied();
      const options = Array.from({ length: BUG_HOLES }, (_, hole) => hole).filter(
        (hole) =>
          !taken.has(hole) &&
          !recent.some(
            (entry) => entry.hole === hole && current.hopAt! - entry.at <= BUG_RESPAWN_GUARD_MS,
          ),
      );
      if (options.length > 0) {
        const to = options[Math.floor(roll() * options.length) % options.length];
        const legs = bugRunnerLegs(current.hopAt / 1000);
        recent = [...recent, { hole: current.hole, at: current.hopAt }];
        const hopped: BugPest = {
          ...current,
          hole: to,
          hoppedFrom: current.hole,
          hopAt: null,
          endsAt: current.hopAt + legs.after,
        };
        events.push({ type: 'hop', pest: hopped, from: current.hole });
        current = hopped;
      } else {
        // Nowhere to go: it stays put for the rest of its time.
        current = { ...current, hopAt: null, endsAt: current.endsAt };
      }
    }
    if (now >= current.endsAt) {
      recent = [...recent, { hole: current.hole, at: current.endsAt }];
      const species = BUG_SPECIES_BY_ID[current.species];
      if (species.hazard) {
        events.push({ type: 'featureLeft', pest: current });
      } else {
        events.push({ type: 'escape', pest: current, chainLost: chain });
        chain = 0;
      }
      nextSpawnAt = Math.max(nextSpawnAt, now + 180);
      continue;
    }
    pests.push(current);
  }

  const shift = bugShiftAt(seconds);
  if (shift.index !== board.shift) events.push({ type: 'shift', shift });

  let next: BugBoard = {
    ...board,
    clock: now,
    pests,
    chain,
    recent,
    nextSpawnAt,
    shift: shift.index,
  };

  if (pests.length < shift.maxActive && now >= nextSpawnAt) {
    const holes = freeHoles(next, now, board.lastHole);
    if (holes.length > 0) {
      const hole = holes[Math.floor(roll() * holes.length) % holes.length];
      let species: BugSpecies;
      let rareSpawned = board.rareSpawned;
      if (board.spawned === 0) species = firstBugSpecies();
      else if (!rareSpawned && now >= board.rareAt) {
        species = BUG_SPECIES_BY_ID.rare;
        rareSpawned = true;
      } else {
        species = pickBugSpeciesForShift(roll(), shift);
        // One decoy at a time: two features at once would turn reading into guessing.
        if (species.hazard && pests.some((pest) => BUG_SPECIES_BY_ID[pest.species].hazard)) {
          species = BUG_SPECIES_BY_ID.worker;
        }
        if (species.id === 'rare') rareSpawned = true;
      }
      const legs = species.hops ? bugRunnerLegs(seconds) : null;
      const pest: BugPest = {
        token: board.nextToken,
        hole,
        species: species.id,
        bornAt: now,
        endsAt: now + (legs ? legs.before + legs.after : bugSpeciesLifetime(species, seconds)),
        tapsLeft: species.taps,
        hopAt: legs ? now + legs.before : null,
        hoppedFrom: null,
      };
      events.push({ type: 'spawn', pest });
      next = {
        ...next,
        pests: [...pests, pest],
        nextToken: board.nextToken + 1,
        spawned: board.spawned + 1,
        lastHole: hole,
        rareSpawned,
        nextSpawnAt: now + bugSpawnInterval(seconds) * shift.tempo,
      };
    }
  }

  return { board: { ...next, rng }, events };
}

/** Apply one tap on `hole` at `clock`. What is on screen is what gets hit. */
export function whackBugBoard(
  board: BugBoard,
  hole: number,
  clock: number,
): { board: BugBoard; outcome: BugWhackOutcome } {
  const now = Math.max(board.clock, clock);
  const pest = board.pests.find((candidate) => candidate.hole === hole);
  if (!pest) {
    if (recentlyVacated(board, hole, now, BUG_INPUT_GRACE_MS)) {
      return { board, outcome: { type: 'grace', hole } };
    }
    const penalty = applyBugEmptyPenalty(board.score);
    return {
      board: { ...board, score: penalty.score, chain: 0 },
      outcome: { type: 'empty', hole, lost: penalty.lost, chainLost: board.chain },
    };
  }

  const species = BUG_SPECIES_BY_ID[pest.species];
  const rest = board.pests.filter((candidate) => candidate.token !== pest.token);
  const vacated = [...board.recent, { hole, at: now }];

  if (species.hazard) {
    const next = Math.max(0, board.score - BUG_FEATURE_PENALTY);
    return {
      board: { ...board, pests: rest, recent: vacated, score: next, chain: 0 },
      outcome: { type: 'feature', pest, lost: board.score - next, chainLost: board.chain },
    };
  }

  if (pest.tapsLeft > 1) {
    // The first tap cracks the shell. A crack at the last moment still leaves time
    // for the second, so committing to an armoured pest is never wasted.
    const cracked: BugPest = {
      ...pest,
      tapsLeft: pest.tapsLeft - 1,
      endsAt: Math.max(pest.endsAt, now + 300),
    };
    return {
      board: {
        ...board,
        pests: board.pests.map((candidate) =>
          candidate.token === pest.token ? cracked : candidate,
        ),
      },
      outcome: { type: 'crack', pest: cracked },
    };
  }

  const chain = board.chain + 1;
  const multiplier = microComboMultiplier('bugSquash', chain);
  const points = bugSpeciesScore(species, chain);
  const gap = bugSpawnInterval(now / 1000) * bugShiftAt(now / 1000).tempo;
  return {
    board: {
      ...board,
      pests: rest,
      recent: vacated,
      chain,
      score: board.score + points,
      nextSpawnAt: Math.max(now + 220, Math.min(board.nextSpawnAt, now + gap * 0.6)),
    },
    outcome: { type: 'hit', pest, points, chain, multiplier },
  };
}

/** The board's pest on `hole`, if any. */
export function bugAt(board: BugBoard, hole: number): BugPest | undefined {
  return board.pests.find((pest) => pest.hole === hole);
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

/**
 * The SHAPE of the wiring, which is what actually makes one desk different from
 * another.
 *
 * Every board used to be a single cycle laid out on an ellipse, so the solution was
 * always "put the plugs in order around the ring". Eight ellipse proportions and a
 * mirror flag made forty boards that were all the same puzzle: once a player learned
 * the procedure, no later desk ever asked a new question.
 *
 * Each topology below needs a different realisation instead:
 *
 *   cycle     one loop. Solved on the perimeter, in order. The original.
 *   wheel     a hub wired to every plug on the rim. The insight is that ONE plug
 *             belongs in the middle — nowhere on the ring works.
 *   bi-loop   two independent loops. The insight is that they must be pulled apart
 *             from each other, not interleaved.
 *   chorded   a loop with shortcut cables across it. The insight is that a shortcut
 *             constrains which rotation of the ring is legal.
 */
export type CableTopology = 'cycle' | 'wheel' | 'bi-loop' | 'chorded';

export interface CablePuzzle {
  points: CablePoint[];
  edges: CableEdge[];
  /** Authored, crossing-free matching-port locations. */
  solution: CablePoint[];
  difficulty: CableDifficulty;
  topology: CableTopology;
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

/**
 * Count every visible cable conflict and overlapping pair of plugs.
 *
 * Exactly the length of `cableConflictMap`, which draws each one: the number on the
 * desk and the marks on the desk come from one list, so they cannot disagree.
 */
export function countCableConflicts(
  edges: readonly CableEdge[],
  pos: Record<number, { x: number; y: number }>,
): number {
  return cableConflictMap(edges, pos).length;
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
  topology: CableTopology;
  difficulty: CableDifficulty;
  /** Placing node `id` at `slots[id]` is conflict-free. Proven for the whole
   *  catalogue by the "every authored desk is solvable" test. */
  slots: readonly { x: number; y: number }[];
  edges: readonly CableEdge[];
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

/** Extra cables mean more to reason about, so they cost a difficulty step. */
function cableDifficulty(nodeCount: number, topology: CableTopology): CableDifficulty {
  const bySize = nodeCount <= 5 ? 0 : nodeCount <= 7 ? 1 : 2;
  // bi-loop splits the desk into two SMALL loops, which is no harder than one big
  // one; wheel and chorded add cables on top of the ring.
  const byShape = topology === 'cycle' || topology === 'bi-loop' ? 0 : 1;
  return (['easy', 'medium', 'hard'] as const)[Math.min(2, bySize + byShape)];
}

/** `count` points spread evenly around an ellipse, in angular order. */
function ellipseSlots(
  count: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  phase: number,
): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = phase + (index * Math.PI * 2) / count;
    return {
      x: roundCableCoordinate(centerX + Math.cos(angle) * radiusX),
      y: roundCableCoordinate(centerY + Math.sin(angle) * radiusY),
    };
  });
}

function buildCableSlots(
  nodeCount: number,
  profile: CableLayoutProfile,
): readonly { x: number; y: number }[] {
  return ellipseSlots(
    nodeCount,
    profile.centerX,
    profile.centerY,
    profile.radiusX,
    profile.radiusY,
    profile.phase * Math.PI,
  );
}

/** Closed loop over a contiguous run of ids starting at `from`. */
function ringEdges(from: number, count: number): CableEdge[] {
  return Array.from({ length: count }, (_, index) => ({
    a: from + index,
    b: from + ((index + 1) % count),
  }));
}

function cableEdges(nodeCount: number): CableEdge[] {
  return ringEdges(0, nodeCount);
}

/**
 * Shortcut cables for a chorded ring, chosen so the perimeter placement stays a
 * valid solution.
 *
 * Two chords cross only if their endpoints interleave around the ring, so these are
 * kept on disjoint arcs (or sharing an endpoint, which is never counted as a
 * crossing). A chord skipping one node cannot pass through the node it skips either,
 * because the slots sit on a strictly convex ellipse.
 */
function chordEdges(nodeCount: number): CableEdge[] {
  const chords: CableEdge[] = [{ a: 0, b: 2 }];
  if (nodeCount >= 6) chords.push({ a: 3, b: 5 });
  if (nodeCount >= 8) chords.push({ a: 5, b: 7 });
  return chords;
}

/** Build one authored desk: its slot positions and its cabling. */
function buildCableLayout(
  nodeCount: number,
  topology: CableTopology,
  profile: CableLayoutProfile,
): { slots: readonly { x: number; y: number }[]; edges: readonly CableEdge[] } | null {
  if (topology === 'cycle') {
    return { slots: buildCableSlots(nodeCount, profile), edges: cableEdges(nodeCount) };
  }

  if (topology === 'chorded') {
    return {
      slots: buildCableSlots(nodeCount, profile),
      edges: [...cableEdges(nodeCount), ...chordEdges(nodeCount)],
    };
  }

  if (topology === 'wheel') {
    // Rim ids 0..n-2 around the ellipse, hub id n-1 at the centre. A spoke from the
    // centre to a rim vertex only touches the perimeter at its own endpoint, so no
    // spoke crosses a rim cable and no rim plug sits on a spoke.
    const rim = nodeCount - 1;
    if (rim < 4) return null;
    const hub = nodeCount - 1;
    const slots = [
      ...buildCableSlots(rim, profile),
      { x: roundCableCoordinate(profile.centerX), y: roundCableCoordinate(profile.centerY) },
    ];
    const spokes = Array.from({ length: rim }, (_, index) => ({ a: hub, b: index }));
    return { slots, edges: [...ringEdges(0, rim), ...spokes] };
  }

  // bi-loop: two loops on side-by-side ellipses whose bounding boxes do not overlap,
  // so nothing in one loop can reach anything in the other. Each loop needs three
  // plugs to be a loop rather than a doubled cable, hence six nodes minimum.
  const sizeA = Math.ceil(nodeCount / 2);
  const sizeB = nodeCount - sizeA;
  if (sizeA < 3 || sizeB < 3) return null;
  const radiusX = 0.15;
  const radiusY = Math.max(0.14, profile.radiusY * 0.5);
  const phase = profile.phase * Math.PI;
  return {
    slots: [
      ...ellipseSlots(sizeA, 0.28, profile.centerY, radiusX, radiusY, phase),
      ...ellipseSlots(sizeB, 0.72, profile.centerY, radiusX, radiusY, phase + Math.PI / 3),
    ],
    edges: [...ringEdges(0, sizeA), ...ringEdges(sizeA, sizeB)],
  };
}

const CABLE_TOPOLOGIES: readonly CableTopology[] = ['cycle', 'wheel', 'bi-loop', 'chorded'];

/** How many ellipse variants each topology gets. The ring keeps all eight it had. */
const PROFILES_PER_TOPOLOGY: Readonly<Record<CableTopology, number>> = {
  cycle: 8,
  wheel: 4,
  'bi-loop': 4,
  chorded: 4,
};

const CABLE_LAYOUTS: readonly CableLayout[] = Array.from(
  { length: 5 },
  (_, index) => index + 5,
).flatMap((nodeCount) =>
  CABLE_TOPOLOGIES.flatMap((topology) =>
    CABLE_LAYOUT_PROFILES.slice(0, PROFILES_PER_TOPOLOGY[topology]).flatMap((profile) => {
      const built = buildCableLayout(nodeCount, topology, profile);
      if (!built) return [];
      return [
        {
          id: `${nodeCount}-${topology}-${profile.id}`,
          nodeCount,
          topology,
          difficulty: cableDifficulty(nodeCount, topology),
          slots: built.slots,
          edges: built.edges,
        },
      ];
    }),
  ),
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

/** Pick a readable tangle near the target crossing count, never a lucky clear board. */
function cableTangleOrder(
  seedStr: string,
  layout: CableLayout,
  slots: readonly { x: number; y: number }[],
): readonly number[] {
  const random = cableRng(hashStringToSeed(`cable-tangle:${seedStr}:${layout.id}`));
  // The desk's OWN cabling, not an assumed ring: a wheel or a pair of loops tangles
  // differently, and scoring a candidate against the wrong graph would hand out
  // boards that are already clear.
  const edges = layout.edges as CableEdge[];
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
  const forSize = CABLE_LAYOUTS.filter((layout) => layout.nodeCount === n);
  const recent = new Set(recentLevelIds);

  /* Pick the SHAPE first, and prefer one the player has not just seen.
     Selecting a layout directly would let the ring dominate purely because it has
     twice as many ellipse variants — the player would mostly get the same puzzle
     again with different proportions, which is the problem topologies exist to fix.
     Choosing the topology explicitly means consecutive desks ask different
     questions. */
  /* One properly mixed stream, two draws — the way every other seeded system here
     works (dailyChallenges and engine both feed hashStringToSeed into a PRNG rather
     than using it directly). Two raw `hash(prefix + seed) % n` draws are NOT
     independent: across the seeds `variety-0..63` the topology landed a perfect
     16/16/16/16 while every shape stayed pinned to one ellipse variant, because the
     inputs differ only in a prefix and a trailing digit. */
  const pick = cableRng(hashStringToSeed(`cable-pick:${seedStr}:${n}`));

  const topologies = [...new Set(forSize.map((layout) => layout.topology))];
  const recentTopologies = new Set(
    forSize.filter((layout) => recent.has(layout.id)).map((layout) => layout.topology),
  );
  const freshTopologies = topologies.filter((topology) => !recentTopologies.has(topology));
  const topologyPool = freshTopologies.length > 0 ? freshTopologies : topologies;
  const topology = topologyPool[Math.floor(pick() * topologyPool.length) % topologyPool.length];

  const candidates = forSize.filter((layout) => layout.topology === topology);
  const available = candidates.filter((layout) => !recent.has(layout.id));
  const pool = available.length > 0 ? available : candidates;
  const level = pool[Math.floor(pick() * pool.length) % pool.length];
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
    edges: level.edges.map((edge) => ({ ...edge })),
    solution,
    difficulty: level.difficulty,
    topology: level.topology,
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

/**
 * Reward for clearing a board; bigger tangles are worth more, and a shape with extra
 * cables is worth more than a plain ring of the same size. Topology is optional so
 * the size-only reading stays valid for callers that only know the node count.
 */
export function cableSolveScore(nodeCount: number, topology: CableTopology = 'cycle'): number {
  const base = 3 + Math.max(0, nodeCount - 4);
  const bonus =
    topology === 'wheel' ? 3 : topology === 'chorded' ? 2 : topology === 'bi-loop' ? 1 : 0;
  return base + bonus;
}

/** Topologies authored for a board size, for diagnostics and variety checks. */
export function cableTopologies(nodeCount: number): readonly CableTopology[] {
  const n = Math.max(5, Math.min(9, nodeCount));
  return [
    ...new Set(CABLE_LAYOUTS.filter((entry) => entry.nodeCount === n).map((e) => e.topology)),
  ];
}

/** The authored cabling for a level id, in node-id space. Mirrors `cableLevelSlots`. */
export function cableLevelEdges(levelId: string): readonly CableEdge[] {
  const level = CABLE_LAYOUTS.find((entry) => entry.id === levelId);
  return level ? level.edges : [];
}

/* --- the conflict map ---------------------------------------------------------
 * The desk used to say "Tangles: 3" and leave the player to find them. The map
 * below names every conflict the counter counts, with a place to draw it:
 *
 *   crossing  two cables cross — a knot at the crossing point
 *   touch     a plug sits on someone else's cable — that plug is in the way
 *   overlap   two cables run along each other — a mark on the shared stretch
 *   crowded   two plugs are stacked — a mark between them
 *
 * `countCableConflicts` IS the length of this list, so the number on the desk and
 * the marks on the desk cannot disagree.
 * ------------------------------------------------------------------------- */

export type CableConflictKind = 'crossing' | 'touch' | 'overlap' | 'crowded';

export interface CableConflict {
  kind: CableConflictKind;
  /** Where to draw it, in board space (0..1). */
  x: number;
  y: number;
  /** Indices into the desk's edge list. */
  edges: number[];
  /** Plugs that are part of the problem (in the way, or stacked). */
  plugs: number[];
}

function crossingPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): { x: number; y: number } {
  const denominator = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(denominator) < 1e-12) return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / denominator;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

export function cableConflictMap(
  edges: readonly CableEdge[],
  pos: Record<number, { x: number; y: number }>,
): CableConflict[] {
  const conflicts: CableConflict[] = [];
  /* A plug resting on someone else's cable is ONE problem, however many of its own
     cables meet that cable there: moving the plug fixes all of them. Counting it once
     per pair of cables made a desk read "3" with two knots on screen. */
  const resting = new Map<string, CableConflict>();
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
        if (overlap) {
          // The two cables share the stretch from their common plug to the nearer end.
          const nearer =
            Math.hypot(first.x - centre.x, first.y - centre.y) <=
            Math.hypot(second.x - centre.x, second.y - centre.y)
              ? first
              : second;
          conflicts.push({
            kind: 'overlap',
            x: (centre.x + nearer.x) / 2,
            y: (centre.y + nearer.y) / 2,
            edges: [i, j],
            plugs: [shared],
          });
        }
        continue;
      }
      const p1 = pos[e1.a];
      const p2 = pos[e1.b];
      const p3 = pos[e2.a];
      const p4 = pos[e2.b];
      if (!cableSegmentsConflict(p1, p2, p3, p4)) continue;
      if (segmentsCross(p1, p2, p3, p4)) {
        const at = crossingPoint(p1, p2, p3, p4);
        conflicts.push({ kind: 'crossing', x: at.x, y: at.y, edges: [i, j], plugs: [] });
        continue;
      }
      // Not a clean X: an end of one cable lies on the other.
      const touching = [
        pointOnSegment(p1, p3, p4) ? e1.a : null,
        pointOnSegment(p2, p3, p4) ? e1.b : null,
        pointOnSegment(p3, p1, p2) ? e2.a : null,
        pointOnSegment(p4, p1, p2) ? e2.b : null,
      ].filter((id): id is number => id !== null);
      const plugs = [...new Set(touching)];
      if (plugs.length === 1) {
        const plug = plugs[0];
        // The cable it rests on is the one of the pair that is not its own.
        const foreign = e1.a === plug || e1.b === plug ? j : i;
        const key = `${plug}:${foreign}`;
        const known = resting.get(key);
        if (known) {
          for (const edge of [i, j]) if (!known.edges.includes(edge)) known.edges.push(edge);
          continue;
        }
        const conflict: CableConflict = {
          kind: 'touch',
          x: pos[plug].x,
          y: pos[plug].y,
          edges: [i, j],
          plugs: [plug],
        };
        resting.set(key, conflict);
        conflicts.push(conflict);
        continue;
      }
      conflicts.push({
        kind: 'overlap',
        x: plugs.reduce((sum, id) => sum + pos[id].x, 0) / plugs.length,
        y: plugs.reduce((sum, id) => sum + pos[id].y, 0) / plugs.length,
        edges: [i, j],
        plugs,
      });
    }
  }

  const ids = Object.keys(pos).map(Number);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = pos[ids[i]];
      const b = pos[ids[j]];
      if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_PLUG_DISTANCE) {
        conflicts.push({
          kind: 'crowded',
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          edges: [],
          plugs: [ids[i], ids[j]],
        });
      }
    }
  }
  return conflicts;
}

/** Plugs that are themselves in the way: on another cable, or stacked on a plug. */
export function cableObstructingPlugs(conflicts: readonly CableConflict[]): Set<number> {
  const out = new Set<number>();
  for (const conflict of conflicts) {
    if (conflict.kind === 'crossing') continue;
    for (const plug of conflict.plugs) out.add(plug);
  }
  return out;
}

/** Cables taking part in at least one conflict. */
export function cableKnottedEdges(conflicts: readonly CableConflict[]): Set<number> {
  const out = new Set<number>();
  for (const conflict of conflicts) for (const edge of conflict.edges) out.add(edge);
  return out;
}

/**
 * A desk cleared inside its par time earns a speed bonus on top of its score. Par
 * grows with the plugs, so a nine-plug desk is not held to a five-plug pace.
 */
export function cableParSeconds(nodeCount: number): number {
  const n = Math.max(5, Math.min(9, nodeCount));
  return Math.round(2.2 * n * 10) / 10;
}

export function cableSpeedBonus(nodeCount: number, seconds: number): number {
  const n = Math.max(5, Math.min(9, nodeCount));
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return seconds <= cableParSeconds(n) ? Math.ceil(n / 3) : 0;
}
