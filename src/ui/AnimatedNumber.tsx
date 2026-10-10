import { useEffect, useRef, useState } from 'react';

// Smoothly tweens a displayed number toward its target so idle counters glide
// instead of snapping. It only re-renders while animating (and respects
// reduced-motion by jumping straight to the value). Digits use tabular figures
// in CSS so the layout never shifts horizontally.
//
// Targets can arrive every few milliseconds (production ticks), far faster than a
// tween lasts, so each tween starts from the number actually on screen and a
// superseded tween can never write again. Without both, the HUD counter drifted
// away from the truth and even below zero during ordinary play (measured: it read
// -5,59M castanhas while the company had 5,76M). The shown value is also kept
// between the two ends of its tween, so it can never leave that range.
export function AnimatedNumber({
  value,
  format,
  reducedMotion = false,
}: {
  value: number;
  format: (v: number) => string;
  reducedMotion?: boolean;
}) {
  const [display, setDisplay] = useState(value);
  /** the number on screen right now (each new tween starts here). */
  const shownRef = useRef(value);

  useEffect(() => {
    if (reducedMotion || !Number.isFinite(value)) {
      shownRef.current = value;
      setDisplay(value);
      return undefined;
    }
    const from = Number.isFinite(shownRef.current) ? shownRef.current : value;
    if (from === value) return undefined;
    const lo = Math.min(from, value);
    const hi = Math.max(from, value);
    const start = performance.now();
    const duration = 400;
    let live = true;
    let frame = 0;

    const tick = (now: number) => {
      if (!live) return;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = p >= 1 ? value : Math.max(lo, Math.min(hi, from + (value - from) * eased));
      shownRef.current = next;
      setDisplay(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [value, reducedMotion]);

  return <span className="tabular">{format(display)}</span>;
}
