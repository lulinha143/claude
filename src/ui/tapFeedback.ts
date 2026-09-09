// Click-station tap feedback.
//
// A clicker has to stay crisp while the player mashes, so none of this goes
// through React. Every tap appends a short-lived DOM node (the same technique as
// sparkle.ts) and lets CSS animate it, which means:
//
//   - No component re-render per tap, so React never becomes the bottleneck.
//   - Overlapping payouts each get their OWN node, so fast taps stack up the way
//     the player expects instead of one popup replacing the last.
//   - Cleanup is bounded and self-contained: nodes remove themselves, and a hard
//     cap sheds the oldest ones if someone really goes for it.
//
// Everything here respects reduced-motion, and every node is parented to a single
// layer element that callers can tear down on unmount so nothing is ever left
// floating over the office.

/** Hard ceiling on live popups, so a very fast player cannot flood the DOM. */
const MAX_LIVE_POPS = 28;

const POP_LIFETIME_MS = 900;

let layer: HTMLDivElement | null = null;
const live: HTMLElement[] = [];

function reducedMotion(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-reduced-motion') === 'true'
  );
}

/** The shared, lazily created popup layer. */
function ensureLayer(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'tap-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

function retire(node: HTMLElement): void {
  const index = live.indexOf(node);
  if (index >= 0) live.splice(index, 1);
  node.remove();
}

export type TapTone = 'normal' | 'critical' | 'golden';

export interface TapPopOptions {
  /** viewport coordinates of the tap. */
  x: number;
  y: number;
  /** the text to float, already formatted (e.g. "+412"). */
  text: string;
  tone?: TapTone;
  /** current combo streak; shown alongside once it is worth mentioning. */
  streak?: number;
}

/**
 * Float a payout number away from the tap point.
 *
 * The horizontal jitter matters more than it looks: without it, rapid taps stack
 * numbers exactly on top of each other and the feedback reads as a single
 * flickering label rather than a satisfying spray of payouts.
 */
export function tapPop({ x, y, text, tone = 'normal', streak = 0 }: TapPopOptions): void {
  const host = ensureLayer();
  if (!host) return;

  // Reduced motion still gets feedback — it just does not fly around.
  const still = reducedMotion();

  const node = document.createElement('span');
  node.className = `tap-pop tap-pop--${tone}${still ? ' tap-pop--still' : ''}`;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  if (!still) {
    const drift = (Math.random() * 2 - 1) * 18;
    node.style.setProperty('--tap-drift', `${drift}px`);
    node.style.setProperty('--tap-rise', `${34 + Math.random() * 14}px`);
  }

  const value = document.createElement('strong');
  value.className = 'tap-pop__value';
  value.textContent = text;
  node.appendChild(value);

  // A streak only earns screen space once it is actually a streak.
  if (streak >= 3) {
    const combo = document.createElement('em');
    combo.className = 'tap-pop__combo';
    combo.textContent = `\u00d7${streak}`;
    node.appendChild(combo);
  }

  host.appendChild(node);
  live.push(node);
  while (live.length > MAX_LIVE_POPS) retire(live[0]);

  window.setTimeout(() => retire(node), POP_LIFETIME_MS);
}

/**
 * Punch the tapped element for one frame's worth of compression.
 *
 * Done by toggling a class rather than by React state so it lands on the very
 * next paint, and re-triggered by forcing a reflow so a second tap during the
 * animation restarts it instead of being swallowed.
 */
export function tapPunch(element: HTMLElement, tone: TapTone = 'normal'): void {
  if (reducedMotion()) return;
  element.classList.remove('is-tapped', 'is-tapped-crit');
  // Reading offsetWidth flushes the class removal so the animation can restart.
  void element.offsetWidth;
  element.classList.add(tone === 'normal' ? 'is-tapped' : 'is-tapped-crit');
  window.setTimeout(
    () => element.classList.remove('is-tapped', 'is-tapped-crit'),
    tone === 'normal' ? 140 : 260,
  );
}

/** Remove every live popup and the layer itself (call on scene unmount). */
export function clearTapFeedback(): void {
  while (live.length) retire(live[0]);
  layer?.remove();
  layer = null;
}
