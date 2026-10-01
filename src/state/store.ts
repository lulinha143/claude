import { create } from 'zustand';
import { GameEngine } from '../sim/engine';
import { SaveManager } from '../save/saveManager';
import {
  computeOffline,
  applyOffline,
  shouldShowOfflineModal,
  type OfflineResult,
} from '../sim/offline';
import { performPrestige, buyPrestigeSkill } from '../sim/prestige';
import type { GameState, PrestigeBranchId } from '../sim/types';
import { getPlatform } from '../platform/adapter';
import { audio } from '../audio/audio';
import { createAchievementAdapter } from '../platform/achievements';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { evaluateAchievements } from '../sim/achievements';
import { unlockedRooms } from '../sim/rooms';
import { ROOMS_BY_ID } from '../content/rooms';
import { REPUTATION_TIERS, reputationTier } from '../content/reputationTiers';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { ACHIEVEMENTS_BY_ID } from '../content/achievements';
import { notify } from '../ui/notificationsStore';
import i18n from '../i18n';

// Read-only audio diagnostics hook so end-to-end tests can verify the REAL
// rendered mute button actually drives every audio bus to zero (not just the
// AudioManager methods in isolation). Harmless: exposes only effective gains.
if (typeof window !== 'undefined') {
  (window as unknown as { __wmnoAudioDiag?: () => unknown }).__wmnoAudioDiag = () =>
    audio.getDiagnostics();
}

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
  masterMuted: boolean;
  musicMuted: boolean;
  batterySaver: boolean;
  recovered: boolean;

  setView: (v: ViewId) => void;
  decorationRequest: string | null;
  activityRequest: 'coffeeRescue' | 'bugSquash' | 'cableUntangle' | null;
  requestActivity: (mode: 'coffeeRescue' | 'bugSquash' | 'cableUntangle' | null) => void;
  /** A minigame is open on the Activities stage (the office is covered). */
  minigameOpen: boolean;
  setMinigameOpen: (open: boolean) => void;
  arrangeDecoration: (id: string | null) => void;
  dismissOffline: () => void;
  setPhotoMode: (v: boolean) => void;
  setBatterySaver: (v: boolean) => void;
  setQuietMode: (v: boolean) => void;
  toggleMute: () => void;
  toggleMusic: () => void;
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
    offlineResult: shouldShowOfflineModal(bootOffline) ? bootOffline : null,
    showOnboarding: !engine.state.onboardingComplete,
    showOpening: loaded.isNew && !engine.state.onboardingComplete,
    finishOpening: () => set({ showOpening: false }),
    photoMode: false,
    quietMode: engine.state.settings.quietMode,
    masterMuted: engine.state.settings.masterMuted,
    musicMuted: !!engine.state.settings.channelMuted?.music,
    batterySaver: false,
    recovered: loaded.recoveredFromBackup,

    setView: (v) => set({ view: v }),
    decorationRequest: null,
    activityRequest: null,
    requestActivity: (mode) => {
      if (mode) engine.closeTalk();
      set(mode ? { activityRequest: mode, view: 'focus' } : { activityRequest: null });
    },
    minigameOpen: false,
    setMinigameOpen: (open) => set({ minigameOpen: open }),
    arrangeDecoration: (id) => {
      if (id) engine.closeTalk();
      set(id ? { decorationRequest: id, view: 'office' } : { decorationRequest: null });
    },
    dismissOffline: () => set({ offlineResult: null }),
    setPhotoMode: (v) => set({ photoMode: v }),
    setBatterySaver: (v) => set({ batterySaver: v }),
    setQuietMode: (v) => {
      engine.updateSettings({ quietMode: v });
      audio.setFlags({ quiet: v });
      set({ quietMode: v });
    },
    // The visible header speaker button = real Master Mute. Applies to the audio
    // engine immediately and persists right away (a deliberate, must-survive
    // action), so a new session restores it.
    toggleMute: () => {
      const v = !engine.state.settings.masterMuted;
      // Ensure the audio context exists + gains are (re)applied on THIS click.
      // The mute button may be the player's first interaction; relying only on
      // the separate first-gesture resume listener is fragile in the packaged
      // Electron build, so resume here too (no-op once the context is live).
      audio.resume();
      engine.updateSettings({ masterMuted: v });
      audio.setFlags({ muted: v });
      engine.save();
      set({ masterMuted: v });
    },
    // The second header button = Music toggle. Mutes ONLY the background music +
    // ambience beds (SFX, interface, minigame and event sounds keep playing).
    // Master mute overrides this; when master mute is lifted, music resumes only
    // if the Music toggle is still on. State persists across sessions.
    toggleMusic: () => {
      const v = !engine.state.settings.channelMuted?.music;
      audio.resume();
      const channelMuted = { ...engine.state.settings.channelMuted, music: v, ambience: v };
      engine.updateSettings({ channelMuted });
      audio.setChannelMutes({ music: v, ambience: v });
      engine.save();
      set({ musicMuted: v });
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
      if (next === engine.state) return;
      replaceStateQuietly(next);
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
      replaceStateQuietly(fresh);
      engine.save();
      set({ showOnboarding: true, view: 'office' });
    },

    importSave: (json) => {
      const result = save.importSave(json);
      if (!result.ok || !result.state) return false;
      replaceStateQuietly(result.state);
      engine.save();
      set({ view: 'office' });
      return true;
    },
  };
});

// ---------------------------------------------------------------------------
// Change detection: diff the state each emit and (a) mirror achievement unlocks
// to the platform adapter, (b) raise player-facing toast notifications for
// meaningful changes (hires, room unlocks, achievements). Runs renderer-side so
// it may use i18n; the sim layer stays framework-independent.
// ---------------------------------------------------------------------------
function unlockedRoomIdSet(state: GameState): Set<string> {
  return new Set(unlockedRooms(state).map((r) => r.id));
}
let prevAch = new Set(
  Object.entries(engine.state.achievements)
    .filter(([, v]) => v > 0)
    .map(([k]) => k),
);
let prevHired = new Set(
  Object.keys(engine.state.employees).filter((id) => engine.state.employees[id]?.hired),
);
let prevRooms = unlockedRoomIdSet(engine.state);
/** Timestamp of the last auto-resolved event already announced. */
let prevAutoResolvedAt = engine.lastAutoResolved?.at ?? 0;
/** The standing tier already announced, so a tier-up fires exactly once. */
let prevRepTier = reputationTier(engine.state.resources.reputation).id;

let suppressNotify = false;
function resetChangeTracking(): void {
  prevAch = new Set(
    Object.entries(engine.state.achievements)
      .filter(([, v]) => v > 0)
      .map(([k]) => k),
  );
  prevHired = new Set(
    Object.keys(engine.state.employees).filter((id) => engine.state.employees[id]?.hired),
  );
  prevRooms = unlockedRoomIdSet(engine.state);
  prevAutoResolvedAt = engine.lastAutoResolved?.at ?? 0;
  prevRepTier = reputationTier(engine.state.resources.reputation).id;
}

/**
 * Record achievements that are ALREADY satisfied by existing progress, without
 * announcing them one by one. Returns how many were caught up.
 *
 * THE BUG THIS FIXES
 * ------------------
 * Achievements are evaluated at the end of every tick, and anything newly
 * satisfied is announced as its own gold toast. That is right for an achievement
 * the player just earned, and wrong for one they earned some time ago — and on the
 * FIRST tick after a load, those are indistinguishable, because the tick has no
 * idea whether the progress that satisfies a condition happened a second ago or
 * last week.
 *
 * So loading a save could unlock a dozen achievements at once and greet the player
 * with a wall of toasts covering the office. It is not only a seeded-save
 * artefact; three ordinary paths reach it:
 *
 *   1. A CONTENT UPDATE that adds achievements. Every returning player already
 *      satisfies most of the new ones, so all of them fire together on next load.
 *      This is the common case and it gets worse the longer the game is supported.
 *   2. A save whose `achievements` record fails validation. The schema repairs it
 *      with `.catch({})` (save/schema.ts), which is the right call for
 *      robustness — but it means every achievement the player ever earned is
 *      "new" again on the next tick.
 *   3. OFFLINE PROGRESSION crossing several thresholds while the game was closed,
 *      which boot applies before the first tick.
 *
 * The fix is to separate catch-up from earning, at the only point where the
 * difference is actually known: load. Anything already true before the game
 * starts running is caught up silently and summarised in ONE toast.
 *
 * Deliberately NOT a suppression: `evaluateAchievements` still records them and
 * still pays their golden-nut rewards, and each is still mirrored to the platform
 * adapter, so nothing is lost and Steam still sees them. Only the interruption is
 * folded together. Genuinely new in-play unlocks are untouched and still announce
 * themselves individually.
 */
function catchUpAchievementsQuietly(): number {
  const caughtUp = evaluateAchievements(engine.state, Date.now());
  for (const id of caughtUp) achievements.unlock(id);
  // Re-baseline so the subscriber does not treat these as fresh unlocks.
  resetChangeTracking();
  return caughtUp.length;
}

/** Replace state (prestige/import/reset) without flooding toasts for the whole company. */
export function replaceStateQuietly(next: GameState): void {
  suppressNotify = true;
  engine.replaceState(next);
  // An imported save is a load like any other, so it gets the same treatment:
  // whatever it already satisfies is history, not an achievement ceremony.
  catchUpAchievementsQuietly();
  resetChangeTracking();
  suppressNotify = false;
}

/**
 * Achievements reconciled at boot, waiting to be summarised.
 *
 * Announced from the subscriber rather than here because this runs during module
 * initialisation, before i18n has necessarily loaded its bundles — translating at
 * that point yields raw key names. The subscriber is where every other
 * notification is translated, so it is where this one belongs too.
 */
let pendingAchievementCatchUp = catchUpAchievementsQuietly();

engine.subscribe(() => {
  if (suppressNotify) return;
  const st = engine.state;

  // One line for everything the save already had, instead of one toast each.
  if (pendingAchievementCatchUp > 0) {
    const count = pendingAchievementCatchUp;
    pendingAchievementCatchUp = 0;
    notify('achievements', i18n.t('notify.achievementsCaughtUp', { count }), 'gold');
  }

  // achievements
  for (const [id, v] of Object.entries(st.achievements)) {
    if (v > 0 && !prevAch.has(id)) {
      prevAch.add(id);
      achievements.unlock(id);
      const def = ACHIEVEMENTS_BY_ID[id];
      if (def) notify('achievements', `${i18n.t('ach.unlocked')} ${i18n.t(def.nameKey)}`, 'gold');
    }
  }

  // employee hires
  for (const id of Object.keys(st.employees)) {
    if (st.employees[id]?.hired && !prevHired.has(id)) {
      prevHired.add(id);
      const def = EMPLOYEES_BY_ID[id];
      if (def)
        notify('employees', i18n.t('notify.hired', { name: i18n.t(def.nameKey) }), 'positive');
    }
  }

  // room unlocks
  const rooms = unlockedRoomIdSet(st);
  for (const rid of rooms) {
    if (!prevRooms.has(rid)) {
      prevRooms.add(rid);
      const def = ROOMS_BY_ID[rid];
      if (def)
        notify('rooms', i18n.t('notify.roomUnlocked', { name: i18n.t(def.nameKey) }), 'positive');
    }
  }

  // Climbing the standing ladder is one of the game's real milestones, so it is
  // announced with the tier's own name and flavour line rather than passing by as
  // a number ticking over.
  const tier = reputationTier(st.resources.reputation);
  if (tier.id !== prevRepTier) {
    const climbed =
      REPUTATION_TIERS.indexOf(tier) > REPUTATION_TIERS.findIndex((t) => t.id === prevRepTier);
    prevRepTier = tier.id;
    if (climbed) {
      notify(
        'reputation',
        i18n.t('notify.repTierUp', { name: i18n.t(tier.nameKey), blurb: i18n.t(tier.blurbKey) }),
        'gold',
      );
    }
  }

  // Promised consequences that have just come due. Announcing these is what keeps
  // a delayed penalty fair: the player sees the bill AND what it is settling up
  // for, rather than an unexplained swing minutes after the decision.
  if (engine.settledConsequences.length > 0) {
    const settled = engine.settledConsequences.splice(0, engine.settledConsequences.length);
    for (const item of settled) {
      notify(
        'moment',
        i18n.t('notify.consequenceSettled', {
          title: i18n.t(item.titleKey),
          body: i18n.t(item.bodyKey),
        }),
        'negative',
      );
    }
  }

  // Events handled automatically because the player turned choice popups off.
  // Reporting them is what keeps the setting honest: the system is still running
  // and the player can see every decision that was taken for them.
  const auto = engine.lastAutoResolved;
  if (auto && auto.at !== prevAutoResolvedAt) {
    prevAutoResolvedAt = auto.at;
    notify(
      'moment',
      i18n.t('notify.eventAutoResolved', {
        title: i18n.t(auto.titleKey),
        choice: i18n.t(auto.choiceLabelKey),
      }),
      'neutral',
    );
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
