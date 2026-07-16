import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SfxName } from '../audio/audio';

// Renders an owned decoration as a LARGE, charming, interactive furniture piece
// in the office. Clicking gives a reaction (a lamp/screen toggling, a wobble,
// bubbles) — never resources, so it can't be click-farmed. Glyphs are chosen by
// a coarse "kind" derived from the id so every decoration reads as real
// furniture with a recognisable silhouette.

export type DecorKind =
  | 'plant'
  | 'lamp'
  | 'poster'
  | 'rug'
  | 'aquarium'
  | 'trophy'
  | 'cushion'
  | 'box'
  | 'screen';

export function decorKind(id: string): DecorKind {
  if (/(fern|plant|garden|terrarium|sawdust)/.test(id)) return 'plant';
  if (/(lamp|light|neon|chandelier|star|hologram)/.test(id)) return 'lamp';
  if (/(poster|blueprint|billboard|window|arch)/.test(id)) return 'poster';
  if (/(rug|carpet)/.test(id)) return 'rug';
  if (/aquarium/.test(id)) return 'aquarium';
  if (/(trophy|statue)/.test(id)) return 'trophy';
  if (/(beanbag|hammock|cushion|snack)/.test(id)) return 'cushion';
  if (/(projector|security|camera|label|monitor)/.test(id)) return 'screen';
  return 'box';
}

// Which kinds toggle an on/off light when clicked.
const TOGGLEABLE: DecorKind[] = ['lamp', 'screen', 'aquarium'];

// The sound each kind makes when a player pokes it. All route through the SFX
// bus (via audio.play), so Master Mute and the SFX-volume slider apply.
export function interactSound(kind: DecorKind): SfxName {
  switch (kind) {
    case 'lamp':
    case 'screen':
    case 'aquarium':
      return 'toggle';
    case 'trophy':
      return 'chime';
    case 'plant':
    case 'cushion':
      return 'footstep';
    case 'box':
      return 'place';
    default:
      return 'click';
  }
}

export function DecorationProp({
  id,
  accent = '#c98a4b',
  reducedMotion = false,
  dim = false,
  selected = false,
  reacting = false,
  title,
  mode = 'interact',
  onToggle,
  onInteract,
  onPointerDown,
}: {
  id: string;
  accent?: string;
  reducedMotion?: boolean;
  dim?: boolean;
  selected?: boolean;
  reacting?: boolean;
  title?: string;
  mode?: 'interact' | 'toggle';
  onToggle?: () => void;
  onInteract?: () => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
}) {
  const kind = decorKind(id);
  const [wiggle, setWiggle] = useState(false);
  const [on, setOn] = useState(true); // lit/active state for toggleable kinds
  const [variant, setVariant] = useState(0); // poster "slogan" / emblem

  function handleClick() {
    if (mode === 'toggle') {
      onToggle?.();
      return;
    }
    // Kind-specific reaction: lights/screens/tanks flick on-off; posters cycle
    // their artwork ("change slogans"); everything gives a springy press.
    if (TOGGLEABLE.includes(kind)) setOn((v) => !v);
    if (kind === 'poster') setVariant((v) => (v + 1) % POSTER_VARIANTS);
    if (!reducedMotion) {
      setWiggle(true);
      setTimeout(() => setWiggle(false), 420);
    }
    onInteract?.();
  }

  return (
    <button
      className={`decor decor--${kind} ${wiggle || (reacting && !reducedMotion) ? 'is-wiggle' : ''} ${
        dim ? 'is-dim' : ''
      } ${selected ? 'is-selected' : ''} ${reacting ? 'is-reacting' : ''} ${
        TOGGLEABLE.includes(kind) && !on ? 'is-off' : ''
      }`}
      style={{ ['--accent' as string]: accent }}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      title={title}
      aria-label={title}
      type="button"
      data-on={TOGGLEABLE.includes(kind) ? String(on) : undefined}
      data-variant={kind === 'poster' ? variant : undefined}
    >
      <Glyph kind={kind} accent={accent} on={on} variant={variant} reducedMotion={reducedMotion} />
    </button>
  );
}

const POSTER_VARIANTS = 3;
// Emblem colours the poster cycles through when tapped.
const POSTER_EMBLEMS = ['#ffd54a', '#e07a5f', '#7fb0c8'];

const LINE = '#241a12';

function Glyph({
  kind,
  accent,
  on,
  variant = 0,
  reducedMotion,
}: {
  kind: DecorKind;
  accent: string;
  on: boolean;
  variant?: number;
  reducedMotion: boolean;
}) {
  // Large furniture footprint. viewBox baseline (y=54) is the "floor".
  const s = { width: 52, height: 60, viewBox: '0 0 48 56', 'aria-hidden': true } as const;
  const spin = reducedMotion ? undefined : 'decor__spin';
  switch (kind) {
    case 'plant':
      return (
        <svg {...s}>
          <ellipse cx="24" cy="53" rx="13" ry="3" fill="rgba(0,0,0,0.25)" />
          {/* leafy foliage */}
          <path className="decor__leaf" d="M24 40 C 10 34 8 16 16 6 C 22 14 24 26 24 40 Z" fill="#3f7d4f" stroke={LINE} strokeWidth="1.2" />
          <path className="decor__leaf" d="M24 40 C 38 34 40 16 32 6 C 26 14 24 26 24 40 Z" fill="#4f9d69" stroke={LINE} strokeWidth="1.2" />
          <path d="M24 42 C 22 30 24 14 24 4" stroke="#2f6d47" strokeWidth="1.4" fill="none" />
          {/* pot */}
          <path d="M15 40 h18 l-2.5 14 h-13 Z" fill={accent} stroke={LINE} strokeWidth="1.4" />
          <rect x="14" y="38" width="20" height="4" rx="1.5" fill={accent} stroke={LINE} strokeWidth="1.2" />
        </svg>
      );
    case 'lamp':
      return (
        <svg {...s}>
          <ellipse cx="24" cy="53" rx="11" ry="3" fill="rgba(0,0,0,0.25)" />
          {on ? <circle cx="24" cy="14" r="15" fill={accent} opacity="0.28" /> : null}
          <path d="M14 22 h20 l-5 -14 h-10 Z" fill={on ? accent : '#5a4632'} stroke={LINE} strokeWidth="1.4" />
          <rect x="23" y="22" width="2.5" height="28" fill="#5a4632" stroke={LINE} strokeWidth="0.6" />
          <path d="M17 52 h14 l-2 2 h-10 Z" fill="#4a3826" stroke={LINE} strokeWidth="1.2" />
        </svg>
      );
    case 'poster': {
      // Tapping cycles the emblem colour — a little "changing slogans" beat.
      const emblem = POSTER_EMBLEMS[variant % POSTER_EMBLEMS.length];
      return (
        <svg {...s}>
          <rect x="7" y="6" width="34" height="40" rx="2" fill="#3a2c1f" stroke={LINE} strokeWidth="2" />
          <rect x="11" y="10" width="26" height="32" rx="1" fill={accent} />
          <circle cx="18" cy="19" r="4" fill={emblem} />
          <path d="M11 34 l8 -9 6 6 5 -6 7 8 v9 h-26 Z" fill="#3f7d4f" opacity="0.85" />
        </svg>
      );
    }
    case 'rug':
      return (
        <svg {...s}>
          <ellipse cx="24" cy="46" rx="22" ry="9" fill={accent} stroke={LINE} strokeWidth="1.6" />
          <ellipse cx="24" cy="46" rx="15" ry="6" fill="none" stroke={LINE} strokeWidth="1.2" opacity="0.6" />
          <ellipse cx="24" cy="46" rx="8" ry="3" fill="none" stroke={LINE} strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case 'aquarium':
      return (
        <svg {...s}>
          <path d="M12 44 h24 v8 h-24 Z" fill="#4a3826" stroke={LINE} strokeWidth="1.4" />
          <rect x="8" y="12" width="32" height="32" rx="3" fill={on ? '#7fb0c8' : '#3f5a66'} stroke={LINE} strokeWidth="2" />
          <rect x="10" y="30" width="28" height="12" fill="#5a8fa8" opacity="0.5" />
          <path d="M20 26 l6 -3 v6 Z" fill={accent} stroke={LINE} strokeWidth="0.8" />
          <circle cx="26" cy="25" r="1" fill={LINE} />
          {!reducedMotion ? (
            <>
              <circle className="decor__bubble" cx="14" cy="38" r="1.6" fill="#fff" opacity="0.8" />
              <circle className="decor__bubble" cx="32" cy="40" r="1.2" fill="#fff" opacity="0.7" />
            </>
          ) : null}
        </svg>
      );
    case 'trophy':
      return (
        <svg {...s}>
          <ellipse cx="24" cy="53" rx="10" ry="3" fill="rgba(0,0,0,0.25)" />
          <rect x="16" y="44" width="16" height="8" rx="1.5" fill="#4a3826" stroke={LINE} strokeWidth="1.4" />
          <path d="M14 12 h20 v6 a10 10 0 0 1 -20 0 Z" fill="#ffd54a" stroke={LINE} strokeWidth="1.6" />
          <path d="M14 14 h-4 a4 4 0 0 0 4 6 M34 14 h4 a4 4 0 0 1 -4 6" fill="none" stroke={LINE} strokeWidth="1.4" />
          <rect x="22" y="30" width="4" height="10" fill="#e0a43b" stroke={LINE} strokeWidth="1" />
          <path className={spin} d="M24 4 l1.5 3 3 .4 -2.2 2.1 .6 3-2.9-1.5-2.9 1.5 .6-3-2.2-2.1 3-.4Z" fill="#fff4c0" opacity="0.9" />
        </svg>
      );
    case 'cushion':
      return (
        <svg {...s}>
          <ellipse cx="24" cy="52" rx="18" ry="4" fill="rgba(0,0,0,0.22)" />
          <path d="M8 42 C 8 26 40 26 40 42 C 40 50 32 52 24 52 C 16 52 8 50 8 42 Z" fill={accent} stroke={LINE} strokeWidth="1.6" />
          <path d="M14 40 q10 6 20 0" fill="none" stroke={LINE} strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case 'screen':
      return (
        <svg {...s}>
          <path d="M10 48 h28 v6 h-28 Z" fill="#4a3826" stroke={LINE} strokeWidth="1.4" />
          <rect x="8" y="12" width="32" height="24" rx="2.5" fill="#1c150d" stroke={LINE} strokeWidth="2" />
          {on ? (
            <>
              <rect x="11" y="15" width="26" height="18" rx="1" fill="#7fb0c8" />
              <path d="M12 30 l6 -6 4 3 6 -7 8 10 h-24 Z" fill="#3f7d4f" opacity="0.8" />
              <circle cx="17" cy="20" r="2.5" fill="#ffd54a" />
            </>
          ) : (
            <rect x="11" y="15" width="26" height="18" rx="1" fill="#26303a" />
          )}
          <rect x="22" y="36" width="4" height="8" fill="#3a2c1f" stroke={LINE} strokeWidth="0.8" />
        </svg>
      );
    default:
      return (
        <svg {...s}>
          <ellipse cx="24" cy="53" rx="14" ry="3" fill="rgba(0,0,0,0.22)" />
          <rect x="10" y="14" width="28" height="38" rx="2" fill={accent} stroke={LINE} strokeWidth="1.8" />
          <path d="M10 27 h28 M10 40 h28" stroke={LINE} strokeWidth="1.2" opacity="0.7" />
          <circle cx="32" cy="20.5" r="1.4" fill={LINE} />
          <circle cx="32" cy="33.5" r="1.4" fill={LINE} />
          <circle cx="32" cy="46" r="1.4" fill={LINE} />
        </svg>
      );
  }
}
