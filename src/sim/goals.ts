import type { GameState } from './types';
import { UPGRADES } from '../content/upgrades';
import { EMPLOYEES } from '../content/employees';
import type { UpgradeDef } from '../content/types';
import {
  aggregatePassives,
  clickPower,
  computeProduction,
  employeeLevelCost,
  isEmployeeUnlocked,
  isUpgradeUnlocked,
  reputationRate,
  upgradeCost,
  upgradeSaturated,
} from './economy';
import { ROOMS } from '../content/rooms';
import type { RoomDef } from '../content/types';
import { UPGRADES_BY_ID } from '../content/upgrades';
import { isRoomUnlocked } from './rooms';

// "What am I working toward?" — the immediate goal, answered in the office.
//
// The goal is the cheapest nut purchase open to the player right now: an
// upgrade, a hire or a promotion. It is shown as one small tag with its progress
// and, once affordable, it can be bought right there with a single tap. Each
// goal also says what it will CHANGE (nuts per second, or per tap), computed by
// trying the purchase on a copy of the relevant state, so the promise on the tag
// is exactly what the purchase does.

export type GoalKind = 'upgrade' | 'room' | 'hire' | 'level';

export interface Goal {
  kind: GoalKind;
  /** upgrade id or employee id. */
  id: string;
  cost: number;
  /** what it changes, already measured. */
  gain: { perSecond: number; perTap: number };
  /** for 'room': the floor it opens. */
  roomId?: string;
  /** for upgrades: the localized name key and its params. */
  nameKey: string;
  nameParams?: Record<string, unknown>;
  /** for 'level': the level the teammate reaches. */
  level?: number;
  /**
   * The goal for what it opens (the next tier and the lines behind it), not for
   * its own gain, which is negligible: the tag says so instead of "+0 por toque".
   */
  opens?: boolean;
}

function withUpgrade(state: GameState, id: string): GameState {
  return { ...state, upgrades: { ...state.upgrades, [id]: (state.upgrades[id] ?? 0) + 1 } };
}

function withEmployeeLevel(state: GameState, id: string): GameState {
  const rt = state.employees[id];
  return {
    ...state,
    employees: { ...state.employees, [id]: { ...rt, hired: true, level: rt.level + 1 } },
  };
}

function measure(before: GameState, after: GameState): Goal['gain'] {
  return {
    perSecond: Math.max(
      0,
      computeProduction(after, false).nutsPerSecond -
        computeProduction(before, false).nutsPerSecond,
    ),
    // What a tap is really worth after the purchase (hand and production slice),
    // so a click upgrade late in the game promises the small gain it truly gives.
    perTap: Math.max(0, clickPower(after) - clickPower(before)),
  };
}

/** What one more level of an upgrade changes, measured on a copy of the state. */
export function upgradeGain(state: GameState, id: string): Goal['gain'] {
  return measure(state, withUpgrade(state, id));
}

/** What hiring (or promoting) a teammate changes, measured on a copy of the state. */
export function employeeGain(state: GameState, id: string): Goal['gain'] {
  return measure(state, withEmployeeLevel(state, id));
}

/**
 * A click level that would add less than this share to a tap is never made the
 * goal. Late in the game the production slice carries a tap and the hand's own
 * strength is a rounding error: the shop still sells the level, honestly
 * measured, but the company is not pointed at it.
 */
export const NEGLIGIBLE_TAP_GAIN = 0.01;

/** Upgrades whose first level opens another (the next tier, the crit and combo lines). */
const OPENS_ANOTHER = new Set(
  (UPGRADES as UpgradeDef[]).map((u) => u.unlock?.upgradeId).filter(Boolean),
);

/** True while buying the upgrade's first level would open further upgrades. */
export function unlocksMoreUpgrades(state: GameState, id: string): boolean {
  return (state.upgrades[id] ?? 0) === 0 && OPENS_ANOTHER.has(id);
}

interface Offer {
  cost: number;
  make: () => Goal;
  /** measured lazily, only for an offer that would otherwise be the goal. */
  worthIt?: () => boolean;
}

/** The player's immediate goal, or null when nothing is left to buy with nuts. */
export function nextGoal(state: GameState): Goal | null {
  const reduction = aggregatePassives(state).costReduction;
  const offers: Offer[] = [];
  const consider = (cost: number, make: () => Goal, worthIt?: () => boolean) => {
    if (!Number.isFinite(cost) || cost <= 0) return;
    offers.push({ cost, make, worthIt });
  };
  let tapNow: number | null = null;
  const tapToday = () => (tapNow ??= clickPower(state));

  for (const def of UPGRADES as UpgradeDef[]) {
    if (def.resource !== 'nuts' || !isUpgradeUnlocked(state, def)) continue;
    const owned = state.upgrades[def.id] ?? 0;
    // A level that would change nothing is never the next thing to buy.
    if (owned >= def.maxLevel || upgradeSaturated(state, def)) continue;
    const cost = upgradeCost(def, owned, reduction);
    const hand = def.effect.kind === 'clickPower';
    const gateway = unlocksMoreUpgrades(state, def.id);
    const significant = () =>
      clickPower(withUpgrade(state, def.id)) - tapToday() >= tapToday() * NEGLIGIBLE_TAP_GAIN;
    consider(
      cost,
      () => ({
        kind: def.effect.kind === 'unlockRoom' ? 'room' : 'upgrade',
        id: def.id,
        cost,
        gain: measure(state, withUpgrade(state, def.id)),
        roomId: def.effect.kind === 'unlockRoom' ? def.effect.roomId : undefined,
        nameKey: def.nameKey,
        nameParams: def.nameParams,
        opens: hand && gateway && !significant() ? true : undefined,
      }),
      // ...nor is one that would change next to nothing — unless its first level
      // opens the next tier and the crit and combo lines behind it, which would
      // otherwise stay out of sight for a company that never bought the hand.
      hand && !gateway ? significant : undefined,
    );
  }

  for (const def of EMPLOYEES) {
    const rt = state.employees[def.id];
    if (!rt || def.hireCost.resource !== 'nuts' || !isEmployeeUnlocked(state, def)) continue;
    const cost = employeeLevelCost(def, rt.level, reduction);
    consider(cost, () => ({
      kind: rt.hired ? 'level' : 'hire',
      id: def.id,
      cost,
      gain: measure(state, withEmployeeLevel(state, def.id)),
      nameKey: def.nameKey,
      level: rt.hired ? rt.level + 1 : undefined,
    }));
  }

  // Cheapest first (ties keep the order above); a negligible level steps aside.
  offers.sort((a, b) => a.cost - b.cost);
  const pick = offers.find((offer) => !offer.worthIt || offer.worthIt()) ?? offers[0];
  return pick ? pick.make() : null;
}

/** 0..1 progress of the current nuts toward the goal. */
export function goalProgress(state: GameState, goal: Goal): number {
  return goal.cost > 0 ? Math.max(0, Math.min(1, state.resources.nuts / goal.cost)) : 1;
}

/** The near-term goal: the next floor of the tower, and how it gets built. */
export interface FloorGoal {
  room: RoomDef;
  via: 'reputation' | 'purchase';
  /** reputation needed, or the floor's price in nuts. */
  need: number;
  /** the matching current amount. */
  have: number;
  upgradeId?: string;
  /** seconds until it can be built at the current pace (Infinity if never). */
  eta: number;
}

/**
 * The floor the company can build soonest: rooms open either with reputation or
 * by buying them, so each locked room is timed at the current pace (reputation
 * per second, nuts per second) and the nearest one is the one under
 * construction at the top of the tower.
 */
export function nextFloor(state: GameState): FloorGoal | null {
  const passives = aggregatePassives(state);
  const repRate = reputationRate(state, passives);
  const nps = computeProduction(state, false).nutsPerSecond;
  let best: FloorGoal | null = null;
  for (const room of ROOMS) {
    if (isRoomUnlocked(state, room)) continue;
    let goal: FloorGoal | null = null;
    if (room.unlock.reputation) {
      const need = room.unlock.reputation;
      const have = state.resources.reputation;
      goal = {
        room,
        via: 'reputation',
        need,
        have,
        eta: have >= need ? 0 : repRate > 0 ? (need - have) / repRate : Infinity,
      };
    } else if (room.unlock.upgradeId) {
      const def = UPGRADES_BY_ID[room.unlock.upgradeId];
      if (!def || !isUpgradeUnlocked(state, def)) continue;
      const need = upgradeCost(def, state.upgrades[def.id] ?? 0, passives.costReduction);
      const have = state.resources.nuts;
      goal = {
        room,
        via: 'purchase',
        need,
        have,
        upgradeId: def.id,
        eta: have >= need ? 0 : nps > 0 ? (need - have) / nps : Infinity,
      };
    }
    if (!goal) continue;
    if (!best || goal.eta < best.eta || (goal.eta === best.eta && room.floor < best.room.floor))
      best = goal;
  }
  return best;
}
