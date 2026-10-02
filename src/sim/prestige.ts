import { BALANCE } from './config';
import type { GameState, PrestigeBranchId } from './types';
import { createInitialState } from './state';
import { PRESTIGE_SKILLS_BY_ID } from '../content/prestige';

/** Lifetime totals stay in the archive; only new production funds a restructure. */
export function nutsThisRun(state: GameState): number {
  return Math.max(0, state.stats.totalNutsEarned - (state.prestige.nutsAtLastPrestige ?? 0));
}

export function canPrestige(state: GameState): boolean {
  return nutsThisRun(state) >= BALANCE.prestige.unlockAtTotalNuts;
}

/** How many Permanent Kernels the player would earn by prestiging right now. */
export function kernelsFromPrestige(state: GameState): number {
  const total = nutsThisRun(state);
  if (total < BALANCE.prestige.unlockAtTotalNuts) return 0;
  const base = Math.floor(
    Math.pow(total / BALANCE.prestige.kernelDivisor, BALANCE.prestige.kernelExponent),
  );
  // refinery skill boosts kernel gain
  const refinery = state.prestige.skills['kernel-refinery'] ?? 0;
  const skill = PRESTIGE_SKILLS_BY_ID['kernel-refinery'];
  const mult =
    skill && skill.effect.kind === 'kernelGain' ? 1 + skill.effect.perLevel * refinery : 1;
  return Math.max(1, Math.floor(base * mult));
}

/**
 * Perform "Go Completely Nuts". Resets company progress but preserves permanent
 * kernels (plus the newly earned ones), the skill tree, collections, cosmetics,
 * employee memories (friendship), achievements and settings. Chooses/keeps a
 * branch.
 */
export function performPrestige(
  state: GameState,
  branch: PrestigeBranchId,
  now: number,
): GameState {
  if (!canPrestige(state)) return state;
  const earned = kernelsFromPrestige(state);
  const fresh = createInitialState(now, state.settings);

  // preserved progression
  fresh.resources.permanentKernels = state.resources.permanentKernels + earned;
  fresh.resources.goldenNuts = state.resources.goldenNuts;
  fresh.prestige = {
    count: state.prestige.count + 1,
    branch,
    skills: { ...state.prestige.skills },
    nutsAtLastPrestige: state.stats.totalNutsEarned,
  };
  fresh.achievements = { ...state.achievements };
  fresh.collections = {
    nuts: [...state.collections.nuts],
    outfits: [...state.collections.outfits],
    logos: [...state.collections.logos],
    moments: [...state.collections.moments],
    secrets: [...state.collections.secrets],
  };
  // Decorations are cosmetics/permanent collection items. Preserve stable
  // identity and all instance metadata; clone nested mutable records so the
  // prestige result never aliases the pre-prestige state.
  fresh.decorationInstances = state.decorationInstances.map((instance) => ({
    ...instance,
    interactionState: instance.interactionState ? { ...instance.interactionState } : undefined,
  }));
  fresh.placements = Object.fromEntries(
    Object.entries(state.placements).map(([id, placement]) => [id, { ...placement }]),
  );
  fresh.company.name = state.company.name;
  fresh.company.icon = state.company.icon;
  fresh.stats = { ...state.stats, prestiges: state.stats.prestiges + 1 };
  fresh.focus.completedSessions = state.focus.completedSessions;
  fresh.microgames = Object.fromEntries(
    Object.entries(state.microgames).map(([id, record]) => [id, { ...record }]),
  );

  // preserve employee memories (friendship + chosen outfit + nickname) but
  // reset hire/level so the company rebuilds
  for (const [id, rt] of Object.entries(state.employees)) {
    if (fresh.employees[id]) {
      fresh.employees[id].friendship = rt.friendship;
      fresh.employees[id].outfitId = rt.outfitId;
      fresh.employees[id].nickname = rt.nickname;
      fresh.employees[id].talks = {
        count: rt.talks?.count ?? 0,
        lastAt: 0,
        seen: { ...rt.talks?.seen },
      };
    }
  }

  // Personal histories remain true after a restructure, including the decisions
  // that unlock their follow-ups. Department crises and promises belong to the old run.
  for (const [id, at] of Object.entries(state.flags)) {
    if (
      id.startsWith('favorite.') ||
      id.startsWith('discovery.') ||
      id.startsWith('annex.') ||
      id.startsWith('microgame.') ||
      id.startsWith('pair.') ||
      // What the player has noticed around the office stays noticed.
      id.startsWith('oddity.') ||
      Object.keys(state.employees).some((employeeId) => id.startsWith(`${employeeId}.`))
    ) {
      fresh.flags[id] = at;
    }
  }

  // head-start skill grants starting nuts
  const head = state.prestige.skills['head-start'] ?? 0;
  const hs = PRESTIGE_SKILLS_BY_ID['head-start'];
  if (hs && hs.effect.kind === 'startNuts') {
    fresh.resources.nuts = hs.effect.perLevel * head;
  }

  return fresh;
}

export function buyPrestigeSkill(state: GameState, skillId: string): boolean {
  const skill = PRESTIGE_SKILLS_BY_ID[skillId];
  if (!skill) return false;
  const level = state.prestige.skills[skillId] ?? 0;
  if (level >= skill.maxLevel) return false;
  if (state.resources.permanentKernels < skill.cost) return false;
  state.resources.permanentKernels -= skill.cost;
  state.prestige.skills[skillId] = level + 1;
  return true;
}
