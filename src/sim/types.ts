import type { DecorationPlacement } from './surfaces';
import type { EventEffect } from '../content/types';

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
  /**
   * Conversation memory for the full-screen interaction mode (persisted).
   *
   * This is what makes a talk a relationship rather than a vending machine: `seen`
   * records when each topic was resolved, so a once-only conversation never repeats
   * and later content can ask how long ago something was said. Optional so saves
   * written before the feature default to "never talked".
   */
  talks?: EmployeeTalkMemory;
}

/** Per-employee record of the conversations that have actually happened. */
export interface EmployeeTalkMemory {
  /** Conversations completed with this employee. */
  count: number;
  /** Epoch ms the last one ended, for the cooldown. */
  lastAt: number;
  /** topicId -> epoch ms it was resolved. */
  seen: Record<string, number>;
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
/**
 * A consequence that was deferred when a choice was made and fires later.
 *
 * Deliberately carries its own presentation keys: when it lands, the player has
 * usually forgotten the decision, so the notice has to say what it is settling up
 * for. Effects are stored as authored data rather than resolved numbers so a
 * delayed morale hit still respects the caps in force when it actually applies.
 */
export interface ScheduledConsequence {
  id: string;
  /** epoch ms at which the effects apply. */
  at: number;
  /** the event that promised this, for the callback notice. */
  sourceEventId: string;
  titleKey: string;
  bodyKey: string;
  /** authored effects, applied through the ordinary effect pipeline. */
  effects: EventEffect[];
  /** settle without a notice: the consequence shows up in the world instead. */
  quiet?: boolean;
}

export interface EventHistoryEntry {
  eventId: string;
  choiceId: string;
  at: number;
}

export type PrestigeBranchId =
  'industrial' | 'cooperative' | 'science' | 'marketing' | 'underground';

export interface PrestigeState {
  nutsAtLastPrestige?: number;
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

/**
 * Persisted active-play record. The live combo itself is deliberately transient
 * (a streak is a moment, not an asset), but the totals below survive a reload so
 * the player keeps credit for how they have actually been playing.
 */
export interface ClickerState {
  /** stationId -> lifetime taps, so rooms can show how used they are. */
  stationTaps: Record<string, number>;
  /** lifetime critical taps. */
  criticalTaps: number;
  /** lifetime taps that dropped a golden nut. */
  goldenTaps: number;
  /** best combo streak ever reached. */
  bestStreak: number;
  /** lifetime rushes started (a room run at full pace by keeping a combo going). */
  rushes?: number;
  /** lifetime finds handed over by teammates. */
  findsCollected?: number;
  /** gold refined toward the next whole golden nut (0..1) by premium stations. */
  goldenDust?: number;
  /** stationId -> epoch ms a premium station was last tapped (refining resumes from it). */
  premiumAt?: Record<string, number>;
}

/**
 * The founder's crate: the share of production the team packs by hand instead of
 * sending straight to the vault. It waits, up to a capacity, until the player
 * collects it (see `sim/crate.ts`).
 */
export interface CrateState {
  nuts: number;
}

/** Something a teammate found in their room and is holding out for the player. */
export interface OfficeFind {
  id: string;
  employeeId: string;
  roomId: string;
  /** what kind of thing it is: the temperament of the room it was found in. */
  kind: 'operational' | 'social' | 'analytical' | 'industrial' | 'secure' | 'irregular';
  createdAt: number;
  /** a find from their personal story: what they say when you take it. */
  noteKey?: string;
}

/** One room's routine, as it stands (see content/roomPlay.ts). */
export interface RoomPlayState {
  /** brew: when the batch was started, and when it will be ready. */
  startedAt?: number;
  readyAt?: number;
  /** tend: the machine has needed a hand since `jamAt`; taps taken toward freeing it. */
  jamAt?: number;
  taps?: number;
  /** watch: something has been on the screen since `blipAt`, until `blipUntil`. */
  blipAt?: number;
  blipUntil?: number;
  /** deliver: something has been waiting since `parcelAt`, for `parcelFor` ('' = the company). */
  parcelAt?: number;
  parcelFor?: string;
  /** tune: the room's chosen mode. */
  mode?: string;
  /** how many times the routine has been done in this room. */
  done?: number;
}

/** A curiosity that has turned up in the office and is waiting to be noticed. */
export interface OfficeOddity {
  id: string;
  roomId: string;
  at: number;
}

export interface OfficeState {
  rooms: Record<string, RoomPlayState>;
  oddities: OfficeOddity[];
}

/** Something happening in the office, waiting for the player to look into it. */
export interface PendingIncident {
  id: string;
  eventId: string;
  /** where it is happening. */
  roomId: string;
  /** who is presenting it (the teammate it is about, or someone there). */
  employeeId?: string;
  at: number;
  /** after this it resolves on its own (or fades, if it was rare). */
  until: number;
}

/** Something a teammate will say when the player is next around. */
export interface PendingRemark {
  employeeId: string;
  key: string;
  /** not before this. */
  at: number;
}

/**
 * The office's diary: what happened, newest last. Bounded. It is what lets a
 * returning player be told what went on while they were away.
 */
export interface DiaryEntry {
  at: number;
  kind:
    | 'incident' // something started happening
    | 'opened' // the player looked into it
    | 'handled' // the team dealt with it themselves
    | 'faded' // nobody looked, and it passed
    | 'moment' // a small moment played out
    | 'landed' // a promised consequence arrived
    | 'remark'; // someone has something to say
  eventId?: string;
  momentId?: string;
  roomId?: string;
  employeeId?: string;
}

export interface HappeningsState {
  incidents: PendingIncident[];
  remarks: PendingRemark[];
  diary: DiaryEntry[];
  /** incidents since the last rare one (rare events grow likelier until one comes). */
  sinceRare: number;
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
  /**
   * When true, choice events no longer interrupt play: the department resolves
   * them automatically (picking the best available option) and reports the
   * decision through the notification feed. Events, their consequences, their
   * history and their cooldowns all keep working — see sim/eventAutoResolve.ts.
   */
  autoResolveEvents: boolean;
  focusHarvestEnabled: boolean;
  offlineCapHours: number;
  /** show the "recommended next step" hint (a sticker by the dock). */
  showHints: boolean;
  /**
   * The office floor (room id) the player last looked at, so the tower reopens
   * there instead of at the rooftop. null = the Founder's Desk (home).
   */
  officeFloor: string | null;
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

/**
 * Which side of the team a placed piece is painted on. Unset means the natural
 * side for its surface: wall pieces and rugs behind employees, free-standing
 * floor pieces and hanging ceiling pieces in front of them.
 */
export type DecorationLayer = 'front' | 'back';

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
  /** The player's front/back choice (optional: older saves use the natural side). */
  layer?: DecorationLayer;
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
  /** active-play (click station) record. */
  clicker: ClickerState;
  /** the founder's crate (optional in older saves; the schema defaults it). */
  crate: CrateState;
  /** finds waiting in the office for the player to take (at most a few). */
  finds: OfficeFind[];
  /** the rooms' routines and the curiosities waiting to be noticed (optional in older saves). */
  office: OfficeState;
  /** incidents waiting, things to be said, and the office diary (optional in older saves). */
  happenings: HappeningsState;
  settings: GameSettings;
  onboardingComplete: boolean;
  /** Cooldown bookkeeping for the event system: eventId -> next-eligible epoch ms. */
  eventCooldowns: Record<string, number>;
  /** Pending multi-step event chain, if any. */
  pendingChain: { eventId: string; step: number } | null;
  /** Chronological record of resolved event decisions (most recent last). */
  eventHistory: EventHistoryEntry[];
  /**
   * Consequence memory: durable marks left by the player's decisions.
   *
   * flagId -> the epoch ms it was set (so content can also ask "how long ago?").
   * Events read these to remember what the company already did — who was turned
   * away, which favour is still owed, which crisis was caused — which is what
   * lets later content refer back to a specific save's history.
   */
  flags: Record<string, number>;
  /**
   * Effects that were promised earlier and land later. This is how a choice can
   * look profitable now and bill the company afterwards.
   */
  scheduled: ScheduledConsequence[];
  /** Resume the exact unresolved decision after closing/reloading the game. */
  eventInProgress: { eventId: string; step: string | null } | null;
  /**
   * Earned encouragement expires against wall-clock time, including while away.
   * A `source` (the minigames) keeps one slot instead of stacking.
   */
  boosts: { multiplier: number; endsAt: number; source?: string }[];
  /** Personal bests and practice history survive company restructures. */
  microgames: Record<string, { best: number; plays: number; lastRewardAt: number }>;
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
