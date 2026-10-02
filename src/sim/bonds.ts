import type { GameState } from './types';
import { EMPLOYEES_BY_ID, FOUNDER_ID } from '../content/employees';
import { CHARACTERS } from '../content/characters';
import {
  GIFTS,
  giftFlag,
  giftReaction,
  type GiftId,
  type GiftReaction,
} from '../content/employeeGifts';
import { BOND_THRESHOLDS, storyDoneFlag, storyFlag, storyTopicId } from '../content/stories';
import { TALKS_BY_ID } from '../content/employeeTalks';
import { PAIRS, partnerIn, type PairDef, type PairKind } from '../content/pairs';
import { checkTalkRequirement, talkCooldownRemaining, topicSpent } from './talks';
import { resolveEmployeeRoom } from './rooms';

// Relationships, as the player sees them. Pure reads over persisted state: the
// tier comes from friendship, everything you have shared with someone comes from
// the durable flags their conversations, gifts and story write. Nothing here
// mutates; the engine owns that.

/** New face → familiar → trusted → close. */
export const BOND_TIERS = ['new', 'familiar', 'trusted', 'close'] as const;
export type BondTierId = (typeof BOND_TIERS)[number];
export type BondTier = 0 | 1 | 2 | 3;

const TIER_MIN = [0, BOND_THRESHOLDS.familiar, BOND_THRESHOLDS.trusted, BOND_THRESHOLDS.close];

/** A close friend's own work gets this much better. */
export const CLOSE_OUTPUT_BONUS = 0.1;

export function bondTier(friendship: number): BondTier {
  if (friendship >= TIER_MIN[3]) return 3;
  if (friendship >= TIER_MIN[2]) return 2;
  if (friendship >= TIER_MIN[1]) return 1;
  return 0;
}

/** Where the relationship stands, and how far it is to the next stage. */
export function bondProgress(friendship: number): {
  tier: BondTier;
  next: BondTier | null;
  /** 0..1 through the current stage. */
  fraction: number;
} {
  const tier = bondTier(friendship);
  if (tier === 3) return { tier, next: null, fraction: 1 };
  const from = TIER_MIN[tier];
  const to = TIER_MIN[tier + 1];
  return {
    tier,
    next: (tier + 1) as BondTier,
    fraction: Math.max(0, Math.min(1, (friendship - from) / (to - from))),
  };
}

export function tierFlag(employeeId: string, tier: BondTier): string {
  return `${employeeId}.tier.${tier}`;
}

/**
 * The highest stage the player has already celebrated with this teammate. The
 * founder starts out familiar (you founded the company together), which is not
 * news to anyone.
 */
export function acknowledgedTier(state: GameState, employeeId: string): BondTier {
  for (let tier = 3; tier >= 1; tier -= 1) {
    if (tierFlag(employeeId, tier as BondTier) in state.flags) return tier as BondTier;
  }
  return employeeId === FOUNDER_ID ? 1 : 0;
}

/** A close friend works this much better (1 = no change). */
export function bondOutputMultiplier(friendship: number): number {
  return bondTier(friendship) >= 3 ? 1 + CLOSE_OUTPUT_BONUS : 1;
}

// ---- gifts ---------------------------------------------------------------------

export function giftTried(state: GameState, employeeId: string, gift: GiftId): boolean {
  return giftFlag(employeeId, gift) in state.flags;
}

/** The reactions the player has actually seen, gift by gift. */
export function knownReactions(
  state: GameState,
  employeeId: string,
): Partial<Record<GiftId, GiftReaction>> {
  const out: Partial<Record<GiftId, GiftReaction>> = {};
  for (const gift of GIFTS) {
    if (giftTried(state, employeeId, gift.id)) out[gift.id] = giftReaction(employeeId, gift.id);
  }
  return out;
}

/** Their favourite, once the player has actually found it. */
export function knownFavorite(state: GameState, employeeId: string): GiftId | null {
  const loves = CHARACTERS[employeeId]?.gifts.loves;
  return loves && giftTried(state, employeeId, loves) ? loves : null;
}

/**
 * A nudge toward the favourite: offered once the player is trusted and has had
 * a couple of misses, so finding it is a little detective work, not a lottery.
 */
export function giftHint(state: GameState, employeeId: string): GiftId | null {
  const loves = CHARACTERS[employeeId]?.gifts.loves;
  if (!loves || knownFavorite(state, employeeId)) return null;
  if (bondTier(state.employees[employeeId]?.friendship ?? 0) < 2) return null;
  const tried = GIFTS.filter((gift) => giftTried(state, employeeId, gift.id)).length;
  return tried >= 2 ? loves : null;
}

// ---- their story ------------------------------------------------------------

export interface StoryState {
  /** parts already told (0-3). */
  told: 0 | 1 | 2 | 3;
  /** the next part, if any. */
  next: 1 | 2 | 3 | null;
  /** the next part's topic, when it can be told right now. */
  readyTopicId: string | null;
  /** what the next part is waiting for. */
  waitingFor: 'friendship' | 'time' | null;
  /** seconds until it can be told, when only time is missing. */
  readyIn: number;
}

export function storyState(state: GameState, employeeId: string, now: number): StoryState {
  const told =
    storyDoneFlag(employeeId) in state.flags
      ? 3
      : storyFlag(employeeId, 2) in state.flags
        ? 2
        : storyFlag(employeeId, 1) in state.flags
          ? 1
          : 0;
  if (told === 3) return { told, next: null, readyTopicId: null, waitingFor: null, readyIn: 0 };
  const next = (told + 1) as 1 | 2 | 3;
  const topic = TALKS_BY_ID[storyTopicId(employeeId, next)];
  if (!topic || topicSpent(state, employeeId, topic.id)) {
    return { told, next: null, readyTopicId: null, waitingFor: null, readyIn: 0 };
  }
  const failures = checkTalkRequirement(state, employeeId, topic.requires, now);
  const friendship = failures.some((f) => f.kind === 'friendship');
  const later = failures.find((f) => f.kind === 'later');
  return {
    told,
    next,
    readyTopicId: failures.length === 0 ? topic.id : null,
    waitingFor: friendship ? 'friendship' : later ? 'time' : null,
    readyIn: later?.required ?? 0,
  };
}

// ---- something to share --------------------------------------------------------

export type PendingMoment =
  | { kind: 'milestone'; tier: BondTier }
  | { kind: 'story'; topicId: string }
  | { kind: 'hint'; gift: GiftId };

/**
 * What this teammate would like to tell the player next time they stop by, if
 * anything: a new stage of the relationship to celebrate, the next part of their
 * story, or a hint about their favourite gift. Shown in the office as a small
 * speech sticker, never as a popup.
 */
export function pendingMoment(
  state: GameState,
  employeeId: string,
  now: number,
): PendingMoment | null {
  const rt = state.employees[employeeId];
  if (!rt?.hired || !EMPLOYEES_BY_ID[employeeId]) return null;
  if (talkCooldownRemaining(state, employeeId, now) > 0) return null;
  const tier = bondTier(rt.friendship);
  if (tier > acknowledgedTier(state, employeeId)) return { kind: 'milestone', tier };
  const story = storyState(state, employeeId, now);
  if (story.readyTopicId) return { kind: 'story', topicId: story.readyTopicId };
  const hint = giftHint(state, employeeId);
  if (hint && !(`${employeeId}.hint` in state.flags)) return { kind: 'hint', gift: hint };
  return null;
}

/** How many teammates may be waving the player over at once. */
export const MAX_WAVING = 3;

const MOMENT_ORDER: Record<PendingMoment['kind'], number> = { milestone: 0, story: 1, hint: 2 };

/**
 * The few teammates currently waving the player over, and what for: news about
 * the friendship first, then stories, then hints, in roster order. Capped, so the
 * office (and the Team card) hint at who to see next rather than nag about all.
 */
export function wavingTeammates(
  state: GameState,
  now: number,
  max = MAX_WAVING,
): Map<string, PendingMoment> {
  const waiting: Array<[string, PendingMoment]> = [];
  for (const id of Object.keys(state.employees)) {
    const moment = pendingMoment(state, id, now);
    if (moment) waiting.push([id, moment]);
  }
  waiting.sort((a, b) => MOMENT_ORDER[a[1].kind] - MOMENT_ORDER[b[1].kind]);
  return new Map(waiting.slice(0, max));
}

// ---- who they get on with -------------------------------------------------------

/** Pairs whose two teammates are both on the payroll and sitting in the same room. */
export function pairsTogether(state: GameState, employeeId?: string): PairDef[] {
  return PAIRS.filter((pair) => {
    if (employeeId && pair.a !== employeeId && pair.b !== employeeId) return false;
    const a = state.employees[pair.a];
    const b = state.employees[pair.b];
    if (!a?.hired || !b?.hired) return false;
    return resolveEmployeeRoom(state, pair.a) === resolveEmployeeRoom(state, pair.b);
  });
}

export function pairFlag(pairId: string): string {
  return `pair.${pairId}`;
}

// ---- the scrapbook ------------------------------------------------------------

export type JournalEntry =
  | { kind: 'tier'; at: number; tier: BondTier }
  | {
      kind: 'story';
      at: number;
      part: 1 | 2 | 3;
      choice: 'a' | 'b';
      titleKey: string;
      quoteKey: string;
    }
  | { kind: 'talk'; at: number; titleKey: string }
  | { kind: 'gift'; at: number; gift: GiftId; reaction: GiftReaction }
  | { kind: 'find'; at: number; quoteKey: string }
  | { kind: 'moment'; at: number; caption: string }
  | { kind: 'pair'; at: number; other: string; pairKind: PairKind; mentor: boolean };

/**
 * Everything the player and this teammate have been through, newest first,
 * derived entirely from persisted facts (so it survives saves and restructures
 * and never drifts from what actually happened).
 */
export function journalFor(state: GameState, employeeId: string): JournalEntry[] {
  const out: JournalEntry[] = [];
  const flags = state.flags;
  for (let tier = 1; tier <= 3; tier += 1) {
    const at = flags[tierFlag(employeeId, tier as BondTier)];
    if (at !== undefined) out.push({ kind: 'tier', at, tier: tier as BondTier });
  }
  for (const part of [1, 2, 3] as const) {
    for (const choice of ['a', 'b'] as const) {
      const at = flags[storyFlag(employeeId, part, choice)];
      if (at === undefined) continue;
      out.push({
        kind: 'story',
        at,
        part,
        choice,
        titleKey: `arc.${employeeId}.title`,
        quoteKey: `arc.${employeeId}.${part}.${choice}.reply`,
      });
    }
  }
  const storyFindAt = flags[`${employeeId}.storyFindTaken`];
  if (storyFindAt !== undefined) {
    out.push({ kind: 'find', at: storyFindAt, quoteKey: `arc.${employeeId}.find` });
  }
  for (const gift of GIFTS) {
    const at = flags[giftFlag(employeeId, gift.id)];
    if (at !== undefined) {
      out.push({ kind: 'gift', at, gift: gift.id, reaction: giftReaction(employeeId, gift.id) });
    }
  }
  // Their other personal conversations (the keepsake, their own topics).
  for (const [topicId, at] of Object.entries(state.employees[employeeId]?.talks?.seen ?? {})) {
    const topic = TALKS_BY_ID[topicId];
    if (!topic || topic.employeeId !== employeeId || topic.story) continue;
    out.push({ kind: 'talk', at, titleKey: topic.titleKey });
  }
  // Moments from events they were part of (talk moments are already above).
  for (const card of state.collections.moments) {
    if (card.employeeId !== employeeId || card.eventId.startsWith('talk:')) continue;
    out.push({ kind: 'moment', at: card.createdAt, caption: card.caption });
  }
  for (const pair of PAIRS) {
    if (pair.a !== employeeId && pair.b !== employeeId) continue;
    const at = flags[pairFlag(pair.id)];
    if (at === undefined) continue;
    out.push({
      kind: 'pair',
      at,
      other: partnerIn(pair, employeeId),
      pairKind: pair.kind,
      mentor: pair.kind === 'mentor' && pair.a === employeeId,
    });
  }
  return out.sort((x, y) => y.at - x.at);
}

/** Whether their keepsake has earned a place by their desk. */
export function keepsakeOnDisplay(state: GameState, employeeId: string): boolean {
  return `favorite.${employeeId}.cared` in state.flags || storyDoneFlag(employeeId) in state.flags;
}

/** The line they say in the office about what you told them in Part 1, if any. */
export function storyCallbackKey(state: GameState, employeeId: string): string | null {
  if (storyDoneFlag(employeeId) in state.flags) return null;
  if (storyFlag(employeeId, 1, 'a') in state.flags) return `arc.${employeeId}.callback.a`;
  if (storyFlag(employeeId, 1, 'b') in state.flags) return `arc.${employeeId}.callback.b`;
  return null;
}
