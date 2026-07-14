import { create } from 'zustand';
import { GameEngine } from '../sim/engine';
import { SaveManager } from '../save/saveManager';
import { computeOffline, applyOffline, type OfflineResult } from '../sim/offline';
import { performPrestige, buyPrestigeSkill } from '../sim/prestige';
import type { GameState, PrestigeBranchId } from '../sim/types';
import { getPlatform } from '../platform/adapter';
import { audio } from '../audio/audio';
import { createAchievementAdapter } from '../platform/achievements';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { evaluateAchievements } from '../sim/achievements';

export type ViewId =
  | 'office'
  | 'shop'
  | 'employees'
  | 'company'
  | 'collections'
  | 'achievements'
  | 'focus'
  | 'decorate'
  | 'settings'
  | 'stats'
  | 'prestige';

function isDevEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dev') === '1') return true;
    }
  } catch {
    /* ignore */
  }
  return import.meta.env.DEV;
}

const save = new SaveManager();
const platform = getPlatform();
const achievements = createAchievementAdapter();

const loaded = save.load();
const engine = new GameEngine(loaded.state, { deterministic: false });
engine.onSave((s) => save.save(s));

// Offline progression on boot (not for a brand-new game).
let bootOffline: OfflineResult | null = null;
if (!loaded.isNew) {
  bootOffline = computeOffline(engine.state, Date.now());
  applyOffline(engine.state, bootOffline);
}

interface StoreState {
  frame: number;
  view: ViewId;
  engine: GameEngine;
  save: SaveManager;
  platform: typeof platform;
  audio: typeof audio;
  devEnabled: boolean;
  offlineResult: OfflineResult | null;
  showOnboarding: boolean;
  showOpening: boolean;
  finishOpening: () => void;
  photoMode: boolean;
  quietMode: boolean;
  recovered: boolean;

  setView: (v: ViewId) => void;
  dismissOffline: () => void;
  setPhotoMode: (v: boolean) => void;
  setQuietMode: (v: boolean) => void;
  finishOnboarding: () => void;
  replayOnboarding: () => void;

  buyDecoration: (id: string) => boolean;
  doPrestige: (branch: PrestigeBranchId) => void;
  buySkill: (id: string) => boolean;
  hardReset: () => void;
  importSave: (json: string) => boolean;
}

export const useStore = create<StoreState>((set) => {
  // Bridge engine emissions into React by bumping `frame`.
  engine.subscribe(() => set({ frame: engine.getVersion() }));

  return {
    frame: 0,
    view: 'office',
    engine,
    save,
    platform,
    audio,
    devEnabled: isDevEnabled(),
    offlineResult: bootOffline && !bootOffline.ignored && bootOffline.nutsEarned > 0 ? bootOffline : null,
    showOnboarding: !engine.state.onboardingComplete,
    showOpening: loaded.isNew && !engine.state.onboardingComplete,
    finishOpening: () => set({ showOpening: false }),
    photoMode: false,
    quietMode: engine.state.settings.quietMode,
    recovered: loaded.recoveredFromBackup,

    setView: (v) => set({ view: v }),
    dismissOffline: () => set({ offlineResult: null }),
    setPhotoMode: (v) => set({ photoMode: v }),
    setQuietMode: (v) => {
      engine.updateSettings({ quietMode: v });
      audio.setFlags({ quiet: v });
      set({ quietMode: v });
    },
    finishOnboarding: () => {
      engine.markOnboardingComplete();
      set({ showOnboarding: false });
    },
    replayOnboarding: () => set({ showOnboarding: true }),

    buyDecoration: (id) => {
      const def = DECORATIONS_BY_ID[id];
      if (!def) return false;
      const key = `deco:${id}`;
      if (engine.state.collections.secrets.includes(key)) return false;
      if (!engine.canAfford(def.cost.resource, def.cost.amount)) return false;
      engine.spendResource(def.cost.resource, def.cost.amount);
      engine.buyDecoration(id);
      engine.addMoraleFromDecoration(def.moraleBonus);
      audio.play('upgrade');
      return true;
    },

    doPrestige: (branch) => {
      const next = performPrestige(engine.state, branch, Date.now());
      engine.replaceState(next);
      engine.save();
      audio.play('prestige');
      set({ view: 'office' });
    },

    buySkill: (id) => {
      const ok = buyPrestigeSkill(engine.state, id);
      if (ok) {
        engine.save();
        set({ frame: engine.getVersion() + 1 });
        audio.play('upgrade');
      }
      return ok;
    },

    hardReset: () => {
      const fresh = save.reset();
      engine.replaceState(fresh);
      engine.save();
      set({ showOnboarding: true, view: 'office' });
    },

    importSave: (json) => {
      const result = save.importSave(json);
      if (!result.ok || !result.state) return false;
      engine.replaceState(result.state);
      engine.save();
      set({ view: 'office' });
      return true;
    },
  };
});

// Sync achievement unlocks to the platform adapter whenever they change.
let lastAchCount = Object.values(engine.state.achievements).filter((v) => v > 0).length;
engine.subscribe(() => {
  const now = Object.entries(engine.state.achievements).filter(([, v]) => v > 0);
  if (now.length !== lastAchCount) {
    for (const [id] of now) achievements.unlock(id);
    lastAchCount = now.length;
  }
});

// ---------------------------------------------------------------------------
// Game loop. Ticks the deterministic simulation at a fixed cadence (10 Hz),
// independent of the SVG animation which runs on CSS/rAF. This keeps React
// re-renders bounded while the office animates smoothly.
// ---------------------------------------------------------------------------
let loopHandle: ReturnType<typeof setInterval> | null = null;
let lastTick = Date.now();

export function startGameLoop(): void {
  if (loopHandle) return;
  lastTick = Date.now();
  loopHandle = setInterval(() => {
    const now = Date.now();
    const delta = Math.min(5, (now - lastTick) / 1000);
    lastTick = now;
    // Battery-friendly / quiet mode reduces frequency implicitly via delta.
    engine.tick(delta);
  }, 100);
}

export function stopGameLoop(): void {
  if (loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
  engine.save();
}

// Persist on page hide/unload so nothing is lost.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => engine.save());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') engine.save();
  });
}

export function getGameState(): GameState {
  return engine.state;
}

// re-export for dev tools
export { evaluateAchievements };
