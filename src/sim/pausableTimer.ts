// A countdown that only advances while it is NOT paused, fires its callback
// exactly once, and can never be starved by rapid pause/resume (blur/focus)
// cycles. This is the backbone of the micro-game round transitions: the older
// implementation restarted a fixed setTimeout on every resume, so a window that
// repeatedly blurred/focused during the "cleared" celebration could reset the
// countdown forever and leave the game permanently stuck between puzzles.
//
// The logic here is deliberately pure and clock-injectable so the exact race
// (pause storm during a transition) can be reproduced deterministically in a
// unit test without a real browser or real timers.

export interface TimerClock {
  now: () => number;
  setTimeout: (cb: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}

export const defaultTimerClock: TimerClock = {
  now: () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now(),
  setTimeout: (cb, ms) => setTimeout(cb, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
};

export interface PausableTimer {
  /**
   * Reconcile the timer with the current paused state. Safe to call as often
   * as you like (e.g. on every render or every pause toggle); it is idempotent
   * for a given state and always keeps the countdown moving while unpaused.
   */
  sync: (paused: boolean) => void;
  /** Cancel without firing. */
  cancel: () => void;
  /** Remaining unpaused milliseconds before the callback fires. */
  remaining: () => number;
  /** Whether the callback has already fired. */
  hasFired: () => boolean;
}

/**
 * Create a pausable countdown. It requires `delayMs` of cumulative *unpaused*
 * wall-clock time to elapse, then invokes `callback` a single time. While
 * paused no real timer is pending and no time is counted, so the callback can
 * never fire during a pause. Because progress is measured from an absolute
 * clock rather than by restarting a fixed delay, any sequence of pause/resume
 * calls still converges to firing after `delayMs` of unpaused time.
 */
export function createPausableTimer(
  delayMs: number,
  callback: () => void,
  clock: TimerClock = defaultTimerClock,
): PausableTimer {
  let remainingMs = Math.max(0, delayMs);
  let runningSince: number | null = null; // clock time when the current unpaused run started
  let handle: number | null = null;
  let fired = false;
  let cancelled = false;

  const clearHandle = () => {
    if (handle !== null) {
      clock.clearTimeout(handle);
      handle = null;
    }
  };

  // Fold the time spent in the current unpaused run into `remainingMs`.
  const settleElapsed = () => {
    if (runningSince === null) return;
    const elapsed = clock.now() - runningSince;
    remainingMs = Math.max(0, remainingMs - Math.max(0, elapsed));
    runningSince = null;
  };

  const fire = () => {
    if (fired || cancelled) return;
    fired = true;
    handle = null;
    runningSince = null;
    remainingMs = 0;
    callback();
  };

  const timer: PausableTimer = {
    sync(paused: boolean) {
      if (fired || cancelled) return;
      if (paused) {
        // Freeze: bank the unpaused progress and drop any pending real timer.
        clearHandle();
        settleElapsed();
        return;
      }
      // Running. If already scheduled, leave it be (idempotent).
      if (runningSince !== null && handle !== null) return;
      if (remainingMs <= 0) {
        fire();
        return;
      }
      runningSince = clock.now();
      handle = clock.setTimeout(fire, remainingMs);
    },
    cancel() {
      if (fired) return;
      cancelled = true;
      clearHandle();
      runningSince = null;
    },
    remaining() {
      if (fired) return 0;
      if (runningSince === null) return remainingMs;
      const elapsed = clock.now() - runningSince;
      return Math.max(0, remainingMs - Math.max(0, elapsed));
    },
    hasFired() {
      return fired;
    },
  };

  return timer;
}
