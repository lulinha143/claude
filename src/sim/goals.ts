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
    perTap: Math.max(0, clickPower(after) - clickPower(before)),
  };
}

/** The player's immediate goal, or null when nothing is left to buy with nuts. */
export function nextGoal(state: GameState): Goal | null {
  const reduction = aggregatePassives(state).costReduction;
  let best: { cost: number; make: () => Goal } | null = null;
  const consider = (cost: number, make: () => Goal) => {
    if (!Number.isFinite(cost) || cost <= 0) return;
    if (!best || cost < best.cost) best = { cost, make };
  };

  for (const def of UPGRADES as UpgradeDef[]) {
    if (def.resource !== 'nuts' || !isUpgradeUnlocked(state, def)) continue;
    const owned = state.upgrades[def.id] ?? 0;
    if (owned >= def.maxLevel) continue;
    const cost = upgradeCost(def, owned, reduction);
    consider(cost, () => ({
      kind: def.effect.kind === 'unlockRoom' ? 'room' : 'upgrade',
      id: def.id,
      cost,
      gain: measure(state, withUpgrade(state, def.id)),
      roomId: def.effect.kind === 'unlockRoom' ? def.effect.roomId : undefined,
      nameKey: def.nameKey,
      nameParams: def.nameParams,
    }));
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

  const pick = best as { cost: number; make: () => Goal } | null;
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
