import { BALANCE, SAVE_VERSION } from './config';
import type { EmployeeRuntimeState, GameSettings, GameState } from './types';
import { EMPLOYEES, FOUNDER_ID } from '../content/employees';
import { ensureDailyForDate } from './dailyChallenges';

export function defaultSettings(): GameSettings {
  return {
    language: 'en',
    masterMuted: false,
    volumes: { master: 0.8, music: 0.5, ambience: 0.5, ui: 0.8, sfx: 0.8 },
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
    focusHarvestEnabled: false,
    offlineCapHours: BALANCE.offline.defaultCapHours,
  };
}

function initialEmployees(): Record<string, EmployeeRuntimeState> {
  const map: Record<string, EmployeeRuntimeState> = {};
  EMPLOYEES.forEach((e, i) => {
    map[e.id] = {
      hired: e.id === FOUNDER_ID,
      level: e.id === FOUNDER_ID ? 1 : 0,
      friendship: e.id === FOUNDER_ID ? 20 : 0,
      outfitId: e.outfits[0]?.id ?? null,
      nickname: null,
      x: 0.15 + i * 0.12,
    };
  });
  return map;
}

export function createInitialState(now = Date.now(), settings?: Partial<GameSettings>): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSaved: now,
    company: { name: 'Nutshell Inc.' },
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
    collections: { nuts: [], outfits: ['pip-classic'], logos: ['default'], moments: [], secrets: [] },
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
    settings: { ...defaultSettings(), ...settings },
    onboardingComplete: false,
    eventCooldowns: {},
    pendingChain: null,
  };
}
