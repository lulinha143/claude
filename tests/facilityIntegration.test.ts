import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { DECORATION_ENSEMBLES } from '../src/content/decorationEnsembles';
import { ROOMS } from '../src/content/rooms';
import { DECORATIONS_BY_ID } from '../src/content/decorations';
import { decorationEnsembles } from '../src/sim/decorationEnsembles';
import { aggregateCompanyModifiers } from '../src/sim/companyModifiers';
import { availableFacilityDiscoveries } from '../src/sim/facilityDiscoveries';
import { MICRO_SOUVENIRS, type MicroMode } from '../src/sim/minigames';
import { SaveManager } from '../src/save/saveManager';
import { SAVE_VERSION } from '../src/sim/config';

function furnished(id: string) {
  const state = createInitialState(1000);
  state.resources.reputation = 100_000;
  for (const room of ROOMS) if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  state.resources.nuts = 10_000_000;
  state.resources.goldenNuts = 10_000;
  const engine = new GameEngine(state, { deterministic: true, now: () => 1000 });
  const set = DECORATION_ENSEMBLES.find((set) => set.id === id)!;
  for (const id of set.items) expect(engine.buyDecoration(id)).toBe(true);
  return engine;
}

describe('facility integration', () => {
  for (const set of DECORATION_ENSEMBLES)
    it(`${set.id} requires all real pieces placed in its room`, () => {
      for (const id of set.items) expect(DECORATIONS_BY_ID[id]).toBeDefined();
      const engine = furnished(set.id);
      expect(
        decorationEnsembles(engine.state).find((entry) => entry.definition.id === set.id)?.active,
      ).toBe(true);
      const withSet = aggregateCompanyModifiers(engine.state)[set.effect.kind];
      engine.state.decorationInstances.find((item) => item.decorationId === set.items[0])!.roomId =
        null;
      expect(
        decorationEnsembles(engine.state).find((entry) => entry.definition.id === set.id)?.active,
      ).toBe(false);
      expect(withSet - aggregateCompanyModifiers(engine.state)[set.effect.kind]).toBeCloseTo(
        set.effect.value,
      );
    });
  it('opens, restores and resolves the archive discovery once', () => {
    const engine = furnished('paper-trail');
    expect(engine.inspectFacility('archive')).toBe(true);
    expect(engine.inspectFacility('archive')).toBe(false);
    engine.resolveEventChoice('read');
    const restored = new GameEngine(JSON.parse(JSON.stringify(engine.state)), {
      deterministic: true,
    });
    expect(restored.activeEvent?.step).toBe('signature');
    restored.resolveEventChoice('correct');
    expect(restored.state.collections.secrets).toContain('anomaly.tomorrow');
    expect(availableFacilityDiscoveries(restored.state).map((item) => item.id)).not.toContain(
      'archive',
    );
  });
  for (const [kind, id] of Object.entries(MICRO_SOUVENIRS))
    it(`${kind} mastery grants one stored souvenir`, () => {
      const engine = new GameEngine(createInitialState(1000), {
        deterministic: true,
        now: () => 1000,
      });
      expect(engine.rewardMicrogame(kind as MicroMode, 35)?.decorationId).toBe(id);
      expect(engine.state.collections.secrets).toContain(`deco:${id}`);
      expect(
        engine.state.decorationInstances.filter((item) => item.decorationId === id),
      ).toHaveLength(1);
      expect(engine.rewardMicrogame(kind as MicroMode, 35)).toBeUndefined();
      expect(
        engine.state.decorationInstances.filter((item) => item.decorationId === id),
      ).toHaveLength(1);
    });
  it('rejects unrelated and newer files without accepting them as empty companies', () => {
    const saves = new SaveManager({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
    for (const data of [{}, [], { settings: {} }, { resources: {}, version: SAVE_VERSION + 1 }])
      expect(saves.importSave(JSON.stringify(data)).ok).toBe(false);
    expect(saves.importSave(JSON.stringify(createInitialState(1000))).ok).toBe(true);
  });
});
