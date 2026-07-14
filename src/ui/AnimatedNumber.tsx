import { useEffect, useRef, useState } from 'react';

// Smoothly tweens a displayed number toward its target so idle counters glide
// instead of snapping. It only re-renders while animating (and respects
// reduced-motion by jumping straight to the value). Digits use tabular figures
// in CSS so the layout never shifts horizontally.
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
  const raf = useRef<number | null>(null);
  const fromRef = useRef(value);
  const startRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    startRef.current = performance.now();
    const from = fromRef.current;
    const duration = 400;

    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (value - from) * eased;
      setDisplay(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reducedMotion]);

  return <span className="tabular">{format(display)}</span>;
}
