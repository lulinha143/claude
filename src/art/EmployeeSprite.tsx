import { memo, type CSSProperties } from 'react';
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
//
// HALO STABILITY (why the soft baked-in halo does not shimmer):
// The glow/halo is painted into the APNG's own alpha channel. Its soft
// SEMI-TRANSPARENT edge shimmers if the GPU resamples it with a DIFFERENT
// sub-pixel geometry on every animation frame. Two independent things cause
// that in a game (but never when viewing the raw APNG standalone), so we defeat
// both, generically, for EVERY animated character — not just Pip:
//
//   1. Compositing coupling. If a repainting ancestor (e.g. the office floor's
//      backdrop-filter reacting to the animated background <video>) forces the
//      sprite's subtree to re-composite each frame, the halo's alpha edge is
//      re-blended repeatedly. Fixed by (a) removing that redundant
//      backdrop-filter (see styles.css) and (b) promoting the sprite to its own
//      compositor layer (`will-change: transform` in .employee-sprite +
//      `translateZ(0)` here) so it is composited from an independent texture.
//
//   2. Fractional per-frame downscale. The office draws the sprite small. If a
//      hi-res frame is downscaled by a FRACTIONAL factor (which happens at
//      non-integer device pixel ratios — e.g. Windows 125%/150% scaling — even
//      with a @1x/@2x srcset) the soft edge lands on a shifting sub-pixel grid
//      each frame and shimmers, while the flat opaque body stays put. Fixed by
//      rendering the frame at its NATIVE pixel size and shrinking it with a
//      CONSTANT transform on the sprite's own layer: the browser rasterises each
//      frame once at native resolution into the layer texture, then the GPU
//      scales that texture by the SAME factor every frame — identical sampling
//      geometry frame-to-frame, so the halo is steady at any DPR. This is why we
//      wrap the animated <img> in a fixed display-size box and scale the img,
//      instead of setting its CSS width/height to the small display size (which
//      re-downscales the decode every frame). Verified pixel-equivalent to the
//      previous rendering in appearance and geometry; nothing about the artwork,
//      halo, transparency, animation, scale or position changes.

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
  const baselineShift = config.baseline > 0 ? `translateY(${config.baseline * 100}%)` : '';

  // The animation is the only path that gets resampled every frame, so it is the
  // only path that needs the native-resolution + constant-scale treatment. The
  // static poster / halo-diagnostic frames are decoded once and never re-scaled
  // per frame, so they render at display size directly (still on their own
  // layer for isolation).
  const animated = !reducedMotion && !useNoHalo;

  if (animated) {
    // `config.src` is the @2x asset when a @1x variant exists (Pip: 206×186 for a
    // 103×93 slot), otherwise it is already the art's native size. Render the img
    // at that native size and shrink it to the slot with a constant transform.
    const nativeScale = config.src1x ? 2 : 1;
    const nativeW = config.frameWidth * nativeScale;
    const nativeH = config.frameHeight * nativeScale;
    const fit = width / nativeW; // constant downscale factor (e.g. 0.5 for Pip)

    const wrapStyle: CSSProperties = {
      position: 'relative',
      display: 'block',
      width: `calc(${width}px * var(--asset-scale))`,
      height: `calc(${height}px * var(--asset-scale))`,
      transform: baselineShift || undefined,
      pointerEvents: 'none',
    };
    const imgStyle: CSSProperties = {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: `${nativeW}px`,
      height: `${nativeH}px`,
      transformOrigin: 'left bottom',
      // Scale the native texture down by a constant factor on the sprite's own
      // GPU layer (translateZ keeps it promoted alongside the CSS will-change).
      transform: `scale(calc(${fit} * var(--asset-scale))) translateZ(0)`,
    };
    return (
      <span className={`employee-sprite-wrap ${className ?? ''}`} style={wrapStyle}>
        <img
          className="employee-sprite"
          src={`${BASE}${file}`}
          alt=""
          width={nativeW}
          height={nativeH}
          draggable={false}
          decoding="async"
          style={imgStyle}
        />
      </span>
    );
  }

  // Static frame (reduced motion poster, or the halo-isolation diagnostic).
  return (
    <img
      className={`employee-sprite ${className ?? ''}`}
      src={`${BASE}${file}`}
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
        transform: `${baselineShift} translateZ(0)`.trim(),
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
