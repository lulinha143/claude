import { create } from 'zustand';
import { GameEngine, type DecorationPurchase } from '../sim/engine';
import { SaveManager } from '../save/saveManager';
import {
  addAway,
  leaveTally,
  summarizeReturn,
  tallyFromAway,
  type ReturnSummary,
  type ReturnTally,
} from './returns';
import { performPrestige, buyPrestigeSkill } from '../sim/prestige';
import type { GameState, PrestigeBranchId } from '../sim/types';
import { getPlatform } from '../platform/adapter';
import { audio } from '../audio/audio';
import { createAchievementAdapter } from '../platform/achievements';
import { evaluateAchievements } from '../sim/achievements';
import { unlockedRooms } from '../sim/rooms';
import { ROOMS_BY_ID } from '../content/rooms';
import { REPUTATION_TIERS, reputationTier } from '../content/reputationTiers';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { ACHIEVEMENTS_BY_ID } from '../content/achievements';
import { PRESTIGE_BRANCHES_BY_ID } from '../content/prestige';
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
/** No save existed at boot: a brand-new company that has not chosen anything yet. */
export const BOOT_SAVE_IS_NEW = loaded.isNew;
const engine = new GameEngine(loaded.state, { deterministic: false });
engine.onSave((s) => save.save(s));

// The time the game was closed, settled once at the away rules on boot (not for a
// brand-new game): the vault and the crate, the finds and incidents that time
// brought. The engine files it at once, so a reload cannot pay it twice.
//
// `returnTally` is kept from the moment the player leaves (the save, here; the
// window going out of sight, later) until they are back, when it becomes the
// welcome-back note.
let returnTally: ReturnTally | null = null;
let returnId = 0;
if (!loaded.isNew) {
  const left = leaveTally(engine.state, engine.state.lastSaved);
  const settled = engine.settleClosedTime();
  if (settled && !settled.ignored) returnTally = addAway(left, settled, 'closed');
}

/** The office is on screen (a window can boot minimized, or out of sight). */
function officeInSight(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

/** The player is back: the stretch they were gone, as a note (or nothing, if trivial). */
function takeReturn(): ReturnSummary | null {
  if (!returnTally) return null;
  const summary = summarizeReturn(returnTally, engine.state, Date.now(), ++returnId);
  returnTally = null;
  return summary;
}

interface StoreState {
  frame: number;
  view: ViewId;
  engine: GameEngine;
  save: SaveManager;
  platform: typeof platform;
  audio: typeof audio;
  devEnabled: boolean;
  /** The welcome-back note, while it is up. */
  returnSummary: ReturnSummary | null;
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
  dismissReturn: () => void;
  /** Developer tools: settle `seconds` away now and show its note. */
  simulateAway: (seconds: number) => void;
  setPhotoMode: (v: boolean) => void;
  setBatterySaver: (v: boolean) => void;
  setQuietMode: (v: boolean) => void;
  toggleMute: () => void;
  toggleMusic: () => void;
  finishOnboarding: () => void;
  replayOnboarding: () => void;

  buyDecoration: (id: string) => DecorationPurchase;
  /** Restructure the company (refused unless it is open); true when it happened. */
  doPrestige: (branch: PrestigeBranchId) => boolean;
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
    // Booted out of sight (minimized, a background tab): the note waits for the player.
    returnSummary: officeInSight() ? takeReturn() : null,
    // The first run teaches by doing (the coach points at the crate, then at the
    // first goal); the field guide is no longer forced open. It is still there to
    // read from Settings (replayOnboarding).
    showOnboarding: false,
    showOpening: loaded.isNew && !engine.state.onboardingComplete,
    finishOpening: () => {
      if (!engine.state.onboardingComplete) engine.markOnboardingComplete();
      set({ showOpening: false });
    },
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
    dismissReturn: () => set({ returnSummary: null }),
    simulateAway: (seconds) => {
      // Measured from before the settlement, as if the game had been closed `seconds` ago.
      const left = leaveTally(engine.state, Date.now() - seconds * 1000);
      returnTally = addAway(left, engine.settleAway(seconds), 'closed');
      set({ returnSummary: takeReturn() });
    },
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

    // The catalogue's purchase: the engine checks, charges once, files it and
    // saves (see engine.purchaseDecoration). The sheet says what happened.
    buyDecoration: (id) => {
      const result = engine.purchaseDecoration(id);
      audio.play(result.ok ? 'upgrade' : 'error');
      return result;
    },

    // One restructure per confirmation: the sim refuses unless this cycle reached
    // the line (a second press, or a stale screen, finds the new cycle at zero), and
    // the old company stays untouched until the new one replaces it whole.
    doPrestige: (branch) => {
      const before = engine.state;
      const next = performPrestige(before, branch, Date.now());
      if (next === before) {
        audio.play('error');
        return false;
      }
      const earned = next.resources.permanentKernels - before.resources.permanentKernels;
      replaceStateQuietly(next);
      engine.save();
      audio.play('prestige');
      notify(
        'kernel',
        i18n.t('notify.restructured', {
          cycle: next.prestige.count + 1,
          count: earned,
          branch: i18n.t(PRESTIGE_BRANCHES_BY_ID[branch]?.nameKey ?? ''),
        }),
        'gold',
      );
      set({ view: 'office' });
      return true;
    },

    buySkill: (id) => {
      const ok = buyPrestigeSkill(engine.state, id);
      if (ok) {
        engine.save();
        set({ frame: engine.getVersion() + 1 });
        audio.play('upgrade');
      } else {
        // A short press is answered (the card says how many kernels are missing).
        audio.play('error');
      }
      return ok;
    },

    hardReset: () => {
      const fresh = save.reset();
      replaceStateQuietly(fresh);
      engine.save();
      set({ showOnboarding: true, view: 'office' });
    },

    // An imported company resumes as it was filed (see engine.replaceState): the
    // time since it was exported is not paid, so importing it again pays nothing.
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
  // Another company: whatever the note said about the old one no longer applies.
  returnTally = null;
  useStore.setState({ returnSummary: null });
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

  // Someone the four-per-room cap moved to another desk (an old save with a
  // crowded room, a hire who took a seat). Nobody vanishes, and nobody is moved
  // without the player hearing where they went.
  if (engine.rehomed.length > 0) {
    const moved = engine.rehomed.splice(0, engine.rehomed.length);
    const nameOf = (id: string) =>
      st.employees[id]?.nickname ?? i18n.t(EMPLOYEES_BY_ID[id]?.nameKey ?? id);
    const roomOf = (id: string) => i18n.t(ROOMS_BY_ID[id]?.nameKey ?? id);
    // Where each one went, when that is short enough to read (it usually is:
    // an old save's crowded room sends one or two elsewhere); names past that.
    const where = (item: { employeeId: string; roomId: string }) =>
      i18n.t('notify.rehomedTo', { name: nameOf(item.employeeId), room: roomOf(item.roomId) });
    notify(
      'rooms',
      moved.length <= 2
        ? i18n.t('notify.rehomedFew', { moves: moved.map(where).join(' · ') })
        : i18n.t('notify.rehomedMany', {
            count: moved.length,
            names: moved.map((item) => nameOf(item.employeeId)).join(', '),
          }),
      'neutral',
    );
  }

  // Promised consequences that have just come due. Announcing these is what keeps
  // a delayed penalty fair: the player sees the bill AND what it is settling up
  // for, rather than an unexplained swing minutes after the decision.
  if (engine.settledConsequences.length > 0) {
    const settled = engine.settledConsequences.splice(0, engine.settledConsequences.length);
    for (const item of settled) {
      // Not every promise is a bill: a teammate coming back with something for
      // you (their story's kind answer paying off) is good news, and says so.
      const costly = item.effects.some((effect) => (effect.value ?? 0) < 0);
      notify(
        'moment',
        i18n.t('notify.consequenceSettled', {
          title: i18n.t(item.titleKey),
          body: i18n.t(item.bodyKey),
        }),
        costly ? 'negative' : 'positive',
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

/** The player is back from somewhere: show the note, with one soft paper sound. */
function welcomeBack(): void {
  const summary = takeReturn();
  if (!summary) return;
  useStore.setState({ returnSummary: summary });
  audio.play('paper');
}

/**
 * Advance the company to the present (see `engine.catchUp` for the one rule).
 *
 * ZooWorkers is meant to be left open in a corner of the desktop, so open time is
 * never lost: a minimized window, a hidden tab or a battery-saving browser can
 * stretch the 100ms interval to a second or a whole minute, and all of it is open
 * play. A gap longer than `awayGapSeconds` means the computer slept or the process
 * was frozen, which is settled like time with the game closed — and is a return
 * of its own when it happened in front of the player.
 */
export function advanceGame(): void {
  const result = engine.catchUp();
  if (result && !result.ignored) {
    // Out of sight already, the sleep joins the stretch the player is away; in
    // front of them, it is a return of its own.
    returnTally = returnTally
      ? addAway(returnTally, result, 'asleep')
      : tallyFromAway(engine.state, result, Date.now());
  }
  // In sight with a stretch away still open: the player is back (this also covers
  // a window the browser never said had come back).
  if (returnTally && officeInSight()) {
    engine.setAttended(true);
    welcomeBack();
  }
}

export function startGameLoop(): void {
  if (loopHandle) return;
  loopHandle = setInterval(() => advanceGame(), 100);
}

export function stopGameLoop(): void {
  if (loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
  engine.catchUp();
  engine.save();
}

/**
 * The window going out of sight and coming back. Leaving: the open time up to this
 * moment is counted first (the browser may not wake the loop again for a minute),
 * then the company is filed and the stretch away begins. Back: the time since is
 * settled at once (not at the next, possibly throttled, interval) and the player
 * is told what it brought, if it was more than a glance away.
 */
function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    engine.catchUp();
    engine.setAttended(false);
    // The next stretch away starts here. A note still up stays up: a glance at
    // another window must not take it away unread; a real absence replaces it.
    returnTally = leaveTally(engine.state, Date.now());
    engine.save();
    return;
  }
  advanceGame();
  engine.setAttended(true);
}

// File the company on page hide/unload, with the time up to that moment counted.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    engine.catchUp();
    engine.save();
  });
  document.addEventListener('visibilitychange', onVisibilityChange);
  // Booted out of sight: nobody can see what is waiting yet.
  if (!officeInSight()) engine.setAttended(false);
}

export function getGameState(): GameState {
  return engine.state;
}

// re-export for dev tools
export { evaluateAchievements };
