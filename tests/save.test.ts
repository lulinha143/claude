import { describe, it, expect } from 'vitest';
import { SaveManager, type KeyValueStore } from '../src/save/saveManager';
import { createInitialState } from '../src/sim/state';
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
    store.setItem('wmno.save.v1', JSON.stringify({ version: SAVE_VERSION, resources: { nuts: 42 } }));
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
});

describe('migrations', () => {
  it('migrates a v1 save up to the current version', () => {
    const v1 = { version: 1, resources: { nuts: 5 } };
    const migrated = migrate(v1) as Record<string, unknown>;
    expect(migrated.version).toBe(SAVE_VERSION);
    expect((migrated.collections as Record<string, unknown>).secrets).toEqual([]);
    expect((migrated.prestige as Record<string, unknown>).skills).toEqual({});
  });

  it('leaves a current-version save unchanged in version', () => {
    const cur = { version: SAVE_VERSION };
    expect((migrate(cur) as { version: number }).version).toBe(SAVE_VERSION);
  });
});
