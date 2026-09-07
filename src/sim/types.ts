import type { DecorationPlacement } from './surfaces';

// Shared simulation types. These describe the persisted game state and the
// runtime shapes the engine works with. Content *definitions* (the catalogue
// of employees, upgrades, events…) live in `src/content` and are referenced by
// id here so save files stay small and forward-compatible.

import type { PlacementRegionKind } from './placementRegions';

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
  /**
   * The room the player has assigned this employee to, or null to use the
   * employee's default department. The engine guarantees a valid *resolved*
   * room at render time (see resolveEmployeeRoom) so an employee is never
   * invisible even if their department isn't unlocked yet.
   */
  room: string | null;
  /** Position within the office scene, normalized 0..1 (x only for the 2D office). */
  x: number;
  /**
   * Event-driven emotion override (persisted). Optional so older saves default
   * to none; the engine expires temporary emotions during the tick.
   */
  emotion?: EmployeeEmotion | null;
}

export type EmployeeMood =
  | 'happy'
  | 'proud'
  | 'relaxed'
  | 'focused'
  | 'inspired'
  | 'curious'
  | 'tired'
  | 'frustrated'
  | 'worried'
  | 'angry'
  | 'embarrassed'
  | 'overcaffeinated'
  | 'suspicious'
  | 'excited'
  | 'sad';

/**
 * A persisted, event-driven emotion override for one employee. When present and
 * not expired it takes priority over the mood derived from company conditions.
 * `until` is an epoch-ms expiry; `null` means the reaction is persistent until
 * something changes it. Absent/expired → the employee falls back to the derived
 * ambient mood.
 */
export interface EmployeeEmotion {
  id: EmployeeMood;
  until: number | null;
}

/** A compact, persisted record of a resolved event decision (company timeline). */
export interface EventHistoryEntry {
  eventId: string;
  choiceId: string;
  at: number;
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
  /** per-channel mute (independent of the channel's stored volume). */
  channelMuted: { music: boolean; ambience: boolean; ui: boolean; sfx: boolean };
  /** reduce/mute audio while the window is unfocused (desktop). */
  muteWhenUnfocused: boolean;
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
  /** show the "recommended next step" hint banner. */
  showHints: boolean;
  /** animated Office background (the official GIF asset) settings. */
  background: {
    enabled: boolean;
    brightness: number; // 0.5..1.5 (1 = unchanged)
    contrast: number;
    saturation: number;
    blurBehindPanels: boolean;
    quality: 'high' | 'balanced' | 'static';
    focal: 'center' | 'top' | 'bottom' | 'left' | 'right';
    pauseWhenHidden: boolean;
  };
}

/** Stable persisted decoration instance. Coordinates are normalized to its destination surface. */
export type DecorationSurfaceType = 'floor' | 'wall' | 'ceiling';

export interface DecorationInstance {
  instanceId: string;
  decorationId: string;
  /** null means the owned item is currently in inventory. */
  roomId: string | null;
  surfaceType: DecorationSurfaceType;
  /**
   * The single placement surface the item lives on: floor, wall or ceiling.
   * `surfaceType` mirrors this for the renderer/old-save compatibility;
   * `regionKind` is the source of truth for the placement geometry.
   */
  regionKind?: PlacementRegionKind;
  normalizedX: number;
  normalizedY: number;
  depth: number;
  variantId?: string;
  flipped?: boolean;
  rotation?: number;
  interactionState?: Record<string, unknown>;
}

/** Serialized, persisted game state. Bump `SAVE_VERSION` when this changes. */
export interface GameState {
  version: number;
  createdAt: number;
  lastSaved: number;
  company: { name: string; icon?: string };
  resources: ResourceState;
  employees: Record<string, EmployeeRuntimeState>;
  upgrades: Record<string, number>; // upgradeId -> owned count/level
  achievements: Record<string, number>; // achievementId -> unlock timestamp (0 = locked)
  /**
   * Compatibility projection for current renderers: decorationId -> normalized
   * surface position. The v7 `decorationInstances` array is authoritative for
   * identity, room assignment, inventory state, variants, and interactions.
   */
  placements: Record<string, DecorationPlacement>;
  /** Stable source model. One instance exists for each currently owned catalogue item. */
  decorationInstances: DecorationInstance[];
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
  /** Chronological record of resolved event decisions (most recent last). */
  eventHistory: EventHistoryEntry[];
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
