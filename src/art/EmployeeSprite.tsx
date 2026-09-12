import { memo } from 'react';
import type { EmployeeSpriteConfig } from './employeeSprites';
import { useHaloOff } from './haloTest';
import { markSpriteUnavailable } from './spriteAvailability';

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
// GEOMETRY CONTRACT (do not break this):
// The sprite is laid out from `config.frameWidth/frameHeight` — the art's own
// aspect ratio — and rendered by setting the <img>'s width AND height to the
// final display size. The element is therefore never larger than the box it
// occupies, which matters because styles.css carries a global
// `img { max-width: 100% }` overflow guard: any <img> rendered WIDER than its
// containing block gets its width clamped while an explicit height is left
// alone, which silently distorts the aspect ratio. (That is exactly what broke
// Pip: an earlier attempt rendered the frame at native resolution inside a
// smaller wrapper and shrank it with a transform, so the guard squeezed it to
// half width — a 2:1 distortion.) `.employee-sprite` now sets
// `max-width: none` so the guard can never apply to character art, and this
// component keeps the img at display size so it never needs to.
//
// HALO NOTE: the soft glow/halo is painted into the APNG's own alpha channel,
// so it is part of the artwork and must never be re-created in CSS. Keeping
// each sprite on its own compositor layer (`will-change: transform` in
// `.employee-sprite` plus the `translateZ(0)` below) stops an ancestor repaint
// from re-blending that semi-transparent edge. See docs/CHARACTER_SPRITES.md
// for what has and has not been shown to affect the reported shimmer.

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
  // Width is DERIVED from the art's aspect ratio, so the rendered box always
  // matches the source proportions exactly.
  const width = Math.round((height * config.frameWidth) / config.frameHeight);

  // TEMP halo-isolation A/B (Ctrl+Alt+H): when enabled, and only for sprites
  // that declare a halo-stripped variant (Pip), swap in the ZERO-semi-transparent
  // art. Same size/position/animation/scene — the halo is the ONLY variable.
  const haloOff = useHaloOff();
  const useNoHalo = haloOff && !reducedMotion && !!config.srcNoHalo;

  // Push any authored bottom padding below the floor line so the character's
  // real contact point sits exactly on its slot (baseline 0 = no shift).
  const baselineShift = config.baseline > 0 ? `translateY(${config.baseline * 100}%)` : '';
  // Slide the figure so ITS centre — not the centre of its transparent padding —
  // lands on the slot the layout chose. Several animals sit 1.5-2.5% right of
  // their canvas centre, which is enough to read as standing beside the desk
  // rather than at it. The wrapper button is already centred on the slot, so the
  // correction is the difference between the two centres.
  const anchorShift =
    Math.abs(config.anchorX - 0.5) > 0.002
      ? `translateX(${((0.5 - config.anchorX) * 100).toFixed(2)}%)`
      : '';
  // Keep a `translateZ(0)` so the sprite stays on its OWN compositor layer (see
  // `.employee-sprite` in styles.css), so the halo's semi-transparent edge is
  // composited from an independently-rasterised texture instead of being
  // re-blended whenever an ancestor repaints.
  const transform = `${anchorShift} ${baselineShift} translateZ(0)`.trim();

  // RESOLUTION SELECTION
  //
  // Two sizes of the same animation exist: `src1x`, encoded at exactly the office
  // display height, and `src`, the denser retained build (~1.6-1.9x of it, not 2x —
  // see characterAssets.ts). Which one to serve depends on how big this particular
  // element is being drawn, because the office draws at `src1x`'s exact size while a
  // roster card draws the same character ~43% larger.
  //
  // The oversized case is decided HERE rather than by handing the browser a density
  // that makes the denser file win, because that does not reliably work: Chromium
  // will not DOWNGRADE to a smaller candidate once a denser one is in its cache, so
  // a character whose srcset was ever evaluated at card proportions keeps the big
  // file everywhere afterwards. Measured directly — a `<img>` moved from densities
  // `0.700x/1.160x` to `1.035x/1.739x` keeps serving the 1.160x file. So density
  // labels stay a fixed property of the FILES, and the size-dependent part is an
  // explicit source choice that cannot drift.
  const oversized = height > config.frameHeight;
  const animation = oversized && config.src1x ? config.src : (config.src1x ?? config.src);
  const file = reducedMotion ? config.poster : useNoHalo ? config.srcNoHalo! : animation;

  // At the encoded size (the office) offer both candidates so a HiDPI display can take
  // the denser one; the labels are the files' real ratio, so DPR 1 lands on `src1x`
  // and maps it 1:1 to device pixels — no resample at all. When oversized we have
  // already chosen the denser build outright and must NOT also advertise the small one,
  // or DPR 1 would pick it and enlarge it, which is the softness this avoids.
  //
  // `--asset-scale` only ever shrinks the element further (it is capped at 1), so the
  // drawn size is at most `height` and these choices stay conservative.
  const srcSet =
    !reducedMotion && !useNoHalo && config.src1x && !oversized
      ? `${BASE}${config.src1x} 1x, ${BASE}${config.src} ${(
          config.srcHeight / config.frameHeight
        ).toFixed(3)}x`
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
      // If the artwork cannot load, record it so this animal falls back to the
      // code-drawn Critter silhouette instead of leaving a broken image (and an
      // orphaned mood bubble) standing at the workstation.
      onError={() => markSpriteUnavailable(config.src)}
      style={{
        width: `calc(${width}px * var(--asset-scale))`,
        height: `calc(${height}px * var(--asset-scale))`,
        transform,
      }}
    />
  );
}

// Only re-render when something that actually affects the pixels changes. This
// guarantees ordinary state churn in the parent never recreates the <img>, so
// the APNG never visibly restarts.
//
// The config is compared BY VALUE, not by identity. `employeeSprite(id)` builds a
// fresh object on every call, so an identity check (`a.config === b.config`) was
// always false and this memo never actually stopped anything — and the office
// diorama re-renders continuously because it reads `Date.now()`, so that was a
// re-render per sprite per animation frame. Only the fields this component reads
// are compared; the rest cannot change what is painted.
export const EmployeeSprite = memo(EmployeeSpriteImpl, (a, b) => {
  return (
    a.reducedMotion === b.reducedMotion &&
    a.height === b.height &&
    a.className === b.className &&
    a.config.src === b.config.src &&
    a.config.src1x === b.config.src1x &&
    a.config.srcNoHalo === b.config.srcNoHalo &&
    a.config.poster === b.config.poster &&
    a.config.frameWidth === b.config.frameWidth &&
    a.config.frameHeight === b.config.frameHeight &&
    a.config.srcHeight === b.config.srcHeight &&
    a.config.anchorX === b.config.anchorX &&
    a.config.baseline === b.config.baseline
  );
});
