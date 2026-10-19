import { describe, it, expect } from 'vitest';
import { SaveManager, type KeyValueStore } from '../src/save/saveManager';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { migrate } from '../src/save/migrations';
import { SAVE_VERSION } from '../src/sim/config';

class MemStore implements KeyValueStore {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe('save system', () => {
  it('round-trips a save', () => {
    const store = new MemStore();
    const sm = new SaveManager(store);
    const s = createInitialState(1000);
    s.resources.nuts = 12345;
    sm.save(s);
    const loaded = sm.load();
    expect(loaded.isNew).toBe(false);
    expect(loaded.state.resources.nuts).toBe(12345);
  });

  it('starts a new game when nothing is stored', () => {
    const sm = new SaveManager(new MemStore());
    const loaded = sm.load(500);
    expect(loaded.isNew).toBe(true);
    expect(loaded.state.version).toBe(SAVE_VERSION);
  });

  it('never loses a save because an optional property is missing', () => {
    const store = new MemStore();
    // a minimal, partial save object
    store.setItem(
      'wmno.save.v1',
      JSON.stringify({ version: SAVE_VERSION, resources: { nuts: 42 } }),
    );
    const sm = new SaveManager(store);
    const loaded = sm.load();
    expect(loaded.state.resources.nuts).toBe(42);
    // filled-in defaults
    expect(loaded.state.company.name).toBeTruthy();
    expect(loaded.state.settings).toBeTruthy();
    expect(loaded.state.collections.nuts).toEqual([]);
  });

  it('recovers from a backup when the main save is corrupted', () => {
    const store = new MemStore();
    const sm = new SaveManager(store);
    const good = createInitialState(0);
    good.resources.nuts = 999;
    sm.save(good); // main
    // save again so the previous good main rotates into backup
    const good2 = createInitialState(0);
    good2.resources.nuts = 1000;
    sm.save(good2);
    // corrupt the main save
    store.setItem('wmno.save.v1', '{ this is not valid json');
    const loaded = sm.load();
    expect(loaded.corrupted).toBe(true);
    expect(loaded.recoveredFromBackup).toBe(true);
    expect(loaded.state.resources.nuts).toBeGreaterThan(0);
  });

  it('starts fresh (keeping settings) on total corruption', () => {
    const store = new MemStore();
    store.setItem('wmno.settings.v1', JSON.stringify({ language: 'pt-BR' }));
    store.setItem('wmno.save.v1', 'garbage');
    const sm = new SaveManager(store);
    const loaded = sm.load();
    expect(loaded.corrupted).toBe(true);
    expect(loaded.state.settings.language).toBe('pt-BR');
  });

  it('export/import is a faithful round trip', () => {
    const sm = new SaveManager(new MemStore());
    const s = createInitialState(0);
    s.resources.goldenNuts = 7;
    const json = sm.exportSave(s);
    const result = sm.importSave(json);
    expect(result.ok).toBe(true);
    expect(result.state?.resources.goldenNuts).toBe(7);
  });

  it('rejects invalid imports', () => {
    const sm = new SaveManager(new MemStore());
    expect(sm.importSave('not json').ok).toBe(false);
  });

  it('salvages valid decoration instances when one imported entry is malformed', () => {
    const store = new MemStore();
    const raw = createInitialState(0) as unknown as Record<string, unknown>;
    raw.collections = {
      ...(raw.collections as Record<string, unknown>),
      secrets: ['deco:potted-fern', 'deco:desk-lamp'],
    };
    raw.decorationInstances = [
      {
        instanceId: 'stable-fern',
        decorationId: 'potted-fern',
        roomId: null,
        surfaceType: 'floor',
        normalizedX: 0.4,
        normalizedY: 0.1,
        depth: 2,
        variantId: 42,
        flipped: 'yes',
        rotation: 'sideways',
        interactionState: 'corrupt',
      },
      { decorationId: 'desk-lamp' },
    ];
    store.setItem('wmno.save.v1', JSON.stringify(raw));
    const loaded = new SaveManager(store).load(0);
    expect(loaded.corrupted).toBe(false);
    expect(loaded.state.decorationInstances).toHaveLength(1);
    expect(loaded.state.decorationInstances[0].instanceId).toBe('stable-fern');
    expect(loaded.state.decorationInstances[0]).toMatchObject({
      roomId: null,
      variantId: undefined,
      flipped: undefined,
      rotation: undefined,
      interactionState: undefined,
    });

    const engine = new GameEngine(loaded.state, { deterministic: true });
    expect(
      engine.state.decorationInstances.find((item) => item.decorationId === 'potted-fern')
        ?.instanceId,
    ).toBe('stable-fern');
    expect(
      engine.state.decorationInstances.find((item) => item.decorationId === 'desk-lamp'),
    ).toBeTruthy();
  });
});

describe('migrations', () => {
  it('migrates a v1 save up to the current version', () => {
    const v1 = { version: 1, resources: { nuts: 5 } };
    const migrated = migrate(v1) as Record<string, unknown>;
    expect(migrated.version).toBe(SAVE_VERSION);
    expect((migrated.collections as Record<string, unknown>).secrets).toEqual([]);
    expect((migrated.prestige as Record<string, unknown>).skills).toEqual({});
  });

  it('migrates v6 decoration placements into stable instances without losing inventory state', () => {
    const v6 = {
      version: 6,
      placements: {
        'potted-fern': { surface: 'floor', x: 0.72, y: 0.08 },
      },
      collections: {
        secrets: ['deco:potted-fern', 'deco:desk-lamp'],
      },
    };
    const migrated = migrate(v6) as {
      version: number;
      decorationInstances: Array<Record<string, unknown>>;
      placements: Record<string, unknown>;
    };
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.placements['potted-fern']).toEqual(v6.placements['potted-fern']);
    const fern = migrated.decorationInstances.find((item) => item.decorationId === 'potted-fern');
    const lamp = migrated.decorationInstances.find((item) => item.decorationId === 'desk-lamp');
    expect(fern).toMatchObject({
      instanceId: 'deco-potted-fern-1',
      roomId: 'founder-desk',
      surfaceType: 'floor',
      normalizedX: 0.72,
      normalizedY: 0.08,
    });
    expect(lamp).toMatchObject({ instanceId: 'deco-desk-lamp-1', roomId: null });
  });

  it('normalizes percentage-like legacy coordinates during decoration migration', () => {
    const migrated = migrate({
      version: 6,
      placements: { 'potted-fern': { surface: 'floor', x: 75, y: 10 } },
      collections: { secrets: ['deco:potted-fern'] },
    }) as { decorationInstances: Array<{ normalizedX: number; normalizedY: number }> };
    expect(migrated.decorationInstances[0].normalizedX).toBe(0.75);
    expect(migrated.decorationInstances[0].normalizedY).toBe(0.1);
  });

  it('fills missing instances in a partial v6 development save without replacing stable ids', () => {
    const migrated = migrate({
      version: 6,
      placements: {},
      collections: { secrets: ['deco:potted-fern', 'deco:desk-lamp'] },
      decorationInstances: [
        {
          instanceId: 'kept-instance-id',
          decorationId: 'potted-fern',
          roomId: null,
          surfaceType: 'floor',
          normalizedX: 0.3,
          normalizedY: 0.1,
          depth: 2,
        },
      ],
    }) as { decorationInstances: Array<Record<string, unknown>> };
    expect(migrated.decorationInstances).toHaveLength(2);
    expect(migrated.decorationInstances[0].instanceId).toBe('kept-instance-id');
    expect(migrated.decorationInstances[1]).toMatchObject({
      instanceId: 'deco-desk-lamp-1',
      decorationId: 'desk-lamp',
      roomId: null,
    });
  });

  it('preserves v6 inventory state through parsing and engine construction', () => {
    const store = new MemStore();
    const v6 = createInitialState(0) as unknown as Record<string, unknown>;
    v6.version = 6;
    v6.placements = { 'potted-fern': { surface: 'floor', x: 0.7, y: 0.08 } };
    v6.collections = {
      ...(v6.collections as Record<string, unknown>),
      secrets: ['deco:potted-fern', 'deco:desk-lamp'],
    };
    delete v6.decorationInstances;
    store.setItem('wmno.save.v1', JSON.stringify(v6));
    const loaded = new SaveManager(store).load(0);
    const engine = new GameEngine(loaded.state, { deterministic: true });
    expect(
      engine.state.decorationInstances.find((item) => item.decorationId === 'potted-fern'),
    ).toMatchObject({
      roomId: 'founder-desk',
      normalizedX: 0.7,
    });
    expect(
      engine.state.decorationInstances.find((item) => item.decorationId === 'desk-lamp'),
    ).toMatchObject({
      roomId: null,
    });
    expect(engine.state.placements['desk-lamp']).toBeUndefined();
  });

  it('leaves a current-version save unchanged in version', () => {
    const cur = { version: SAVE_VERSION };
    expect((migrate(cur) as { version: number }).version).toBe(SAVE_VERSION);
  });
});
