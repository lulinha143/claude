// Shared simulation types. These describe the persisted game state and the
// runtime shapes the engine works with. Content *definitions* (the catalogue
// of employees, upgrades, events…) live in `src/content` and are referenced by
// id here so save files stay small and forward-compatible.

export type ResourceId = 'nuts' | 'goldenNuts' | 'permanentKernels';

export interface ResourceState {
  nuts: number;
  goldenNuts: number;
  permanentKernels: number;
  /** 0..100 company-wide modifier. */
  morale: number;
  /** grows over time, unlocks applicants/rooms/events. */
  reputation: number;
}

export interface EmployeeRuntimeState {
  hired: boolean;
  level: number;
  friendship: number; // 0..100
  outfitId: string | null;
  nickname: string | null;
  /** Position within the office scene, normalized 0..1 (x only for the 2D office). */
  x: number;
}

export type PrestigeBranchId =
  | 'industrial'
  | 'cooperative'
  | 'science'
  | 'marketing'
  | 'underground';

export interface PrestigeState {
  count: number;
  branch: PrestigeBranchId | null;
  skills: Record<string, number>; // skillId -> level
}

export interface FocusState {
  active: boolean;
  /** epoch ms when the session ends. */
  endsAt: number;
  /** planned duration in seconds. */
  durationSeconds: number;
  completedSessions: number;
}

export interface MomentCard {
  id: string;
  eventId: string;
  employeeId: string | null;
  caption: string;
  rarity: EventRarity;
  createdAt: number;
}

export type EventRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface DailyChallengeProgress {
  id: string;
  goal: number;
  progress: number;
  claimed: boolean;
}

export interface DailyState {
  date: string; // YYYY-MM-DD (local)
  challenges: DailyChallengeProgress[];
}

export interface StatsState {
  totalNutsEarned: number;
  totalClicks: number;
  cratesCollected: number;
  playTimeSeconds: number;
  eventsSeen: number;
  microgamesPlayed: number;
  highestNutsPerSecond: number;
  prestiges: number;
}

export interface GameSettings {
  language: string;
  masterMuted: boolean;
  volumes: { master: number; music: number; ambience: number; ui: number; sfx: number };
  reducedMotion: boolean;
  disableShake: boolean;
  disableFlashing: boolean;
  highContrast: boolean;
  colorblindMode: 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  dyslexiaFont: boolean;
  fontScale: number; // 1 = 100%
  uiScale: number;
  subtitles: boolean;
  quietMode: boolean;
  pauseAnimationsInMenus: boolean;
  fpsLimit: 30 | 60;
  focusHarvestEnabled: boolean;
  offlineCapHours: number;
}

/** Serialized, persisted game state. Bump `SAVE_VERSION` when this changes. */
export interface GameState {
  version: number;
  createdAt: number;
  lastSaved: number;
  company: { name: string };
  resources: ResourceState;
  employees: Record<string, EmployeeRuntimeState>;
  upgrades: Record<string, number>; // upgradeId -> owned count/level
  achievements: Record<string, number>; // achievementId -> unlock timestamp (0 = locked)
  collections: {
    nuts: string[];
    outfits: string[];
    logos: string[];
    moments: MomentCard[];
    secrets: string[];
  };
  prestige: PrestigeState;
  focus: FocusState;
  daily: DailyState;
  stats: StatsState;
  settings: GameSettings;
  onboardingComplete: boolean;
  /** Cooldown bookkeeping for the event system: eventId -> next-eligible epoch ms. */
  eventCooldowns: Record<string, number>;
  /** Pending multi-step event chain, if any. */
  pendingChain: { eventId: string; step: number } | null;
}

export interface ProductionBreakdownEntry {
  source: string; // 'employee:pip' | 'upgrade:...' | 'base'
  nutsPerSecond: number;
}

export interface ProductionResult {
  nutsPerSecond: number;
  multiplier: number;
  breakdown: ProductionBreakdownEntry[];
}
