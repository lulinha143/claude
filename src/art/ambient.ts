// Whether the office's decorative ambient life (dust motes, steam, bubbles,
// blinking, gentle sway) should run right now. It is deliberately cheap and
// non-essential, so we pause it whenever running it would be wasteful or
// unwelcome: the window is hidden/minimized, the player asked for battery-saver
// mode, or they prefer reduced motion. Kept pure for unit testing; the App maps
// the result to a `data-ambient` attribute that the stylesheet reads.

export type AmbientState = 'on' | 'paused';

export function ambientState(opts: {
  hidden: boolean;
  batterySaver: boolean;
  reducedMotion: boolean;
}): AmbientState {
  return opts.hidden || opts.batterySaver || opts.reducedMotion ? 'paused' : 'on';
}
