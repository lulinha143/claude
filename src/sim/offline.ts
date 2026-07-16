import { BALANCE } from './config';
import { computeProduction, offlineCapHours } from './economy';
import type { GameState } from './types';

export interface OfflineResult {
  seconds: number;
  cappedSeconds: number;
  nutsEarned: number;
  ratePerSecond: number;
  wasCapped: boolean;
  ignored: boolean; // true when the elapsed time was invalid and skipped
}

/**
 * Compute offline earnings between `lastSaved` and `now`. Robust against:
 *  - negative deltas (clock moved backwards / timezone change) -> ignored
 *  - absurdly large deltas (corrupted timestamp) -> ignored
 *  - the per-save offline cap (default 8h, upgradeable to 24h)
 * This function is pure and does NOT mutate state; the caller applies the nuts.
 */
export function computeOffline(state: GameState, now: number): OfflineResult {
  const rate = computeProduction(state, false).nutsPerSecond;
  const elapsedMs = now - state.lastSaved;
  const elapsed = elapsedMs / 1000;

  const MAX_PLAUSIBLE = 60 * 60 * 24 * 60; // 60 days; anything more is corruption
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > MAX_PLAUSIBLE) {
    return {
      seconds: Math.max(0, elapsed),
      cappedSeconds: 0,
      nutsEarned: 0,
      ratePerSecond: rate,
      wasCapped: false,
      ignored: true,
    };
  }

  const capSeconds = offlineCapHours(state) * 3600;
  const capped = Math.min(elapsed, capSeconds);
  const nutsEarned = rate * capped * BALANCE.offline.efficiency;

  return {
    seconds: elapsed,
    cappedSeconds: capped,
    nutsEarned,
    ratePerSecond: rate,
    wasCapped: elapsed > capSeconds,
    ignored: false,
  };
}

export function applyOffline(state: GameState, result: OfflineResult): void {
  if (result.ignored || result.nutsEarned <= 0) return;
  state.resources.nuts += result.nutsEarned;
  state.stats.totalNutsEarned += result.nutsEarned;
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
  return result.nutsEarned > 0 && result.seconds >= minSeconds;
}
