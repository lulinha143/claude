import { DECORATION_ENSEMBLES } from '../content/decorationEnsembles';
import type { GameState } from './types';
import { isRoomIdUnlocked } from './rooms';

export function decorationEnsembles(state: GameState) {
  const locations = new Map(
    state.decorationInstances
      .filter((item) => item.roomId !== null)
      .map((item) => [item.decorationId, item.roomId]),
  );
  return DECORATION_ENSEMBLES.map((definition) => {
    const unlocked = isRoomIdUnlocked(state, definition.roomId);
    const placed = definition.items.filter((id) => locations.get(id) === definition.roomId);
    return { definition, placed, active: unlocked && placed.length === definition.items.length };
  });
}
