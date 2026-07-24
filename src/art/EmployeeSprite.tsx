import { memo } from 'react';
import type { EmployeeSpriteConfig } from './employeeSprites';

// Renders an employee's FINAL animated artwork as a looping APNG.
//
// Why an <img>: a browser-decoded APNG autoplays, loops forever (the asset's
// num_plays is 0), preserves transparency, colour and the authored frame timing
// with zero JS, and — crucially — keeps playing across React re-renders because
// the element is never recreated. This component is wrapped in React.memo and
// takes only stable props, so the office diorama can re-render every animation
// frame (it reads Date.now()) without ever remounting the <img> and restarting
// the loop. When the player prefers reduced motion we swap in a single static
// poster frame instead of the animation.
//
// Asset URLs resolve through import.meta.env.BASE_URL so they work identically
// in the dev server, the GitHub Pages build (base './') and the packaged
// Electron app (file://) — matching the office-background convention.

const BASE = import.meta.env.BASE_URL ?? '/';

export interface EmployeeSpriteProps {
  config: EmployeeSpriteConfig;
  /** Show the static poster instead of the animation. */
  reducedMotion: boolean;
  /** Rendered height in px (before the global --asset-scale multiplier). */
  height: number;
  /** Accessible label (the wrapping control usually supplies its own). */
  title?: string;
  className?: string;
}

function EmployeeSpriteImpl({
  config,
  reducedMotion,
  height,
  title,
  className,
}: EmployeeSpriteProps) {
  const width = Math.round((height * config.frameWidth) / config.frameHeight);
  const file = reducedMotion ? config.poster : config.src;
  // Push any authored bottom padding below the floor line so the character's
  // real contact point sits exactly on its slot (baseline 0 = no shift).
  const baselineShift = config.baseline > 0 ? `translateY(${config.baseline * 100}%)` : undefined;

  return (
    <img
      className={`employee-sprite ${className ?? ''}`}
      src={`${BASE}${file}`}
      alt={title ?? ''}
      width={width}
      height={height}
      draggable={false}
      decoding="async"
      style={{
        width: `calc(${width}px * var(--asset-scale))`,
        height: `calc(${height}px * var(--asset-scale))`,
        transform: baselineShift,
      }}
    />
  );
}

// Only re-render when something that actually affects the pixels changes. This
// guarantees ordinary state churn in the parent never recreates the <img>, so
// the APNG never visibly restarts.
export const EmployeeSprite = memo(EmployeeSpriteImpl, (a, b) => {
  return (
    a.config === b.config &&
    a.reducedMotion === b.reducedMotion &&
    a.height === b.height &&
    a.title === b.title &&
    a.className === b.className
  );
});
