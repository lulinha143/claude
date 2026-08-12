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
  className?: string;
}

function EmployeeSpriteImpl({ config, reducedMotion, height, className }: EmployeeSpriteProps) {
  const width = Math.round((height * config.frameWidth) / config.frameHeight);
  const file = reducedMotion ? config.poster : config.src;
  // Push any authored bottom padding below the floor line so the character's
  // real contact point sits exactly on its slot (baseline 0 = no shift).
  const baselineShift = config.baseline > 0 ? `translateY(${config.baseline * 100}%)` : undefined;

  // Render the APNG at its NATIVE pixel size and size it down to the slot with a
  // single, CONSTANT compositor transform — instead of letting the <img> resample
  // the frame to the display size every animation frame.
  //
  // Why: the office renders the sprite scaled down (e.g. a 248px-wide source in a
  // ~103px slot). On the GPU, resampling the soft SEMI-TRANSPARENT halo to a
  // smaller size every animation frame is not temporally stable — the halo's
  // partially-transparent edge pixels are filtered slightly differently frame to
  // frame, so the halo shimmers/flickers while the opaque body (flat colour) is
  // unaffected. Viewed at 100% (native) in a browser there is no downscale, so it
  // looks perfect. Painting the frame at native resolution into its own layer and
  // then scaling that layer by a fixed transform samples the halo identically on
  // every frame, so it stays rock-steady — no blur, no change to the artwork,
  // halo, transparency, animation, scale or position.
  const scale = height / config.frameHeight;

  return (
    <span
      className={`employee-sprite-frame ${className ?? ''}`}
      style={{
        width: `calc(${width}px * var(--asset-scale))`,
        height: `calc(${height}px * var(--asset-scale))`,
        transform: baselineShift,
      }}
    >
      <img
        className="employee-sprite"
        src={`${BASE}${file}`}
        // Decorative: the wrapping button / roster card already names the
        // employee, so an empty alt avoids a duplicate screen-reader announcement.
        alt=""
        width={config.frameWidth}
        height={config.frameHeight}
        draggable={false}
        decoding="async"
        style={{
          width: `${config.frameWidth}px`,
          height: `${config.frameHeight}px`,
          transform: `scale(calc(${scale} * var(--asset-scale)))`,
        }}
      />
    </span>
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
    a.className === b.className
  );
});
