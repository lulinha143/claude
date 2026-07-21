import { useEffect, useRef } from 'react';
import {
  createPausableTimer,
  defaultTimerClock,
  type PausableTimer,
  type TimerClock,
} from '../sim/pausableTimer';

/**
 * Fire `callback` once, `delayMs` of *unpaused* time after `active` becomes
 * true. While `paused` is true the countdown freezes and can never fire, and
 * because the underlying timer measures elapsed unpaused time (rather than
 * restarting a fixed delay on every resume) it always converges to firing even
 * under a storm of pause/resume — the failure mode that used to strand the
 * micro-games between rounds. When `active` returns to false the countdown is
 * cancelled and fully reset for its next activation.
 */
export function usePausableTimeout(
  active: boolean,
  paused: boolean,
  delayMs: number,
  callback: () => void,
  clock: TimerClock = defaultTimerClock,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<PausableTimer | null>(null);

  useEffect(() => {
    if (!active) {
      timerRef.current?.cancel();
      timerRef.current = null;
      return;
    }
    if (!timerRef.current) {
      timerRef.current = createPausableTimer(delayMs, () => callbackRef.current(), clock);
    }
    timerRef.current.sync(paused);
  }, [active, paused, delayMs, clock]);

  useEffect(
    () => () => {
      timerRef.current?.cancel();
      timerRef.current = null;
    },
    [],
  );
}
