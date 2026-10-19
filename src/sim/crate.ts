import { BALANCE } from './config';

// The founder's crate: where production becomes something the player collects.
//
// Half of what the company makes goes straight to the vault, so the nut counter
// always climbs on its own. The team packs the other half into the crate. It
// waits there, up to `capacity`, until the player taps the crate to collect it:
// playing regularly gets every nut the company makes.
//
// A full crate takes no more. Its share then still reaches the vault at
// `crateOverflowRate`: never below the offline efficiency, so a game left open
// and ignored earns at least what a closed one would, and automation raises it
// until nothing at all waits on the player.
//
// Away time (the game was closed, or the computer slept) settles the same way
// except that everything that does not fit in the crate banks at the offline
// efficiency. Either way the crate is full and waiting when the player returns.

/** Nuts per second packed into the crate, out of total production. */
export function crateFillRate(productionPerSecond: number): number {
  return Math.max(0, productionPerSecond) * BALANCE.crate.share;
}

/** What a full crate holds: `capacityMinutes` of packing at the current pace. */
export function crateCapacity(productionPerSecond: number): number {
  return Math.max(
    BALANCE.crate.minCapacity,
    crateFillRate(productionPerSecond) * BALANCE.crate.capacityMinutes * 60,
  );
}

/**
 * The share of the crate's portion that still banks while the crate is full.
 * With no automation, exactly enough that open play matches offline efficiency;
 * full automation lets all of it through.
 */
export function crateOverflowRate(autoRate: number): number {
  const share = BALANCE.crate.share;
  const floor = Math.max(0, Math.min(1, (BALANCE.offline.efficiency - (1 - share)) / share));
  const automation = Math.max(0, Math.min(1, autoRate));
  return floor + (1 - floor) * automation;
}

export interface ProductionSplit {
  /** nuts that go straight to the vault. */
  banked: number;
  /** nuts packed into the crate. */
  packed: number;
}

/** Where `produced` nuts go while the game runs. */
export function splitProduction(
  crateNuts: number,
  capacity: number,
  produced: number,
  autoRate: number,
): ProductionSplit {
  if (!(produced > 0)) return { banked: 0, packed: 0 };
  const share = produced * BALANCE.crate.share;
  const packed = Math.min(Math.max(0, capacity - crateNuts), share);
  const overflow = share - packed;
  return { banked: produced - share + overflow * crateOverflowRate(autoRate), packed };
}

/** Where `produced` nuts go while the player was away. */
export function splitAway(crateNuts: number, capacity: number, produced: number): ProductionSplit {
  if (!(produced > 0)) return { banked: 0, packed: 0 };
  const packed = Math.min(Math.max(0, capacity - crateNuts), produced * BALANCE.crate.share);
  return { banked: (produced - packed) * BALANCE.offline.efficiency, packed };
}

/** How full the crate is, 0..1. */
export function crateFill(crateNuts: number, capacity: number): number {
  return capacity > 0 ? Math.max(0, Math.min(1, crateNuts / capacity)) : 0;
}

/** Seconds until the crate is full at the current pace (0 when full, null when idle). */
export function secondsToFull(
  crateNuts: number,
  capacity: number,
  productionPerSecond: number,
): number | null {
  const rate = crateFillRate(productionPerSecond);
  if (crateNuts >= capacity) return 0;
  if (rate <= 0) return null;
  return (capacity - crateNuts) / rate;
}
