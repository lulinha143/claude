import { BALANCE } from './config';
import { crateCapacity, splitAway } from './crate';
import { computeProduction, offlineCapHours } from './economy';
import type { GameState } from './types';

export interface OfflineResult {
  seconds: number;
  cappedSeconds: number;
  nutsEarned: number;
  ratePerSecond: number;
  wasCapped: boolean;
  ignored: boolean; // true when the elapsed time was invalid and skipped
  /** nuts the team packed into the crate meanwhile (collected by the player). */
  crateFilled?: number;
}

/**
 * Compute offline earnings between `lastSaved` and `now`. Robust against:
 *  - negative deltas (clock moved backwards / timezone change) -> ignored
 *  - absurdly large deltas (corrupted timestamp) -> ignored
 *  - the per-save offline cap (default 8h, upgradeable to 24h)
 * This function is pure and does NOT mutate state; the caller applies the nuts.
 */
export function computeOffline(state: GameState, now: number): OfflineResult {
  return computeAway(state, (now - state.lastSaved) / 1000);
}

/**
 * Settle `elapsed` seconds the company ran unattended: the game was closed, or
 * the computer slept with it open. Production runs at the current rate up to the
 * offline cap; the crate fills first (see `sim/crate.ts`) and the rest banks at
 * the offline efficiency. Nothing is invented for time beyond the cap.
 */
export function computeAway(state: GameState, elapsed: number): OfflineResult {
  const rate = computeProduction(state, false).nutsPerSecond;

  const MAX_PLAUSIBLE = 60 * 60 * 24 * 60; // 60 days; anything more is corruption
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > MAX_PLAUSIBLE) {
    return {
      seconds: Math.max(0, Number.isFinite(elapsed) ? elapsed : 0),
      cappedSeconds: 0,
      nutsEarned: 0,
      ratePerSecond: rate,
      wasCapped: false,
      ignored: true,
      crateFilled: 0,
    };
  }

  const capSeconds = offlineCapHours(state) * 3600;
  const capped = Math.min(elapsed, capSeconds);
  const split = splitAway(state.crate?.nuts ?? 0, crateCapacity(rate), rate * capped);

  return {
    seconds: elapsed,
    cappedSeconds: capped,
    nutsEarned: split.banked,
    ratePerSecond: rate,
    wasCapped: elapsed > capSeconds,
    ignored: false,
    crateFilled: split.packed,
  };
}

export function applyOffline(state: GameState, result: OfflineResult): void {
  if (result.ignored) return;
  if (result.nutsEarned > 0) {
    state.resources.nuts += result.nutsEarned;
    state.stats.totalNutsEarned += result.nutsEarned;
  }
  // Packed nuts count as earned when the player collects them, not before.
  if ((result.crateFilled ?? 0) > 0) {
    state.crate ??= { nuts: 0 };
    state.crate.nuts += result.crateFilled ?? 0;
  }
}

/**
 * Whether the "While You Were Away" modal is worth interrupting the player with.
 * Trivial absences (a quick reload, alt-tab, or the dev preview) still bank their
 * nuts via applyOffline, but should NOT pop a modal. Defaults to a 2-minute floor.
 */
export function shouldShowOfflineModal(
  result: OfflineResult | null,
  minSeconds: number = BALANCE.offline.minModalSeconds,
): boolean {
  if (!result || result.ignored) return false;
  return result.nutsEarned + (result.crateFilled ?? 0) > 0 && result.seconds >= minSeconds;
}
