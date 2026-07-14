import type { GameState } from './types';
import { ROOMS } from '../content/rooms';
import type { RoomDef } from '../content/types';

export function isRoomUnlocked(state: GameState, room: RoomDef): boolean {
  if (room.id === 'founder-desk') return true;
  if (room.unlock.upgradeId && (state.upgrades[room.unlock.upgradeId] ?? 0) > 0) return true;
  if (room.unlock.reputation && state.resources.reputation >= room.unlock.reputation) return true;
  return false;
}

export function unlockedRooms(state: GameState): RoomDef[] {
  return ROOMS.filter((r) => isRoomUnlocked(state, r)).sort((a, b) => a.floor - b.floor);
}

export function countUnlockedRooms(state: GameState): number {
  return unlockedRooms(state).length;
}
