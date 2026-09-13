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
    // Spread widened from +/-18px along with the payout type size. The jitter has to
    // scale with the glyphs it separates: at the larger, outlined size the old range
    // was narrower than the numbers themselves, so a fast streak stacked them into an
    // unreadable pile instead of a spray.
    const drift = (Math.random() * 2 - 1) * 34;
    node.style.setProperty('--tap-drift', `${drift}px`);
    node.style.setProperty('--tap-rise', `${40 + Math.random() * 20}px`);
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
 * Mark a tap burst as in progress, so the rest of the UI can get out of the way.
 *
 * Exists for one specific problem: to tap a station you hover it, and hovering
 * opens that station's tooltip, anchored right on top of the machine and its own
 * floating payouts. Aiming at the thing hid the feedback for hitting it.
 *
 * The flag lives on <html> rather than on the button because the tooltip is
 * portalled to <body>, so it is not reachable from the station's own subtree. It
 * clears itself shortly after the last tap, which is why it is a debounced timer
 * rather than a pointerup handler: mashing produces a stream of downs and ups, and
 * the tooltip should stay out of the way for the whole burst, not flicker between
 * every one of them.
 */
const TAP_BURST_LINGER_MS = 420;
let burstTimer: number | null = null;

export function markTapBurst(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-station-tapping', 'true');
  if (burstTimer !== null) window.clearTimeout(burstTimer);
  burstTimer = window.setTimeout(() => {
    burstTimer = null;
    document.documentElement.removeAttribute('data-station-tapping');
  }, TAP_BURST_LINGER_MS);
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
  // Never leave the burst flag latched on <html>: it dims tooltips, and a scene
  // torn down mid-burst would otherwise keep them dimmed for the rest of the session.
  if (burstTimer !== null) window.clearTimeout(burstTimer);
  burstTimer = null;
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-station-tapping');
  }
}
