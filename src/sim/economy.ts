import { BALANCE, geometricCost } from './config';
import { BOND_THRESHOLDS } from '../content/stories';
import type { GameState, ProductionResult, ProductionBreakdownEntry } from './types';
import { EMPLOYEES, EMPLOYEES_BY_ID } from '../content/employees';
import { ROOMS } from '../content/rooms';
import { UPGRADES_BY_ID } from '../content/upgrades';
import type { EmployeeDef, PrestigeBranchDef, UpgradeDef } from '../content/types';
import { PRESTIGE_BRANCHES_BY_ID, PRESTIGE_SKILLS_BY_ID } from '../content/prestige';
import { teamMoodMultiplier } from './mood';
import { affinityMultiplier } from './affinity';
import { resolveEmployeeRoom } from './rooms';
import { aggregateCompanyModifiers } from './companyModifiers';
// Re-exported so existing callers can keep importing it from the economy module.
export { upgradeBonus } from './upgradeEffects';
import { nextReputationTier } from '../content/reputationTiers';

/** An employee's output = their base contribution × room-specialization bonus. */
export function employeeOutput(state: GameState, def: EmployeeDef, level: number): number {
  const room = resolveEmployeeRoom(state, def.id);
  // A close friend works a little better (see sim/bonds.ts: the "close" stage).
  const close = (state.employees[def.id]?.friendship ?? 0) >= BOND_THRESHOLDS.close;
  return (
    employeeContribution(def, level) *
    affinityMultiplier(def.id, room) *
    (close ? 1 + CLOSE_FRIEND_BONUS : 1)
  );
}

/** How much better a close friend works. Mirrors `CLOSE_OUTPUT_BONUS` in sim/bonds. */
export const CLOSE_FRIEND_BONUS = 0.1;

/** A single employee's raw nuts/second contribution at a given level. */
export function employeeContribution(def: EmployeeDef, level: number): number {
  let contrib = def.baseRate * level;
  if (def.passive.type === 'selfMultiplier') {
    const self = def.passive.base + def.passive.perLevel * (level - 1);
    contrib *= 1 + self;
  }
  return contrib;
}

/** Team-mood production multiplier, weighted by each employee's contribution. */
export function moodMultiplier(state: GameState): number {
  return teamMoodMultiplier(state, (id) => {
    const def = EMPLOYEES_BY_ID[id];
    const rt = state.employees[id];
    if (!def || !rt || !rt.hired || rt.level <= 0) return 0;
    return employeeContribution(def, rt.level);
  });
}

// --------------------------------------------------------------------------
// Costs
// --------------------------------------------------------------------------

export function upgradeCost(def: UpgradeDef, ownedLevels: number, costReduction = 0): number {
  const raw = geometricCost(def.baseCost, def.costMult, ownedLevels);
  return Math.max(1, Math.ceil(raw * (1 - costReduction)));
}

export function employeeLevelCost(
  def: EmployeeDef,
  currentLevel: number,
  costReduction = 0,
): number {
  // Level 0 -> 1 uses the hire cost; further levels grow geometrically.
  const base = def.hireCost.amount > 0 ? def.hireCost.amount : 100;
  const raw = Math.ceil(base * Math.pow(def.levelCostMult, Math.max(0, currentLevel)));
  return Math.max(1, Math.ceil(raw * (1 - costReduction)));
}

// --------------------------------------------------------------------------
// Aggregated passives from employees
// --------------------------------------------------------------------------

export interface Passives {
  globalMultiplier: number;
  moraleBonus: number;
  costReduction: number;
  rareChance: number;
  reputationRate: number;
  resourceFind: number;
}

export function aggregatePassives(state: GameState): Passives {
  const p: Passives = {
    globalMultiplier: 0,
    moraleBonus: 0,
    costReduction: 0,
    rareChance: 0,
    reputationRate: 0,
    resourceFind: 0,
  };
  for (const def of EMPLOYEES) {
    const rt = state.employees[def.id];
    if (!rt || !rt.hired) continue;
    const value = def.passive.base + def.passive.perLevel * Math.max(0, rt.level - 1);
    switch (def.passive.type) {
      case 'globalMultiplier':
        p.globalMultiplier += value;
        break;
      case 'moraleBonus':
        p.moraleBonus += value;
        break;
      case 'costReduction':
        p.costReduction += value;
        break;
      case 'rareChance':
        p.rareChance += value;
        break;
      case 'reputationGain':
        p.reputationRate += value;
        break;
      case 'resourceFind':
        p.resourceFind += value;
        break;
      case 'selfMultiplier':
        // applied per-employee in production, not globally
        break;
    }
  }
  // Procurement, the Vault, the Nap Room and company standing all make the
  // building cheaper to run. Folding that in here means every existing consumer
  // of `costReduction` (upgrades, hiring, levelling) picks it up without a second
  // discount system to keep in sync.
  p.costReduction += aggregateCompanyModifiers(state).costReduction;
  // Cost reduction is capped so it can never make things free.
  p.costReduction = Math.min(0.75, p.costReduction);
  return p;
}

// --------------------------------------------------------------------------
// Multipliers
// --------------------------------------------------------------------------

export function moraleMultiplier(morale: number): number {
  const { min, baseCap, minMultiplier, maxMultiplier } = BALANCE.morale;
  const t = Math.max(0, Math.min(1, (morale - min) / (baseCap - min)));
  return minMultiplier + (maxMultiplier - minMultiplier) * t;
}

/** The current morale effect on production, as a signed whole percentage. */
export function moraleProductionBonusPct(morale: number): number {
  return Math.round((moraleMultiplier(morale) - 1) * 100);
}

/**
 * The next reputation threshold that unlocks a new room or teammate, or null if
 * everything gated by reputation is already unlocked. Used to tell the player
 * exactly what their Reputation is working toward.
 */
export function nextReputationUnlock(state: GameState): number | null {
  const cur = state.resources.reputation;
  let next: number | null = null;
  const consider = (rep?: number) => {
    if (typeof rep === 'number' && rep > cur) next = next === null ? rep : Math.min(next, rep);
  };
  for (const r of ROOMS) consider(r.unlock.reputation);
  for (const e of EMPLOYEES) consider(e.unlock.reputation);
  // The next rung of the standing ladder is also something reputation is working
  // toward, and it is often the nearest goal.
  consider(nextReputationTier(cur)?.at);
  return next;
}

export function upgradeGlobalMultiplier(state: GameState): number {
  let mult = 0;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (!def || level <= 0) continue;
    if (def.effect.kind === 'globalMultiplier') mult += def.effect.perLevel * level;
  }
  return mult;
}

export function prestigeMultiplier(state: GameState): number {
  let mult = 1;
  // permanent kernels bonus
  mult += state.resources.permanentKernels * BALANCE.prestige.kernelGlobalBonus;
  // active branch
  if (state.prestige.branch) {
    const branch = PRESTIGE_BRANCHES_BY_ID[state.prestige.branch];
    if (branch) mult *= branch.productionMultiplier;
  }
  // compound-nuts skill
  const compound = state.prestige.skills['compound-nuts'] ?? 0;
  const skill = PRESTIGE_SKILLS_BY_ID['compound-nuts'];
  if (skill && skill.effect.kind === 'globalMultiplier') {
    mult *= 1 + skill.effect.perLevel * compound;
  }
  return mult;
}

/*
 * A prestige branch defines THREE effects, and for a long time only
 * `productionMultiplier` above was actually applied. The other two are read here.
 *
 * That mattered more than a normal dead field, because branch choice is permanent and
 * once per run, and the branch cards describe these effects to the player in so many
 * words: "Everyone's happy. High morale" (moraleBonus +20), "More rare events"
 * (rareEventChance +5%), "Big rare-event chance" (+10%), "lower morale" (-5). Three of
 * the five branches were selling a benefit that did not exist, and Cozy Cooperative —
 * whose entire pitch is the morale — also carries the lowest production multiplier, so
 * the branch that read as the friendly option was strictly the worst pick in the game.
 *
 * Kept as two small named accessors rather than folded into `aggregateCompanyModifiers`
 * because these come from the run's permanent identity, not from the building, and the
 * two are worth telling apart when balancing.
 */
function activeBranch(state: GameState): PrestigeBranchDef | undefined {
  return state.prestige.branch ? PRESTIGE_BRANCHES_BY_ID[state.prestige.branch] : undefined;
}

/** Morale equilibrium shift from the run's permanent branch. */
export function prestigeMoraleBonus(state: GameState): number {
  return activeBranch(state)?.moraleBonus ?? 0;
}

/** Added chance per roll that something interesting happens, from the branch. */
export function prestigeRareEventChance(state: GameState): number {
  return activeBranch(state)?.rareEventChance ?? 0;
}

// --------------------------------------------------------------------------
// Production
// --------------------------------------------------------------------------

export function computeProduction(state: GameState, focusActive: boolean): ProductionResult {
  const passives = aggregatePassives(state);
  const breakdown: ProductionBreakdownEntry[] = [];

  // Raw base rate from founder + each hired employee at their level.
  let baseRate = BALANCE.baseProductionPerSecond;
  breakdown.push({ source: 'base', nutsPerSecond: baseRate });

  for (const def of EMPLOYEES) {
    const rt = state.employees[def.id];
    if (!rt || !rt.hired || rt.level <= 0) continue;
    const contrib = employeeOutput(state, def, rt.level);
    baseRate += contrib;
    breakdown.push({ source: `employee:${def.id}`, nutsPerSecond: contrib });
  }

  // Global multiplier stack. The room network joins the additive bucket, so a
  // well-designed building reads as one clear "+x% from your rooms" line rather
  // than a hidden extra multiplication.
  const rooms = aggregateCompanyModifiers(state);
  const globalMult =
    (1 + upgradeGlobalMultiplier(state) + passives.globalMultiplier + rooms.production) *
    moraleMultiplier(state.resources.morale) *
    prestigeMultiplier(state) *
    moodMultiplier(state) *
    (focusActive ? BALANCE.focus.productionMultiplier : 1);

  const nutsPerSecond = baseRate * globalMult;
  return { nutsPerSecond, multiplier: globalMult, breakdown };
}

export interface ProductionBreakdown {
  base: number;
  employees: { id: string; rate: number }[];
  rawPerSecond: number;
  /** additive fractions (0.1 = +10%) */
  upgradeBonus: number;
  passiveBonus: number;
  /** net additive contribution of the room synergy network. */
  roomBonus: number;
  /** multipliers (1 = no change) */
  moraleMult: number;
  prestigeMult: number;
  focusMult: number;
  /** team-mood multiplier (weighted average of employee emotions) */
  moodMult: number;
  total: number;
}

/**
 * A fully itemised production breakdown so the UI can explain exactly why the
 * nuts/second number is what it is. Mirrors computeProduction() but keeps every
 * contribution separate. Pure and unit-tested.
 */
export function productionBreakdown(state: GameState, focusActive: boolean): ProductionBreakdown {
  const passives = aggregatePassives(state);
  const base = BALANCE.baseProductionPerSecond;
  const employees: { id: string; rate: number }[] = [];
  let raw = base;
  for (const def of EMPLOYEES) {
    const rt = state.employees[def.id];
    if (!rt || !rt.hired || rt.level <= 0) continue;
    const contrib = employeeOutput(state, def, rt.level);
    employees.push({ id: def.id, rate: contrib });
    raw += contrib;
  }
  const upgradeBonus = upgradeGlobalMultiplier(state);
  const passiveBonus = passives.globalMultiplier;
  const roomBonus = aggregateCompanyModifiers(state).production;
  const moraleMult = moraleMultiplier(state.resources.morale);
  const prestigeMult = prestigeMultiplier(state);
  const focusMult = focusActive ? BALANCE.focus.productionMultiplier : 1;
  const moodMult = moodMultiplier(state);
  const total =
    raw *
    (1 + upgradeBonus + passiveBonus + roomBonus) *
    moraleMult *
    prestigeMult *
    focusMult *
    moodMult;
  return {
    base,
    employees,
    rawPerSecond: raw,
    upgradeBonus,
    passiveBonus,
    roomBonus,
    moraleMult,
    prestigeMult,
    focusMult,
    moodMult,
    total,
  };
}

export function clickPower(state: GameState): number {
  let power = BALANCE.baseClickPower;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (!def || level <= 0) continue;
    if (def.effect.kind === 'clickPower') power += def.effect.perLevel * level;
  }
  // Rooms that sharpen the active layer raise tap value directly, so building for
  // clicking is a real strategy rather than an early-game phase.
  power *= 1 + aggregateCompanyModifiers(state).clickPower;
  // clicks also benefit from the global multiplier so they stay relevant.
  const prod = computeProduction(state, false);
  return Math.max(BALANCE.baseClickPower * 0.25, power) * Math.max(1, Math.sqrt(prod.multiplier));
}

export function crateValue(state: GameState, focusActive: boolean): number {
  const prod = computeProduction(state, focusActive);
  return Math.max(BALANCE.crate.minValue, prod.nutsPerSecond * BALANCE.crate.secondsOfProduction);
}

export function moraleCap(state: GameState): number {
  let cap = BALANCE.morale.baseCap;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (def && def.effect.kind === 'moraleCap') cap += def.effect.perLevel * level;
  }
  return cap;
}

export function moraleFloor(state: GameState): number {
  const good = state.prestige.skills['good-vibes'] ?? 0;
  const skill = PRESTIGE_SKILLS_BY_ID['good-vibes'];
  if (skill && skill.effect.kind === 'moraleFloor') return skill.effect.perLevel * good;
  return 0;
}

export function offlineCapHours(state: GameState): number {
  let cap = BALANCE.offline.defaultCapHours;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (def && def.effect.kind === 'offlineCapHours') cap += def.effect.perLevel * level;
  }
  const deep = state.prestige.skills['deep-storage'] ?? 0;
  const skill = PRESTIGE_SKILLS_BY_ID['deep-storage'];
  if (skill && skill.effect.kind === 'offlineCapHours') cap += skill.effect.perLevel * deep;
  return Math.min(BALANCE.offline.maxCapHours, cap);
}

export function reputationRate(state: GameState, passives: Passives): number {
  let rate = BALANCE.reputation.baseRatePerSecond;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (def && def.effect.kind === 'reputationRate') rate += def.effect.perLevel * level;
  }
  // Marketing and the rooftop dish earn standing; the Lab and the basement cost
  // it. The net can go negative, which is the point — a company built only out of
  // the unpleasant rooms slides back down the ladder.
  rate += aggregateCompanyModifiers(state).reputationRate;
  return rate + passives.reputationRate / 60; // passive reputationRate is per-minute
}

export function autoCollectRate(state: GameState): number {
  let rate = 0;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (def && def.effect.kind === 'autoCollect') rate += def.effect.perLevel * level;
  }
  // Automation also arrives from the workshop and from company standing, so the
  // shift from "run it by hand" to "it mostly runs itself" happens through play.
  rate += aggregateCompanyModifiers(state).automation;
  return Math.min(1, rate); // fraction of production auto-banked per second
}

export function isEmployeeUnlocked(state: GameState, def: EmployeeDef): boolean {
  // Hiring is permanent for this run. A reputation setback must not remove a
  // colleague's conversation, coffee or promotion controls.
  if (state.employees[def.id]?.hired) return true;
  if (def.unlock.reputation && state.resources.reputation < def.unlock.reputation) return false;
  if (def.unlock.prestige && state.prestige.count < def.unlock.prestige) return false;
  return true;
}

export function isUpgradeUnlocked(state: GameState, def: UpgradeDef): boolean {
  if (!def.unlock) return true;
  if (def.unlock.reputation && state.resources.reputation < def.unlock.reputation) return false;
  if (def.unlock.prestige && state.prestige.count < def.unlock.prestige) return false;
  if (def.unlock.upgradeId && (state.upgrades[def.unlock.upgradeId] ?? 0) <= 0) return false;
  return true;
}

export { EMPLOYEES_BY_ID };
