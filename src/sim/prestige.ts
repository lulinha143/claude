import { BALANCE } from './config';
import type { GameState, PrestigeBranchId } from './types';
import { createInitialState } from './state';
import { ensureDailyForDate } from './dailyChallenges';
import { unlockedRooms, isRoomIdUnlocked } from './rooms';
import { decorationEnsembles } from './decorationEnsembles';
import { PRESTIGE_BRANCHES_BY_ID, PRESTIGE_SKILLS_BY_ID } from '../content/prestige';
import type { PrestigeBranchDef } from '../content/types';
import { ANOMALY_THREAD_FLAG } from '../content/happenings';
import { DECORATIONS } from '../content/decorations';
import { NUTS } from '../content/nuts';
import { UPGRADES_BY_ID } from '../content/upgrades';
import { ACHIEVEMENTS } from '../content/achievements';
import { FOUNDER_ID } from '../content/employees';

/**
 * Set when the player has read the continuity file while a restructure is open to
 * them. The guide then stops pointing at it for the rest of the cycle. It is not a
 * kept flag, so the next cycle offers the restructure again, once.
 */
export const RESTRUCTURE_REVIEWED_FLAG = 'restructure.reviewed';

/**
 * Share of the line at which the restructure comes into sight in the Archive, before
 * it can be done: enough of a cycle to make it something to look forward to, not a
 * late-game screen in a new company's first minutes.
 */
export const RESTRUCTURE_IN_SIGHT_SHARE = 0.5;

/** Lifetime totals stay in the archive; only new production funds a restructure. */
export function nutsThisRun(state: GameState): number {
  return Math.max(0, state.stats.totalNutsEarned - (state.prestige.nutsAtLastPrestige ?? 0));
}

export function canPrestige(state: GameState): boolean {
  return nutsThisRun(state) >= BALANCE.prestige.unlockAtTotalNuts;
}

/** Whether the Archive shows the restructure at all (ready, done before, or half way). */
export function restructureInSight(state: GameState): boolean {
  return (
    canPrestige(state) ||
    state.prestige.count > 0 ||
    state.resources.permanentKernels > 0 ||
    nutsThisRun(state) >= BALANCE.prestige.unlockAtTotalNuts * RESTRUCTURE_IN_SIGHT_SHARE
  );
}

/** Kernels a cycle that produced `total` nuts pays, with the refinery skill. */
function kernelsFor(state: GameState, total: number): number {
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

/** How many Permanent Kernels the player would earn by prestiging right now. */
export function kernelsFromPrestige(state: GameState): number {
  return kernelsFor(state, nutsThisRun(state));
}

/** Nuts a new cycle starts with (the Head Start skill). */
export function restructureStartNuts(state: GameState): number {
  const head = state.prestige.skills['head-start'] ?? 0;
  const hs = PRESTIGE_SKILLS_BY_ID['head-start'];
  return hs && hs.effect.kind === 'startNuts' ? hs.effect.perLevel * head : BALANCE.startingNuts;
}

/**
 * The company after a restructure, whether or not one is allowed now. Resets the
 * company's progress and keeps what belongs to the player and the people:
 *
 * - kept: permanent kernels (plus the earned ones), the skill tree and the branch
 *   chosen; golden nuts and their dust; collections, cosmetics and decorations (with
 *   where they stand); achievements; employee memories (friendship, outfit,
 *   nickname, conversations) and the histories written in flags; minigame records;
 *   completed focus sessions; lifetime stats; the company's name, logo and founding
 *   date; the settings; the day's assignments (claimed stays claimed); onboarding.
 * - reset: nuts, hires and levels, rooms, upgrades, morale and reputation, the crate,
 *   whatever was waiting in the office (finds, incidents, curiosities), promises not
 *   yet kept, temporary boosts and a focus session in progress.
 */
function restructured(state: GameState, branch: PrestigeBranchId, now: number): GameState {
  const earned = kernelsFromPrestige(state);
  const fresh = createInitialState(now, state.settings);

  // preserved progression
  fresh.createdAt = state.createdAt;
  fresh.onboardingComplete = state.onboardingComplete;
  fresh.resources.permanentKernels = state.resources.permanentKernels + earned;
  fresh.resources.goldenNuts = state.resources.goldenNuts;
  // The fraction of a golden nut still refining is part of that balance.
  fresh.clicker.goldenDust = state.clicker?.goldenDust ?? 0;
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
  // The day's assignments belong to the day, not to the cycle: a challenge already
  // claimed stays claimed (claiming it again would pay twice), and progress stands.
  fresh.daily = ensureDailyForDate(
    {
      date: state.daily.date,
      challenges: state.daily.challenges.map((challenge) => ({ ...challenge })),
    },
    now,
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
      // What the player has noticed around the office stays noticed, and so does
      // the building having noticed them back.
      id.startsWith('oddity.') ||
      id === ANOMALY_THREAD_FLAG ||
      Object.keys(state.employees).some((employeeId) => id.startsWith(`${employeeId}.`))
    ) {
      fresh.flags[id] = at;
    }
  }

  fresh.resources.nuts = restructureStartNuts(state);
  return fresh;
}

/**
 * Perform "Go Completely Nuts". Refused (the same state is returned, nothing
 * charged, reset or granted) unless this cycle has reached the line and the branch
 * exists, so a second confirmation, a stale screen or a replayed command pays
 * nothing: the new cycle starts counting from the lifetime total it closed at.
 */
export function performPrestige(
  state: GameState,
  branch: PrestigeBranchId,
  now: number,
): GameState {
  if (!canPrestige(state) || !PRESTIGE_BRANCHES_BY_ID[branch]) return state;
  return restructured(state, branch, now);
}

/** What a restructure would do, read off the operation itself so the screen cannot drift. */
export interface RestructurePreview {
  ready: boolean;
  /** Nuts produced this cycle, and the line a restructure opens at. */
  thisCycle: number;
  line: number;
  /** Kernels earned now (0 until ready), and what reaching the line would pay. */
  kernels: number;
  kernelsAtLine: number;
  /** Production share from the kernels held, now and after (0.04 = +4%). */
  kernelBonus: { now: number; after: number };
  branch: PrestigeBranchDef;
  currentBranch: PrestigeBranchId | null;
  cycle: { now: number; next: number };
  startNuts: number;
  keeps: {
    goldenNuts: number;
    decorations: number;
    /** Of those, pieces standing in rooms that close until they reopen. */
    decorationsWaiting: number;
    /** Complete decoration sets that go quiet until their room reopens. */
    setsPaused: number;
    nuts: number;
    moments: number;
    secrets: number;
    outfits: number;
    achievements: number;
    /** Teammates who know the player (friendship above zero). */
    friends: number;
    conversations: number;
    /** Minigames with a record. */
    records: number;
  };
  resets: {
    nuts: number;
    /** Teammates who leave the payroll (the founder stays). */
    hires: number;
    rooms: number;
    upgrades: number;
    crate: number;
    /** Finds, incidents and curiosities waiting in the office. */
    waiting: number;
    /** Promised consequences that had not landed yet. */
    promises: number;
    boosts: number;
    focus: boolean;
  };
}

export function restructurePreview(
  state: GameState,
  branch: PrestigeBranchId,
  now: number,
): RestructurePreview {
  const def = PRESTIGE_BRANCHES_BY_ID[branch] ?? PRESTIGE_BRANCHES_BY_ID.industrial;
  const after = restructured(state, def.id as PrestigeBranchId, now);
  const bonus = BALANCE.prestige.kernelGlobalBonus;
  const decoIds = new Set(DECORATIONS.map((item) => `deco:${item.id}`));
  const nutIds = new Set(NUTS.map((nut) => nut.id));
  const hiredIn = (s: GameState) =>
    Object.entries(s.employees).filter(([id, rt]) => rt.hired && id !== FOUNDER_ID).length;
  const activeSets = (s: GameState) => decorationEnsembles(s).filter((set) => set.active).length;
  const upgradesOwned = Object.entries(state.upgrades).filter(
    ([id, level]) => level > 0 && UPGRADES_BY_ID[id]?.effect.kind !== 'unlockRoom',
  ).length;
  return {
    ready: canPrestige(state),
    thisCycle: nutsThisRun(state),
    line: BALANCE.prestige.unlockAtTotalNuts,
    kernels: kernelsFromPrestige(state),
    kernelsAtLine: kernelsFor(state, BALANCE.prestige.unlockAtTotalNuts),
    kernelBonus: {
      now: state.resources.permanentKernels * bonus,
      after: after.resources.permanentKernels * bonus,
    },
    branch: def,
    currentBranch: state.prestige.branch,
    cycle: { now: state.prestige.count + 1, next: after.prestige.count + 1 },
    startNuts: after.resources.nuts,
    keeps: {
      goldenNuts: Math.floor(after.resources.goldenNuts),
      decorations: new Set(after.collections.secrets.filter((id) => decoIds.has(id))).size,
      decorationsWaiting: after.decorationInstances.filter(
        (item) => item.roomId !== null && !isRoomIdUnlocked(after, item.roomId),
      ).length,
      setsPaused: Math.max(0, activeSets(state) - activeSets(after)),
      nuts: new Set(after.collections.nuts.filter((id) => nutIds.has(id))).size,
      moments: after.collections.moments.length,
      secrets: new Set(after.collections.secrets.filter((id) => !id.startsWith('deco:'))).size,
      outfits: new Set(after.collections.outfits).size,
      achievements: ACHIEVEMENTS.filter((item) => (after.achievements[item.id] ?? 0) > 0).length,
      friends: Object.values(after.employees).filter((rt) => rt.friendship > 0).length,
      conversations: Object.values(after.employees).reduce(
        (sum, rt) => sum + (rt.talks?.count ?? 0),
        0,
      ),
      records: Object.values(after.microgames).filter((record) => record.best > 0).length,
    },
    resets: {
      nuts: Math.max(0, state.resources.nuts - after.resources.nuts),
      hires: Math.max(0, hiredIn(state) - hiredIn(after)),
      rooms: Math.max(0, unlockedRooms(state).length - unlockedRooms(after).length),
      upgrades: upgradesOwned,
      crate: state.crate?.nuts ?? 0,
      waiting:
        (state.finds?.length ?? 0) +
        (state.happenings?.incidents.length ?? 0) +
        (state.office?.oddities.length ?? 0),
      promises: state.scheduled.length,
      boosts: state.boosts.filter((boost) => boost.endsAt > now).length,
      focus: state.focus.active,
    },
  };
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
