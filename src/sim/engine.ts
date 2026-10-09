import { BALANCE } from './config';
import { MICRO_TEAM, MICRO_SOUVENIRS, type MicroMode, type MicroReward } from './minigames';
import { availableFacilityDiscoveries } from './facilityDiscoveries';
import { createRng, hashStringToSeed, type Rng } from './rng';
import type {
  DecorationInstance,
  DecorationLayer,
  DiaryEntry as DiaryEntryInput,
  EmployeeMood,
  OfficeFind,
  GameState,
  MomentCard,
  PendingIncident,
  RoomPlayState,
  ScheduledConsequence,
} from './types';
import {
  aggregatePassives,
  autoCollectRate,
  clickPower,
  computeProduction,
  crateValue,
  employeeLevelCost,
  isEmployeeUnlocked,
  isUpgradeUnlocked,
  moraleCap,
  moraleFloor,
  prestigeMoraleBonus,
  prestigeRareEventChance,
  reputationRate,
  upgradeCost,
  upgradeSaturated,
} from './economy';
import { upgradeBonus } from './upgradeEffects';
import { crateCapacity, crateFill, splitProduction } from './crate';
import { applyOffline, computeAway, type OfflineResult } from './offline';
import { holdWaiting, shiftTimeline } from './timeline';
import { ROOM_PROFILES_BY_ID } from '../content/roomProfiles';
import { MOOD_POSITIVE } from './mood';
import { acknowledgedTier, bondTier, pairFlag, tierFlag, type BondTier } from './bonds';
import { LEGACY_GIFT_FAVORITES, giftFlag } from '../content/employeeGifts';
import { employeeMood, moodProductivityMultiplier } from './mood';
import { repairEmployees } from './state';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { GIFT_PREFERENCES } from '../content/employeeGifts';
import { UPGRADES_BY_ID } from '../content/upgrades';
import type { EventChoice, EventEffect, GameEventDef } from '../content/types';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../content/events';
import { eventChoicesForState } from './eventChoices';
import { chooseAutoResolution } from './eventAutoResolve';
import {
  eligibleTopics,
  evaluateTalkNode,
  nodePrompt,
  pickTopic,
  talkCooldownRemaining,
} from './talks';
import type { TalkChoice, TalkTopic } from '../content/employeeTalks';
import { CLICK_STATIONS_BY_ID } from '../content/clickStations';
import {
  CLICK,
  critChance,
  goldenBeat,
  goldenTapChance,
  resolveClick,
  rushStreak,
  stationComboWindowMs,
  type ClickResolution,
  type ComboTracker,
} from './clickStations';
import { aggregateCompanyModifiers } from './companyModifiers';
import { evaluateAchievements } from './achievements';
import { ensureDailyForDate } from './dailyChallenges';
import {
  ROOM_CAP,
  bestRoomWithSpace,
  employeesInRoom,
  enforceRoomCapacity,
  isRoomIdUnlocked,
  repairPlacements,
  resolveEmployeeRoom,
  roomHasSpace,
  unlockedRooms,
} from './rooms';
import {
  repairDecorations,
  repairDecorationInstances,
  syncDecorationInstanceFromPlacement,
  syncDecorationInstancesFromPlacements,
  isDecorationOwned,
  isDecorationPlaced,
  decorationRoom,
  ownedDecorationsInRoom,
  placedCountOnSurface,
  placementAt,
  decorationInstance,
} from './decorations';
import { DECORATIONS_BY_ID } from '../content/decorations';
import {
  decorationDepthKind,
  decorationSurface,
  projectSurfaceType,
  regionKindForSurface,
} from './surfaces';
import { decorationLayerAdjustable, decorationSide } from './depth';
import {
  evaluateRegionPlacement,
  resolveRegionByKind,
  defaultRegionPlacementFor,
  pointerRegionPlacement,
} from './placement';
import type { RegionPlacementCheck } from './placement';
import { REGION_KIND_SURFACE, type PlacementRegionKind } from './placementRegions';
import { compatibleRegionsForProfile } from '../content/roomSurfaces';
import {
  ODDITIES,
  ODDITIES_BY_ID,
  ROOM_PLAY,
  ROOM_ROUTINES,
  fileOddities,
  oddityFlag,
  roomFileFlag,
  type BrewOutcome,
  type OddityDef,
  type RoomReward,
  type RoutineKind,
} from '../content/roomPlay';
import {
  ANOMALY_THREAD_AFTER,
  ANOMALY_THREAD_FLAG,
  HAPPENINGS,
  HOOKS,
  WORLD_MOMENTS_BY_ID,
  memoriesOf,
  type WorldMomentDef,
} from '../content/happenings';
import {
  eligibleMoments,
  emptyHappenings,
  eventPlace,
  meetsHappeningRequirements,
  pickIncident,
  rarityOdds,
} from './happenings';
import {
  brewSeconds,
  peopleHelpers,
  roomHelpers,
  routineOddities,
  routineView,
  speakerFor,
  spontaneousOddities,
  watchSeconds,
} from './roomPlay';

/** A single employee's measured change from an event choice (WHAT CHANGED). */
export interface EmployeeChange {
  id: string;
  /** the employee's emotion after the choice (present only when it changed). */
  emotion: EmployeeMood | null;
  /** expiry epoch ms for a temporary emotion; null = persistent. */
  emotionUntil: number | null;
  /** production factor vs neutral from the new emotion (e.g. +0.05). */
  productivityDelta: number;
  /** friendship points gained/lost. */
  friendshipDelta: number;
}

/** The measured, real consequences of an event choice (diffed from sim state). */
export interface ConsequenceReport {
  nuts: number;
  goldenNuts: number;
  morale: number;
  reputation: number;
  /** >1 when a temporary production boost was applied, else 0. */
  boostMultiplier: number;
  boostSeconds: number;
  momentCreated: boolean;
  employees: EmployeeChange[];
}

export interface Consequence {
  /** the event it settles (absent on consequences recorded by older builds). */
  eventId?: string;
  titleKey: string;
  choiceLabelKey: string;
  effects: EventEffect[];
  reactions: string[];
  /** where it happened, so the result is told in the same room. */
  place?: EventPlace;
  rarity?: GameEventDef['rarity'];
  /** the choice set something in motion that will show up later (not said what). */
  setInMotion?: boolean;
  /** a teammate will remember this choice. */
  remembered?: string;
  /** measured, itemised consequences reflecting the actual simulation change. */
  report: ConsequenceReport;
}

export interface TempBoost {
  multiplier: number;
  endsAt: number;
}

export interface ActiveEvent {
  def: GameEventDef;
  step: string | null; // null = base body, otherwise a chain step id
  /** Monotonic identity used to reject delayed input from an older popup. */
  instanceId: number;
  /** where it is happening and who is presenting it, for the card's scene. */
  place?: EventPlace;
}

/** Where an event happens, and who brings it to the player. */
export interface EventPlace {
  roomId: string;
  employeeId?: string;
}

export interface EventChoiceContext {
  eventInstanceId: number;
  step: string | null;
}

/** An open employee conversation. Transient — see `GameEngine.activeTalk`. */
export interface ActiveTalk {
  profileOnly?: boolean;
  employeeId: string;
  topic: TalkTopic;
  /** Current node; empty string once the conversation has ended. */
  nodeId: string;
  /** Identity used to reject a click that was in flight across a state change. */
  instanceId: string;
  /** The employee's reply to the option just taken, shown before the next prompt. */
  lastReplyKey: string | null;
  /**
   * What they say at the current node, decided when the conversation arrived
   * there (the room, their mood, what happened since you last spoke), so the line
   * never changes under the player while they read it. Null once it has ended.
   */
  promptKey?: string | null;
  /** How many options have been taken, so the UI can show progress. */
  exchanges: number;
  /** Measured before/after of the last option, for the "what changed" readout. */
  report: ConsequenceReport | null;
  /** A new stage of the relationship reached on this visit, to celebrate. */
  milestone?: BondTier | null;
  /** Which part of the visit to open on. */
  tab?: VisitTab;
}

/** The three things you can do on a visit. */
export type VisitTab = 'talk' | 'gifts' | 'scrapbook';

/**
 * Effect types that act ON a specific employee.
 *
 * A conversation topic is written once and reused across the cast, so its effects name
 * no employee; these are the ones that need to be pointed at whoever is being talked
 * to. Everything else (nuts, morale, reputation, boosts) is company-wide and must be
 * left alone — stamping an employeeId onto a morale effect would be harmless today but
 * is exactly the kind of quiet wrongness that surfaces later.
 */
const EFFECTS_NEEDING_EMPLOYEE: ReadonlySet<EventEffect['type']> = new Set([
  'friendship',
  'emotion',
  'find',
]);

/** Bind delayed promises too: they may settle after their conversation is gone. */
function bindEmployeeEffect(effect: EventEffect, employeeId?: string | null): EventEffect {
  return {
    ...effect,
    ...(employeeId && !effect.employeeId && EFFECTS_NEEDING_EMPLOYEE.has(effect.type)
      ? { employeeId }
      : {}),
    ...(effect.scheduled
      ? { scheduled: effect.scheduled.map((child) => bindEmployeeEffect(child, employeeId)) }
      : {}),
  };
}

/** One decision taken on the player's behalf while popups are disabled. */
interface AutoResolvedDecision {
  def: GameEventDef;
  choice: { id: string; labelKey: string };
}

/**
 * Summary of the most recent auto-resolved event, so the UI can tell the player
 * what the department decided. Transient: it is a notification, not saved state.
 */
export interface AutoResolvedEvent {
  titleKey: string;
  choiceLabelKey: string;
  at: number;
}

export interface EngineOptions {
  now?: () => number;
  seed?: number;
  deterministic?: boolean;
}

export type EngineListener = () => void;

/**
 * Carry an old save's gift memory over. Before gifts became a discovery game the
 * only gift remembered was "their favourite", given once; record it as the gift
 * it actually was, so the notebook shows what really happened.
 */
function repairBondMemories(state: GameState): void {
  for (const [id, legacy] of Object.entries(LEGACY_GIFT_FAVORITES)) {
    const at = state.flags[`favorite.${id}.giftMemory`];
    if (at === undefined) continue;
    if (Object.keys(state.flags).some((flag) => flag.startsWith(`${id}.gift.`))) continue;
    state.flags[giftFlag(id, legacy)] = at;
  }
}

/** The founder's floor, whose own output (the company base rate) a rush there doubles. */
const FOUNDER_ROOM = 'founder-desk';

export interface CollectResult {
  gained: number;
  bonus: boolean;
}

/** What taking a teammate's find gave the player. */
export interface FindReward {
  find: OfficeFind;
  nuts: number;
  golden: number;
}

/** A tap's payout, plus what else the tap did to the office. */
export type StationTapResult = ClickResolution & {
  /** nuts collected from the crate by this tap (crate station only). */
  crate?: number;
  /** premium stations: whole golden nuts this tap completed (the rest is dust). */
  goldenPaid?: number;
  /** premium stations: golden dust refined toward the next nut after this tap, 0..1. */
  dust?: number;
  /** this tap started the room's rush, or kept it going. */
  rush?: 'started' | 'extended';
  /** the machine was acting up: this tap went toward freeing it. */
  tend?: { taps: number; needed: number; fixed?: RoomPlayResult };
};

/** What a room's routine (or a curiosity) just paid, for the office to show. */
export interface RoomPayout {
  nuts: number;
  golden: number;
  morale: number;
  reputation: number;
  boost?: { value: number; seconds: number };
  rush?: number;
}

/** Something done in a room, and what came of it. */
export interface RoomPlayResult {
  roomId: string;
  kind: RoutineKind | 'oddity';
  /** the brew outcome or tune mode, or 'fixed' | 'selfFixed' | 'caught' | 'delivered' | 'noticed'. */
  outcome: string;
  payout: RoomPayout;
  /** a curiosity noticed through this (for `oddity`, the one noticed). */
  oddityId?: string;
  /** the Nut Encyclopedia entry it turned out to be. */
  nutId?: string;
  /** who a delivery was for. */
  recipient?: string;
  /** who in the room reacts. */
  speaker: string | null;
  /** every curiosity in the room has now been noticed. */
  roomComplete?: boolean;
  /** enough of the strange side has been noticed that the building notices back. */
  thread?: boolean;
}

/** Something the office did on its own, for the scene to show once (drained by the UI). */
export interface OfficeNews {
  kind: 'jam' | 'blip' | 'parcel' | 'oddity' | 'selfFix' | 'incident' | 'moment';
  roomId: string;
  oddityId?: string;
  result?: RoomPlayResult;
  /** incident: what started happening, who points it out, and what they say. */
  eventId?: string;
  employeeId?: string;
  hookKey?: string;
  /** moment: which one, and what it paid. */
  momentId?: string;
  payout?: RoomPayout;
}

function emptyPayout(): RoomPayout {
  return { nuts: 0, golden: 0, morale: 0, reputation: 0 };
}

function addPayout(into: RoomPayout, more: RoomPayout): void {
  into.nuts += more.nuts;
  into.golden += more.golden;
  into.morale += more.morale;
  into.reputation += more.reputation;
  into.boost ??= more.boost;
  into.rush ??= more.rush;
}

/** Saves and test states from before room play have no office yet. */
function ensureOffice(state: GameState): void {
  state.office ??= { rooms: {}, oddities: [] };
  state.office.rooms ??= {};
  state.office.oddities ??= [];
  state.happenings ??= emptyHappenings();
  state.happenings.incidents ??= [];
  state.happenings.remarks ??= [];
  state.happenings.diary ??= [];
  state.happenings.sinceRare ??= 0;
  // A save from before the building noticed back, that had already noticed
  // enough of its strange side: the thread started when the last of them was.
  if (!(ANOMALY_THREAD_FLAG in state.flags)) {
    const strange = ODDITIES.filter(
      (def) => def.tone === 'paranormal' && oddityFlag(def.id) in state.flags,
    ).map((def) => state.flags[oddityFlag(def.id)]);
    if (strange.length >= ANOMALY_THREAD_AFTER)
      state.flags[ANOMALY_THREAD_FLAG] = Math.max(...strange);
  }
}

type DecorationArrangement = Array<
  Pick<
    DecorationInstance,
    | 'instanceId'
    | 'roomId'
    | 'surfaceType'
    | 'regionKind'
    | 'normalizedX'
    | 'normalizedY'
    | 'depth'
    | 'layer'
  >
>;

/**
 * The GameEngine owns the authoritative game state and all mutations. It is
 * deliberately free of React/Electron/Pixi imports so it can run in unit tests
 * and be shared by the browser demo and the desktop app.
 */
export class GameEngine {
  state: GameState;
  activeEvent: ActiveEvent | null = null;
  /** transient: the result of the most recent event choice, for the result panel. */
  lastConsequence: Consequence | null = null;
  get tempBoosts(): TempBoost[] {
    return this.state.boosts;
  }
  set tempBoosts(boosts: TempBoost[]) {
    this.state.boosts = boosts;
  }
  /**
   * transient: the live click-station combo. A streak is a moment, not an asset,
   * so it is intentionally NOT persisted — it lapses on reload just as it lapses
   * when the player stops tapping. Lifetime totals live in `state.clicker`.
   */
  combo: ComboTracker | null = null;
  /**
   * transient: the last event the department handled on its own (only set while
   * `settings.autoResolveEvents` is on), for the notification feed.
   */
  lastAutoResolved: AutoResolvedEvent | null = null;
  /**
   * transient: delayed consequences that have just landed, for the notification
   * feed. Drained by the UI; the authoritative queue lives in `state.scheduled`.
   */
  settledConsequences: ScheduledConsequence[] = [];
  /**
   * transient: the open employee conversation, driving the full-screen interaction
   * screen. The CONVERSATION is a moment and is not persisted — what it changed is,
   * because every consequence went through `applyEffect` into `state`, and the fact
   * that it happened is recorded in the employee's `talks` memory. So closing the game
   * mid-sentence loses only the sentence.
   */
  activeTalk: ActiveTalk | null = null;
  /** transient: what the office did on its own since the scene last looked. */
  officeNews: OfficeNews[] = [];

  private listeners = new Set<EngineListener>();
  private now: () => number;
  private rng: Rng;
  private eventAccum = 0;
  private saveAccum = 0;
  private saveCallback: ((state: GameState) => void) | null = null;
  private version = 0;
  private nextEventInstanceId = 1;
  /** Rooms unlocked as of the last check, so a new one can re-seat the team. */
  private unlockedRoomCount = 0;
  /** roomId -> epoch ms its rush ends. A rush is a moment: never persisted. */
  private rushes = new Map<string, number>();
  private findAccum = 0;
  private officeAccum = 0;
  private resolvingEventInstanceId: number | null = null;
  /**
   * The wall-clock moment the company has been settled up to: every interval
   * before it has been paid exactly once, by one rule (see `catchUp`). It is what
   * a save records as `lastSaved`, so the next boot settles exactly the rest.
   */
  private settledAt: number;
  /** While a slice of a long tick is simulated: that slice's own moment (else null). */
  private stepClock: number | null = null;
  /**
   * Whether anybody can see the office (the window is showing). While nobody can,
   * what waits to be noticed holds its place instead of being decided offscreen.
   */
  private attended = true;

  constructor(state: GameState, opts: EngineOptions = {}) {
    this.state = state;
    this.now = opts.now ?? (() => Date.now());
    // A loaded company is settled up to its save; the boot settles the rest.
    this.settledAt = Number.isFinite(state.lastSaved) ? state.lastSaved : this.now();
    this.state.boosts ??= [];
    this.state.microgames ??= {};
    ensureOffice(this.state);
    this.restoreEvent();
    const seed = opts.deterministic ? (opts.seed ?? 12345) : (opts.seed ?? Date.now() & 0xffffffff);
    this.rng = createRng(seed);
    // Backfill any employees added to the game since this save was written, so
    // screens that map over all employees never read `undefined` and crash.
    repairEmployees(this.state);
    // Repair any invalid employee placement data on load so no one is lost.
    this.repairedOnLoad = repairPlacements(this.state);
    // Older saves predate the four-per-room cap, and the fallback resolution can
    // pile unassigned teammates into one room regardless of when the save was
    // written, so the invariant is established before anything renders.
    enforceRoomCapacity(this.state);
    this.unlockedRoomCount = unlockedRooms(this.state).length;
    // Repair the source instance model before its legacy placement projection,
    // then mirror any coordinate clamping back into the instances.
    repairDecorationInstances(this.state);
    repairDecorations(this.state);
    syncDecorationInstancesFromPlacements(this.state);
    repairBondMemories(this.state);
  }

  /** ids whose invalid placement was repaired at load (for dev-only logging). */
  repairedOnLoad: string[] = [];

  // Session-only undo/redo history for authoritative decoration arrangement.
  // Identity and cosmetic metadata remain untouched while room, surface,
  // position, and depth move together.
  private decoUndo: DecorationArrangement[] = [];
  private decoRedo: DecorationArrangement[] = [];

  // -- subscription ---------------------------------------------------------
  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onSave(cb: (state: GameState) => void): void {
    this.saveCallback = cb;
  }

  getVersion(): number {
    return this.version;
  }

  private emit(): void {
    this.version += 1;
    for (const l of this.listeners) l();
  }

  // -- derived reads --------------------------------------------------------
  /**
   * The moment the temporary multipliers (boosts, rushes, Focus Harvest) are read
   * at: the present, or — while a long tick is simulated slice by slice — that
   * slice's own moment, so a boost that ran out inside a throttled minute counts
   * for exactly its share of it rather than all or nothing.
   */
  private clock(): number {
    return this.stepClock ?? this.now();
  }

  isFocusActive(): boolean {
    return this.state.focus.active && this.clock() < this.state.focus.endsAt;
  }

  productionPerSecond(): number {
    const prod = computeProduction(this.state, this.isFocusActive());
    return prod.nutsPerSecond * this.currentBoostMultiplier() * this.rushMultiplier(prod);
  }

  /** The factor rushing rooms add to production right now (1 when none rush). */
  currentRushMultiplier(): number {
    return this.rushMultiplier(computeProduction(this.state, this.isFocusActive()));
  }

  /**
   * Production without the temporary multipliers (boosts, rushes): what rewards
   * worth "N seconds of production" are priced on. Paying a find or a routine on
   * the boosted rate let a rush and a stack of boosts multiply every claim taken
   * during them (up to six times), which the microgame reward already refuses.
   */
  private rewardBasePerSecond(): number {
    return computeProduction(this.state, this.isFocusActive()).nutsPerSecond;
  }

  // -- rushes -----------------------------------------------------------------
  // Keep a station's combo going long enough and its room rushes: the people who
  // work there produce double for a while, and every tap that keeps the rhythm
  // keeps it going. A short burst of attention therefore scales with the company
  // instead of fading into a rounding error, and who sits in which room matters.

  /** Epoch ms the room's rush ends (0 when it is not rushing). */
  rushEndsAt(roomId: string): number {
    const ends = this.rushes.get(roomId) ?? 0;
    return ends > this.clock() ? ends : 0;
  }

  /** Rooms rushing right now. */
  activeRushes(): string[] {
    const t = this.clock();
    return [...this.rushes].filter(([, ends]) => ends > t).map(([room]) => room);
  }

  /** The share of the company's raw output made in `roomId` (0..1). */
  roomShare(roomId: string, prod = computeProduction(this.state, this.isFocusActive())): number {
    let total = 0;
    let room = 0;
    for (const entry of prod.breakdown) {
      total += entry.nutsPerSecond;
      if (entry.source === 'base') {
        if (roomId === FOUNDER_ROOM) room += entry.nutsPerSecond;
      } else if (entry.source.startsWith('employee:')) {
        const id = entry.source.slice('employee:'.length);
        if (resolveEmployeeRoom(this.state, id) === roomId) room += entry.nutsPerSecond;
      }
    }
    return total > 0 ? room / total : 0;
  }

  private rushMultiplier(prod: ReturnType<typeof computeProduction>): number {
    const rushing = this.activeRushes();
    if (!rushing.length) return 1;
    let share = 0;
    for (const room of rushing) share += this.roomShare(room, prod);
    return 1 + (CLICK.rushMultiplier - 1) * Math.min(1, share);
  }

  private startRush(roomId: string, seconds: number = CLICK.rushSeconds): 'started' | 'extended' {
    const was = this.rushEndsAt(roomId) > 0;
    this.rushes.set(roomId, Math.max(this.now() + seconds * 1000, this.rushes.get(roomId) ?? 0));
    if (!was) this.state.clicker.rushes = (this.state.clicker.rushes ?? 0) + 1;
    return was ? 'extended' : 'started';
  }

  // -- the crate --------------------------------------------------------------
  /**
   * What a full crate holds: ten minutes of packing at the company's own pace.
   * Temporary multipliers (a boost, a rush, Focus Harvest) pack it faster, they do
   * not make it bigger: it used to grow during a rush and shrink back after, so a
   * crate filled while away read "full" in the art and "not quite" on the HUD.
   */
  crateCapacity(): number {
    return crateCapacity(computeProduction(this.state, false).nutsPerSecond);
  }

  /** How full the crate is, 0..1. */
  crateFill(): number {
    return crateFill(this.state.crate.nuts, this.crateCapacity());
  }

  currentBoostMultiplier(): number {
    const t = this.clock();
    let m = 1;
    for (const b of this.tempBoosts) if (b.endsAt > t) m += b.multiplier - 1;
    return Math.min(3, Math.max(1, m));
  }

  clickPower(): number {
    return clickPower(this.state) * this.currentBoostMultiplier();
  }

  crateValue(): number {
    return crateValue(this.state, this.isFocusActive()) * this.currentBoostMultiplier();
  }

  // -- main tick ------------------------------------------------------------
  /**
   * Advance the simulation by the `deltaSeconds` of open play that end now,
   * chunked for stability. Each slice is valued at its own moment (see `clock`),
   * so one throttled minute-long tick earns what six hundred quick ones would.
   */
  tick(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || !Number.isFinite(deltaSeconds)) return;
    const end = this.now();
    this.settledAt = end;
    let remaining = Math.min(deltaSeconds, 60 * 60); // never process >1h in one call
    let sliceStart = end - remaining * 1000;
    // Bounded work per call: at most ~120 slices, so a window woken after a few
    // throttled minutes catches up in a blink instead of replaying every half second.
    const slice = Math.max(BALANCE.maxTickSeconds, remaining / 120);
    while (remaining > 0) {
      const step = Math.min(remaining, slice);
      this.stepClock = sliceStart + (step * 1000) / 2;
      try {
        this.tickFocus(this.stepClock);
        this.stepSimulation(step);
      } finally {
        this.stepClock = null;
      }
      sliceStart += step * 1000;
      remaining -= step;
    }
    // Nobody can see the office (minimized, hidden): what waits to be noticed
    // keeps its place rather than being decided or fading offscreen.
    if (!this.attended) holdWaiting(this.state, Math.min(deltaSeconds, 3600) * 1000);
    this.state.stats.playTimeSeconds += Math.min(deltaSeconds, 3600);
    this.tickFocus();
    this.rolloverDaily();

    // A room opening is the one thing that can change where the team fits without
    // the player touching anything: reputation crosses a threshold mid-tick and a
    // new department appears. Re-seat anyone the fallback had crowded, and give the
    // newly opened room its first occupants.
    const openRooms = unlockedRooms(this.state).length;
    if (openRooms !== this.unlockedRoomCount) {
      this.unlockedRoomCount = openRooms;
      enforceRoomCapacity(this.state);
    }

    // prune expired boosts to avoid unbounded growth
    const t = this.now();
    this.tempBoosts = this.tempBoosts.filter((b) => b.endsAt > t);
    for (const [room, ends] of this.rushes) if (ends <= t) this.rushes.delete(room);
    this.rollFinds(Math.min(deltaSeconds, 3600));
    this.stepOffice(Math.min(deltaSeconds, 3600));
    // drop expired temporary employee emotions
    this.expireEmotions(t);

    // periodic autosave
    this.saveAccum += deltaSeconds;
    if (this.saveAccum >= BALANCE.autosaveIntervalSeconds) {
      this.saveAccum = 0;
      this.save();
    }

    // random events
    this.settleScheduled();
    this.expireIncidents();
    if (this.activeEvent && this.state.settings.autoResolveEvents) this.autoResolveActiveEvent();

    // One roll per interval of company time, however the ticks fall: a throttled
    // window ticking once a minute used to roll once a minute instead of every
    // 45 seconds (and drop the rest). Bounded, so no tick replays a backlog.
    this.eventAccum += deltaSeconds;
    let rolls = 0;
    while (this.eventAccum >= BALANCE.eventRollIntervalSeconds && rolls < 8) {
      this.eventAccum -= BALANCE.eventRollIntervalSeconds;
      rolls += 1;
      this.maybeRollEvent();
    }
    if (this.eventAccum >= BALANCE.eventRollIntervalSeconds) this.eventAccum = 0;

    this.checkAchievements();
    this.emit();
  }

  private stepSimulation(dt: number): void {
    const prod = computeProduction(this.state, this.isFocusActive());
    const passives = aggregatePassives(this.state);
    const boost = this.currentBoostMultiplier();
    const nps = prod.nutsPerSecond * boost * this.rushMultiplier(prod);

    // Half goes straight to the vault; the team packs the other half into the
    // crate for the player to collect. A full crate's share still banks at the
    // overflow rate (offline efficiency, more with automation). See sim/crate.ts.
    const ownPace = this.isFocusActive()
      ? computeProduction(this.state, false).nutsPerSecond
      : prod.nutsPerSecond;
    const split = splitProduction(
      this.state.crate.nuts,
      crateCapacity(ownPace),
      nps * dt,
      autoCollectRate(this.state),
    );
    if (split.banked > 0) this.addNuts(split.banked, false);
    if (split.packed > 0) this.state.crate.nuts += split.packed;

    this.state.stats.highestNutsPerSecond = Math.max(this.state.stats.highestNutsPerSecond, nps);

    // Morale drifts toward an equilibrium set by passives AND by the building.
    //
    // The room network drives both ends: the Lab, the basement and the production
    // floors drag the target down, while the Break Room and the Nap Room raise it
    // and speed up recovery. This is the causal chain the player feels — an
    // unbalanced building settles at low morale, low morale cuts production via
    // `moraleMultiplier`, and weaker production slows every other system.
    const rooms = aggregateCompanyModifiers(this.state);
    const cap = moraleCap(this.state);
    const floor = Math.max(BALANCE.morale.min, moraleFloor(this.state));
    const target = Math.min(
      cap,
      Math.max(
        BALANCE.morale.min,
        BALANCE.morale.start +
          passives.moraleBonus +
          rooms.moraleTarget +
          // The run's permanent branch shifts where morale settles, which is the whole
          // pitch of Cozy Cooperative (+20) and the stated cost of Industrial (-5).
          prestigeMoraleBonus(this.state),
      ),
    );
    const m = this.state.resources.morale;
    const regen = Math.max(0.1, BALANCE.morale.driftPerSecond * (1 + rooms.moraleRegen));
    const drift = (target - m) * Math.min(1, regen * dt);
    this.state.resources.morale = Math.max(floor, Math.min(cap, m + drift));

    // Reputation grows slowly with company size. A building of only the unpleasant
    // rooms slides back down the ladder, but never below zero (the save would
    // silently reset a negative value to 0 anyway, after showing it on the HUD).
    this.state.resources.reputation = Math.max(
      0,
      this.state.resources.reputation + reputationRate(this.state, passives) * dt,
    );
  }

  private addNuts(amount: number, isClick: boolean): void {
    // A NaN or infinite reward (a broken input upstream) must never reach the balance.
    if (!(amount > 0) || !Number.isFinite(amount)) return;
    this.state.resources.nuts += amount;
    this.state.stats.totalNutsEarned += amount;
    if (isClick) this.state.stats.totalClicks += 1;
    // daily challenge progress
    this.progressDaily('produceNuts', amount);
  }

  // -- player actions -------------------------------------------------------
  click(): number {
    const gained = this.clickPower();
    this.addNuts(gained, true);
    this.emit();
    return gained;
  }

  /**
   * Empty the crate into the vault. A lucky crate (the company's find bonus)
   * turns out to hold half as much again.
   */
  collectCrate(): CollectResult {
    const stored = this.state.crate.nuts;
    if (!(stored > 0)) return { gained: 0, bonus: false };
    const passives = aggregatePassives(this.state);
    const bonus = this.rng.chance(passives.resourceFind);
    const gained = stored * (bonus ? 1.5 : 1);
    this.state.crate.nuts = 0;
    this.addNuts(gained, false);
    this.emit();
    return { gained, bonus };
  }

  /**
   * Tap a click station. This is the game's primary active-play verb.
   *
   * There is deliberately NO cooldown or debounce: every call pays out, so
   * repeated clicking is always honoured and never silently dropped. Stations
   * that want a rhythm express it through their `charge` cadence (a reduced —
   * never zero — payout for tapping early), which is a balancing choice the
   * player can see and learn, not an input limiter.
   */
  tapStation(stationId: string): StationTapResult | null {
    const def = CLICK_STATIONS_BY_ID[stationId];
    if (!def) return null;
    // A station is available exactly when its room is.
    if (!isRoomIdUnlocked(this.state, def.roomId)) return null;

    const now = this.now();
    const rolls = {
      critical: this.rng.chance(critChance(this.state, def)),
      // Rolled per beat of tapping, not per tap: mashing does not mint gold.
      golden: this.rng.chance(goldenTapChance(this.state) * goldenBeat(this.combo, now)),
    };
    const result: StationTapResult = resolveClick(this.state, def, this.combo, now, rolls);

    // Advance the transient combo tracker.
    this.combo = { stationId: def.id, streak: result.streak, lastTapAt: now };

    if (result.resource === 'goldenNuts') {
      // A premium station refines gold: the tap adds dust, and whole nuts are paid
      // as the dust completes them. Its clock is saved, so reloading is no shortcut.
      const clicker = this.state.clicker;
      clicker.premiumAt = { ...(clicker.premiumAt ?? {}), [def.id]: now };
      const total = Math.max(0, clicker.goldenDust ?? 0) + Math.max(0, result.amount);
      const whole = Math.floor(total + 1e-9);
      clicker.goldenDust = Math.min(0.999999, total - whole);
      if (whole > 0) this.state.resources.goldenNuts += whole;
      result.goldenPaid = whole;
      result.dust = clicker.goldenDust;
      // Taps still count as clicks for stats/dailies even when paid in gold.
      this.state.stats.totalClicks += 1;
    } else {
      this.addNuts(result.amount, true);
    }
    if (result.golden) this.state.resources.goldenNuts += 1;

    const clicker = this.state.clicker;
    clicker.stationTaps[def.id] = (clicker.stationTaps[def.id] ?? 0) + 1;
    if (result.critical) clicker.criticalTaps += 1;
    if (result.golden) clicker.goldenTaps += 1;
    clicker.bestStreak = Math.max(clicker.bestStreak, result.streak);

    // The crate is the founder's station, so keep its long-standing counters and
    // daily challenge wired up rather than stranding them.
    if (def.kind === 'crate') {
      this.state.stats.cratesCollected += 1;
      this.progressDaily('collectCrates', 1);
      // Tapping the crate takes out whatever the team has packed so far.
      const collected = this.collectCrate();
      if (collected.gained > 0) result.crate = collected.gained;
    }

    // A machine that is acting up takes the tap toward freeing it.
    const routine = ROOM_ROUTINES[def.roomId];
    const play = this.state.office.rooms[def.roomId];
    if (routine?.kind === 'tend' && play?.jamAt) {
      play.taps = (play.taps ?? 0) + 1;
      result.tend = { taps: play.taps, needed: routine.taps };
      if (play.taps >= routine.taps) {
        result.tend.fixed = this.fixMachine(def.roomId, false) ?? undefined;
        this.save();
      }
    }

    // Keeping the rhythm long enough sets the room rushing.
    if (result.streak >= rushStreak(def)) result.rush = this.startRush(def.roomId);

    this.emit();
    return result;
  }

  // -- finds --------------------------------------------------------------------
  // Now and then a teammate finds something in their room and holds it out. It
  // waits for the player (finds never expire), is worth some production, and the
  // finder is pleased to hand it over. Content-wise a find is the room's
  // temperament: a snack in a social room, a sample in a lab, a bolt on a
  // production floor, so the same verb reads differently all over the building.

  /** Finds waiting in the office. */
  waitingFinds(): OfficeFind[] {
    return this.state.finds;
  }

  /** Roll for a new find (`seconds` of company time has passed). */
  private rollFinds(seconds: number): void {
    if (this.state.stats.playTimeSeconds < BALANCE.finds.firstAfterSeconds) return;
    this.findAccum += seconds;
    const ROLL = 15;
    while (this.findAccum >= ROLL) {
      this.findAccum -= ROLL;
      if (this.rng.chance(ROLL / BALANCE.finds.meanIntervalSeconds)) this.spawnFind();
    }
  }

  /** Hand one new find to a teammate, weighted towards the ones in a good mood. */
  private spawnFind(): OfficeFind | null {
    if (this.state.finds.length >= BALANCE.finds.maxWaiting) return null;
    const holding = new Set(this.state.finds.map((find) => find.employeeId));
    const now = this.now();
    const candidates: Array<{ id: string; weight: number }> = [];
    for (const [id, rt] of Object.entries(this.state.employees)) {
      if (!rt?.hired || rt.level <= 0 || holding.has(id)) continue;
      const mood = employeeMood(this.state, id, now);
      candidates.push({ id, weight: MOOD_POSITIVE[mood] ? 3 : 1 });
    }
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (total <= 0) return null;
    let roll = this.rng.next() * total;
    const pick = candidates.find((c) => (roll -= c.weight) < 0) ?? candidates[0];
    const roomId = resolveEmployeeRoom(this.state, pick.id);
    const find: OfficeFind = {
      id: `find-${now.toString(36)}-${this.state.finds.length}-${Math.floor(this.rng.next() * 1e6).toString(36)}`,
      employeeId: pick.id,
      roomId,
      kind: ROOM_PROFILES_BY_ID[roomId]?.temper ?? 'operational',
      createdAt: now,
    };
    this.state.finds.push(find);
    return find;
  }

  /** Take a teammate's find. */
  collectFind(id: string): FindReward | null {
    const index = this.state.finds.findIndex((find) => find.id === id);
    if (index < 0) return null;
    const [find] = this.state.finds.splice(index, 1);
    const story = Boolean(find.noteKey);
    const nuts =
      Math.max(BALANCE.finds.minReward, this.rewardBasePerSecond() * BALANCE.finds.rewardSeconds) *
      (story ? 2 : 1);
    this.addNuts(nuts, false);
    const golden = this.rng.chance(BALANCE.finds.goldenChance) ? 1 : 0;
    if (golden) this.state.resources.goldenNuts += golden;
    const rt = this.state.employees[find.employeeId];
    if (rt?.hired) {
      rt.friendship = Math.min(100, (rt.friendship ?? 0) + (story ? 3 : 1));
      this.setEmployeeEmotion(find.employeeId, 'happy', BALANCE.finds.happySeconds);
    }
    if (story) this.state.flags[`${find.employeeId}.storyFindTaken`] = this.now();
    this.state.clicker.findsCollected = (this.state.clicker.findsCollected ?? 0) + 1;
    this.save();
    this.emit();
    return { find, nuts, golden };
  }

  /**
   * Settle `seconds` the game was not running — closed, or open while the computer
   * slept or the process was frozen — at the away rules: production at the offline
   * efficiency up to the cap, the crate filled first, the finds that time would
   * have brought, a few things started in the office. Nobody could look meanwhile,
   * so what was already waiting keeps its place. Returns what happened, for the
   * welcome-back note.
   */
  settleAway(seconds: number): OfflineResult {
    this.settledAt = this.now();
    const result = computeAway(this.state, seconds);
    if (!result.ignored) {
      applyOffline(this.state, result);
      holdWaiting(this.state, result.seconds * 1000);
      this.catchUpFinds(result.cappedSeconds);
      result.incidents = this.catchUpHappenings(result.cappedSeconds);
    }
    this.save();
    this.emit();
    return result;
  }

  /**
   * Bring the company up to the present. This is the one place elapsed wall-clock
   * time is accounted for while the game runs, each interval exactly once:
   *
   *  - forward, up to `awayGapSeconds` since the last settlement: open play. A
   *    minimized or hidden window that the browser only wakes once a minute is
   *    still open, and every second of it is ticked at the open rules.
   *  - forward, longer: the game was not running (the computer slept, the process
   *    was frozen). Settled at the away rules, like time with the game closed.
   *  - backwards: the clock was turned back. Nothing is paid and nothing ages; the
   *    whole timeline moves back with the clock (see `sim/timeline.ts`).
   *
   * Returns the away settlement when there was one, for the welcome-back note.
   */
  catchUp(): OfflineResult | null {
    const now = this.now();
    const elapsedMs = now - this.settledAt;
    if (!Number.isFinite(elapsedMs)) {
      this.settledAt = now;
      return null;
    }
    if (elapsedMs < 0) {
      this.rewindTo(now);
      return null;
    }
    if (elapsedMs === 0) return null;
    if (elapsedMs > BALANCE.awayGapSeconds * 1000) return this.settleAway(elapsedMs / 1000);
    this.tick(elapsedMs / 1000);
    return null;
  }

  /**
   * The game was closed (boot): settle everything since the save at the away
   * rules, however short — closed time is never open time. A save stamped later
   * than now means the clock went back while it was closed: nothing is paid and
   * the timeline moves back with the clock.
   */
  settleClosedTime(): OfflineResult | null {
    const now = this.now();
    const elapsedMs = now - this.state.lastSaved;
    if (Number.isFinite(elapsedMs) && elapsedMs < 0) {
      this.settledAt = this.state.lastSaved;
      this.rewindTo(now);
      return null;
    }
    return this.settleAway(elapsedMs / 1000);
  }

  /** The clock went back to `now`: move the timeline back with it (nothing paid, nothing aged). */
  private rewindTo(now: number): void {
    const delta = now - this.settledAt;
    if (Number.isFinite(delta) && delta < 0) {
      shiftTimeline(this.state, delta);
      for (const [room, ends] of this.rushes) this.rushes.set(room, ends + delta);
      if (this.combo) this.combo = { ...this.combo, lastTapAt: this.combo.lastTapAt + delta };
    }
    this.settledAt = now;
    this.save();
    this.emit();
  }

  /** Whether anybody can see the office (the shell reports the window's visibility). */
  setAttended(attended: boolean): void {
    this.attended = attended;
  }

  /** The finds `seconds` away from the office would have produced (bounded). */
  catchUpFinds(seconds: number): void {
    if (!(seconds > 0)) return;
    const expected = Math.floor(seconds / BALANCE.finds.meanIntervalSeconds);
    for (let i = 0; i < expected && this.state.finds.length < BALANCE.finds.maxWaiting; i += 1) {
      if (!this.spawnFind()) break;
    }
  }

  // -- room play --------------------------------------------------------------
  // Each room's station has a routine of its own (content/roomPlay.ts): brew,
  // tend, watch, deliver or tune. Starting, sharing, freeing, catching, handing
  // over and switching all go through here; what turns up on its own is rolled
  // in `stepOffice`. Every payout goes through `grantRoomReward`, which only uses
  // systems the rest of the game already has (nuts, golden nuts, morale,
  // reputation, boosts, rushes, moods and friendship).

  private roomPlay(roomId: string): RoomPlayState {
    const rooms = this.state.office.rooms;
    rooms[roomId] ??= {};
    return rooms[roomId];
  }

  /** Start a brew: a pot, lunch, a lab sample, a seed, the beds, a dream. */
  startRoutine(roomId: string): boolean {
    const routine = ROOM_ROUTINES[roomId];
    const now = this.now();
    if (routine?.kind !== 'brew' || routineView(this.state, roomId, now)?.status !== 'idle') {
      return false;
    }
    const play = this.roomPlay(roomId);
    play.startedAt = now;
    play.readyAt = now + brewSeconds(this.state, roomId) * 1000;
    this.save();
    this.emit();
    return true;
  }

  /** Share out a finished brew. */
  collectRoutine(roomId: string): RoomPlayResult | null {
    const routine = ROOM_ROUTINES[roomId];
    if (
      routine?.kind !== 'brew' ||
      routineView(this.state, roomId, this.now())?.status !== 'ready'
    ) {
      return null;
    }
    const play = this.roomPlay(roomId);
    delete play.startedAt;
    delete play.readyAt;
    play.done = (play.done ?? 0) + 1;
    const outcome = this.pickOutcome(routine.outcomes);
    const result: RoomPlayResult = {
      roomId,
      kind: 'brew',
      outcome: outcome.id,
      payout: this.grantRoomReward(roomId, outcome.reward),
      speaker: this.speaker(roomId),
    };
    if (outcome.reveal) this.revealInto(result);
    return this.finishPlay(result);
  }

  /** Catch what is on a room's screen before it goes. */
  catchBlip(roomId: string): RoomPlayResult | null {
    const routine = ROOM_ROUTINES[roomId];
    if (
      routine?.kind !== 'watch' ||
      routineView(this.state, roomId, this.now())?.status !== 'blip'
    ) {
      return null;
    }
    const play = this.roomPlay(roomId);
    delete play.blipAt;
    delete play.blipUntil;
    play.done = (play.done ?? 0) + 1;
    const result: RoomPlayResult = {
      roomId,
      kind: 'watch',
      outcome: 'caught',
      payout: this.grantRoomReward(roomId, routine.reward),
      speaker: this.speaker(roomId),
    };
    if (this.rng.chance(routine.revealChance)) this.revealInto(result);
    return this.finishPlay(result);
  }

  /** Hand over what arrived: a letter or parcel for a teammate, or an order for the company. */
  deliverParcel(roomId: string): RoomPlayResult | null {
    const routine = ROOM_ROUTINES[roomId];
    if (routine?.kind !== 'deliver' || !isRoomIdUnlocked(this.state, roomId)) return null;
    const play = this.roomPlay(roomId);
    if (!play.parcelAt) return null;
    const addressee = play.parcelFor ?? '';
    const recipient =
      routine.to === 'teammate' && this.state.employees[addressee]?.hired ? addressee : undefined;
    delete play.parcelAt;
    delete play.parcelFor;
    play.done = (play.done ?? 0) + 1;
    const result: RoomPlayResult = {
      roomId,
      kind: 'deliver',
      outcome: 'delivered',
      payout: this.grantRoomReward(roomId, routine.reward, recipient),
      recipient,
      speaker: recipient ?? this.speaker(roomId),
    };
    if (routine.revealChance > 0 && this.rng.chance(routine.revealChance)) this.revealInto(result);
    return this.finishPlay(result);
  }

  /** Switch a room to its next mode. The room's people take to it at once. */
  cycleRoomMode(roomId: string): RoomPlayResult | null {
    const routine = ROOM_ROUTINES[roomId];
    if (routine?.kind !== 'tune' || !isRoomIdUnlocked(this.state, roomId)) return null;
    const play = this.roomPlay(roomId);
    const index = routine.modes.findIndex((mode) => mode.id === play.mode);
    const next = routine.modes[(index + 1) % routine.modes.length];
    play.mode = next.id;
    for (const id of employeesInRoom(this.state, roomId)) {
      this.setEmployeeEmotion(id, next.mood, 300);
    }
    return this.finishPlay({
      roomId,
      kind: 'tune',
      outcome: next.id,
      payout: emptyPayout(),
      speaker: this.speaker(roomId),
    });
  }

  /** Notice a curiosity that has turned up in the office. */
  noticeOddity(id: string): RoomPlayResult | null {
    const index = this.state.office.oddities.findIndex((item) => item.id === id);
    const def = ODDITIES_BY_ID[id];
    if (index < 0 || !def) return null;
    this.state.office.oddities.splice(index, 1);
    if (oddityFlag(id) in this.state.flags) {
      this.finishPlay(null);
      return null;
    }
    const result: RoomPlayResult = {
      roomId: def.roomId,
      kind: 'oddity',
      outcome: 'noticed',
      payout: emptyPayout(),
      speaker: this.speaker(def.roomId),
    };
    this.notice(def, result);
    return this.finishPlay(result);
  }

  /** What the office did on its own since the scene last asked. */
  drainOfficeNews(): OfficeNews[] {
    return this.officeNews.splice(0, this.officeNews.length);
  }

  /**
   * Make the office produce one of its moments now, within the usual limits (one
   * stuck machine and one blip at a time, a couple of deliveries, one curiosity).
   * The dice call this; so do the dev panel and tests that cannot wait for them.
   */
  spawnOfficeMoment(kind: 'tend' | 'watch' | 'deliver' | 'oddity', roomId?: string): boolean {
    const now = this.now();
    const rooms = this.state.office.rooms;
    const plays = Object.values(rooms);
    const staffed = (id: string) => employeesInRoom(this.state, id).length > 0;
    const ofKind = (wanted: RoutineKind) =>
      Object.entries(ROOM_ROUTINES)
        .filter(
          ([id, routine]) =>
            routine.kind === wanted &&
            (!roomId || id === roomId) &&
            isRoomIdUnlocked(this.state, id),
        )
        .map(([id]) => id);
    switch (kind) {
      case 'tend': {
        if (plays.some((play) => play.jamAt)) return false;
        const candidates = ofKind('tend').filter(staffed);
        if (!candidates.length) return false;
        const room = this.rng.pick(candidates);
        Object.assign(this.roomPlay(room), { jamAt: now, taps: 0 });
        this.pushNews({ kind: 'jam', roomId: room });
        return true;
      }
      case 'watch': {
        if (plays.some((play) => play.blipUntil && play.blipUntil > now)) return false;
        const room = this.weightedRoom(ofKind('watch'), (id) => (staffed(id) ? 2 : 1));
        if (!room) return false;
        Object.assign(this.roomPlay(room), {
          blipAt: now,
          blipUntil: now + watchSeconds(this.state, room) * 1000,
        });
        this.pushNews({ kind: 'blip', roomId: room });
        return true;
      }
      case 'deliver': {
        if (plays.filter((play) => play.parcelAt).length >= ROOM_PLAY.maxParcels) return false;
        const room = this.weightedRoom(
          ofKind('deliver').filter((id) => !rooms[id]?.parcelAt),
          (id) => (roomHelpers(this.state, id).length > 0 ? ROOM_PLAY.deliverHelperWeight : 1),
        );
        if (!room) return false;
        const routine = ROOM_ROUTINES[room];
        let parcelFor = '';
        if (routine.kind === 'deliver' && routine.to === 'teammate') {
          const hired = Object.keys(this.state.employees).filter(
            (id) => this.state.employees[id]?.hired,
          );
          if (!hired.length) return false;
          parcelFor = this.rng.pick(hired);
        }
        Object.assign(this.roomPlay(room), { parcelAt: now, parcelFor });
        this.pushNews({ kind: 'parcel', roomId: room });
        return true;
      }
      case 'oddity': {
        if (this.state.office.oddities.length >= ROOM_PLAY.maxOddities) return false;
        const candidates = spontaneousOddities(this.state, now).filter(
          (def) => !roomId || def.roomId === roomId,
        );
        if (!candidates.length) return false;
        const def = this.rng.pick(candidates);
        this.state.office.oddities.push({ id: def.id, roomId: def.roomId, at: now });
        this.pushNews({ kind: 'oddity', roomId: def.roomId, oddityId: def.id });
        return true;
      }
    }
  }

  /** The office getting on with things: blips fade, helpers fix, and something may turn up. */
  private stepOffice(seconds: number): void {
    const now = this.now();
    const office = this.state.office;
    for (const [roomId, play] of Object.entries(office.rooms)) {
      if (play.blipUntil && play.blipUntil <= now) {
        delete play.blipAt;
        delete play.blipUntil;
      }
      // A specialist or a close friend in the room frees a stuck machine
      // themselves, given a minute: the player's hands are welcome, not required.
      if (
        play.jamAt &&
        now - play.jamAt >= ROOM_PLAY.selfFixSeconds * 1000 &&
        peopleHelpers(this.state, roomId).length > 0
      ) {
        const result = this.fixMachine(roomId, true);
        if (result) this.pushNews({ kind: 'selfFix', roomId, result });
      }
    }
    if (office.oddities.length) {
      office.oddities = office.oddities.filter(
        (item) =>
          now - item.at < ROOM_PLAY.oddityLingerSeconds * 1000 &&
          !(oddityFlag(item.id) in this.state.flags),
      );
    }
    if (this.state.stats.playTimeSeconds < ROOM_PLAY.firstAfterSeconds) return;
    this.officeAccum += seconds;
    while (this.officeAccum >= ROOM_PLAY.rollSeconds) {
      this.officeAccum -= ROOM_PLAY.rollSeconds;
      const roll = ROOM_PLAY.rollSeconds;
      if (this.rng.chance(roll / ROOM_PLAY.tendMeanSeconds)) this.spawnOfficeMoment('tend');
      if (this.rng.chance(roll / ROOM_PLAY.watchMeanSeconds)) this.spawnOfficeMoment('watch');
      if (this.rng.chance(roll / ROOM_PLAY.deliverMeanSeconds)) this.spawnOfficeMoment('deliver');
      if (this.rng.chance(roll / ROOM_PLAY.oddityMeanSeconds)) this.spawnOfficeMoment('oddity');
    }
  }

  /** Free a stuck machine: by the player's taps, or by a helper on their own. */
  private fixMachine(roomId: string, byHelper: boolean): RoomPlayResult | null {
    const routine = ROOM_ROUTINES[roomId];
    if (routine?.kind !== 'tend') return null;
    const play = this.roomPlay(roomId);
    if (!play.jamAt) return null;
    delete play.jamAt;
    delete play.taps;
    play.done = (play.done ?? 0) + 1;
    const helpers = peopleHelpers(this.state, roomId);
    const result: RoomPlayResult = {
      roomId,
      kind: 'tend',
      outcome: byHelper ? 'selfFixed' : 'fixed',
      // A helper's fix is quicker and quieter: a short rush, nothing else.
      payout: this.grantRoomReward(
        roomId,
        byHelper ? { rush: Math.round(CLICK.rushSeconds / 2) } : routine.reward,
      ),
      speaker: byHelper && helpers.length ? this.rng.pick(helpers).id : this.speaker(roomId),
    };
    if (!byHelper && this.rng.chance(routine.revealChance)) this.revealInto(result);
    return result;
  }

  private speaker(roomId: string): string | null {
    return speakerFor(this.state, roomId, (n) => this.rng.int(0, n));
  }

  private pickOutcome(outcomes: readonly BrewOutcome[]): BrewOutcome {
    const total = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    let roll = this.rng.next() * total;
    return outcomes.find((outcome) => (roll -= outcome.weight) < 0) ?? outcomes[0];
  }

  private weightedRoom(rooms: string[], weight: (id: string) => number): string | null {
    if (!rooms.length) return null;
    const weights = rooms.map(weight);
    let roll = this.rng.next() * weights.reduce((sum, w) => sum + w, 0);
    return rooms.find((_, i) => (roll -= weights[i]) < 0) ?? rooms[0];
  }

  private pushNews(news: OfficeNews): void {
    this.officeNews.push(news);
    if (this.officeNews.length > 12) this.officeNews.shift();
  }

  /** Bring out one of the room's routine-only curiosities into `result`, if any is left. */
  private revealInto(result: RoomPlayResult): void {
    const left = routineOddities(this.state, result.roomId, this.now());
    if (left.length) this.notice(this.rng.pick(left), result);
  }

  /** Remember a curiosity, pay for it, and see whether the room's file is now complete. */
  private notice(def: OddityDef, result: RoomPlayResult): void {
    this.state.flags[oddityFlag(def.id)] = this.now();
    // Notice enough of the building's strange side and it starts to notice back.
    if (def.tone === 'paranormal' && !(ANOMALY_THREAD_FLAG in this.state.flags)) {
      const strange = ODDITIES.filter(
        (other) => other.tone === 'paranormal' && oddityFlag(other.id) in this.state.flags,
      ).length;
      if (strange >= ANOMALY_THREAD_AFTER) {
        this.state.flags[ANOMALY_THREAD_FLAG] = this.now();
        result.thread = true;
      }
    }
    result.oddityId = def.id;
    if (def.nutId) {
      result.nutId = def.nutId;
      if (!this.state.collections.nuts.includes(def.nutId)) {
        this.state.collections.nuts.push(def.nutId);
      }
    }
    addPayout(result.payout, this.grantRoomReward(def.roomId, def.reward));
    const file = roomFileFlag(def.roomId);
    if (
      !def.extra &&
      !(file in this.state.flags) &&
      fileOddities(def.roomId).every((other) => oddityFlag(other.id) in this.state.flags)
    ) {
      this.state.flags[file] = this.now();
      this.state.resources.goldenNuts += ROOM_PLAY.roomCompleteGolden;
      result.payout.golden += ROOM_PLAY.roomCompleteGolden;
      result.roomComplete = true;
    }
  }

  private finishPlay<T extends RoomPlayResult | null>(result: T): T {
    this.save();
    this.emit();
    return result;
  }

  /**
   * Pay a room reward. Production-scaled nuts never fall below a small floor;
   * mood and friendship land on the people working in the room (for a
   * delivery: on whoever it was for).
   */
  private grantRoomReward(roomId: string, reward: RoomReward, recipient?: string): RoomPayout {
    const out = emptyPayout();
    if (reward.output) {
      const nuts = Math.max(ROOM_PLAY.minOutput, this.rewardBasePerSecond() * reward.output);
      this.addNuts(nuts, false);
      out.nuts = nuts;
    }
    let golden = reward.golden ?? 0;
    if (reward.goldenChance && this.rng.chance(reward.goldenChance)) golden += 1;
    if (golden > 0) {
      this.state.resources.goldenNuts += golden;
      out.golden = golden;
    }
    if (reward.morale) {
      const before = this.state.resources.morale;
      this.state.resources.morale = Math.max(
        0,
        Math.min(moraleCap(this.state), before + reward.morale),
      );
      out.morale = this.state.resources.morale - before;
    }
    if (reward.reputation) {
      this.state.resources.reputation += reward.reputation;
      out.reputation = reward.reputation;
    }
    if (reward.boost) {
      this.addBoost(reward.boost.value, reward.boost.seconds);
      out.boost = reward.boost;
    }
    if (reward.rush && employeesInRoom(this.state, roomId).length > 0) {
      this.startRush(roomId, reward.rush);
      out.rush = reward.rush;
    }
    for (const id of recipient ? [recipient] : employeesInRoom(this.state, roomId)) {
      const rt = this.state.employees[id];
      if (!rt?.hired) continue;
      if (reward.friendship) rt.friendship = Math.min(100, rt.friendship + reward.friendship);
      if (reward.mood) this.setEmployeeEmotion(id, reward.mood.emotion, reward.mood.seconds);
    }
    if (reward.everyone) {
      for (const rt of Object.values(this.state.employees)) {
        if (rt.hired) rt.friendship = Math.min(100, rt.friendship + reward.everyone);
      }
    }
    return out;
  }

  /**
   * Apply any promised consequences that have come due.
   *
   * Run every tick, which also means a player who was away gets their bill on
   * return rather than having it silently skipped: `tick` catches up elapsed time,
   * so anything whose moment passed offline settles on the next tick.
   */
  private settleScheduled(): void {
    if (this.state.scheduled.length === 0) return;
    const now = this.now();
    const due = this.state.scheduled.filter((s) => s.at <= now);
    if (due.length === 0) return;
    this.state.scheduled = this.state.scheduled.filter((s) => s.at > now);

    for (const item of due) {
      const def = GAME_EVENTS_BY_ID[item.sourceEventId];
      for (const effect of item.effects) {
        // Reuse the ordinary effect pipeline so a delayed change is clamped and
        // recorded exactly like an immediate one.
        this.applyEffect(effect, def ?? this.syntheticEventFor(item));
      }
      // Surfaced so the callback never feels like an unexplained swing; a quiet
      // one shows up in the world instead (someone says something, something
      // turns up), so it is discovered rather than announced.
      if (!item.quiet) {
        this.settledConsequences.push(item);
        if (this.settledConsequences.length > 8) this.settledConsequences.shift();
      }
      this.writeDiary({ kind: 'landed', eventId: item.sourceEventId });
    }
    this.save();
  }

  /**
   * A minimal event stand-in for a scheduled consequence whose source event no
   * longer exists (content removed between versions). Keeps `applyEffect`'s
   * employee fallbacks working without special-casing them.
   */
  private syntheticEventFor(item: ScheduledConsequence): GameEventDef {
    return {
      id: item.sourceEventId,
      titleKey: item.titleKey,
      bodyKey: item.bodyKey,
      rarity: 'common',
      weight: 0,
      cooldownSeconds: 0,
      choices: [],
    };
  }

  /** The live combo streak on a station, or 0 if it has lapsed. */
  comboStreak(stationId: string): number {
    const def = CLICK_STATIONS_BY_ID[stationId];
    if (!def || !this.combo || this.combo.stationId !== stationId) return 0;
    if (this.now() - this.combo.lastTapAt > stationComboWindowMs(this.state, def)) return 0;
    return this.combo.streak;
  }

  /** The combo window currently in force for a station (rooms can widen it). */
  comboWindowFor(stationId: string): number {
    const def = CLICK_STATIONS_BY_ID[stationId];
    return def ? stationComboWindowMs(this.state, def) : CLICK.comboWindowMs;
  }

  canAfford(resource: 'nuts' | 'goldenNuts' | 'permanentKernels', amount: number): boolean {
    return this.state.resources[resource] >= amount;
  }

  buyUpgrade(id: string): boolean {
    const def = UPGRADES_BY_ID[id];
    if (!def) return false;
    if (!isUpgradeUnlocked(this.state, def)) return false;
    const owned = this.state.upgrades[id] ?? 0;
    if (owned >= def.maxLevel) return false;
    // Never sell a level that would change nothing (automation already complete).
    if (upgradeSaturated(this.state, def)) return false;
    const passives = aggregatePassives(this.state);
    const reduction = def.resource === 'nuts' ? passives.costReduction : 0;
    const cost = upgradeCost(def, owned, reduction);
    if (!this.canAfford(def.resource, cost)) return false;
    this.state.resources[def.resource] -= cost;
    this.state.upgrades[id] = owned + 1;
    this.emit();
    // A purchase is a deliberate step: keep it even if the game closes now.
    this.save();
    return true;
  }

  hireOrLevelEmployee(id: string): boolean {
    const def = EMPLOYEES_BY_ID[id];
    if (!def) return false;
    if (!isEmployeeUnlocked(this.state, def)) return false;
    const rt = this.state.employees[id];
    if (!rt) return false;
    const passives = aggregatePassives(this.state);
    const reduction = def.hireCost.resource === 'nuts' ? passives.costReduction : 0;
    const cost = employeeLevelCost(def, rt.level, reduction);
    if (!this.canAfford(def.hireCost.resource, cost)) return false;
    this.state.resources[def.hireCost.resource] -= cost;
    const firstDay = !rt.hired;
    rt.hired = true;
    rt.level += 1;
    // A new hire needs a desk that exists. Without this they resolve to their
    // department (or the Founder's Desk) no matter how full it already is.
    if (firstDay && !rt.room) {
      const home = def.room;
      rt.room =
        home && isRoomIdUnlocked(this.state, home) && roomHasSpace(this.state, home)
          ? home
          : bestRoomWithSpace(this.state, id);
      enforceRoomCapacity(this.state);
    }
    this.emit();
    // A purchase is a deliberate step: keep it even if the game closes now.
    this.save();
    return true;
  }

  setEmployeeOutfit(id: string, outfitId: string): boolean {
    const def = EMPLOYEES_BY_ID[id];
    const rt = this.state.employees[id];
    if (!def || !rt) return false;
    const outfit = def.outfits.find((o) => o.id === outfitId);
    if (!outfit) return false;
    const owned = this.state.collections.outfits.includes(outfitId);
    if (!owned) {
      if (!this.canAfford(outfit.cost.resource, outfit.cost.amount)) return false;
      this.state.resources[outfit.cost.resource] -= outfit.cost.amount;
      this.state.collections.outfits.push(outfitId);
    }
    rt.outfitId = outfitId;
    this.emit();
    return true;
  }

  renameCompany(name: string): void {
    this.state.company.name = name.slice(0, 40) || this.state.company.name;
    this.emit();
  }

  /** Set the company's chosen logo icon. Deliberate + must survive reload. */
  setCompanyIcon(icon: string): void {
    this.state.company.icon = icon;
    this.save();
    this.emit();
  }

  renameEmployee(id: string, nickname: string): void {
    const rt = this.state.employees[id];
    if (!rt) return;
    rt.nickname = nickname.slice(0, 24) || null;
    this.emit();
  }

  /**
   * Assign an employee to a specific unlocked room (or null to use their
   * department default). Returns false if the room isn't unlocked/valid so the
   * caller can surface feedback.
   */
  assignEmployee(id: string, roomId: string | null): boolean {
    const rt = this.state.employees[id];
    if (!rt) return false;
    if (roomId !== null && !isRoomIdUnlocked(this.state, roomId)) return false;
    // A full room refuses the move outright rather than accepting it and letting
    // the capacity pass silently bounce them somewhere else — the player asked for
    // a specific desk, so "no" is the honest answer.
    if (
      roomId !== null &&
      resolveEmployeeRoom(this.state, id) !== roomId &&
      !roomHasSpace(this.state, roomId)
    ) {
      return false;
    }
    rt.room = roomId;
    // Clearing an assignment hands them back to the fallback, which can overfill a
    // room; re-seat whoever that displaces.
    if (roomId === null) enforceRoomCapacity(this.state);
    this.emit();
    this.save(); // a room move is a deliberate action — persist it immediately
    return true;
  }

  /**
   * Auto-arrange every hired employee.
   *   'department' — send each teammate to their home department room (if
   *                  unlocked); this is also the sensible "restore default".
   *   'balanced'   — spread the team evenly across all unlocked rooms.
   * Returns the number of employees actually moved.
   */
  autoArrangeEmployees(strategy: 'department' | 'balanced'): number {
    const hired = Object.entries(this.state.employees).filter(([, rt]) => rt.hired);
    let changes = 0;
    // Both strategies fill rooms against a live occupancy count, so neither can
    // produce a five-person room. 'department' used to send a whole department to
    // one room regardless, and 'balanced' round-robined over however many rooms
    // happened to be unlocked.
    const occupancy = new Map<string, number>(unlockedRooms(this.state).map((r) => [r.id, 0]));
    const take = (roomId: string): boolean => {
      const seated = occupancy.get(roomId);
      if (seated === undefined || seated >= ROOM_CAP) return false;
      occupancy.set(roomId, seated + 1);
      return true;
    };
    const place = (rt: (typeof hired)[number][1], roomId: string | null) => {
      if (!roomId) return;
      if (rt.room !== roomId) {
        rt.room = roomId;
        changes += 1;
      }
    };

    if (strategy === 'department') {
      const spill: [string, (typeof hired)[number][1]][] = [];
      for (const [id, rt] of hired) {
        const home = EMPLOYEES_BY_ID[id]?.room ?? null;
        if (home && isRoomIdUnlocked(this.state, home) && take(home)) place(rt, home);
        else spill.push([id, rt]);
      }
      // Anyone whose department is full or locked gets the room they next prefer.
      for (const [id, rt] of spill) {
        const target = bestRoomWithSpace(this.state, id, occupancy);
        if (target && take(target)) place(rt, target);
      }
    } else {
      const rooms = unlockedRooms(this.state).map((r) => r.id);
      if (rooms.length > 0) {
        // Deal round-robin, skipping rooms that have reached the cap so a small
        // office packs evenly instead of overfilling the first few rooms.
        let cursor = 0;
        for (const [, rt] of hired) {
          let target: string | null = null;
          for (let step = 0; step < rooms.length; step += 1) {
            const candidate = rooms[(cursor + step) % rooms.length];
            if (take(candidate)) {
              target = candidate;
              cursor = (cursor + step + 1) % rooms.length;
              break;
            }
          }
          place(rt, target);
        }
      }
    }
    if (changes > 0) {
      enforceRoomCapacity(this.state);
      this.emit();
    }
    return changes;
  }

  coffeeCooldownRemaining(id: string): number {
    const at = this.state.flags[`interaction.coffee.${id}`];
    return at === undefined ? 0 : Math.max(0, Math.ceil(120 - (this.now() - at) / 1000));
  }

  giveCoffee(id: string): boolean {
    const rt = this.state.employees[id];
    if (!rt?.hired || this.coffeeCooldownRemaining(id) > 0) return false;
    this.state.flags[`interaction.coffee.${id}`] = this.now();
    rt.friendship = Math.min(100, rt.friendship + 3);
    this.state.resources.morale = Math.min(moraleCap(this.state), this.state.resources.morale + 2);
    this.emit();
    this.save();
    return true;
  }

  petPip(): void {
    const pip = this.state.employees['pip'];
    const last = this.state.flags['interaction.pet.pip'];
    if (pip && (last === undefined || this.now() - last >= 15_000)) {
      pip.friendship = Math.min(100, pip.friendship + 1);
      this.state.flags['interaction.pet.pip'] = this.now();
    }
    this.addBoost(1.05, 15);
    this.emit();
  }

  /** `from`: when the encouragement began (default now; a completed session: when it ended). */
  addBoost(multiplier: number, seconds: number, from: number = this.now()): void {
    if (
      !Number.isFinite(multiplier) ||
      !Number.isFinite(seconds) ||
      !Number.isFinite(from) ||
      multiplier <= 1 ||
      seconds <= 0
    )
      return;
    // Repeated pets/coffee refresh the same encouragement instead of multiplying
    // production exponentially with every click.
    const existing = this.tempBoosts.find((boost) => boost.multiplier === multiplier);
    if (existing) {
      existing.endsAt = Math.max(existing.endsAt, from + seconds * 1000);
      return;
    }
    this.tempBoosts.push({ multiplier, endsAt: from + seconds * 1000 });
  }

  // -- events ---------------------------------------------------------------
  /** Ids of the events that could fire right now. Useful for diagnostics. */
  eligibleEventIds(): string[] {
    return this.eligibleEvents().map((ev) => ev.id);
  }

  /** Every event whose cooldown has expired and whose requirements are met. */
  eligibleEvents(): GameEventDef[] {
    const t = this.now();
    return GAME_EVENTS.filter((ev) => {
      const cd = this.state.eventCooldowns[ev.id] ?? 0;
      if (cd > t) return false;
      if (ev.requires?.reputation && this.state.resources.reputation < ev.requires.reputation)
        return false;
      if (ev.requires?.prestige && this.state.prestige.count < ev.requires.prestige) return false;
      if (ev.requires?.hiredEmployee && !this.state.employees[ev.requires.hiredEmployee]?.hired)
        return false;
      // Consequence memory: content can be gated on what this company has
      // already done, which is how a decision made an hour ago comes back.
      if (ev.requires?.flag && !(ev.requires.flag in this.state.flags)) return false;
      if (ev.requires?.missingFlag && ev.requires.missingFlag in this.state.flags) return false;
      if (ev.requires?.room && !isRoomIdUnlocked(this.state, ev.requires.room)) return false;
      // Situational events: a morale crisis should only turn up when there IS one.
      if (
        ev.requires?.moraleBelow !== undefined &&
        this.state.resources.morale > ev.requires.moraleBelow
      )
        return false;
      if (
        ev.requires?.moraleAbove !== undefined &&
        this.state.resources.morale < ev.requires.moraleAbove
      )
        return false;
      if (!meetsHappeningRequirements(this.state, ev, t)) return false;
      // Already happening somewhere in the office.
      if (this.state.happenings.incidents.some((item) => item.eventId === ev.id)) return false;
      return true;
    });
  }

  /**
   * Something may start happening in the office.
   *
   * Events never open themselves. A roll either plays a small moment (two
   * teammates, a line each, no popup) or starts an incident: it waits where it
   * is happening, the teammate it is about points it out, and the player looks
   * into it when they choose. A couple at most wait at once, and a new founder
   * gets a few quiet minutes first. Rarity decides which incident: a tier first,
   * then the events' own weights, with rare events growing likelier the longer
   * it has been since one.
   */
  maybeRollEvent(force = false): void {
    if (this.activeEvent || this.activeTalk) return;
    if (!force && this.state.stats.playTimeSeconds < HAPPENINGS.firstAfterSeconds) return;
    if (!force && !this.rng.chance(HAPPENINGS.chance)) return;
    const now = this.now();
    const moments = eligibleMoments(this.state, now);
    if (moments.length && this.rng.chance(HAPPENINGS.momentShare)) {
      const total = moments.reduce((sum, def) => sum + def.weight, 0);
      let roll = this.rng.next() * total;
      this.playMoment(moments.find((def) => (roll -= def.weight) < 0) ?? moments[0]);
      return;
    }
    if (this.state.happenings.incidents.length >= HAPPENINGS.maxIncidents) return;
    const busy = new Set(this.state.happenings.incidents.map((item) => item.roomId));
    const pool = this.eligibleEvents().filter(
      (def) => !busy.has(eventPlace(this.state, def).roomId),
    );
    const chosen = pickIncident(pool, this.rarityOdds(), () => this.rng.next());
    if (chosen) this.queueIncident(chosen.id);
  }

  /** How likely each rarity is for the next incident (see sim/happenings.ts). */
  rarityOdds() {
    const passives = aggregatePassives(this.state);
    const luck =
      aggregateCompanyModifiers(this.state).eventLuck +
      passives.rareChance +
      prestigeRareEventChance(this.state);
    return rarityOdds(luck, this.state.happenings.sinceRare);
  }

  /** Incidents waiting in the office. */
  pendingIncidents(): PendingIncident[] {
    return this.state.happenings.incidents;
  }

  /**
   * An event starts happening in the office. With choice popups turned off the
   * team handles it there and then (and says so), exactly as before.
   */
  queueIncident(eventId: string): boolean {
    const def = GAME_EVENTS_BY_ID[eventId];
    if (!def) return false;
    if (this.state.happenings.incidents.some((item) => item.eventId === eventId)) return false;
    if (this.state.settings.autoResolveEvents) {
      if (this.activeEvent) return false;
      return this.triggerEvent(eventId);
    }
    const now = this.now();
    const place = eventPlace(this.state, def);
    const incident: PendingIncident = {
      id: `incident-${def.id}-${now.toString(36)}`,
      eventId: def.id,
      roomId: place.roomId,
      employeeId: place.employeeId,
      at: now,
      until: now + HAPPENINGS.lingerSeconds[def.rarity] * 1000,
    };
    this.state.happenings.incidents.push(incident);
    // Rare events grow likelier with every incident since the last one.
    this.state.happenings.sinceRare =
      def.rarity === 'rare' || def.rarity === 'legendary' ? 0 : this.state.happenings.sinceRare + 1;
    this.writeDiary({ kind: 'incident', eventId: def.id, roomId: place.roomId });
    const hooks = HOOKS[def.rarity];
    this.pushNews({
      kind: 'incident',
      roomId: place.roomId,
      eventId: def.id,
      employeeId: place.employeeId,
      hookKey: def.hookKey ?? hooks[this.rng.int(0, hooks.length)],
    });
    this.save();
    this.emit();
    return true;
  }

  /** The player looks into something that is happening: its card opens. */
  openIncident(id: string): boolean {
    if (this.activeEvent || this.activeTalk) return false;
    const index = this.state.happenings.incidents.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const incident = this.state.happenings.incidents[index];
    if (!GAME_EVENTS_BY_ID[incident.eventId]) {
      this.state.happenings.incidents.splice(index, 1);
      return false;
    }
    this.state.happenings.incidents.splice(index, 1);
    this.writeDiary({ kind: 'opened', eventId: incident.eventId, roomId: incident.roomId });
    return this.triggerEvent(incident.eventId, {
      roomId: incident.roomId,
      employeeId: incident.employeeId,
    });
  }

  /**
   * Incidents nobody looked into: an ordinary one is handled by the team (the
   * department's own call, reported like any auto-resolved event); a rare one
   * simply passes, and may come round again another day.
   */
  private expireIncidents(): void {
    const now = this.now();
    const incidents = this.state.happenings.incidents;
    if (!incidents.some((item) => item.until <= now)) return;
    for (const incident of [...incidents]) {
      if (incident.until > now) continue;
      const def = GAME_EVENTS_BY_ID[incident.eventId];
      if (def && (def.rarity === 'common' || def.rarity === 'uncommon') && !this.activeEvent) {
        this.state.happenings.incidents = this.state.happenings.incidents.filter(
          (item) => item.id !== incident.id,
        );
        this.activeEvent = {
          def,
          step: null,
          instanceId: this.nextEventInstanceId++,
          place: { roomId: incident.roomId, employeeId: incident.employeeId },
        };
        this.state.eventInProgress = { eventId: def.id, step: null };
        this.autoResolveActiveEvent();
        this.writeDiary({ kind: 'handled', eventId: def.id, roomId: incident.roomId });
      } else if (!def || def.rarity === 'rare' || def.rarity === 'legendary') {
        this.state.happenings.incidents = this.state.happenings.incidents.filter(
          (item) => item.id !== incident.id,
        );
        if (def) this.state.eventCooldowns[def.id] = now + def.cooldownSeconds * 1000;
        this.writeDiary({ kind: 'faded', eventId: incident.eventId, roomId: incident.roomId });
      }
    }
  }

  /** A small moment plays out: a line or two, a little good, no popup. */
  playMoment(def: WorldMomentDef): void {
    const roomId = resolveEmployeeRoom(this.state, def.cast[0]);
    this.state.eventCooldowns[`moment:${def.id}`] = this.now() + def.cooldownSeconds * 1000;
    this.state.flags[`moment.${def.id}`] ??= this.now();
    const payout = this.grantRoomReward(roomId, def.reward);
    this.writeDiary({ kind: 'moment', momentId: def.id, roomId });
    this.pushNews({ kind: 'moment', roomId, momentId: def.id, payout });
    this.save();
    this.emit();
  }

  /** Someone will say something about it, when the player is next around. */
  queueRemark(employeeId: string, key: string, delaySeconds = 0): void {
    if (!this.state.employees[employeeId]?.hired) return;
    const remarks = this.state.happenings.remarks;
    if (remarks.some((item) => item.key === key)) return;
    remarks.push({ employeeId, key, at: this.now() + Math.max(0, delaySeconds) * 1000 });
    if (remarks.length > HAPPENINGS.maxRemarks) remarks.shift();
    this.writeDiary({ kind: 'remark', employeeId });
  }

  /** Take what a teammate has been waiting to say (null if nothing, or not yet). */
  takeRemark(employeeId: string): string | null {
    const remarks = this.state.happenings.remarks;
    const index = remarks.findIndex(
      (item) => item.employeeId === employeeId && item.at <= this.now(),
    );
    if (index < 0) return null;
    const [remark] = remarks.splice(index, 1);
    this.save();
    return remark.key;
  }

  /**
   * Marks this choice left that a teammate remembers (content/happenings.ts):
   * one of them will bring it up a few minutes later. Returns who.
   */
  private rememberChoice(flagsBefore: Set<string>): string | null {
    const fresh = Object.keys(this.state.flags).filter((flag) => !flagsBefore.has(flag));
    const memories = fresh
      .flatMap((flag) => memoriesOf(flag))
      .filter((memory) => this.state.employees[memory.employeeId]?.hired);
    if (!memories.length) return null;
    const memory = memories[this.rng.int(0, memories.length)];
    const [min, max] = HAPPENINGS.memoryDelay;
    this.queueRemark(memory.employeeId, `memory.${memory.key}`, min + this.rng.int(0, max - min));
    return memory.employeeId;
  }

  private writeDiary(entry: Omit<DiaryEntryInput, 'at'>): void {
    const diary = this.state.happenings.diary;
    diary.push({ at: this.now(), ...entry });
    if (diary.length > HAPPENINGS.diarySize) diary.splice(0, diary.length - HAPPENINGS.diarySize);
  }

  /**
   * Time away from the office (closed, or the computer asleep): a few things may
   * have started happening, at most one per quarter of an hour, never more than
   * can wait at once. They are there, in their rooms, when the player is back.
   */
  catchUpHappenings(seconds: number): number {
    if (!(seconds > 0) || this.state.settings.autoResolveEvents) return 0;
    const times = Math.min(
      HAPPENINGS.maxIncidents,
      Math.floor(seconds / HAPPENINGS.awaySecondsPerIncident),
    );
    let started = 0;
    for (let i = 0; i < times; i += 1) {
      if (this.state.happenings.incidents.length >= HAPPENINGS.maxIncidents) break;
      const busy = new Set(this.state.happenings.incidents.map((item) => item.roomId));
      const pool = this.eligibleEvents().filter(
        (def) => !busy.has(eventPlace(this.state, def).roomId),
      );
      const chosen = pickIncident(pool, this.rarityOdds(), () => this.rng.next());
      if (!chosen) break;
      if (this.queueIncident(chosen.id)) started += 1;
    }
    // Nobody announces these on the way in: they are simply there, in their rooms.
    this.officeNews = this.officeNews.filter((item) => item.kind !== 'incident');
    return started;
  }

  triggerEvent(id: string, place?: EventPlace): boolean {
    const def = GAME_EVENTS_BY_ID[id];
    if (!def || this.activeEvent) return false;
    this.activeEvent = {
      def,
      step: null,
      instanceId: this.nextEventInstanceId++,
      place: place ?? eventPlace(this.state, def),
    };
    this.state.eventInProgress = { eventId: id, step: null };
    this.state.stats.eventsSeen += 1;
    this.progressDaily('employeeConversations', def.employeeId ? 1 : 0);

    // The player has asked not to be interrupted: handle the whole event now,
    // consequences and all, and report it instead of showing a popup.
    if (this.state.settings.autoResolveEvents) {
      const handled = this.autoResolveActiveEvent();
      this.emit();
      return handled;
    }

    this.emit();
    this.save();
    return true;
  }

  inspectFacility(id: string): boolean {
    if (this.activeTalk || this.activeEvent) return false;
    const discovery = availableFacilityDiscoveries(this.state).find((entry) => entry.id === id);
    return discovery ? this.triggerEvent(discovery.eventId) : false;
  }

  private restoreEvent(): void {
    const pending = this.state.eventInProgress;
    this.activeEvent = null;
    if (!pending) return;
    const def = GAME_EVENTS_BY_ID[pending.eventId];
    if (!def || (pending.step !== null && !def.steps?.[pending.step])) {
      this.state.eventInProgress = null;
      return;
    }
    this.activeEvent = {
      def,
      step: pending.step,
      instanceId: this.nextEventInstanceId++,
      place: eventPlace(this.state, def),
    };
  }

  /**
   * Resolve the active event (and any chain it leads into) without a popup.
   *
   * Runs the real `resolveEventChoice` path so effects, the measured consequence
   * report, event history and cooldowns behave exactly as they do when the player
   * decides by hand — the only difference is who picked. The decisions taken are
   * returned so the UI can summarise them in the notification feed.
   */
  private autoResolveActiveEvent(): boolean {
    const decisions: AutoResolvedDecision[] = [];
    // A chain cannot legitimately be longer than its authored steps; the guard
    // stops malformed content (a step pointing at itself) from spinning forever.
    const guard = Object.keys(this.activeEvent?.def.steps ?? {}).length + 2;

    for (let i = 0; i < guard; i += 1) {
      const active = this.activeEvent;
      if (!active) break;
      const picked = chooseAutoResolution(this.state, active.def, active.step);
      if (!picked) break;
      decisions.push({ def: active.def, choice: picked.choice });
      const resolved = this.resolveEventChoice(picked.choice.id, {
        eventInstanceId: active.instanceId,
        step: active.step,
      });
      if (!resolved) break;
    }

    if (decisions.length === 0) {
      // Nothing actionable (malformed content): do not leave a popup stranded.
      this.activeEvent = null;
      this.state.eventInProgress = null;
      return false;
    }

    // The result panel is an interruption too, so it is suppressed; the summary
    // below is what the player sees.
    if (this.activeEvent) {
      // Malformed cyclic chains must not hold the event slot forever.
      this.state.eventCooldowns[this.activeEvent.def.id] =
        this.now() + this.activeEvent.def.cooldownSeconds * 1000;
      this.activeEvent = null;
      this.state.eventInProgress = null;
    }
    this.lastConsequence = null;
    this.lastAutoResolved = {
      titleKey: decisions[0].def.titleKey,
      choiceLabelKey: decisions[decisions.length - 1].choice.labelKey,
      at: this.now(),
    };
    this.save();
    return true;
  }

  resolveEventChoice(choiceId: string, context?: EventChoiceContext): boolean {
    const active = this.activeEvent;
    if (!active) return false;
    if (
      context &&
      (context.eventInstanceId !== active.instanceId || context.step !== active.step)
    ) {
      return false;
    }
    if (this.resolvingEventInstanceId === active.instanceId) return false;

    const { def, step } = active;
    const choiceSet = eventChoicesForState(this.state, def, step);
    const evaluatedChoice = choiceSet.choices.find((entry) => entry.choice.id === choiceId);
    if (!evaluatedChoice?.enabled) return false;
    const choice = evaluatedChoice.choice;

    this.resolvingEventInstanceId = active.instanceId;
    try {
      // Snapshot BEFORE applying effects so the "WHAT CHANGED" panel reports the
      // real, measured change rather than the raw effect list.
      const now = this.now();
      const before = this.snapshotForReport(now);
      const flagsBefore = new Set(Object.keys(this.state.flags));

      for (const effect of choice.effects) this.applyEffect(effect, def);

      const report = this.diffReport(before, choice.effects, now);
      // A choice someone will bring up later, unprompted, when the player is around.
      const remembered = this.rememberChoice(flagsBefore);

      // record the decision in the company timeline (capped)
      this.state.eventHistory.push({ eventId: def.id, choiceId: choice.id, at: this.now() });
      if (this.state.eventHistory.length > 50) this.state.eventHistory.shift();

      // build the consequence result panel (announces every change clearly)
      this.lastConsequence = {
        eventId: def.id,
        titleKey: def.titleKey,
        choiceLabelKey: choice.labelKey,
        effects: choice.effects,
        reactions: choice.reactions ?? [],
        report,
        place: active.place,
        rarity: def.rarity,
        setInMotion: choice.effects.some((effect) => effect.type === 'schedule'),
        remembered: remembered ?? undefined,
      };

      // advance chain or close
      if (choice.next && def.steps?.[choice.next]) {
        this.activeEvent = {
          def,
          step: choice.next,
          instanceId: active.instanceId,
          place: active.place,
        };
        this.state.eventInProgress = { eventId: def.id, step: choice.next };
        // mid-chain steps don't show a standalone result panel
        this.lastConsequence = null;
      } else {
        this.state.eventCooldowns[def.id] = this.now() + def.cooldownSeconds * 1000;
        this.filePromisedMoment(def, choice);
        report.momentCreated = this.state.collections.moments.length > before.moments;
        this.activeEvent = null;
        this.state.eventInProgress = null;
      }
      this.save();
      this.emit();
      return true;
    } finally {
      this.resolvingEventInstanceId = null;
    }
  }

  /**
   * Keep the souvenir a `momentWorthy` event promises.
   *
   * `GameEventDef.momentWorthy` is documented as "true when this event is worth a
   * shareable Moment Card automatically", and forty-four events are authored with it —
   * but nothing read the flag. Cards were only ever created by an explicit
   * `{ type: 'momentCard' }` effect on the chosen path, so most of those forty-four
   * quietly produced nothing, and the collection stayed far emptier than the content
   * intended.
   *
   * Two conditions keep it honest rather than spammy:
   *  - if the chosen path already filed a card, this does nothing, so an event that
   *    hand-places `momentCard` on one branch never ends up with two;
   *  - only the FIRST time the company settles this event, because a souvenir is a
   *    memento of a thing happening, not a receipt printed on every repeat.
   *
   * Called only when an event CLOSES, so a multi-step chain files one card at its
   * conclusion rather than one per step.
   */
  private filePromisedMoment(def: GameEventDef, choice: EventChoice): void {
    if (!def.momentWorthy) return;
    if (choice.effects.some((effect) => effect.type === 'momentCard')) return;
    if (this.state.collections.moments.some((card) => card.eventId === def.id)) return;
    this.createMomentCard(def);
  }

  clearConsequence(): void {
    this.lastConsequence = null;
    this.emit();
  }

  /* ---------------------------------------------------------------------------
   * Employee conversations (the full-screen interaction mode)
   *
   * Deliberately built ON the event machinery rather than beside it: a talk's
   * consequences are `EventEffect`s put through `applyEffect`, so they inherit the
   * caps, the temporary-emotion expiry, consequence-memory flags and the scheduled
   * queue for free — a promise made in conversation is billed by the same
   * `settleScheduled` that bills a random event. The only new persistent state is the
   * per-employee `talks` memory, which is what stops a once-only conversation from
   * repeating and lets later content ask how long ago something was said.
   * ------------------------------------------------------------------------- */

  /** Open a conversation, choosing the most pressing topic. False if nobody is free. */
  openTalk(
    employeeId: string,
    topicId?: string,
    visit = false,
    opts: { tab?: VisitTab } = {},
  ): boolean {
    const rt = this.state.employees[employeeId];
    if (!rt?.hired) return false;
    const now = this.now();
    const profileOnly = talkCooldownRemaining(this.state, employeeId, now) > 0;
    if (profileOnly && !visit) return false;
    if (
      this.activeTalk &&
      (this.activeTalk.employeeId !== employeeId ||
        (this.activeTalk.exchanges > 0 && this.activeTalk.nodeId !== ''))
    )
      return false;
    const topic = topicId
      ? eligibleTopics(this.state, employeeId, now).find((candidate) => candidate.id === topicId)
      : pickTopic(this.state, employeeId, now);
    if (!topic) return false;
    const node = topic.nodes[topic.root];
    if (!node) return false;
    // Changing the subject (or bringing a gift) is still the same visit: a stage
    // reached when it began is still being celebrated.
    const sameVisit = this.activeTalk?.employeeId === employeeId ? this.activeTalk : null;
    this.activeTalk = {
      profileOnly,
      employeeId,
      topic,
      nodeId: profileOnly ? '' : topic.root,
      instanceId: `${employeeId}:${topic.id}:${now}`,
      promptKey: profileOnly
        ? null
        : nodePrompt(this.state, node, { employeeId, topicId: topic.id, now }),
      // The reply to the option just taken, shown before the next node's prompt.
      lastReplyKey: null,
      exchanges: 0,
      report: null,
      tab: opts.tab,
      // Reaching a new stage is celebrated the next time you stop by.
      milestone: this.acknowledgeBond(employeeId) ?? sameVisit?.milestone ?? null,
    };
    this.emit();
    return true;
  }

  /**
   * Record every stage of the relationship reached and not yet celebrated.
   * Returns the newest one, or null when there is nothing new.
   */
  private acknowledgeBond(employeeId: string): BondTier | null {
    const rt = this.state.employees[employeeId];
    if (!rt?.hired) return null;
    const tier = bondTier(rt.friendship);
    const seen = acknowledgedTier(this.state, employeeId);
    if (tier <= seen) return null;
    for (let next = seen + 1; next <= tier; next += 1) {
      this.state.flags[tierFlag(employeeId, next as BondTier)] = this.now();
    }
    return tier;
  }

  /** The player has read the gift hint this teammate dropped. */
  noteHintSeen(employeeId: string): void {
    const key = `${employeeId}.hint`;
    if (key in this.state.flags) return;
    this.state.flags[key] = this.now();
    this.save();
  }

  /** Two teammates who get on (or do not) were seen together for the first time. */
  notePairSeen(pairId: string): void {
    const key = pairFlag(pairId);
    if (key in this.state.flags) return;
    this.state.flags[key] = this.now();
  }

  /**
   * Take an option. Applies its effects, records the reply, and either advances to the
   * next node or ends the conversation.
   *
   * `instanceId` is checked so a click that was already in flight when the state moved
   * cannot resolve against a different conversation — the same staleness guard
   * `resolveEventChoice` uses for event popups.
   */
  chooseTalkOption(choiceId: string, instanceId?: string): boolean {
    const active = this.activeTalk;
    if (!active || active.profileOnly) return false;
    if (instanceId && instanceId !== active.instanceId) return false;
    const node = active.topic.nodes[active.nodeId];
    if (!node) return false;
    const now = this.now();
    const evaluated = evaluateTalkNode(this.state, active.employeeId, node.choices, now);
    const picked = evaluated.find((e) => e.choice.id === choiceId);
    if (!picked?.enabled) return false;
    const choice = picked.choice;
    const firstPreferredGift =
      active.topic.id === 'gift' &&
      choice.id === GIFT_PREFERENCES[active.employeeId] &&
      this.state.flags[`favorite.${active.employeeId}.giftMemory`] === undefined;

    // Snapshot BEFORE, so what the player is shown afterwards is measured rather
    // than a restatement of the authored effect list.
    const before = this.snapshotForReport(now);
    for (const effect of choice.effects) {
      // Effects that name no employee are about THIS conversation's employee. That is
      // what lets one topic be written once and reused across the whole cast.
      this.applyEffect(
        bindEmployeeEffect(effect, active.employeeId),
        this.talkEventShim(active.topic, choice, active.employeeId),
      );
    }
    const report = this.diffReport(before, choice.effects, now);
    if (firstPreferredGift) {
      this.state.flags[`favorite.${active.employeeId}.giftMemory`] = now;
      this.createMomentCard(
        this.talkEventShim(active.topic, choice, active.employeeId),
        choice.replyKey,
      );
    }

    this.state.eventHistory.push({
      eventId: `talk:${active.topic.id}`,
      choiceId: choice.id,
      at: now,
    });
    if (this.state.eventHistory.length > 50) this.state.eventHistory.shift();

    active.exchanges += 1;
    active.lastReplyKey = choice.replyKey;
    active.report = report;
    // A conversation that carries the relationship into a new stage says so then.
    const reached = this.acknowledgeBond(active.employeeId);
    if (reached !== null) active.milestone = reached;

    // Record the conversation on the FIRST option taken, not when it ends.
    //
    // Waiting for the end left a live exploit: a branching topic whose opening option
    // pays trust could be taken, abandoned with Escape, and taken again immediately —
    // nothing had marked the topic spent or started the cooldown, so the reward
    // repeated. Taking an option IS having the conversation, so that is the moment it
    // counts. Later options in the same conversation only refresh the timestamp.
    this.recordTalk(active.employeeId, active.topic.id, now, active.exchanges === 1);

    const next = choice.next ? active.topic.nodes[choice.next] : undefined;
    if (next) {
      active.nodeId = next.id;
      active.promptKey = nodePrompt(this.state, next, {
        employeeId: active.employeeId,
        topicId: active.topic.id,
        now,
      });
    } else {
      active.nodeId = '';
      active.promptKey = null;
    }
    // Persist after EVERY option, not only when the conversation ends.
    //
    // A talk's effects are applied irreversibly the moment an option is taken, so they
    // have to be durable at that moment too. Saving only on completion lost them: an
    // e2e test that took the first option of a branching topic, pressed Escape and
    // reloaded got the pre-conversation friendship back, because the mid-conversation
    // state was in memory and the next autosave had not come round yet. Nothing about
    // leaving a conversation early is supposed to undo what was already agreed.
    this.save();
    this.emit();
    return true;
  }

  /**
   * Write the conversation into the employee's memory and (re)start the cooldown.
   *
   * `first` distinguishes the option that begins a conversation from the ones that
   * continue it, so a three-node topic counts once rather than three times. The caller
   * saves immediately afterwards, so this memory write and the consequences it
   * accompanies land together.
   */
  private recordTalk(employeeId: string, topicId: string, now: number, first: boolean): void {
    const rt = this.state.employees[employeeId];
    if (!rt) return;
    if (!rt.talks) rt.talks = { count: 0, lastAt: 0, seen: {} };
    if (first) {
      rt.talks.count += 1;
      rt.talks.seen[topicId] = now;
    }
    rt.talks.lastAt = now;
  }

  /** Close the interaction screen. */
  closeTalk(): void {
    this.activeTalk = null;
    this.emit();
  }

  /**
   * A minimal `GameEventDef` so a talk's effects can reuse `applyEffect` unchanged.
   *
   * `applyEffect` reads only `id`, `titleKey` and `bodyKey` off the def — to label a
   * scheduled callback and to stamp a moment card — so this supplies exactly those
   * rather than forcing conversations to be authored as fake events.
   */
  private talkEventShim(topic: TalkTopic, choice: TalkChoice, employeeId: string): GameEventDef {
    return {
      id: `talk:${topic.id}`,
      employeeId,
      titleKey: topic.titleKey,
      bodyKey: choice.replyKey,
      rarity: 'common',
      weight: 0,
      cooldownSeconds: 0,
      choices: [],
    };
  }

  /** Set (or clear) an employee's event-driven emotion. Only unlocked (hired)
   *  employees have any simulation state — locked ones are ignored entirely. */
  setEmployeeEmotion(id: string, emotion: EmployeeMood, durationSeconds?: number): void {
    const rt = this.state.employees[id];
    if (!rt || !rt.hired) return;
    rt.emotion = {
      id: emotion,
      until: durationSeconds && durationSeconds > 0 ? this.now() + durationSeconds * 1000 : null,
    };
  }

  /** Drop expired temporary emotions so the save stays tidy (called each tick). */
  private expireEmotions(now: number): void {
    for (const rt of Object.values(this.state.employees)) {
      if (rt.emotion && rt.emotion.until !== null && rt.emotion.until <= now) rt.emotion = null;
    }
  }

  private snapshotForReport(now: number): {
    nuts: number;
    goldenNuts: number;
    morale: number;
    reputation: number;
    moments: number;
    emp: Record<string, { friendship: number; mood: EmployeeMood }>;
  } {
    const emp: Record<string, { friendship: number; mood: EmployeeMood }> = {};
    for (const [id, rt] of Object.entries(this.state.employees)) {
      if (!rt.hired) continue; // locked employees are not part of the simulation
      emp[id] = { friendship: rt.friendship, mood: employeeMood(this.state, id, now) };
    }
    return {
      nuts: this.state.resources.nuts,
      goldenNuts: this.state.resources.goldenNuts,
      morale: this.state.resources.morale,
      reputation: this.state.resources.reputation,
      moments: this.state.collections.moments.length,
      emp,
    };
  }

  private diffReport(
    before: ReturnType<GameEngine['snapshotForReport']>,
    effects: EventEffect[],
    now: number,
  ): ConsequenceReport {
    const boost = effects.find((e) => e.type === 'productionBoost');
    const employees: EmployeeChange[] = [];
    for (const [id, rt] of Object.entries(this.state.employees)) {
      if (!rt.hired) continue; // never report changes for locked employees
      const prev = before.emp[id];
      if (!prev) continue;
      const moodNow = employeeMood(this.state, id, now);
      const friendshipDelta = Math.round(rt.friendship - prev.friendship);
      const moodChanged = moodNow !== prev.mood;
      if (!moodChanged && friendshipDelta === 0) continue;
      employees.push({
        id,
        emotion: moodChanged ? moodNow : null,
        emotionUntil: moodChanged ? (rt.emotion?.until ?? null) : null,
        productivityDelta: moodChanged ? moodProductivityMultiplier(moodNow) - 1 : 0,
        friendshipDelta,
      });
    }
    return {
      nuts: Math.round(this.state.resources.nuts - before.nuts),
      goldenNuts: Math.round(this.state.resources.goldenNuts - before.goldenNuts),
      morale: Math.round(this.state.resources.morale - before.morale),
      reputation: Math.round(this.state.resources.reputation - before.reputation),
      boostMultiplier: boost ? (boost.value ?? 1.5) : 0,
      boostSeconds: boost ? (boost.durationSeconds ?? 60) : 0,
      momentCreated: this.state.collections.moments.length > before.moments,
      employees,
    };
  }

  /**
   * Apply one authored effect. This is the SINGLE funnel every effect goes
   * through — event choices, delayed consequences, and the dev panel — so all of
   * them share the same clamping, employee fallbacks and caps.
   *
   * `def` supplies the contextual employee for effects that omit one; it is
   * optional because a delayed consequence can outlive the event that promised it.
   */
  applyEffect(effect: EventEffect, def?: GameEventDef): void {
    // Upgrades in the "negotiation" line make favourable outcomes pay MORE without
    // softening the unfavourable ones — so investing in decision-making changes
    // which choices are worth taking, rather than removing the risk from all of
    // them. Penalties are deliberately untouched.
    const rewardBonus = 1 + upgradeBonus(this.state, 'eventReward');
    const gain = (value: number | undefined): number => {
      const raw = value ?? 0;
      return raw > 0 ? raw * rewardBonus : raw;
    };
    switch (effect.type) {
      case 'nuts':
        // Math.max(0, NaN) is NaN: a malformed value must not reach the balance.
        if (!Number.isFinite(effect.value ?? 0)) break;
        if ((effect.value ?? 0) >= 0) this.addNuts(gain(effect.value), false);
        else
          this.state.resources.nuts = Math.max(0, this.state.resources.nuts + (effect.value ?? 0));
        break;
      case 'goldenNuts':
        this.state.resources.goldenNuts = Math.max(
          0,
          this.state.resources.goldenNuts + (effect.value ?? 0),
        );
        break;
      case 'morale':
        this.state.resources.morale = Math.max(
          0,
          Math.min(moraleCap(this.state), this.state.resources.morale + (effect.value ?? 0)),
        );
        break;
      case 'reputation':
        this.state.resources.reputation = Math.max(
          0,
          this.state.resources.reputation + gain(effect.value),
        );
        break;
      case 'productionBoost':
        this.addBoost(effect.value ?? 1.5, effect.durationSeconds ?? 60);
        break;
      case 'friendship': {
        const rt = this.state.employees[effect.employeeId ?? def?.employeeId ?? ''];
        // Only unlocked employees participate in the simulation.
        if (rt && rt.hired)
          rt.friendship = Math.max(0, Math.min(100, rt.friendship + (effect.value ?? 5)));
        break;
      }
      case 'emotion': {
        const id = effect.employeeId ?? def?.employeeId ?? '';
        if (effect.emotion) this.setEmployeeEmotion(id, effect.emotion, effect.durationSeconds);
        break;
      }
      case 'collectNut':
        if (effect.nutId && !this.state.collections.nuts.includes(effect.nutId))
          this.state.collections.nuts.push(effect.nutId);
        break;
      case 'unlockSecret':
        if (effect.secretId && !this.state.collections.secrets.includes(effect.secretId))
          this.state.collections.secrets.push(effect.secretId);
        break;
      // Consequence memory. Stamped with WHEN so later content can distinguish
      // "this happened" from "this happened recently".
      case 'setFlag':
        if (effect.flagId && !(effect.flagId in this.state.flags)) {
          this.state.flags[effect.flagId] = this.now();
        }
        break;
      case 'clearFlag':
        if (effect.flagId) delete this.state.flags[effect.flagId];
        break;
      // A promise to be settled later. Stored as authored effects so the delayed
      // change still respects whatever caps are in force when it lands.
      case 'schedule': {
        if (!effect.scheduled?.length) break;
        const delay = Math.max(1, effect.delaySeconds ?? 300);
        this.state.scheduled.push({
          id: `${def?.id ?? 'manual'}:${effect.flagId ?? 'delayed'}:${this.now()}`,
          at: this.now() + delay * 1000,
          sourceEventId: def?.id ?? 'manual',
          titleKey: effect.scheduleTitleKey ?? def?.titleKey ?? 'notify.consequenceSettled',
          bodyKey: effect.scheduleBodyKey ?? def?.bodyKey ?? 'notify.consequenceSettled',
          effects: effect.scheduled.map((child) => bindEmployeeEffect(child, def?.employeeId)),
          ...(effect.quiet ? { quiet: true } : {}),
        });
        // Keep the queue bounded; a save should never accumulate promises forever.
        if (this.state.scheduled.length > 24) this.state.scheduled.shift();
        break;
      }
      case 'momentCard':
        // A moment card is a souvenir OF an event, so it needs a real source.
        if (def) this.createMomentCard(def);
        break;
      case 'find': {
        const who = effect.employeeId ?? def?.employeeId;
        if (who) this.giveStoryFind(who, effect.findNoteKey);
        break;
      }
      case 'remark': {
        const who = effect.employeeId ?? def?.employeeId;
        if (who && effect.lineKey) this.queueRemark(who, effect.lineKey, effect.delaySeconds ?? 0);
        break;
      }
      // A follow-up starts happening in the office: when there is room for it.
      // It waits its turn rather than piling onto what is already happening there.
      case 'incident': {
        const followUp = effect.eventId ? GAME_EVENTS_BY_ID[effect.eventId] : undefined;
        if (!followUp) break;
        const waiting = this.state.happenings.incidents;
        if (waiting.some((item) => item.eventId === followUp.id)) break;
        const roomId = eventPlace(this.state, followUp).roomId;
        const crowded =
          waiting.length >= HAPPENINGS.maxIncidents ||
          waiting.some((item) => item.roomId === roomId);
        const started =
          (!crowded || this.state.settings.autoResolveEvents) && this.queueIncident(followUp.id);
        if (!started) {
          this.state.scheduled.push({
            id: `${followUp.id}:waits:${this.now()}`,
            at: this.now() + HAPPENINGS.followUpRetrySeconds * 1000,
            sourceEventId: def?.id ?? followUp.id,
            titleKey: followUp.titleKey,
            bodyKey: followUp.bodyKey,
            effects: [effect],
            quiet: true,
          });
        }
        break;
      }
      case 'moment': {
        const moment = effect.momentId ? WORLD_MOMENTS_BY_ID[effect.momentId] : undefined;
        if (moment && moment.cast.every((id) => this.state.employees[id]?.hired)) {
          this.playMoment(moment);
        }
        break;
      }
      // Something turns up in a room because of what was decided.
      case 'oddity': {
        const oddity = effect.oddityId ? ODDITIES_BY_ID[effect.oddityId] : undefined;
        if (
          oddity &&
          !(oddityFlag(oddity.id) in this.state.flags) &&
          isRoomIdUnlocked(this.state, oddity.roomId) &&
          !this.state.office.oddities.some((item) => item.id === oddity.id)
        ) {
          this.state.office.oddities.push({ id: oddity.id, roomId: oddity.roomId, at: this.now() });
          // An aftermath may wait beside an ordinary curiosity.
          if (this.state.office.oddities.length > ROOM_PLAY.maxOddities + 1) {
            this.state.office.oddities.shift();
          }
          this.pushNews({ kind: 'oddity', roomId: oddity.roomId, oddityId: oddity.id });
        }
        break;
      }
      case 'roomMode': {
        const routine = effect.roomId ? ROOM_ROUTINES[effect.roomId] : undefined;
        if (routine?.kind === 'tune' && routine.modes.some((mode) => mode.id === effect.mode)) {
          this.roomPlay(effect.roomId!).mode = effect.mode;
        }
        break;
      }
      case 'rush':
        if (effect.roomId && employeesInRoom(this.state, effect.roomId).length > 0) {
          this.startRush(effect.roomId, effect.durationSeconds ?? CLICK.rushSeconds);
        }
        break;
      case 'roomMood':
        if (effect.roomId && effect.emotion) {
          for (const id of employeesInRoom(this.state, effect.roomId)) {
            this.setEmployeeEmotion(id, effect.emotion, effect.durationSeconds);
          }
        }
        break;
      case 'everyone':
        for (const rt of Object.values(this.state.employees)) {
          if (rt.hired)
            rt.friendship = Math.max(0, Math.min(100, rt.friendship + (effect.value ?? 1)));
        }
        break;
    }
  }

  /**
   * A teammate turns up holding something from their story. It takes the place of
   * anything ordinary they were holding, and waits like any other find.
   */
  private giveStoryFind(employeeId: string, noteKey?: string): void {
    const rt = this.state.employees[employeeId];
    if (!rt?.hired) return;
    const holding = this.state.finds.find((find) => find.employeeId === employeeId);
    if (holding) {
      holding.noteKey = noteKey;
      return;
    }
    const roomId = resolveEmployeeRoom(this.state, employeeId);
    this.state.finds.push({
      id: `find-story-${employeeId}-${this.now().toString(36)}`,
      employeeId,
      roomId,
      kind: ROOM_PROFILES_BY_ID[roomId]?.temper ?? 'operational',
      createdAt: this.now(),
      noteKey,
    });
    // A story find may wait beside the ordinary ones, one over the usual limit.
    if (this.state.finds.length > BALANCE.finds.maxWaiting + 1) this.state.finds.shift();
  }

  createMomentCard(def: GameEventDef, caption?: string): MomentCard {
    const card: MomentCard = {
      id: `${def.id}-${this.now()}-${Math.floor(this.rng.next() * 1e6)}`,
      eventId: def.id,
      employeeId: def.employeeId ?? null,
      caption: caption ?? def.bodyKey,
      rarity: def.rarity,
      createdAt: this.now(),
    };
    this.state.collections.moments.push(card);
    if (this.state.collections.moments.length > 200) this.state.collections.moments.shift();
    return card;
  }

  // -- daily challenges -----------------------------------------------------
  progressDaily(type: string, amount: number): void {
    if (amount <= 0) return;
    for (const ch of this.state.daily.challenges) {
      if (ch.claimed) continue;
      if (ch.id.startsWith(type)) ch.progress = Math.min(ch.goal, ch.progress + amount);
    }
  }

  private rolloverDaily(): void {
    const next = ensureDailyForDate(this.state.daily, this.now());
    if (next !== this.state.daily) this.state.daily = next;
    // maintainMorale challenge: satisfied by simply having morale above goal
    for (const ch of this.state.daily.challenges) {
      if (ch.id.startsWith('maintainMorale') && !ch.claimed) {
        if (this.state.resources.morale >= ch.goal) ch.progress = ch.goal;
      }
    }
  }

  claimDaily(id: string): boolean {
    const ch = this.state.daily.challenges.find((c) => c.id === id);
    if (!ch || ch.claimed || ch.progress < ch.goal) return false;
    ch.claimed = true;
    this.state.resources.goldenNuts += goldenForChallenge(id);
    // A claim is a deliberate step: keep it (exactly once) even if the game closes now.
    this.save();
    this.emit();
    return true;
  }

  // -- focus harvest --------------------------------------------------------
  startFocus(minutes: number): void {
    const seconds = Math.max(60, Math.round(minutes * 60));
    this.state.focus = {
      active: true,
      endsAt: this.now() + seconds * 1000,
      durationSeconds: seconds,
      completedSessions: this.state.focus.completedSessions,
    };
    this.emit();
  }

  cancelFocus(): void {
    // Never punished: simply ends the session with no penalty.
    this.state.focus.active = false;
    this.state.focus.endsAt = 0;
    this.emit();
  }

  /**
   * A session that has run its course completes at `at` (the slice of a long tick
   * it ended in), and its encouragement starts when it ended, not at whichever
   * throttled tick noticed: the two minutes of x1.2 are the ones right after it.
   */
  private tickFocus(at: number = this.now()): void {
    if (this.state.focus.active && at >= this.state.focus.endsAt) {
      this.state.focus.active = false;
      this.state.focus.completedSessions += 1;
      // reward proportional to duration
      const reward = Math.max(1, Math.round(this.state.focus.durationSeconds / (25 * 60)) * 1);
      this.state.resources.goldenNuts += reward;
      this.addBoost(1.2, 120, Math.min(this.now(), this.state.focus.endsAt));
      this.progressDaily('completeFocus', 1);
    }
  }

  // -- microgames -----------------------------------------------------------
  rewardMicrogame(kind: MicroMode, score: number): MicroReward | undefined {
    if (!MICRO_TEAM[kind] || !Number.isFinite(score) || score < 0) return;
    const now = this.now();
    const record = this.state.microgames[kind] ?? { best: 0, plays: 0, lastRewardAt: 0 };
    // A completed round lasts at least 30 seconds. Reject duplicate completion
    // callbacks even across a save/reload without throttling legitimate replays.
    if (record.plays > 0 && now - record.lastRewardAt < 25_000) return;
    score = Math.floor(score);
    const newBest = score > record.best;
    const mastered = record.best < 30 && score >= 30;
    record.best = Math.max(record.best, score);
    record.plays += 1;
    record.lastRewardAt = now;
    this.state.microgames[kind] = record;
    this.state.stats.microgamesPlayed += 1;
    this.progressDaily('playMicrogame', 1);
    const boost = 1 + Math.min(0.5, score / 100);
    // Pay from unboosted production, before granting this round's encouragement.
    // A reward must not multiply itself or compound the previous round's payout.
    const nuts =
      score > 0
        ? Math.round(
            crateValue(this.state, this.isFocusActive()) * (0.5 + Math.min(2.5, score / 50)),
          )
        : 0;
    this.addBoost(boost, 90);
    this.addNuts(nuts, false);
    const employeeIds =
      score >= 18 ? MICRO_TEAM[kind].filter((id) => this.state.employees[id]?.hired) : [];
    for (const id of employeeIds) {
      this.applyEffect({ type: 'friendship', employeeId: id, value: 3 });
      this.setEmployeeEmotion(id, 'proud', 180);
    }
    if (mastered) {
      this.state.resources.goldenNuts += 1;
      this.state.flags[`microgame.${kind}.mastered`] = now;
      this.createMomentCard({
        id: `microgame:${kind}`,
        employeeId: employeeIds[0] ?? null,
        titleKey: `microgame.${kind}.name`,
        bodyKey: `microgame.${kind}.reaction`,
        rarity: 'uncommon',
        choices: [],
        weight: 0,
        cooldownSeconds: 0,
      });
    }
    const decorationId =
      mastered && !this.state.collections.secrets.includes(`deco:${MICRO_SOUVENIRS[kind]}`)
        ? MICRO_SOUVENIRS[kind]
        : undefined;
    if (decorationId) this.applyDecorationPurchase(decorationId, `deco:${decorationId}`);
    this.save();
    this.emit();
    return {
      nuts,
      boost,
      best: record.best,
      newBest,
      mastered,
      employeeIds: [...employeeIds],
      decorationId,
    };
  }

  // -- prestige / skills / decorations --------------------------------------
  buyDecoration(id: string): boolean {
    // decorations are cosmetic + morale; stored as owned "secrets"-style flags
    const key = `deco:${id}`;
    if (this.state.collections.secrets.includes(key)) return false;
    return this.applyDecorationPurchase(id, key);
  }

  private applyDecorationPurchase(id: string, key: string): boolean {
    // Ownership is added exactly once. The item auto-places on its real support
    // (floor, wall, ceiling, tabletop, shelf or a room-specific surface) at a
    // tidy authored spot only when the complete footprint, room lock, and
    // collision/capacity checks all pass; otherwise the stable instance stays
    // safely in storage for explicit placement.
    this.state.collections.secrets.push(key);
    const def = DECORATIONS_BY_ID[id];
    if (def) {
      delete this.state.placements[id];
      syncDecorationInstanceFromPlacement(this.state, id);
      const index = placedCountOnSurface(this.state, def.room, decorationSurface(id));
      const candidate = defaultRegionPlacementFor(this.state, id, def.room, index);
      if (candidate?.ok && this.canMoveDecorationToRoom(id, def.room)) {
        this.applyRegionPlacement(id, def.room, candidate);
      }
    }
    this.emit();
    return true;
  }

  // -- decoration placement (controlled free placement) ---------------------
  private snapshotDecorationArrangement(): DecorationArrangement {
    return this.state.decorationInstances.map((instance) => ({
      instanceId: instance.instanceId,
      roomId: instance.roomId,
      surfaceType: instance.surfaceType,
      regionKind: instance.regionKind,
      normalizedX: instance.normalizedX,
      normalizedY: instance.normalizedY,
      depth: instance.depth,
      layer: instance.layer,
    }));
  }

  private restoreDecorationArrangement(arrangement: DecorationArrangement): void {
    const saved = new Map(arrangement.map((item) => [item.instanceId, item]));
    for (const instance of this.state.decorationInstances) {
      const previous = saved.get(instance.instanceId);
      if (!previous) continue;
      Object.assign(instance, previous);
    }
    repairDecorationInstances(this.state);
  }

  private pushDecoHistory(): void {
    this.decoUndo.push(this.snapshotDecorationArrangement());
    if (this.decoUndo.length > 50) this.decoUndo.shift();
    this.decoRedo = [];
  }

  canMoveDecorationToRoom(id: string, roomId: string): boolean {
    const def = DECORATIONS_BY_ID[id];
    return Boolean(
      def &&
      isDecorationOwned(this.state, id) &&
      def.compatibleRooms.includes(roomId) &&
      isRoomIdUnlocked(this.state, roomId),
    );
  }

  private canApplyDecorationPlacement(id: string, roomId: string, x: number, y: number): boolean {
    if (!this.canMoveDecorationToRoom(id, roomId)) return false;
    const def = DECORATIONS_BY_ID[id];
    if (!def || def.defaultRegionKind !== 'floor') {
      return true;
    }
    const region = compatibleRegionsForProfile(roomId, def).find(
      (candidate) => candidate.kind === def.defaultRegionKind,
    );
    return Boolean(region && evaluateRegionPlacement(this.state, id, roomId, region, { x, y })?.ok);
  }

  private applyDecorationPlacement(
    id: string,
    roomId: string,
    x: number,
    y: number,
    depth?: number,
  ): boolean {
    // Renderer previews and all alternative controls share this authoritative
    // guard, so Move To/reset cannot bypass semantic geometry, collisions, or
    // one-rug capacity even if they do not originate from a pointer drop.
    if (!this.canApplyDecorationPlacement(id, roomId, x, y)) return false;
    const placement = placementAt(id, x, y);
    this.state.placements[id] = placement;
    const instance = syncDecorationInstanceFromPlacement(this.state, id);
    if (!instance) return false;
    instance.roomId = roomId;
    // Prefer the catalogue's semantic default kind when it projects to the same
    // legacy surface (so a rug stays a rug-plane, a lamp a tabletop), else fall
    // back to the coarse surface→kind mapping.
    const legacyDef = DECORATIONS_BY_ID[id];
    instance.regionKind =
      legacyDef &&
      projectSurfaceType(REGION_KIND_SURFACE[legacyDef.defaultRegionKind]) === placement.surface
        ? legacyDef.defaultRegionKind
        : regionKindForSurface(placement.surface);
    if (depth !== undefined) {
      instance.depth = depth;
    } else {
      const def = DECORATIONS_BY_ID[id];
      const region = def
        ? compatibleRegionsForProfile(roomId, def).find(
            (candidate) => candidate.kind === def.defaultRegionKind,
          )
        : undefined;
      const semanticDepth = region
        ? evaluateRegionPlacement(this.state, id, roomId, region, { x, y })?.depth
        : undefined;
      if (semanticDepth !== undefined) instance.depth = semanticDepth;
    }
    return true;
  }

  /**
   * Authoritative region-anchored commit shared by pointer drops and every
   * non-pointer flow (purchase, Move To, room reset). The exact clamped region
   * point, its projected legacy surface, its semantic kind, and its perspective
   * depth are written together so the preview a player saw is what gets saved.
   */
  private applyRegionPlacement(id: string, roomId: string, check: RegionPlacementCheck): boolean {
    const surface = projectSurfaceType(check.region.surfaceType);
    this.state.placements[id] = { surface, x: check.point.x, y: check.point.y };
    const instance = syncDecorationInstanceFromPlacement(this.state, id);
    if (!instance) return false;
    instance.roomId = roomId;
    instance.regionKind = check.region.kind;
    instance.surfaceType = surface;
    instance.normalizedX = check.point.x;
    instance.normalizedY = check.point.y;
    instance.depth = check.depth;
    return true;
  }

  /** Resolve + validate a region placement for a specific semantic kind. */
  private resolveRegionPlacement(
    id: string,
    roomId: string,
    x: number,
    y: number,
    regionKind: PlacementRegionKind,
  ): RegionPlacementCheck | null {
    const def = DECORATIONS_BY_ID[id];
    if (!def) return null;
    const region = resolveRegionByKind(roomId, def, regionKind);
    if (!region) return null;
    return evaluateRegionPlacement(this.state, id, roomId, region, { x, y });
  }

  /** Place a stored item in an unlocked compatible room. */
  placeDecorationInRoom(id: string, roomId: string, position?: { x: number; y: number }): boolean {
    if (!this.canMoveDecorationToRoom(id, roomId)) return false;
    const def = DECORATIONS_BY_ID[id];
    if (!def) return false;
    let check: RegionPlacementCheck | null;
    if (position) {
      // An explicit position picks the region under that point (any category).
      check = pointerRegionPlacement(this.state, id, roomId, position);
    } else {
      const index = placedCountOnSurface(this.state, roomId, decorationSurface(id));
      check = defaultRegionPlacementFor(this.state, id, roomId, index);
    }
    if (!check?.ok) return false;
    this.pushDecoHistory();
    if (!this.applyRegionPlacement(id, roomId, check)) return false;
    this.save();
    this.emit();
    return true;
  }

  /** Backward-compatible placement in the current room, or catalogue default from storage. */
  placeDecoration(id: string, position?: { x: number; y: number }): boolean {
    const def = DECORATIONS_BY_ID[id];
    if (!def) return false;
    return this.placeDecorationInRoom(id, decorationRoom(this.state, id) ?? def.room, position);
  }

  /**
   * Move a decoration across rooms while preserving its stable instance id.
   * When a `regionKind` is supplied (every pointer drop and the unified drag
   * preview do), the placement is committed through the authoritative region
   * model so it lands exactly where the preview showed — on floor, wall,
   * ceiling, tabletop, shelf, or a room-specific special support. Callers that
   * omit it keep the legacy floor/wall/ceiling band behaviour.
   */
  moveDecorationToRoom(
    id: string,
    roomId: string,
    x: number,
    y: number,
    depth?: number,
    regionKind?: PlacementRegionKind,
  ): boolean {
    if (regionKind) {
      if (!this.canMoveDecorationToRoom(id, roomId)) return false;
      const check = this.resolveRegionPlacement(id, roomId, x, y, regionKind);
      if (!check?.ok) return false;
      this.pushDecoHistory();
      if (!this.applyRegionPlacement(id, roomId, check)) return false;
      this.save();
      this.emit();
      return true;
    }
    if (!this.canApplyDecorationPlacement(id, roomId, x, y)) return false;
    this.pushDecoHistory();
    if (!this.applyDecorationPlacement(id, roomId, x, y, depth)) return false;
    this.save();
    this.emit();
    return true;
  }

  /** Move within the current room (legacy API retained for existing callers). */
  moveDecoration(id: string, x: number, y: number): boolean {
    const def = DECORATIONS_BY_ID[id];
    if (!def || !isDecorationOwned(this.state, id)) return false;
    return this.moveDecorationToRoom(id, decorationRoom(this.state, id) ?? def.room, x, y);
  }

  /** Return an owned decoration to storage. */
  removeDecoration(id: string): boolean {
    if (!isDecorationPlaced(this.state, id)) return false;
    this.pushDecoHistory();
    delete this.state.placements[id];
    syncDecorationInstanceFromPlacement(this.state, id);
    this.save();
    this.emit();
    return true;
  }

  /** Reset a room to a tidy default while retaining each instance identity. */
  resetRoomDecorations(roomId: string): boolean {
    const owned = ownedDecorationsInRoom(this.state, roomId).filter((def) =>
      def.compatibleRooms.includes(roomId),
    );
    if (owned.length === 0 || !isRoomIdUnlocked(this.state, roomId)) return false;

    // Plan against a clone with this room cleared first. This avoids old
    // positions blocking their own replacements and guarantees that a full rug
    // plane or collision aborts without partial mutation, history, or saving.
    const trial = structuredClone(this.state);
    for (const def of owned) {
      delete trial.placements[def.id];
      syncDecorationInstanceFromPlacement(trial, def.id);
    }

    const perKind: Record<string, number> = {};
    const plan: Array<{ id: string; check: RegionPlacementCheck }> = [];
    for (const def of owned) {
      const idx = perKind[def.defaultRegionKind] ?? 0;
      perKind[def.defaultRegionKind] = idx + 1;
      const candidate = defaultRegionPlacementFor(trial, def.id, roomId, idx);
      // Every owned item must land on a valid support; a full plane or a
      // collision aborts the whole reset (no partial mutation, history, save).
      if (!candidate?.ok) return false;
      const surface = projectSurfaceType(candidate.region.surfaceType);
      trial.placements[def.id] = { surface, x: candidate.point.x, y: candidate.point.y };
      const trialInstance = syncDecorationInstanceFromPlacement(trial, def.id);
      if (!trialInstance) return false;
      trialInstance.roomId = roomId;
      trialInstance.regionKind = candidate.region.kind;
      trialInstance.surfaceType = surface;
      trialInstance.normalizedX = candidate.point.x;
      trialInstance.normalizedY = candidate.point.y;
      trialInstance.depth = candidate.depth;
      plan.push({ id: def.id, check: candidate });
    }

    this.pushDecoHistory();
    for (const item of plan) {
      this.applyRegionPlacement(item.id, roomId, item.check);
      // A tidy room puts every piece back on its natural side of the team.
      const instance = decorationInstance(this.state, item.id);
      if (instance) delete instance.layer;
    }
    this.save();
    this.emit();
    return true;
  }

  /**
   * Put a placed wall or floor piece in front of or behind the team. Persisted on
   * the instance, undoable, and a no-op for rugs and ceiling pieces (their side
   * never changes) or when the piece is already on that side.
   */
  setDecorationLayer(id: string, layer: DecorationLayer): boolean {
    const instance = decorationInstance(this.state, id);
    if (!instance || instance.roomId === null) return false;
    const kind = decorationDepthKind(id, instance.surfaceType);
    if (!decorationLayerAdjustable(kind)) return false;
    if (decorationSide(kind, instance.layer) === layer) return false;
    this.pushDecoHistory();
    instance.layer = layer;
    this.save();
    this.emit();
    return true;
  }

  /** Toggle an owned decoration between placed (default spot) and storage. */
  toggleDecoration(id: string): void {
    if (isDecorationPlaced(this.state, id)) this.removeDecoration(id);
    else this.placeDecoration(id);
  }

  canUndoDecoration(): boolean {
    return this.decoUndo.length > 0;
  }

  canRedoDecoration(): boolean {
    return this.decoRedo.length > 0;
  }

  undoDecoration(): boolean {
    const previous = this.decoUndo.pop();
    if (!previous) return false;
    this.decoRedo.push(this.snapshotDecorationArrangement());
    this.restoreDecorationArrangement(previous);
    this.save();
    this.emit();
    return true;
  }

  redoDecoration(): boolean {
    const next = this.decoRedo.pop();
    if (!next) return false;
    this.decoUndo.push(this.snapshotDecorationArrangement());
    this.restoreDecorationArrangement(next);
    this.save();
    this.emit();
    return true;
  }

  spendResource(resource: 'nuts' | 'goldenNuts' | 'permanentKernels', amount: number): boolean {
    if (!this.canAfford(resource, amount)) return false;
    this.state.resources[resource] -= amount;
    return true;
  }

  updateSettings(patch: Partial<GameState['settings']>): void {
    this.state.settings = { ...this.state.settings, ...patch };
    this.save(); // settings (language, audio, accessibility) are deliberate — persist now
    this.emit();
  }

  /**
   * Remember which office floor the player is looking at. Deliberately silent (no
   * emit, no immediate save): it changes while scrolling, so it rides along with
   * the next autosave instead of re-rendering the scene on every scroll step.
   */
  rememberOfficeFloor(roomId: string | null): void {
    this.state.settings.officeFloor = roomId;
  }

  markOnboardingComplete(): void {
    this.state.onboardingComplete = true;
    this.save(); // finishing onboarding is deliberate — don't replay it after a quick reload
    this.emit();
  }

  addMoraleFromDecoration(amount: number): void {
    this.state.resources.morale = Math.min(
      moraleCap(this.state),
      this.state.resources.morale + amount,
    );
  }

  /**
   * Swap in another company (an import, a restructure, a fresh start). A filed
   * company resumes exactly as it was filed: its timeline is moved to the present
   * (no pay for the days since, nothing expired or decided by them), and it is
   * settled from now on.
   */
  replaceState(next: GameState): void {
    const now = this.now();
    shiftTimeline(next, now - next.lastSaved);
    this.settledAt = now;
    this.rushes.clear();
    this.state = next;
    this.state.boosts ??= [];
    this.state.microgames ??= {};
    ensureOffice(this.state);
    this.officeNews = [];
    this.activeTalk = null;
    this.combo = null;
    this.lastAutoResolved = null;
    this.settledConsequences = [];
    this.restoreEvent();
    this.lastConsequence = null;
    this.resolvingEventInstanceId = null;
    repairEmployees(this.state);
    enforceRoomCapacity(this.state);
    this.repairedOnLoad = repairPlacements(this.state);
    repairBondMemories(this.state);
    repairDecorationInstances(this.state);
    repairDecorations(this.state);
    syncDecorationInstancesFromPlacements(this.state);
    this.decoUndo = [];
    this.decoRedo = [];
    this.emit();
  }

  // -- achievements ---------------------------------------------------------
  private checkAchievements(): void {
    const unlocked = evaluateAchievements(this.state, this.now());
    if (unlocked.length > 0) this.emit();
  }

  // -- persistence ----------------------------------------------------------
  /**
   * File the company. `lastSaved` records the moment it is settled up to (not the
   * moment of writing): a save between two ticks of a throttled window would
   * otherwise skip the time since the last tick, which the next boot never paid.
   */
  save(): void {
    this.state.lastSaved = this.settledAt;
    this.saveCallback?.(this.state);
  }

  // deterministic seed helper for dev tools/tests
  reseed(seedString: string): void {
    this.rng = createRng(hashStringToSeed(seedString));
  }
}

function goldenForChallenge(id: string): number {
  // reward encoded by challenge template; kept simple and safe.
  return id.startsWith('completeFocus') ? 2 : 1;
}
