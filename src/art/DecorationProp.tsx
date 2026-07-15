import { useState } from 'react';

// Renders an owned decoration as a small, charming, INTERACTIVE prop in the
// office. Clicking gives a short reaction (a wiggle, a lamp toggling on/off) —
// never resources, so it can't be click-farmed. Glyphs are chosen by a coarse
// "kind" derived from the decoration id so all 32 decorations render with a
// recognisable silhouette without 32 bespoke drawings.

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
}: {
  id: string;
  accent?: string;
  reducedMotion?: boolean;
  dim?: boolean;
  /** highlight this prop as the currently picked-up item in arrange mode. */
  selected?: boolean;
  /** briefly animate the prop when a nearby employee reacts to it. */
  reacting?: boolean;
  title?: string;
  /** 'interact' = charming reaction on click; 'toggle' = pick up / select in arrange mode. */
  mode?: 'interact' | 'toggle';
  onToggle?: () => void;
  onInteract?: () => void;
}) {
  const kind = decorKind(id);
  const [wiggle, setWiggle] = useState(false);
  const [lampOn, setLampOn] = useState(true);

  function handleClick() {
    if (mode === 'toggle') {
      onToggle?.();
      return;
    }
    if (kind === 'lamp') setLampOn((v) => !v);
    if (!reducedMotion) {
      setWiggle(true);
      setTimeout(() => setWiggle(false), 360);
    }
    onInteract?.();
  }

  return (
    <button
      className={`decor decor--${kind} ${wiggle || (reacting && !reducedMotion) ? 'is-wiggle' : ''} ${
        dim ? 'is-dim' : ''
      } ${selected ? 'is-selected' : ''} ${reacting ? 'is-reacting' : ''} ${
        kind === 'lamp' && !lampOn ? 'is-off' : ''
      }`}
      style={{ ['--accent' as string]: accent }}
      onClick={handleClick}
      title={title}
      aria-label={title}
      type="button"
    >
      <Glyph kind={kind} accent={accent} lampOn={lampOn} />
    </button>
  );
}

function Glyph({ kind, accent, lampOn }: { kind: DecorKind; accent: string; lampOn: boolean }) {
  // Larger base glyph so props read as real furniture next to the critters.
  const s = { width: 32, height: 37, viewBox: '0 0 26 30', 'aria-hidden': true } as const;
  const line = '#241a12';
  switch (kind) {
    case 'plant':
      return (
        <svg {...s}>
          <path className="decor__leaf" d="M13 20 q-8 -2 -6 -13 q6 2 6 12 q0 -12 6 -14 q3 9 -6 15" fill="#3f7d4f" stroke={line} strokeWidth="1" />
          <path d="M8 20 h10 l-1.5 8 h-7 Z" fill={accent} stroke={line} strokeWidth="1" />
        </svg>
      );
    case 'lamp':
      return (
        <svg {...s}>
          {lampOn ? <circle cx="13" cy="9" r="9" fill={accent} opacity="0.35" /> : null}
          <path d="M7 6 h12 l-3 8 h-6 Z" fill={lampOn ? accent : '#5a4632'} stroke={line} strokeWidth="1.2" />
          <path d="M13 14 v10 M8 24 h10" stroke={line} strokeWidth="2" />
        </svg>
      );
    case 'poster':
      return (
        <svg {...s}>
          <rect x="4" y="4" width="18" height="22" rx="1.5" fill={accent} stroke={line} strokeWidth="1.4" />
          <path d="M8 12 l4 4 6 -8" stroke={line} strokeWidth="1.4" fill="none" />
        </svg>
      );
    case 'rug':
      return (
        <svg {...s}>
          <ellipse cx="13" cy="20" rx="11" ry="6" fill={accent} stroke={line} strokeWidth="1.4" />
          <ellipse cx="13" cy="20" rx="6" ry="3" fill="none" stroke={line} strokeWidth="1" />
        </svg>
      );
    case 'aquarium':
      return (
        <svg {...s}>
          <rect x="4" y="8" width="18" height="16" rx="2" fill="#7fb0c8" stroke={line} strokeWidth="1.4" />
          <circle className="decor__bubble" cx="10" cy="16" r="1.5" fill="#fff" />
          <path d="M14 16 l4 -2 v4 Z" fill={accent} />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...s}>
          <path d="M8 6 h10 v4 a5 5 0 0 1 -10 0 Z" fill="#ffd54a" stroke={line} strokeWidth="1.2" />
          <path d="M13 15 v6 M9 24 h8" stroke={line} strokeWidth="2" />
        </svg>
      );
    case 'cushion':
      return (
        <svg {...s}>
          <rect x="4" y="14" width="18" height="11" rx="5" fill={accent} stroke={line} strokeWidth="1.4" />
        </svg>
      );
    case 'screen':
      return (
        <svg {...s}>
          <rect x="4" y="7" width="18" height="13" rx="2" fill="#1c150d" stroke={line} strokeWidth="1.4" />
          <rect x="6" y="9" width="14" height="9" fill="#7fb0c8" />
          <path d="M10 24 h6" stroke={line} strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg {...s}>
          <rect x="5" y="10" width="16" height="15" rx="2" fill={accent} stroke={line} strokeWidth="1.4" />
          <path d="M5 15 h16" stroke={line} strokeWidth="1" />
        </svg>
      );
  }
}
