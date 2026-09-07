// Central, tunable balance configuration. Designers should be able to reshape
// the whole economy from this one file. Formulas live in economy.ts and read
// from here.

export const SAVE_VERSION = 8;

export const BALANCE = {
  /** starting nuts for a brand new company. */
  startingNuts: 0,
  /** base nuts granted per manual click before click upgrades. */
  baseClickPower: 1,
  /** nuts produced per second by the founder before any employees/upgrades. */
  baseProductionPerSecond: 0.5,

  morale: {
    start: 70,
    min: 0,
    baseCap: 100,
    /** morale drifts toward this equilibrium each second. */
    driftPerSecond: 0.4,
    /** production multiplier at 0 morale and at full morale. */
    minMultiplier: 0.6,
    maxMultiplier: 1.25,
  },

  reputation: {
    start: 0,
    /** passive reputation gained per second from company size. */
    baseRatePerSecond: 0.02,
  },

  /** how a crate's worth scales; crates hold this many seconds of production. */
  crate: {
    secondsOfProduction: 8,
    /** minimum nuts a crate is worth so early clicks feel good. */
    minValue: 1,
  },

  offline: {
    defaultCapHours: 8,
    maxCapHours: 24,
    /** offline production efficiency vs. active play. */
    efficiency: 0.6,
    /** minimum real absence (seconds) before the welcome-back modal is shown;
     *  shorter absences still bank their nuts silently (no interruption). */
    minModalSeconds: 120,
  },

  prestige: {
    /** you can prestige once lifetime nuts crosses this. */
    unlockAtTotalNuts: 1_000_000,
    /** kernels = floor((totalNuts / divisor) ^ exponent). */
    kernelDivisor: 1_000_000,
    kernelExponent: 0.5,
    /** each permanent kernel adds this to the global multiplier. */
    kernelGlobalBonus: 0.02,
  },

  focus: {
    /** production multiplier during a focus session. */
    productionMultiplier: 1.25,
    /** golden nuts rewarded per completed 25-minute-equivalent. */
    goldenPer25Min: 1,
    presetMinutes: [15, 25, 45, 60] as const,
  },

  /** how often (seconds) the engine attempts to roll a random event. */
  eventRollIntervalSeconds: 45,
  /** base probability per roll (modified by reputation and passives). */
  eventBaseChance: 0.35,

  /** autosave cadence in seconds (never every frame). */
  autosaveIntervalSeconds: 20,

  /** simulation tick granularity used when catching up large deltas. */
  maxTickSeconds: 0.5,
} as const;

/** Geometric cost of the Nth level of something with a base and multiplier. */
export function geometricCost(base: number, mult: number, ownedLevels: number): number {
  return Math.ceil(base * Math.pow(mult, ownedLevels));
}
