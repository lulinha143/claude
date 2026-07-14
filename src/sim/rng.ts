// Deterministic, seedable pseudo-random number generator (mulberry32).
// Used everywhere randomness must be reproducible: unit tests, daily
// challenges (date-seeded), and the developer "deterministic seed" toggle.
// We never use Math.random() directly in the simulation layer.

export interface Rng {
  next(): number; // [0, 1)
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  fork(salt: number): Rng;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9; // avoid the degenerate all-zero state

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int(minInclusive, maxExclusive) {
      return Math.floor(next() * (maxExclusive - minInclusive)) + minInclusive;
    },
    pick(items) {
      if (items.length === 0) throw new Error('createRng.pick: empty array');
      return items[Math.floor(next() * items.length)];
    },
    chance(probability) {
      return next() < probability;
    },
    fork(salt) {
      return createRng((seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0);
    },
  };
  return rng;
}

// Turn an arbitrary string (e.g. a date "2026-07-14") into a 32-bit seed.
export function hashStringToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
