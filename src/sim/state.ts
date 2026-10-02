import { BALANCE, SAVE_VERSION } from './config';
import type { EmployeeRuntimeState, GameSettings, GameState } from './types';
import { EMPLOYEES, FOUNDER_ID } from '../content/employees';
import { ensureDailyForDate } from './dailyChallenges';

export function defaultSettings(): GameSettings {
  return {
    language: 'en',
    masterMuted: false,
    channelMuted: { music: false, ambience: false, ui: false, sfx: false },
    muteWhenUnfocused: false,
    // Louder, more present default mix (0..1). A master limiter prevents clipping.
    volumes: { master: 0.85, music: 0.7, ambience: 0.75, ui: 0.8, sfx: 0.85 },
    reducedMotion: false,
    disableShake: false,
    disableFlashing: false,
    highContrast: false,
    colorblindMode: 'off',
    dyslexiaFont: false,
    fontScale: 1,
    uiScale: 1,
    subtitles: false,
    quietMode: false,
    pauseAnimationsInMenus: false,
    fpsLimit: 60,
    autoResolveEvents: false,
    focusHarvestEnabled: false,
    offlineCapHours: BALANCE.offline.defaultCapHours,
    showHints: true,
    officeFloor: null,
    background: {
      enabled: true,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blurBehindPanels: true,
      quality: 'high',
      focal: 'center',
      pauseWhenHidden: true,
    },
  };
}

function makeEmployeeState(e: (typeof EMPLOYEES)[number], i: number): EmployeeRuntimeState {
  return {
    hired: e.id === FOUNDER_ID,
    level: e.id === FOUNDER_ID ? 1 : 0,
    friendship: e.id === FOUNDER_ID ? 20 : 0,
    outfitId: e.outfits[0]?.id ?? null,
    nickname: null,
    room: null, // resolved to their department (or Founder's Desk) at render time
    x: 0.15 + i * 0.12,
    emotion: null,
    talks: { count: 0, lastAt: 0, seen: {} },
  };
}

function initialEmployees(): Record<string, EmployeeRuntimeState> {
  const map: Record<string, EmployeeRuntimeState> = {};
  EMPLOYEES.forEach((e, i) => {
    map[e.id] = makeEmployeeState(e, i);
  });
  return map;
}

/**
 * Ensure every employee DEFINED in content has a runtime entry. This protects
 * against saves created before an employee was added to the game (a real
 * update scenario): without it, any screen that maps over all employees (e.g.
 * the Team view) would read `undefined.level` and crash. Missing employees are
 * added as un-hired. Returns the ids that were backfilled.
 */
export function repairEmployees(state: GameState): string[] {
  if (!state.employees || typeof state.employees !== 'object') state.employees = {};
  const added: string[] = [];
  EMPLOYEES.forEach((e, i) => {
    if (!state.employees[e.id]) {
      state.employees[e.id] = makeEmployeeState(e, i);
      added.push(e.id);
    }
    // Conversation memory arrived after these saves existed. Backfilling it here as
    // well as in the migration means an employee added by a LATER content update
    // also gets it, which the migration alone cannot do.
    const rt = state.employees[e.id];
    if (!rt.talks || typeof rt.talks !== 'object') {
      rt.talks = { count: 0, lastAt: 0, seen: {} };
    } else if (!rt.talks.seen || typeof rt.talks.seen !== 'object') {
      rt.talks.seen = {};
    }
  });
  return added;
}

export function createInitialState(now = Date.now(), settings?: Partial<GameSettings>): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSaved: now,
    company: { name: 'Nutshell Inc.', icon: 'paw' },
    resources: {
      nuts: BALANCE.startingNuts,
      goldenNuts: 0,
      permanentKernels: 0,
      morale: BALANCE.morale.start,
      reputation: BALANCE.reputation.start,
    },
    employees: initialEmployees(),
    upgrades: {},
    achievements: {},
    placements: {},
    decorationInstances: [],
    collections: {
      nuts: [],
      outfits: ['pip-classic'],
      logos: ['default'],
      moments: [],
      secrets: [],
    },
    prestige: { count: 0, branch: null, skills: {} },
    focus: { active: false, endsAt: 0, durationSeconds: 0, completedSessions: 0 },
    daily: ensureDailyForDate(undefined, now),
    stats: {
      totalNutsEarned: 0,
      totalClicks: 0,
      cratesCollected: 0,
      playTimeSeconds: 0,
      eventsSeen: 0,
      microgamesPlayed: 0,
      highestNutsPerSecond: 0,
      prestiges: 0,
    },
    clicker: {
      stationTaps: {},
      criticalTaps: 0,
      goldenTaps: 0,
      bestStreak: 0,
      rushes: 0,
      findsCollected: 0,
    },
    crate: { nuts: 0 },
    finds: [],
    office: { rooms: {}, oddities: [] },
    settings: { ...defaultSettings(), ...settings },
    onboardingComplete: false,
    eventCooldowns: {},
    flags: {},
    scheduled: [],
    eventInProgress: null,
    boosts: [],
    microgames: {},
    pendingChain: null,
    eventHistory: [],
  };
}
