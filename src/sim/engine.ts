import { BALANCE } from './config';
import { createRng, hashStringToSeed, type Rng } from './rng';
import type {
  DecorationInstance,
  EmployeeMood,
  GameState,
  MomentCard,
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
  reputationRate,
  upgradeCost,
} from './economy';
import { employeeMood, moodProductivityMultiplier } from './mood';
import { repairEmployees } from './state';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { UPGRADES_BY_ID } from '../content/upgrades';
import type { EventEffect, GameEventDef } from '../content/types';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../content/events';
import { eventChoicesForState } from './eventChoices';
import { chooseAutoResolution } from './eventAutoResolve';
import { CLICK_STATIONS_BY_ID } from '../content/clickStations';
import {
  CLICK,
  critChance,
  goldenTapChance,
  resolveClick,
  stationComboWindowMs,
  type ClickResolution,
  type ComboTracker,
} from './clickStations';
import { aggregateCompanyModifiers } from './companyModifiers';
import { evaluateAchievements } from './achievements';
import { ensureDailyForDate } from './dailyChallenges';
import { isRoomIdUnlocked, repairPlacements, unlockedRooms } from './rooms';
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
} from './decorations';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { decorationSurface, projectSurfaceType, regionKindForSurface } from './surfaces';
import {
  evaluateRegionPlacement,
  resolveRegionByKind,
  defaultRegionPlacementFor,
  pointerRegionPlacement,
} from './placement';
import type { RegionPlacementCheck } from './placement';
import { REGION_KIND_SURFACE, type PlacementRegionKind } from './placementRegions';
import { compatibleRegionsForProfile } from '../content/roomSurfaces';

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
  titleKey: string;
  choiceLabelKey: string;
  effects: EventEffect[];
  reactions: string[];
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
}

export interface EventChoiceContext {
  eventInstanceId: number;
  step: string | null;
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

export interface CollectResult {
  gained: number;
  bonus: boolean;
}

type DecorationArrangement = Array<
  Pick<
    DecorationInstance,
    'instanceId' | 'roomId' | 'surfaceType' | 'regionKind' | 'normalizedX' | 'normalizedY' | 'depth'
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
  tempBoosts: TempBoost[] = [];
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

  private listeners = new Set<EngineListener>();
  private now: () => number;
  private rng: Rng;
  private eventAccum = 0;
  private saveAccum = 0;
  private saveCallback: ((state: GameState) => void) | null = null;
  private version = 0;
  private nextEventInstanceId = 1;
  private resolvingEventInstanceId: number | null = null;

  constructor(state: GameState, opts: EngineOptions = {}) {
    this.state = state;
    this.now = opts.now ?? (() => Date.now());
    const seed = opts.deterministic ? (opts.seed ?? 12345) : (opts.seed ?? Date.now() & 0xffffffff);
    this.rng = createRng(seed);
    // Backfill any employees added to the game since this save was written, so
    // screens that map over all employees never read `undefined` and crash.
    repairEmployees(this.state);
    // Repair any invalid employee placement data on load so no one is lost.
    this.repairedOnLoad = repairPlacements(this.state);
    // Repair the source instance model before its legacy placement projection,
    // then mirror any coordinate clamping back into the instances.
    repairDecorationInstances(this.state);
    repairDecorations(this.state);
    syncDecorationInstancesFromPlacements(this.state);
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
  isFocusActive(): boolean {
    return this.state.focus.active && this.now() < this.state.focus.endsAt;
  }

  productionPerSecond(): number {
    const base = computeProduction(this.state, this.isFocusActive()).nutsPerSecond;
    return base * this.currentBoostMultiplier();
  }

  currentBoostMultiplier(): number {
    const t = this.now();
    let m = 1;
    for (const b of this.tempBoosts) if (b.endsAt > t) m *= b.multiplier;
    return m;
  }

  clickPower(): number {
    return clickPower(this.state) * this.currentBoostMultiplier();
  }

  crateValue(): number {
    return crateValue(this.state, this.isFocusActive()) * this.currentBoostMultiplier();
  }

  // -- main tick ------------------------------------------------------------
  /** Advance the simulation by `deltaSeconds`, chunked for stability. */
  tick(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || !Number.isFinite(deltaSeconds)) return;
    let remaining = Math.min(deltaSeconds, 60 * 60); // never process >1h in one call
    while (remaining > 0) {
      const step = Math.min(remaining, BALANCE.maxTickSeconds);
      this.stepSimulation(step);
      remaining -= step;
    }
    this.state.stats.playTimeSeconds += Math.min(deltaSeconds, 3600);
    this.tickFocus();
    this.rolloverDaily();

    // prune expired boosts to avoid unbounded growth
    const t = this.now();
    this.tempBoosts = this.tempBoosts.filter((b) => b.endsAt > t);
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

    this.eventAccum += deltaSeconds;
    if (this.eventAccum >= BALANCE.eventRollIntervalSeconds) {
      this.eventAccum = 0;
      this.maybeRollEvent();
    }

    this.checkAchievements();
    this.emit();
  }

  private stepSimulation(dt: number): void {
    const prod = computeProduction(this.state, this.isFocusActive());
    const passives = aggregatePassives(this.state);
    const boost = this.currentBoostMultiplier();
    const nps = prod.nutsPerSecond * boost;

    // Auto-collector banks a fraction of production automatically.
    const autoRate = autoCollectRate(this.state);
    const gained = nps * dt * autoRate;
    if (gained > 0) this.addNuts(gained, false);

    // The rest accumulates as pending crates the player collects — but for a
    // cozy experience without mandatory clicking, uncollected production still
    // trickles in at reduced rate.
    const trickle = nps * dt * (1 - autoRate) * 0.5;
    if (trickle > 0) this.addNuts(trickle, false);

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
        BALANCE.morale.start + passives.moraleBonus + rooms.moraleTarget,
      ),
    );
    const m = this.state.resources.morale;
    const regen = Math.max(0.1, BALANCE.morale.driftPerSecond * (1 + rooms.moraleRegen));
    const drift = (target - m) * Math.min(1, regen * dt);
    this.state.resources.morale = Math.max(floor, Math.min(cap, m + drift));

    // Reputation grows slowly with company size.
    this.state.resources.reputation += reputationRate(this.state, passives) * dt;
  }

  private addNuts(amount: number, isClick: boolean): void {
    if (amount <= 0) return;
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

  collectCrate(): CollectResult {
    const passives = aggregatePassives(this.state);
    let gained = this.crateValue();
    let bonus = false;
    if (this.rng.chance(passives.resourceFind)) {
      gained *= 3;
      bonus = true;
    }
    this.addNuts(gained, false);
    this.state.stats.cratesCollected += 1;
    this.progressDaily('collectCrates', 1);
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
  tapStation(stationId: string): ClickResolution | null {
    const def = CLICK_STATIONS_BY_ID[stationId];
    if (!def) return null;
    // A station is available exactly when its room is.
    if (!isRoomIdUnlocked(this.state, def.roomId)) return null;

    const now = this.now();
    const rolls = {
      critical: this.rng.chance(critChance(this.state, def)),
      golden: this.rng.chance(goldenTapChance(this.state)),
    };
    const result = resolveClick(this.state, def, this.combo, now, rolls);

    // Advance the transient combo tracker.
    this.combo = { stationId: def.id, streak: result.streak, lastTapAt: now };

    if (result.resource === 'goldenNuts') {
      this.state.resources.goldenNuts += result.amount;
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
    }

    this.emit();
    return result;
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
      // Surfaced so the callback never feels like an unexplained swing.
      this.settledConsequences.push(item);
      if (this.settledConsequences.length > 8) this.settledConsequences.shift();
    }
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
    const passives = aggregatePassives(this.state);
    const reduction = def.resource === 'nuts' ? passives.costReduction : 0;
    const cost = upgradeCost(def, owned, reduction);
    if (!this.canAfford(def.resource, cost)) return false;
    this.state.resources[def.resource] -= cost;
    this.state.upgrades[id] = owned + 1;
    this.emit();
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
    rt.hired = true;
    rt.level += 1;
    this.emit();
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
    rt.room = roomId;
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
    if (strategy === 'department') {
      for (const [id, rt] of hired) {
        const home = EMPLOYEES_BY_ID[id]?.room ?? null;
        if (home && isRoomIdUnlocked(this.state, home) && rt.room !== home) {
          rt.room = home;
          changes += 1;
        }
      }
    } else {
      const rooms = unlockedRooms(this.state).map((r) => r.id);
      if (rooms.length > 0) {
        hired.forEach(([, rt], i) => {
          const target = rooms[i % rooms.length];
          if (rt.room !== target) {
            rt.room = target;
            changes += 1;
          }
        });
      }
    }
    if (changes > 0) this.emit();
    return changes;
  }

  giveCoffee(id: string): void {
    const rt = this.state.employees[id];
    if (!rt) return;
    rt.friendship = Math.min(100, rt.friendship + 3);
    this.state.resources.morale = Math.min(moraleCap(this.state), this.state.resources.morale + 2);
    this.emit();
  }

  petPip(): void {
    const pip = this.state.employees['pip'];
    if (pip) pip.friendship = Math.min(100, pip.friendship + 1);
    this.addBoost(1.05, 15);
    this.emit();
  }

  addBoost(multiplier: number, seconds: number): void {
    this.tempBoosts.push({ multiplier, endsAt: this.now() + seconds * 1000 });
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
      return true;
    });
  }

  maybeRollEvent(force = false): void {
    if (this.activeEvent) return;
    const passives = aggregatePassives(this.state);
    // Rooms that deal in the strange — the Lab, Research, the basement — make
    // something interesting happen more often, which is their real reward.
    const luck = aggregateCompanyModifiers(this.state).eventLuck;
    const chance = BALANCE.eventBaseChance + passives.rareChance + luck;
    if (!force && !this.rng.chance(chance)) return;
    const pool = this.eligibleEvents();
    if (pool.length === 0) return;
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = this.rng.next() * total;
    let chosen = pool[0];
    for (const ev of pool) {
      roll -= ev.weight;
      if (roll <= 0) {
        chosen = ev;
        break;
      }
    }
    this.triggerEvent(chosen.id);
  }

  triggerEvent(id: string): boolean {
    const def = GAME_EVENTS_BY_ID[id];
    if (!def || this.activeEvent) return false;
    this.activeEvent = { def, step: null, instanceId: this.nextEventInstanceId++ };
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
    return true;
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
      return false;
    }

    // The result panel is an interruption too, so it is suppressed; the summary
    // below is what the player sees.
    this.lastConsequence = null;
    this.lastAutoResolved = {
      titleKey: decisions[0].def.titleKey,
      choiceLabelKey: decisions[decisions.length - 1].choice.labelKey,
      at: this.now(),
    };
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

      for (const effect of choice.effects) this.applyEffect(effect, def);

      const report = this.diffReport(before, choice.effects, now);

      // record the decision in the company timeline (capped)
      this.state.eventHistory.push({ eventId: def.id, choiceId: choice.id, at: this.now() });
      if (this.state.eventHistory.length > 50) this.state.eventHistory.shift();

      // build the consequence result panel (announces every change clearly)
      this.lastConsequence = {
        titleKey: def.titleKey,
        choiceLabelKey: choice.labelKey,
        effects: choice.effects,
        reactions: choice.reactions ?? [],
        report,
      };

      // advance chain or close
      if (choice.next && def.steps?.[choice.next]) {
        this.activeEvent = { def, step: choice.next, instanceId: active.instanceId };
        // mid-chain steps don't show a standalone result panel
        this.lastConsequence = null;
      } else {
        this.state.eventCooldowns[def.id] = this.now() + def.cooldownSeconds * 1000;
        this.activeEvent = null;
      }
      this.emit();
      return true;
    } finally {
      this.resolvingEventInstanceId = null;
    }
  }

  clearConsequence(): void {
    this.lastConsequence = null;
    this.emit();
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
    switch (effect.type) {
      case 'nuts':
        if ((effect.value ?? 0) >= 0) this.addNuts(effect.value ?? 0, false);
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
          this.state.resources.reputation + (effect.value ?? 0),
        );
        break;
      case 'productionBoost':
        this.addBoost(effect.value ?? 1.5, effect.durationSeconds ?? 60);
        break;
      case 'friendship': {
        const rt = this.state.employees[effect.employeeId ?? def?.employeeId ?? ''];
        // Only unlocked employees participate in the simulation.
        if (rt && rt.hired) rt.friendship = Math.min(100, rt.friendship + (effect.value ?? 5));
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
          effects: effect.scheduled,
        });
        // Keep the queue bounded; a save should never accumulate promises forever.
        if (this.state.scheduled.length > 24) this.state.scheduled.shift();
        break;
      }
      case 'momentCard':
        // A moment card is a souvenir OF an event, so it needs a real source.
        if (def) this.createMomentCard(def);
        break;
    }
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

  private tickFocus(): void {
    if (this.state.focus.active && this.now() >= this.state.focus.endsAt) {
      this.state.focus.active = false;
      this.state.focus.completedSessions += 1;
      // reward proportional to duration
      const reward = Math.max(1, Math.round(this.state.focus.durationSeconds / (25 * 60)) * 1);
      this.state.resources.goldenNuts += reward;
      this.addBoost(1.2, 120);
      this.progressDaily('completeFocus', 1);
    }
  }

  // -- microgames -----------------------------------------------------------
  rewardMicrogame(_kind: 'coffeeRescue' | 'bugSquash' | 'cableUntangle', score: number): void {
    this.state.stats.microgamesPlayed += 1;
    this.progressDaily('playMicrogame', 1);
    const boost = 1 + Math.min(0.5, score / 100);
    this.addBoost(boost, 90);
    this.addNuts(this.crateValue() * (1 + score / 50), false);
    this.emit();
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
    }
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

  replaceState(next: GameState): void {
    this.state = next;
    this.activeEvent = null;
    this.lastConsequence = null;
    this.resolvingEventInstanceId = null;
    this.tempBoosts = [];
    this.repairedOnLoad = repairPlacements(this.state);
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
  save(): void {
    this.state.lastSaved = this.now();
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
