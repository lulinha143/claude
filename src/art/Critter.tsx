import type { CritterState } from './animation';

// Original, code-drawn SVG character. All employees reuse this component with
// different colours and small silhouette parameters, so the art is consistent
// and swappable. The `state` drives a CSS class that animates via keyframes
// (see styles.css). This is the boundary a future PixiJS/sprite renderer would
// replace — gameplay never touches SVG internals.

export type EarType = 'round' | 'pointy' | 'flat';

export interface CritterProps {
  color: string;
  accent: string;
  state: CritterState;
  earType?: EarType;
  hasTail?: boolean;
  hasGlasses?: boolean;
  hasBeak?: boolean;
  size?: number;
  reducedMotion?: boolean;
  title?: string;
}

export function Critter({
  color,
  accent,
  state,
  earType = 'round',
  hasTail = false,
  hasGlasses = false,
  hasBeak = false,
  size = 64,
  reducedMotion = false,
  title,
}: CritterProps) {
  const dark = shade(color, -0.25);
  const light = shade(color, 0.2);
  const cls = `critter critter--${reducedMotion ? 'idle' : state}`;
  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? 'character'}
    >
      {title ? <title>{title}</title> : null}
      {hasTail ? (
        <path
          className="critter__tail"
          d="M78 78 C 98 66, 96 34, 78 26 C 92 40, 86 62, 70 70 Z"
          fill={light}
          stroke={dark}
          strokeWidth="1.5"
        />
      ) : null}

      {/* body */}
      <ellipse className="critter__body" cx="50" cy="66" rx="24" ry="26" fill={color} stroke={dark} strokeWidth="1.5" />
      <ellipse cx="50" cy="70" rx="15" ry="18" fill={light} opacity="0.55" />

      {/* accent (necktie / vest) */}
      <path className="critter__accent" d="M50 50 l6 12 -6 6 -6 -6 Z" fill={accent} />

      {/* arms */}
      <ellipse className="critter__arm critter__arm--l" cx="30" cy="66" rx="6" ry="10" fill={color} stroke={dark} strokeWidth="1.2" />
      <ellipse className="critter__arm critter__arm--r" cx="70" cy="66" rx="6" ry="10" fill={color} stroke={dark} strokeWidth="1.2" />

      {/* head */}
      <g className="critter__head">
        {/* ears */}
        {earType === 'pointy' ? (
          <>
            <path d="M34 22 L30 6 L44 18 Z" fill={color} stroke={dark} strokeWidth="1.2" />
            <path d="M66 22 L70 6 L56 18 Z" fill={color} stroke={dark} strokeWidth="1.2" />
          </>
        ) : earType === 'flat' ? (
          <>
            <ellipse cx="34" cy="20" rx="8" ry="5" fill={color} stroke={dark} strokeWidth="1.2" />
            <ellipse cx="66" cy="20" rx="8" ry="5" fill={color} stroke={dark} strokeWidth="1.2" />
          </>
        ) : (
          <>
            <circle cx="35" cy="20" r="8" fill={color} stroke={dark} strokeWidth="1.2" />
            <circle cx="65" cy="20" r="8" fill={color} stroke={dark} strokeWidth="1.2" />
          </>
        )}
        <circle cx="50" cy="34" r="20" fill={color} stroke={dark} strokeWidth="1.5" />
        <ellipse cx="50" cy="40" rx="12" ry="10" fill={light} opacity="0.5" />

        {/* eyes */}
        <circle className="critter__eye" cx="43" cy="33" r="3.2" fill="#241a12" />
        <circle className="critter__eye" cx="57" cy="33" r="3.2" fill="#241a12" />

        {/* glasses */}
        {hasGlasses ? (
          <g stroke="#241a12" strokeWidth="1.6" fill="none">
            <circle cx="43" cy="33" r="6" />
            <circle cx="57" cy="33" r="6" />
            <line x1="49" y1="33" x2="51" y2="33" />
          </g>
        ) : null}

        {/* nose / beak */}
        {hasBeak ? (
          <path d="M50 38 l6 4 -6 4 -6 -4 Z" fill="#e0a43b" stroke={dark} strokeWidth="0.8" />
        ) : (
          <ellipse cx="50" cy="40" rx="2.6" ry="2" fill="#241a12" />
        )}
      </g>
    </svg>
  );
}

// small colour helpers (no external deps)
function shade(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.replace(/(.)/g, '$1$1') : c, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = clamp(Math.round(r + 255 * amount));
  g = clamp(Math.round(g + 255 * amount));
  b = clamp(Math.round(b + 255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}
