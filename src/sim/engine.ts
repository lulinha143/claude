import { BALANCE } from './config';
import { createRng, hashStringToSeed, type Rng } from './rng';
import type { EmployeeMood, GameState, MomentCard } from './types';
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
import { evaluateAchievements } from './achievements';
import { ensureDailyForDate } from './dailyChallenges';
import { isRoomIdUnlocked, repairPlacements, unlockedRooms } from './rooms';
import {
  repairDecorations,
  firstFreeAnchorId,
  decorationAtAnchor,
  isDecorationOwned,
  isDecorationPlaced,
  ownedDecorationsInRoom,
} from './decorations';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { anchorById, anchorsForRoom } from '../content/roomLayout';

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

  private listeners = new Set<EngineListener>();
  private now: () => number;
  private rng: Rng;
  private eventAccum = 0;
  private saveAccum = 0;
  private saveCallback: ((state: GameState) => void) | null = null;
  private version = 0;

  constructor(state: GameState, opts: EngineOptions = {}) {
    this.state = state;
    this.now = opts.now ?? (() => Date.now());
    const seed = opts.deterministic ? (opts.seed ?? 12345) : (opts.seed ?? (Date.now() & 0xffffffff));
    this.rng = createRng(seed);
    // Backfill any employees added to the game since this save was written, so
    // screens that map over all employees never read `undefined` and crash.
    repairEmployees(this.state);
    // Repair any invalid employee placement data on load so no one is lost.
    this.repairedOnLoad = repairPlacements(this.state);
    // Normalize + migrate decoration placement (auto-places legacy purchases).
    repairDecorations(this.state);
  }

  /** ids whose invalid placement was repaired at load (for dev-only logging). */
  repairedOnLoad: string[] = [];

  // Session-only undo/redo history for decoration placement (snapshots of the
  // placements map). Not persisted — a fresh session starts with clean history.
  private decoUndo: Array<Record<string, string>> = [];
  private decoRedo: Array<Record<string, string>> = [];

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

    // Morale drifts toward equilibrium influenced by passives, with a floor.
    const cap = moraleCap(this.state);
    const floor = Math.max(BALANCE.morale.min, moraleFloor(this.state));
    const target = Math.min(cap, BALANCE.morale.start + passives.moraleBonus);
    const m = this.state.resources.morale;
    const drift = (target - m) * Math.min(1, BALANCE.morale.driftPerSecond * dt);
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
  private eligibleEvents(): GameEventDef[] {
    const t = this.now();
    return GAME_EVENTS.filter((ev) => {
      const cd = this.state.eventCooldowns[ev.id] ?? 0;
      if (cd > t) return false;
      if (ev.requires?.reputation && this.state.resources.reputation < ev.requires.reputation)
        return false;
      if (ev.requires?.prestige && this.state.prestige.count < ev.requires.prestige) return false;
      if (ev.requires?.hiredEmployee && !this.state.employees[ev.requires.hiredEmployee]?.hired)
        return false;
      return true;
    });
  }

  maybeRollEvent(force = false): void {
    if (this.activeEvent) return;
    const passives = aggregatePassives(this.state);
    const chance = BALANCE.eventBaseChance + passives.rareChance;
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

  triggerEvent(id: string): void {
    const def = GAME_EVENTS_BY_ID[id];
    if (!def) return;
    this.activeEvent = { def, step: null };
    this.state.stats.eventsSeen += 1;
    this.progressDaily('employeeConversations', def.employeeId ? 1 : 0);
    this.emit();
  }

  resolveEventChoice(choiceId: string): void {
    if (!this.activeEvent) return;
    const { def, step } = this.activeEvent;
    const choices = step && def.steps?.[step] ? def.steps[step].choices : def.choices;
    const choice = choices.find((c) => c.id === choiceId);
    if (!choice) return;

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
      this.activeEvent = { def, step: choice.next };
      // mid-chain steps don't show a standalone result panel
      this.lastConsequence = null;
    } else {
      this.state.eventCooldowns[def.id] = this.now() + def.cooldownSeconds * 1000;
      this.activeEvent = null;
    }
    this.emit();
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

  private applyEffect(effect: EventEffect, def: GameEventDef): void {
    switch (effect.type) {
      case 'nuts':
        if ((effect.value ?? 0) >= 0) this.addNuts(effect.value ?? 0, false);
        else this.state.resources.nuts = Math.max(0, this.state.resources.nuts + (effect.value ?? 0));
        break;
      case 'goldenNuts':
        this.state.resources.goldenNuts = Math.max(0, this.state.resources.goldenNuts + (effect.value ?? 0));
        break;
      case 'morale':
        this.state.resources.morale = Math.max(
          0,
          Math.min(moraleCap(this.state), this.state.resources.morale + (effect.value ?? 0)),
        );
        break;
      case 'reputation':
        this.state.resources.reputation = Math.max(0, this.state.resources.reputation + (effect.value ?? 0));
        break;
      case 'productionBoost':
        this.addBoost(effect.value ?? 1.5, effect.durationSeconds ?? 60);
        break;
      case 'friendship': {
        const rt = this.state.employees[effect.employeeId ?? def.employeeId ?? ''];
        // Only unlocked employees participate in the simulation.
        if (rt && rt.hired) rt.friendship = Math.min(100, rt.friendship + (effect.value ?? 5));
        break;
      }
      case 'emotion': {
        const id = effect.employeeId ?? def.employeeId ?? '';
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
      case 'momentCard':
        this.createMomentCard(def);
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
    // The store validates cost before calling; here we track ownership and, for
    // instant gratification, auto-place the new decoration into a free anchor so
    // it appears in the office immediately.
    this.state.collections.secrets.push(key);
    const def = DECORATIONS_BY_ID[id];
    if (def) {
      const free = firstFreeAnchorId(this.state, def.room);
      if (free) this.state.placements[id] = free;
    }
    this.emit();
    return true;
  }

  // -- decoration placement -------------------------------------------------
  private snapshotPlacements(): Record<string, string> {
    return { ...this.state.placements };
  }

  private pushDecoHistory(): void {
    this.decoUndo.push(this.snapshotPlacements());
    if (this.decoUndo.length > 50) this.decoUndo.shift();
    this.decoRedo = [];
  }

  /**
   * Place an owned decoration at an anchor (or the first free anchor if none is
   * given). If the target anchor is occupied by another decoration, that one is
   * returned to the inventory so the move is always reliable.
   */
  placeDecoration(id: string, anchorId?: string): boolean {
    if (!isDecorationOwned(this.state, id)) return false;
    const def = DECORATIONS_BY_ID[id];
    if (!def) return false;
    const roomId = def.room;
    const target = anchorId ?? firstFreeAnchorId(this.state, roomId);
    if (!target || !anchorById(roomId, target)) return false;
    this.pushDecoHistory();
    const prevAnchor = this.state.placements[id]; // where this piece was (if placed)
    const occupant = decorationAtAnchor(this.state, roomId, target);
    if (occupant && occupant !== id) {
      // Intelligent swap: if the dragged piece already had a spot, the piece at
      // the target moves into it; otherwise it returns to the inventory.
      if (prevAnchor) this.state.placements[occupant] = prevAnchor;
      else delete this.state.placements[occupant];
    }
    this.state.placements[id] = target;
    this.emit();
    return true;
  }

  /** Move a placed decoration to a different anchor (alias of placeDecoration). */
  moveDecoration(id: string, anchorId: string): boolean {
    return this.placeDecoration(id, anchorId);
  }

  /** Return an owned decoration to the inventory (removed from the office). */
  removeDecoration(id: string): boolean {
    if (!isDecorationPlaced(this.state, id)) return false;
    this.pushDecoHistory();
    delete this.state.placements[id];
    this.emit();
    return true;
  }

  /** Reset a room to a tidy default: every owned decoration placed in order. */
  resetRoomDecorations(roomId: string): boolean {
    const owned = ownedDecorationsInRoom(this.state, roomId);
    if (owned.length === 0) return false;
    this.pushDecoHistory();
    for (const d of owned) delete this.state.placements[d.id];
    const anchors = anchorsForRoom(roomId);
    owned.forEach((d, i) => {
      if (i < anchors.length) this.state.placements[d.id] = anchors[i].id;
    });
    this.emit();
    return true;
  }

  /** Toggle an owned decoration between placed (auto anchor) and inventory. */
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
    const prev = this.decoUndo.pop();
    if (!prev) return false;
    this.decoRedo.push(this.snapshotPlacements());
    this.state.placements = prev;
    this.emit();
    return true;
  }

  redoDecoration(): boolean {
    const next = this.decoRedo.pop();
    if (!next) return false;
    this.decoUndo.push(this.snapshotPlacements());
    this.state.placements = next;
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
    this.emit();
  }

  markOnboardingComplete(): void {
    this.state.onboardingComplete = true;
    this.emit();
  }

  addMoraleFromDecoration(amount: number): void {
    this.state.resources.morale = Math.min(moraleCap(this.state), this.state.resources.morale + amount);
  }

  replaceState(next: GameState): void {
    this.state = next;
    this.activeEvent = null;
    this.lastConsequence = null;
    this.tempBoosts = [];
    this.repairedOnLoad = repairPlacements(this.state);
    repairDecorations(this.state);
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
