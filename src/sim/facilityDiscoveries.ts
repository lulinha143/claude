import { FACILITY_DISCOVERIES } from '../content/facilityDiscoveries';
import { ROOM_PLAY } from '../content/roomPlay';
import { decorationEnsembles } from './decorationEnsembles';
import { curiosityProgress } from './roomPlay';
import { isRoomIdUnlocked } from './rooms';
import type { GameState } from './types';

/**
 * Discoveries waiting to be looked into. Each facility room's discovery comes
 * forward when the room's decoration set is complete, when the player has
 * mastered its activity, or simply when they have noticed enough odd things
 * there: paying attention to a room is a way into its secret.
 */
export function availableFacilityDiscoveries(state: GameState) {
  const active = new Set(
    decorationEnsembles(state)
      .filter((set) => set.active)
      .map((set) => set.definition.id),
  );
  return FACILITY_DISCOVERIES.filter(
    (discovery) =>
      isRoomIdUnlocked(state, discovery.roomId) &&
      state.flags[`discovery.${discovery.id}`] === undefined &&
      (active.has(discovery.ensembleId) ||
        curiosityProgress(state, discovery.roomId).noticed >= ROOM_PLAY.discoveryAfter ||
        (discovery.id === 'security' &&
          state.flags['microgame.cableUntangle.mastered'] !== undefined) ||
        (discovery.id === 'incubator' &&
          state.flags['microgame.bugSquash.mastered'] !== undefined)),
  );
}
