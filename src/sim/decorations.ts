import type { GameState } from './types';
import { DECORATIONS } from '../content/decorations';
import type { DecorationDef } from '../content/types';

// Decoration ownership + visibility live in `collections.secrets` (a persisted
// string[]), so no new save field/migration is needed:
//   `deco:<id>`      -> the player owns this decoration
//   `decohide:<id>`  -> the player has hidden it in decoration mode
export function isDecorationOwned(state: GameState, id: string): boolean {
  return state.collections.secrets.includes(`deco:${id}`);
}

export function isDecorationHidden(state: GameState, id: string): boolean {
  return state.collections.secrets.includes(`decohide:${id}`);
}

export function ownedDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return DECORATIONS.filter((d) => d.room === roomId && isDecorationOwned(state, d.id));
}

export function visibleDecorationsInRoom(state: GameState, roomId: string): DecorationDef[] {
  return ownedDecorationsInRoom(state, roomId).filter((d) => !isDecorationHidden(state, d.id));
}

/** Sum of morale bonuses from currently-visible owned decorations (room comfort). */
export function roomComfort(state: GameState, roomId: string): number {
  return visibleDecorationsInRoom(state, roomId).reduce((s, d) => s + d.moraleBonus, 0);
}
