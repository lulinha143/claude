import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import {
  RESTRUCTURE_REVIEWED_FLAG,
  canPrestige,
  kernelsFromPrestige,
  nutsThisRun,
  performPrestige,
  restructureInSight,
  restructurePreview,
} from '../src/sim/prestige';
import { computeNextStep } from '../src/sim/nextStep';
import { nextGoal } from '../src/sim/goals';
import { GameEngine } from '../src/sim/engine';
import { gameStateSchema } from '../src/save/schema';
import { ensureDailyForDate } from '../src/sim/dailyChallenges';
import { BALANCE } from '../src/sim/config';
import { ROOMS } from '../src/content/rooms';
import { DECORATION_ENSEMBLES } from '../src/content/decorationEnsembles';
import { DECORATIONS_BY_ID } from '../src/content/decorations';
import { keepsakeFlag } from '../src/content/employeeKeepsakes';
import { unlockedRooms } from '../src/sim/rooms';
import { decorationEnsembles } from '../src/sim/decorationEnsembles';
import type { DecorationInstance, GameState } from '../src/sim/types';

/*
 * Chapter 10: a restructure ("Go Completely Nuts") is one operation with one set of
 * rules. What it keeps and what it resets are pinned here, field by field, so the
 * continuity file (which reads `restructurePreview`) and the operation cannot drift.
 */

const NOW = 1_700_000_000_000;

function piece(id: string, roomId: string | null, x: number): DecorationInstance {
  const surface = DECORATIONS_BY_ID[id]?.placementSurface ?? 'floor';
  return {
    instanceId: `deco-${id}-1`,
    decorationId: id,
    roomId,
    surfaceType: surface,
    regionKind: surface,
    normalizedX: x,
    normalizedY: 0.1,
    depth: 200,
    flipped: false,
    rotation: 0,
    interactionState: { watered: true },
  } as DecorationInstance;
}

/** A company a few hours in: every room open, a team, collections and things in flight. */
function company(): GameState {
  const s = createInitialState(NOW - 86_400_000);
  s.lastSaved = NOW;
  s.onboardingComplete = true;
  s.company = { name: 'Nozes & Cia', icon: 'leaf' };
  s.stats.totalNutsEarned = 4_000_000;
  s.stats.playTimeSeconds = 12_000;
  s.stats.microgamesPlayed = 6;
  s.resources.nuts = 2_000_000;
  s.resources.goldenNuts = 12;
  s.resources.permanentKernels = 3;
  s.resources.morale = 80;
  s.resources.reputation = 500;
  s.clicker.goldenDust = 0.6;
  s.clicker.bestStreak = 40;
  for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
  s.upgrades.conveyor = 4;
  s.upgrades['morale-cap'] = 2;
  for (const id of ['marlow', 'otto', 'bea']) {
    s.employees[id] = {
      ...s.employees[id],
      hired: true,
      level: 4,
      friendship: 35,
      room: 'sorting',
    };
  }
  s.employees.otto.nickname = 'Ottinho';
  s.employees.otto.talks = { count: 5, lastAt: NOW - 60_000, seen: { 'check-in': NOW - 60_000 } };
  s.collections.nuts.push('intern-acorn', 'founder-acorn');
  s.collections.outfits.push('pip-ceo');
  s.collections.moments.push({
    id: 'card-1',
    eventId: 'annex-broadcast',
    employeeId: null,
    caption: 'event.annex-broadcast.body',
    rarity: 'rare',
    createdAt: NOW - 50_000,
  });
  s.collections.secrets.push('anomaly.silence', 'deco:potted-fern');
  s.decorationInstances.push(piece('potted-fern', 'founder-desk', 0.2));
  // A complete set in the repair workshop, a room the restructure closes.
  const set = DECORATION_ENSEMBLES.find((item) => item.id === 'repair-set')!;
  set.items.forEach((id, index) => {
    s.collections.secrets.push(`deco:${id}`);
    s.decorationInstances.push(piece(id, set.roomId, 0.2 + index * 0.25));
  });
  s.achievements['first-day'] = NOW - 80_000_000;
  s.flags[keepsakeFlag('otto', 'cared')] = NOW - 40_000;
  s.flags['otto.arc.1'] = NOW - 30_000;
  s.flags['discovery.broadcast'] = NOW - 20_000;
  s.flags['oddity.first-acorn'] = NOW - 10_000;
  s.flags['microgame.coffeeRescue.mastered'] = NOW - 9_000;
  s.flags['incident.rebrand.both'] = NOW - 8_000;
  s.flags[RESTRUCTURE_REVIEWED_FLAG] = NOW - 1_000;
  s.microgames.coffeeRescue = { best: 180, plays: 5, lastRewardAt: NOW - 9_000 };
  s.focus = { active: true, endsAt: NOW + 600_000, durationSeconds: 900, completedSessions: 3 };
  s.boosts.push({ multiplier: 1.5, endsAt: NOW + 60_000 });
  s.crate.nuts = 5_000;
  s.finds.push({
    id: 'find-1',
    employeeId: 'otto',
    roomId: 'sorting',
    kind: 'operational',
    createdAt: NOW - 5_000,
  });
  s.scheduled.push({
    id: 'promise-1',
    at: NOW + 3_600_000,
    sourceEventId: 'nut-audit',
    titleKey: 'x',
    bodyKey: 'y',
    effects: [{ type: 'nuts', value: 10 }],
  });
  s.daily = ensureDailyForDate(undefined, NOW);
  s.daily.challenges[0] = {
    ...s.daily.challenges[0],
    progress: s.daily.challenges[0].goal,
    claimed: true,
  };
  s.daily.challenges[1] = { ...s.daily.challenges[1], progress: 1, claimed: false };
  s.settings.language = 'pt-BR';
  s.settings.highContrast = true;
  return s;
}

describe('what a restructure keeps and what it starts over', () => {
  it('keeps the player, the people and their history, the collections and the identity', () => {
    const before = company();
    const after = performPrestige(before, 'cooperative', NOW);
    expect(after).not.toBe(before);
    // The company itself.
    expect(after.company).toEqual({ name: 'Nozes & Cia', icon: 'leaf' });
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.onboardingComplete).toBe(true);
    expect(after.settings.highContrast).toBe(true);
    expect(after.settings.language).toBe('pt-BR');
    // Permanent progression and play-earned money.
    expect(after.resources.permanentKernels).toBe(3 + kernelsFromPrestige(before));
    expect(after.resources.goldenNuts).toBe(12);
    expect(after.clicker.goldenDust).toBe(0.6);
    expect(after.prestige).toMatchObject({ count: 1, branch: 'cooperative' });
    expect(after.prestige.nutsAtLastPrestige).toBe(before.stats.totalNutsEarned);
    expect(after.stats).toEqual({ ...before.stats, prestiges: 1 });
    // Collections, cosmetics and decorations (with where they stand).
    expect(after.collections).toEqual(before.collections);
    expect(after.decorationInstances).toEqual(before.decorationInstances);
    expect(after.achievements).toEqual(before.achievements);
    expect(after.microgames).toEqual(before.microgames);
    expect(after.focus.completedSessions).toBe(3);
    // The people: friendship, nickname, outfit and conversations; not the payroll.
    expect(after.employees.otto).toMatchObject({
      hired: false,
      level: 0,
      friendship: 35,
      nickname: 'Ottinho',
      talks: { count: 5, lastAt: 0, seen: { 'check-in': NOW - 60_000 } },
    });
    // Histories written in flags; not the old cycle's crises, promises or reading.
    expect(Object.keys(after.flags).sort()).toEqual(
      [
        keepsakeFlag('otto', 'cared'),
        'otto.arc.1',
        'discovery.broadcast',
        'oddity.first-acorn',
        'microgame.coffeeRescue.mastered',
      ].sort(),
    );
    // The day's assignments: the claimed one stays claimed, progress stands.
    expect(after.daily).toEqual(before.daily);
    expect(after.daily.challenges).not.toBe(before.daily.challenges);
  });

  it("starts the company's progress over", () => {
    const before = company();
    const after = performPrestige(before, 'industrial', NOW);
    expect(after.resources.nuts).toBe(BALANCE.startingNuts);
    expect(after.resources.morale).toBe(BALANCE.morale.start);
    expect(after.resources.reputation).toBe(BALANCE.reputation.start);
    expect(
      Object.entries(after.employees)
        .filter(([, rt]) => rt.hired)
        .map(([id]) => id),
    ).toEqual(['pip']);
    expect(after.upgrades).toEqual({});
    expect(unlockedRooms(after).length).toBeLessThan(unlockedRooms(before).length);
    expect(after.crate.nuts).toBe(0);
    expect(after.finds).toEqual([]);
    expect(after.scheduled).toEqual([]);
    expect(after.boosts).toEqual([]);
    expect(after.focus.active).toBe(false);
    expect(after.clicker.bestStreak).toBe(0);
    expect(after.eventInProgress).toBeNull();
    // A set whose room closed stops counting until the room reopens (its pieces stay put).
    expect(decorationEnsembles(before).some((set) => set.active)).toBe(true);
    expect(decorationEnsembles(after).some((set) => set.active)).toBe(false);
  });

  it('says exactly what the operation does, before it is done', () => {
    const before = company();
    const preview = restructurePreview(before, 'science', NOW);
    const after = performPrestige(before, 'science', NOW);
    expect(preview.ready).toBe(true);
    expect(preview.kernels).toBe(after.resources.permanentKernels - 3);
    expect(preview.kernelBonus.now).toBeCloseTo(3 * BALANCE.prestige.kernelGlobalBonus);
    expect(preview.kernelBonus.after).toBeCloseTo(
      after.resources.permanentKernels * BALANCE.prestige.kernelGlobalBonus,
    );
    expect(preview.branch.id).toBe('science');
    expect(preview.cycle).toEqual({ now: 1, next: 2 });
    expect(preview.keeps).toMatchObject({
      goldenNuts: 12,
      decorations: 4,
      decorationsWaiting: 3,
      setsPaused: 1,
      nuts: 2,
      moments: 1,
      secrets: 1,
      achievements: 1,
      records: 1,
    });
    expect(preview.resets).toMatchObject({
      nuts: 2_000_000,
      hires: 3,
      rooms: unlockedRooms(before).length - unlockedRooms(after).length,
      upgrades: 2,
      crate: 5_000,
      waiting: 1,
      promises: 1,
      boosts: 1,
      focus: true,
    });
    // Reading it changes nothing.
    expect(before).toEqual(company());
  });

  it('starts the new cycle with the Head Start it bought', () => {
    const before = company();
    before.prestige.skills['head-start'] = 3;
    expect(restructurePreview(before, 'industrial', NOW).startNuts).toBe(1_500);
    expect(performPrestige(before, 'industrial', NOW).resources.nuts).toBe(1_500);
  });
});

describe('a restructure happens once, or not at all', () => {
  it('refuses below the line, or with a branch that does not exist, changing nothing', () => {
    const early = createInitialState(NOW);
    early.stats.totalNutsEarned = BALANCE.prestige.unlockAtTotalNuts - 1;
    const copy = structuredClone(early);
    expect(performPrestige(early, 'industrial', NOW)).toBe(early);
    expect(early).toEqual(copy);

    const ready = company();
    const snapshot = structuredClone(ready);
    expect(performPrestige(ready, 'not-a-branch' as never, NOW)).toBe(ready);
    expect(ready).toEqual(snapshot);
  });

  it('pays nothing the second time: not again in memory, not after a reload', () => {
    const first = performPrestige(company(), 'marketing', NOW);
    expect(canPrestige(first)).toBe(false);
    expect(performPrestige(first, 'marketing', NOW + 1)).toBe(first);
    const loaded = gameStateSchema.parse(JSON.parse(JSON.stringify(first))) as unknown as GameState;
    expect(canPrestige(loaded)).toBe(false);
    expect(nutsThisRun(loaded)).toBe(0);
    expect(performPrestige(loaded, 'industrial', NOW + 2)).toBe(loaded);
  });

  it('does not let the day be claimed twice across a restructure', () => {
    const before = company();
    const claimed = before.daily.challenges[0].id;
    const engine = new GameEngine(performPrestige(before, 'industrial', NOW), {
      deterministic: true,
    });
    const golden = engine.state.resources.goldenNuts;
    // Still the same day's assignment, still marked as paid.
    expect(engine.state.daily.date).toBe(before.daily.date);
    expect(engine.state.daily.challenges.find((c) => c.id === claimed)?.claimed).toBe(true);
    expect(engine.claimDaily(claimed)).toBe(false);
    expect(engine.state.resources.goldenNuts).toBe(golden);
  });

  it('restructures an older save that predates the cycle record and fields added since', () => {
    const legacy = JSON.parse(JSON.stringify(company())) as Record<string, unknown>;
    delete (legacy.prestige as Record<string, unknown>).nutsAtLastPrestige;
    delete legacy.daily;
    delete (legacy.clicker as Record<string, unknown>).goldenDust;
    const loaded = gameStateSchema.parse(legacy) as unknown as GameState;
    expect(canPrestige(loaded)).toBe(true);
    const after = performPrestige(loaded, 'underground', NOW);
    expect(after.prestige.count).toBe(1);
    expect(Number.isFinite(after.clicker.goldenDust)).toBe(true);
    expect(after.daily.challenges.length).toBeGreaterThan(0);
  });
});

describe('the new cycle has somewhere to go', () => {
  it('opens on a goal the player can work toward, and nothing it cannot do', () => {
    const after = performPrestige(company(), 'industrial', NOW);
    const goal = nextGoal(after);
    expect(goal).not.toBeNull();
    expect(goal!.cost).toBeGreaterThan(0);
    // The guide never points back at a restructure that just happened.
    expect(computeNextStep(after)?.key).not.toBe('prestige');
  });

  it('shows the restructure from half way to the line, and keeps it after the first one', () => {
    const s = createInitialState(NOW);
    expect(restructureInSight(s)).toBe(false);
    s.stats.totalNutsEarned = BALANCE.prestige.unlockAtTotalNuts / 2;
    expect(restructureInSight(s)).toBe(true);
    const after = performPrestige(company(), 'industrial', NOW);
    expect(restructureInSight(after)).toBe(true);
  });
});

describe('the guide offers a restructure once per cycle', () => {
  it('retires the suggestion when the file is read, and offers it again next cycle', () => {
    const s = company();
    delete s.flags[RESTRUCTURE_REVIEWED_FLAG];
    s.employees.marlow.talks = { count: 1, lastAt: 0, seen: {} };
    // Nothing waiting in the building for this test.
    s.flags['discovery.repair'] = NOW;
    const engine = new GameEngine(s, { deterministic: true });
    expect(computeNextStep(engine.state)?.key).toBe('prestige');
    engine.reviewRestructure();
    expect(RESTRUCTURE_REVIEWED_FLAG in engine.state.flags).toBe(true);
    expect(computeNextStep(engine.state)?.key).not.toBe('prestige');

    // The next cycle, once it reaches the line, is offered again.
    const next = performPrestige(engine.state, 'industrial', NOW);
    expect(RESTRUCTURE_REVIEWED_FLAG in next.flags).toBe(false);
    next.stats.totalNutsEarned += BALANCE.prestige.unlockAtTotalNuts;
    expect(canPrestige(next)).toBe(true);
    expect(computeNextStep(next)?.key).toBe('prestige');
  });

  it('is not retired by reading the file before it is open', () => {
    const s = createInitialState(NOW);
    s.stats.totalNutsEarned = BALANCE.prestige.unlockAtTotalNuts / 2;
    const engine = new GameEngine(s, { deterministic: true });
    engine.reviewRestructure();
    expect(RESTRUCTURE_REVIEWED_FLAG in engine.state.flags).toBe(false);
  });
});
