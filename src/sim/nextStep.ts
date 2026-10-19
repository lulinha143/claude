import type { GameState } from './types';
import { EMPLOYEES } from '../content/employees';
import { UPGRADES } from '../content/upgrades';
import { DECORATIONS } from '../content/decorations';
import {
  aggregatePassives,
  employeeLevelCost,
  isEmployeeUnlocked,
  isUpgradeUnlocked,
  upgradeCost,
  upgradeSaturated,
} from './economy';
import { RESTRUCTURE_REVIEWED_FLAG, canPrestige, kernelsFromPrestige } from './prestige';
import { isRoomIdUnlocked } from './rooms';
import { isDecorationOwned } from './decorations';
import { availableFacilityDiscoveries } from './facilityDiscoveries';
import { goldenForChallenge } from './dailyChallenges';

export interface NextStep {
  key: string; // localization key under `nextStep.` (and `nextStep.why.` when it has a reason)
  view: string; // ViewId to navigate to
  employeeId?: string;
  /** The room it concerns (a discovery waiting there). */
  roomId?: string;
  /** The number its reason quotes: golden nuts waiting, kernels on offer. */
  amount?: number;
}

// A gentle, non-forcing "recommended next step" suggestion. Returns the single
// most useful action right now, or null. Pure so it can be unit-tested.
//
// Order: what is already earned and waiting, then the first invitations (each
// retires when the player tries it), then what the building is holding for them,
// then a decision (a restructure, offered once per cycle), then growth, then
// optional things to try. Every step is open right now: nothing here suggests what
// is done, locked or out of reach.
export function computeNextStep(state: GameState): NextStep | null {
  // 1. a completed daily challenge waiting to be claimed (free reward)
  const claimable = state.daily.challenges.filter((c) => !c.claimed && c.progress >= c.goal);
  if (claimable.length) {
    return {
      key: 'claimDaily',
      view: 'company',
      amount: claimable.reduce((sum, c) => sum + goldenForChallenge(c.id), 0),
    };
  }

  const passives = aggregatePassives(state);

  // Introduce the people and activities before the endless upgrade list can
  // monopolize the guide. Each invitation retires when the player tries it.
  if (
    state.stats.playTimeSeconds >= 60 &&
    Object.values(state.employees).every((employee) => !employee.talks?.count)
  ) {
    return { key: 'firstConversation', view: 'employees', employeeId: 'pip' };
  }
  if (state.stats.playTimeSeconds >= 180 && state.stats.microgamesPlayed === 0) {
    return { key: 'firstActivity', view: 'focus' };
  }

  if (
    state.stats.playTimeSeconds >= 120 &&
    !state.collections.secrets.some((id) => id.startsWith('deco:')) &&
    DECORATIONS.some(
      (item) =>
        isRoomIdUnlocked(state, item.room) &&
        state.resources[item.cost.resource] >= item.cost.amount,
    )
  )
    return { key: 'firstDecoration', view: 'decorate' };

  // Something the building found waits to be looked into; it does not expire, and
  // a restructure keeps what it leads to, so it comes before the decision.
  const discovery = availableFacilityDiscoveries(state)[0];
  if (discovery) return { key: 'investigate', view: 'office', roomId: discovery.roomId };

  // A new company cycle is a meaningful decision, not another upgrade in the queue.
  // It is offered until the player has read the continuity file this cycle; after
  // that it waits in the Archive and the guide goes back to the office.
  if (canPrestige(state) && !(RESTRUCTURE_REVIEWED_FLAG in state.flags)) {
    return { key: 'prestige', view: 'prestige', amount: kernelsFromPrestige(state) };
  }

  // 2. an unlocked employee you can afford to hire
  for (const def of EMPLOYEES) {
    const rt = state.employees[def.id];
    if (!rt || rt.hired) continue;
    if (!isEmployeeUnlocked(state, def)) continue;
    const reduction = def.hireCost.resource === 'nuts' ? passives.costReduction : 0;
    const cost = employeeLevelCost(def, rt.level, reduction);
    if (state.resources[def.hireCost.resource] >= cost) {
      return { key: 'hire', view: 'employees', employeeId: def.id };
    }
  }

  // 3. an affordable upgrade you don't own to the max (and that would still do something)
  for (const def of UPGRADES) {
    if (!isUpgradeUnlocked(state, def)) continue;
    const owned = state.upgrades[def.id] ?? 0;
    if (owned >= def.maxLevel || upgradeSaturated(state, def)) continue;
    const reduction = def.resource === 'nuts' ? passives.costReduction : 0;
    if (state.resources[def.resource] >= upgradeCost(def, owned, reduction)) {
      return { key: 'upgrade', view: 'shop' };
    }
  }

  // 5. try Focus Harvest once it's had time to matter (retires once a session is done)
  if (
    !state.settings.focusHarvestEnabled &&
    state.focus.completedSessions === 0 &&
    state.stats.playTimeSeconds > 120
  ) {
    return { key: 'focus', view: 'focus' };
  }

  // 6. an affordable decoration you don't own
  for (const d of DECORATIONS) {
    if (isDecorationOwned(state, d.id) || !isRoomIdUnlocked(state, d.room)) continue;
    if (state.resources[d.cost.resource] >= d.cost.amount) {
      return { key: 'decorate', view: 'decorate' };
    }
  }

  // 7. nothing pressing — just keep the nuts flowing
  return null;
}
