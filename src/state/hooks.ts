import { useStore } from './store';
import type { GameState } from '../sim/types';
import type { GameEngine } from '../sim/engine';

// Convenience hook: subscribes to the frame counter (so the component re-renders
// each sim tick) and returns the live engine + its state. Reads are cheap; the
// engine mutates in place and `frame` drives reactivity.
export function useGame(): { engine: GameEngine; state: GameState; frame: number } {
  const frame = useStore((s) => s.frame);
  const engine = useStore((s) => s.engine);
  return { engine, state: engine.state, frame };
}

/**
 * `useGame`, but it stops following sim ticks while `paused` — for a big scene
 * that is fully covered (the office behind a minigame, a visit or a full-window
 * sheet). The component catches up in one render as soon as it is uncovered.
 */
export function useGameUnlessCovered(paused: boolean): {
  engine: GameEngine;
  state: GameState;
  frame: number;
} {
  const frame = useStore((s) => (paused ? -1 : s.frame));
  const engine = useStore((s) => s.engine);
  return { engine, state: engine.state, frame };
}
