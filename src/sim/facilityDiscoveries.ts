import { FACILITY_DISCOVERIES } from '../content/facilityDiscoveries';
import { decorationEnsembles } from './decorationEnsembles';
import { isRoomIdUnlocked } from './rooms';
import type { GameState } from './types';

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
        (discovery.id === 'security' &&
          state.flags['microgame.cableUntangle.mastered'] !== undefined) ||
        (discovery.id === 'incubator' &&
          state.flags['microgame.bugSquash.mastered'] !== undefined)),
  );
}
