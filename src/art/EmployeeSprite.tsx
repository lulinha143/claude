import { memo } from 'react';
import type { EmployeeSpriteConfig } from './employeeSprites';
import { useHaloOff } from './haloTest';

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
  // TEMP halo-isolation A/B (Ctrl+Alt+H): when enabled, and only for sprites
  // that declare a halo-stripped variant (Pip), swap in the ZERO-semi-transparent
  // art. Same size/position/animation/scene — the halo is the ONLY variable.
  const haloOff = useHaloOff();
  const useNoHalo = haloOff && !reducedMotion && !!config.srcNoHalo;
  const file = reducedMotion ? config.poster : useNoHalo ? config.srcNoHalo! : config.src;
  // Push any authored bottom padding below the floor line so the character's
  // real contact point sits exactly on its slot (baseline 0 = no shift).
  const baselineShift = config.baseline > 0 ? `translateY(${config.baseline * 100}%)` : undefined;

  // Serve the animated APNG at the RESOLUTION IT IS ACTUALLY DISPLAYED AT, per
  // device pixel ratio, so the GPU never has to resample it every frame.
  //
  // Why: the office renders the sprite small (its slot is ~1x its @1x size). If a
  // single hi-res frame is downscaled by a FRACTIONAL factor every animation
  // frame, the GPU samples the soft SEMI-TRANSPARENT halo at a shifting sub-pixel
  // grid / fractional mip level, so the halo shimmers frame-to-frame while the
  // flat opaque body stays put. At 100% (integer/1:1) it is stable — which is
  // exactly why the raw APNG looks perfect in a browser tab. By shipping the
  // frame at 1x AND 2x the slot size and letting the browser pick the one that
  // matches the device pixel ratio, it renders 1:1 (DPR 1 -> @1x, DPR 2 -> @2x):
  // no fractional downscale, no upscale blur. Nothing about the artwork, halo,
  // transparency, animation, scale or position changes.
  const srcSet =
    !reducedMotion && !useNoHalo && config.src1x
      ? `${BASE}${config.src1x} 1x, ${BASE}${config.src} 2x`
      : undefined;

  return (
    <img
      className={`employee-sprite ${className ?? ''}`}
      src={`${BASE}${file}`}
      srcSet={srcSet}
      // Decorative: the wrapping button / roster card already names the
      // employee, so an empty alt avoids a duplicate screen-reader announcement.
      alt=""
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
    a.className === b.className
  );
});
