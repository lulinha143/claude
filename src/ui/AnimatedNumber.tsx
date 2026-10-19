import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';

// The HUD's counter. It shows exactly the number it is given, and glides only when
// that number jumps (a crate collected, a purchase), so the jump reads as money
// arriving or leaving. Digits use tabular figures in CSS so the layout never shifts.
//
// Production reaches it in small steps, ten times a second. It used to start a
// fresh 400 ms tween from the number on screen at every step, so it only caught up
// as far as the frames between two steps allowed: on a busy computer (few frames)
// it fell seconds of production behind the balance it stood for. Small steps now
// move the counter with them, so it is never behind however busy the machine is.
//
// A glide is the distance the counter still trails the value (`trail`), closed by
// the time that really passed between frames, and it always lands within
// GLIDE_SETTLE_MS of its jump. A superseded glide carries on from where the
// counter is, so it can never wander off the two numbers it moves between (it
// once read -5,59M castanhas while the company had 5,76M). Reduced motion shows
// the number straight away.

/** How fast a glide closes in (time constant). */
const GLIDE_TAU_MS = 80;
/** A glide lands exactly on its number this long after the last jump. */
const GLIDE_SETTLE_MS = 400;
/** A frame after a long gap counts as at most this long (a glide still shows). */
const GLIDE_MAX_FRAME_MS = 100;
/** A change above this share of the number (or above 1) is a jump; smaller ones follow. */
const JUMP_SHARE = 0.01;

export function AnimatedNumber({
  value,
  format,
  reducedMotion = false,
}: {
  value: number;
  format: (v: number) => string;
  reducedMotion?: boolean;
}) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  /** The number the trail is measured from (the last one given). */
  const seenRef = useRef(value);
  /** How far the number on screen still trails `value` (0: on it). */
  const trailRef = useRef(0);
  const frameRef = useRef(0);
  const lastFrameRef = useRef(0);
  const jumpAtRef = useRef(0);

  // A layout effect, so a jump is taken up before the frame is painted: the
  // counter never flashes the new number before gliding to it.
  useLayoutEffect(() => {
    const previous = seenRef.current;
    seenRef.current = value;
    if (reducedMotion || !Number.isFinite(value) || !Number.isFinite(previous)) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      if (trailRef.current !== 0) {
        trailRef.current = 0;
        redraw();
      }
      return;
    }
    const delta = value - previous;
    if (Math.abs(delta) <= Math.max(1, Math.abs(previous) * JUMP_SHARE)) return;
    trailRef.current += delta;
    const now = performance.now();
    jumpAtRef.current = now;
    redraw();
    if (frameRef.current) return;
    lastFrameRef.current = now;
    const step = (time: number) => {
      const elapsed = Math.min(GLIDE_MAX_FRAME_MS, Math.max(0, time - lastFrameRef.current));
      lastFrameRef.current = time;
      trailRef.current =
        time - jumpAtRef.current >= GLIDE_SETTLE_MS
          ? 0
          : trailRef.current * Math.exp(-elapsed / GLIDE_TAU_MS);
      frameRef.current = trailRef.current === 0 ? 0 : requestAnimationFrame(step);
      redraw();
    };
    frameRef.current = requestAnimationFrame(step);
  }, [value, reducedMotion]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const shown = value - trailRef.current;
  // A balance that is not below zero is never shown below zero.
  return <span className="tabular">{format(value >= 0 ? Math.max(0, shown) : shown)}</span>;
}
