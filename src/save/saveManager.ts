import type { GameState } from '../sim/types';
import { createInitialState } from '../sim/state';
import { gameStateSchema } from './schema';
import { migrate } from './migrations';

// Storage abstraction so the save system is testable and works in the browser
// (localStorage), in tests (in-memory), and in Electron (renderer localStorage,
// which Electron persists to disk in the userData dir — a Steam-Cloud-friendly
// location documented in docs/STEAM.md).
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

export function defaultStore(): KeyValueStore {
  try {
    if (typeof localStorage !== 'undefined') {
      // touch it to confirm access (private mode can throw)
      const probe = '__wmno_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    /* fall through to memory */
  }
  return new MemoryStore();
}

const SAVE_KEY = 'wmno.save.v1';
const SETTINGS_KEY = 'wmno.settings.v1';
const BACKUP_PREFIX = 'wmno.save.bak.';
const BACKUP_COUNT = 3;

export interface LoadResult {
  state: GameState;
  isNew: boolean;
  recoveredFromBackup: boolean;
  corrupted: boolean;
}

export class SaveManager {
  constructor(private store: KeyValueStore = defaultStore()) {}

  private parse(raw: string): GameState | null {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const migrated = migrate(obj);
      const result = gameStateSchema.safeParse(migrated);
      if (!result.success) return null;
      // The schema fills defaults; cast is safe because schema mirrors GameState.
      return result.data as unknown as GameState;
    } catch {
      return null;
    }
  }

  load(now = Date.now()): LoadResult {
    const raw = this.store.getItem(SAVE_KEY);
    if (raw === null) {
      const state = this.applyStoredSettings(createInitialState(now));
      return { state, isNew: true, recoveredFromBackup: false, corrupted: false };
    }
    const parsed = this.parse(raw);
    if (parsed) {
      return { state: parsed, isNew: false, recoveredFromBackup: false, corrupted: false };
    }
    // main save corrupted — walk backups newest-first
    for (let i = 0; i < BACKUP_COUNT; i += 1) {
      const bakRaw = this.store.getItem(BACKUP_PREFIX + i);
      if (bakRaw) {
        const bak = this.parse(bakRaw);
        if (bak) return { state: bak, isNew: false, recoveredFromBackup: true, corrupted: true };
      }
    }
    // total loss — start fresh but keep any separately-stored settings
    const state = this.applyStoredSettings(createInitialState(now));
    return { state, isNew: true, recoveredFromBackup: false, corrupted: true };
  }

  private applyStoredSettings(state: GameState): GameState {
    const raw = this.store.getItem(SETTINGS_KEY);
    if (!raw) return state;
    try {
      const settings = JSON.parse(raw);
      return { ...state, settings: { ...state.settings, ...settings } };
    } catch {
      return state;
    }
  }

  save(state: GameState): void {
    const serialized = JSON.stringify(state);
    try {
      // rotate backups: bak.(n-1) <- ... <- bak.0 <- current main
      const currentMain = this.store.getItem(SAVE_KEY);
      if (currentMain) {
        for (let i = BACKUP_COUNT - 1; i > 0; i -= 1) {
          const prev = this.store.getItem(BACKUP_PREFIX + (i - 1));
          if (prev) this.store.setItem(BACKUP_PREFIX + i, prev);
        }
        this.store.setItem(BACKUP_PREFIX + 0, currentMain);
      }
      // localStorage.setItem is atomic per-key; a failed write leaves the
      // previous value intact.
      this.store.setItem(SAVE_KEY, serialized);
      this.store.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (err) {
      console.error('Save failed', err);
    }
  }

  exportSave(state: GameState): string {
    // human-readable, base-safe export string
    return JSON.stringify(state, null, 2);
  }

  importSave(json: string): { ok: boolean; state?: GameState; error?: string } {
    const parsed = this.parse(json);
    if (!parsed) return { ok: false, error: 'invalid' };
    // sanitize: clamp obviously-cheated / NaN values happens in schema catches
    return { ok: true, state: parsed };
  }

  reset(now = Date.now()): GameState {
    for (let i = 0; i < BACKUP_COUNT; i += 1) this.store.removeItem(BACKUP_PREFIX + i);
    this.store.removeItem(SAVE_KEY);
    // keep settings on reset
    return this.applyStoredSettings(createInitialState(now));
  }
}
