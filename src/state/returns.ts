import { BALANCE } from '../sim/config';
import type { OfflineResult } from '../sim/offline';
import type { GameState } from '../sim/types';

// The welcome back, as bookkeeping. A "return" is the player coming back after
// the office was out of their sight: the game was closed, the computer slept, or
// the window was minimized/hidden. Everything it reports is measured — what the
// vault and the crate actually gained between leaving and coming back, and which
// stretch of it was settled at the away rules — never estimated or invented.

/** Kept from the moment the player left until they are back. */
export interface ReturnTally {
  /** epoch ms the player left (the save, for a closed game). */
  since: number;
  /** lifetime nuts banked, and the crate, when they left. */
  earned: number;
  crate: number;
  /** seconds settled at the away rules meanwhile, how many of them counted, whether the cap bit. */
  offlineSeconds: number;
  countedSeconds: number;
  capped: boolean;
  /** the game was closed (boot), or the computer slept with it open. */
  closed: boolean;
  asleep: boolean;
}

/** What the welcome-back note says. */
export interface ReturnSummary {
  id: number;
  since: number;
  /** wall-clock seconds the office was out of sight. */
  awaySeconds: number;
  /** nuts banked in the vault meanwhile, and packed into the crate. */
  banked: number;
  packed: number;
  offlineSeconds: number;
  countedSeconds: number;
  capped: boolean;
  /** how the time passed: closed, asleep (open, computer asleep) or open (minimized/hidden). */
  mode: 'closed' | 'asleep' | 'open';
}

/** The player leaves now (or left at `at`, for a save). */
export function leaveTally(state: GameState, at: number): ReturnTally {
  return {
    since: at,
    earned: state.stats.totalNutsEarned,
    crate: state.crate?.nuts ?? 0,
    offlineSeconds: 0,
    countedSeconds: 0,
    capped: false,
    closed: false,
    asleep: false,
  };
}

/** An away settlement joins the stretch the player was gone. */
export function addAway(
  tally: ReturnTally,
  result: OfflineResult,
  how: 'closed' | 'asleep',
): ReturnTally {
  if (result.ignored) return tally;
  return {
    ...tally,
    offlineSeconds: tally.offlineSeconds + result.seconds,
    countedSeconds: tally.countedSeconds + result.cappedSeconds,
    capped: tally.capped || result.wasCapped,
    closed: tally.closed || how === 'closed',
    asleep: tally.asleep || how === 'asleep',
  };
}

/**
 * The computer slept with the office in view: that sleep is a return of its own,
 * measured from just before it (what the settlement added is taken back out).
 */
export function tallyFromAway(state: GameState, result: OfflineResult, now: number): ReturnTally {
  const left: ReturnTally = {
    ...leaveTally(state, now - result.seconds * 1000),
    earned: state.stats.totalNutsEarned - result.nutsEarned,
    crate: (state.crate?.nuts ?? 0) - (result.crateFilled ?? 0),
  };
  return addAway(left, result, 'asleep');
}

/**
 * What to tell the player now that they are back, or null when it is not worth
 * a note: a short absence (a quick alt-tab, a reload) banks silently.
 */
export function summarizeReturn(
  tally: ReturnTally,
  state: GameState,
  now: number,
  id: number,
  minSeconds: number = BALANCE.offline.minModalSeconds,
): ReturnSummary | null {
  const awaySeconds = Math.max(0, (now - tally.since) / 1000);
  const banked = Math.max(0, state.stats.totalNutsEarned - tally.earned);
  const packed = Math.max(0, (state.crate?.nuts ?? 0) - tally.crate);
  if (!(awaySeconds >= minSeconds) || banked + packed < 1) return null;
  return {
    id,
    since: tally.since,
    awaySeconds,
    banked,
    packed,
    offlineSeconds: tally.offlineSeconds,
    countedSeconds: tally.countedSeconds,
    capped: tally.capped,
    mode: tally.closed ? 'closed' : tally.asleep ? 'asleep' : 'open',
  };
}
