import { describe, it, expect } from 'vitest';
import { createPausableTimer, type TimerClock } from '../src/sim/pausableTimer';

// A deterministic fake clock that models real setTimeout ordering against an
// injectable "now", so we can reproduce the exact pause/resume races that used
// to strand the cable game between rounds — without real timers.
function makeClock() {
  let time = 0;
  let nextId = 1;
  const timers = new Map<number, { fireAt: number; cb: () => void }>();
  const clock: TimerClock = {
    now: () => time,
    setTimeout: (cb, ms) => {
      const id = nextId++;
      timers.set(id, { fireAt: time + Math.max(0, ms), cb });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
  };
  function advance(ms: number) {
    const target = time + ms;
    for (;;) {
      let due: { id: number; fireAt: number; cb: () => void } | null = null;
      for (const [id, t] of timers) {
        if (t.fireAt <= target && (due === null || t.fireAt < due.fireAt)) {
          due = { id, ...t };
        }
      }
      if (!due) break;
      time = due.fireAt;
      timers.delete(due.id);
      due.cb();
    }
    time = target;
  }
  return { clock, advance };
}

describe('createPausableTimer', () => {
  it('fires exactly once after the full delay when never paused', () => {
    const { clock, advance } = makeClock();
    let fired = 0;
    const timer = createPausableTimer(1000, () => (fired += 1), clock);
    timer.sync(false);
    advance(999);
    expect(fired).toBe(0);
    advance(1);
    expect(fired).toBe(1);
    advance(5000);
    expect(fired).toBe(1);
    expect(timer.hasFired()).toBe(true);
  });

  it('never fires while paused, no matter how much time passes', () => {
    const { clock, advance } = makeClock();
    let fired = 0;
    const timer = createPausableTimer(1000, () => (fired += 1), clock);
    timer.sync(true); // paused from the start
    advance(10_000);
    expect(fired).toBe(0);
    expect(timer.remaining()).toBe(1000);
  });

  it('counts only unpaused time toward firing', () => {
    const { clock, advance } = makeClock();
    let fired = 0;
    const timer = createPausableTimer(1000, () => (fired += 1), clock);
    timer.sync(false);
    advance(400); // 600 remaining
    timer.sync(true);
    advance(5000); // frozen
    expect(fired).toBe(0);
    expect(timer.remaining()).toBe(600);
    timer.sync(false);
    advance(599);
    expect(fired).toBe(0);
    advance(1);
    expect(fired).toBe(1);
  });

  it('still fires under a relentless pause/resume storm (the stuck-round repro)', () => {
    const { clock, advance } = makeClock();
    let fired = 0;
    const timer = createPausableTimer(1000, () => (fired += 1), clock);
    // Simulate a window that keeps blurring/focusing during the transition:
    // 100ms of unpaused time, then a long paused gap, repeated. The old
    // "restart the full delay on resume" logic would never complete this.
    for (let cycle = 0; cycle < 12 && fired === 0; cycle += 1) {
      timer.sync(false);
      advance(100);
      timer.sync(true);
      advance(3000);
    }
    // After 10 * 100ms = 1000ms of cumulative unpaused time it must have fired.
    expect(fired).toBe(1);
  });

  it('is idempotent: repeated sync(false) calls do not restart or double-fire', () => {
    const { clock, advance } = makeClock();
    let fired = 0;
    const timer = createPausableTimer(1000, () => (fired += 1), clock);
    timer.sync(false);
    advance(500);
    timer.sync(false); // must not reset the countdown
    timer.sync(false);
    advance(500);
    expect(fired).toBe(1);
  });

  it('can be cancelled and then never fires', () => {
    const { clock, advance } = makeClock();
    let fired = 0;
    const timer = createPausableTimer(1000, () => (fired += 1), clock);
    timer.sync(false);
    advance(500);
    timer.cancel();
    advance(5000);
    expect(fired).toBe(0);
    expect(timer.hasFired()).toBe(false);
  });

  it('resolves immediately on resume when the unpaused budget is already spent', () => {
    const { clock } = makeClock();
    let fired = 0;
    const timer = createPausableTimer(0, () => (fired += 1), clock);
    timer.sync(false);
    expect(fired).toBe(1);
  });
});
