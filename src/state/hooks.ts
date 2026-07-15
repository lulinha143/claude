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
