import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SfxName } from '../audio/audio';
import { DecoArt } from './decoArt';
import { placementSpec } from '../content/placementSpecs';

// Stable per-id hash so a "mirrorable" prop always flips the same way (no
// flicker between renders / on reload) while still varying across the catalogue.
function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// Renders an owned decoration as a large, charming, interactive furniture piece
// in the office. Clicking gives a reaction (a lamp/screen toggling, a wobble,
// bubbles) — never resources, so it can't be click-farmed. A coarse "kind"
// derived from the id drives behaviour (sound / class / toggle / poster cycle),
// while the pixel-art sprite (DecoArt) is chosen per exact item id so every
// decoration reads as its own distinct object.

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
  if (/(fern|plant|garden|terrarium)/.test(id)) return 'plant';
  if (/(lamp|light|neon|chandelier|star|hologram)/.test(id)) return 'lamp';
  if (/(motivational-poster|blueprint|window|painting)/.test(id)) return 'poster';
  if (/(rug|carpet)/.test(id)) return 'rug';
  if (/aquarium/.test(id)) return 'aquarium';
  if (/(trophy|statue)/.test(id)) return 'trophy';
  if (/(beanbag|hammock|cushion)/.test(id)) return 'cushion';
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
  const spec = placementSpec(id);
  const mirror = spec.mirrorable && idHash(id) % 2 === 1;
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
      // The authored per-item scale is published as a variable so the stylesheet can
      // combine it with the scene scale; see `.floor__deco .decor > svg`.
      style={{ ['--accent' as string]: accent, ['--deco-scale' as string]: spec.scale }}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      title={title}
      aria-label={title}
      type="button"
      data-anchor={spec.anchor}
      data-baseline={spec.baseline}
      data-on={TOGGLEABLE.includes(kind) ? String(on) : undefined}
      data-variant={kind === 'poster' ? variant : undefined}
    >
      <DecoArt
        id={id}
        on={on}
        variant={variant}
        accent={accent}
        reducedMotion={reducedMotion}
        scale={spec.scale}
        mirror={mirror}
      />
    </button>
  );
}

// How many artworks a poster cycles through when tapped (drives data-variant).
const POSTER_VARIANTS = 3;
