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
import { TALKS_BY_ID, topicsForEmployee, type TalkChoice } from '../content/employeeTalks';
import {
  KEEPSAKE_ANSWER,
  keepsakeFlag,
  keepsakeTopicId,
  type KeepsakeDecision,
} from '../content/employeeKeepsakes';
import { EVENT_MEMORIES } from '../content/happenings';
import { GAME_EVENTS } from '../content/events';
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

/**
 * Whether their story may be named yet: once it has begun, or its first part is
 * ready to be told. Before that its title stays theirs (the scrapbook says only
 * that there is a story, and when it starts).
 */
export function storyNamed(state: GameState, employeeId: string, now: number): boolean {
  const story = storyState(state, employeeId, now);
  return story.told > 0 || story.readyTopicId !== null;
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
      /** what the player said. */
      saidKey: string;
      /** what they said back. */
      quoteKey: string;
    }
  | {
      kind: 'keepsake';
      at: number;
      decision: KeepsakeDecision;
      /** the object's name. */
      titleKey: string;
      saidKey: string;
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
    const answers = TALKS_BY_ID[storyTopicId(employeeId, part)]?.nodes.open?.choices ?? [];
    for (const choice of ['a', 'b'] as const) {
      const at = flags[storyFlag(employeeId, part, choice)];
      if (at === undefined) continue;
      const answer = answers.find((candidate) => candidate.id === choice);
      out.push({
        kind: 'story',
        at,
        part,
        choice,
        titleKey: `arc.${employeeId}.title`,
        saidKey: answer?.labelKey ?? `arc.${employeeId}.${part}.${choice}.label`,
        quoteKey: answer?.replyKey ?? `arc.${employeeId}.${part}.${choice}.reply`,
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
  // The conversation about their keepsake, with what was decided.
  const keepsake = keepsakeFor(state, employeeId)?.talk ?? null;
  if (keepsake) {
    out.push({
      kind: 'keepsake',
      at: keepsake.at,
      decision: keepsake.decision,
      titleKey: EMPLOYEES_BY_ID[employeeId]?.favoriteItemKey ?? keepsakeTopicId(employeeId),
      saidKey: keepsake.choiceLabelKey,
      quoteKey: keepsake.replyKey,
    });
  }
  // Their other personal conversations (their own topics).
  for (const [topicId, at] of Object.entries(state.employees[employeeId]?.talks?.seen ?? {})) {
    const topic = TALKS_BY_ID[topicId];
    if (!topic || topic.employeeId !== employeeId || topic.story) continue;
    if (keepsake && topicId === keepsakeTopicId(employeeId)) continue;
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
  return (
    keepsakeFlag(employeeId, 'cared') in state.flags || storyDoneFlag(employeeId) in state.flags
  );
}

// ---- their keepsake --------------------------------------------------------------

/** A teammate's keepsake, as far as the player knows it. */
export interface KeepsakeView {
  employeeId: string;
  /** the object's name. */
  itemKey: string;
  /** a line about it (the scene its conversation opens on). */
  sceneKey: string;
  /** out on their desk. */
  onDisplay: boolean;
  /** what put it there first: looking after it, or hearing their whole story. */
  reason: 'cared' | 'story' | null;
  /** since when it has been on their desk. */
  since: number | null;
  /** the conversation about it, if the two of you have had it. */
  talk: {
    decision: KeepsakeDecision;
    at: number;
    choiceLabelKey: string;
    replyKey: string;
  } | null;
}

/**
 * Their keepsake once the player knows it: they have talked about it, or it went
 * on their desk at the end of their story. Null before that, so nothing about it
 * (not even its name) is shown early. Read from durable marks only, so it never
 * drifts from what happened and an old save shows exactly what it earned.
 */
export function keepsakeFor(state: GameState, employeeId: string): KeepsakeView | null {
  const def = EMPLOYEES_BY_ID[employeeId];
  if (!def) return null;
  const caredAt = state.flags[keepsakeFlag(employeeId, 'cared')];
  const discussedAt = state.flags[keepsakeFlag(employeeId, 'discussed')];
  const storyAt = state.flags[storyDoneFlag(employeeId)];
  const decision: KeepsakeDecision | null =
    caredAt !== undefined ? 'cared' : discussedAt !== undefined ? 'discussed' : null;
  if (!decision && storyAt === undefined) return null;
  const answer = decision
    ? TALKS_BY_ID[keepsakeTopicId(employeeId)]?.nodes.open?.choices.find(
        (choice) => choice.id === KEEPSAKE_ANSWER[decision],
      )
    : undefined;
  const placed = [
    caredAt !== undefined ? { reason: 'cared' as const, at: caredAt } : null,
    storyAt !== undefined ? { reason: 'story' as const, at: storyAt } : null,
  ]
    .filter((entry): entry is { reason: 'cared' | 'story'; at: number } => entry !== null)
    .sort((a, b) => a.at - b.at)[0];
  return {
    employeeId,
    itemKey: def.favoriteItemKey,
    sceneKey: `keepsake.${employeeId}.scene`,
    onDisplay: Boolean(placed),
    reason: placed?.reason ?? null,
    since: placed?.at ?? null,
    talk:
      decision && answer
        ? {
            decision,
            at: (decision === 'cared' ? caredAt : discussedAt)!,
            choiceLabelKey: answer.labelKey,
            replyKey: answer.replyKey,
          }
        : null,
  };
}

// ---- what an answer leaves behind ------------------------------------------------

/** What taking a conversation answer costs: what will be taken (it says so first). */
export function talkChoiceCost(choice: TalkChoice): { nuts: number; goldenNuts: number } {
  let nuts = 0;
  let goldenNuts = 0;
  for (const effect of choice.effects) {
    const value = effect.value ?? 0;
    if (effect.type === 'nuts' && value < 0) nuts -= value;
    if (effect.type === 'goldenNuts' && value < 0) goldenNuts -= value;
  }
  return { nuts, goldenNuts };
}

/** What an answer sets going besides what it changes now. */
export interface TalkAftermath {
  /** something will come of it later: a delayed effect, a find, a follow-up. */
  later: boolean;
  /** this teammate will bring it up: a remark, or a mark their own words read. */
  remembered: boolean;
}

/** A mark something of theirs reads back: their lines, a memory, an incident about them. */
function teammateReads(employeeId: string, flag: string): boolean {
  const variants = topicsForEmployee(employeeId).some((topic) =>
    Object.values(topic.nodes).some((node) =>
      (node.variants ?? []).some((variant) => variant.flag === flag || variant.since === flag),
    ),
  );
  if (variants) return true;
  if (EVENT_MEMORIES.some((memory) => memory.employeeId === employeeId && memory.flag === flag)) {
    return true;
  }
  // An incident about them that offers a different answer because of it.
  return GAME_EVENTS.some(
    (event) =>
      event.employeeId === employeeId &&
      [...event.choices, ...Object.values(event.steps ?? {}).flatMap((step) => step.choices)].some(
        (choice) => choice.requires?.flag === flag,
      ),
  );
}

/** A mark that opens something later: a conversation of theirs, or an incident. */
function opensLater(employeeId: string, flag: string): boolean {
  const topic = topicsForEmployee(employeeId).some(
    (candidate) =>
      !candidate.story &&
      (candidate.requires?.flag === flag || candidate.requires?.after?.flag === flag),
  );
  if (topic) return true;
  return GAME_EVENTS.some(
    (event) => event.requires?.flag === flag || event.requires?.flags?.includes(flag),
  );
}

/**
 * What an answer leaves behind, read from the content itself (the same marks the
 * rest of the game reads), so a visit says THAT something will come of a choice,
 * or that they will bring it up, without ever saying what. Story parts opening
 * the next part are not counted here: the visit says where the story stands.
 */
export function talkAftermath(employeeId: string, choice: TalkChoice): TalkAftermath {
  const marks = choice.effects
    .filter((effect) => effect.type === 'setFlag' && effect.flagId)
    .map((effect) => effect.flagId as string);
  const later =
    choice.effects.some(
      (effect) =>
        (effect.type === 'schedule' && (effect.scheduled?.length ?? 0) > 0) ||
        effect.type === 'find' ||
        effect.type === 'incident' ||
        effect.type === 'oddity',
    ) || marks.some((flag) => opensLater(employeeId, flag));
  const remembered =
    choice.effects.some((effect) => effect.type === 'remark') ||
    marks.some((flag) => teammateReads(employeeId, flag));
  return { later, remembered };
}

/** The line they say in the office about what you told them in Part 1, if any. */
export function storyCallbackKey(state: GameState, employeeId: string): string | null {
  if (storyDoneFlag(employeeId) in state.flags) return null;
  if (storyFlag(employeeId, 1, 'a') in state.flags) return `arc.${employeeId}.callback.a`;
  if (storyFlag(employeeId, 1, 'b') in state.flags) return `arc.${employeeId}.callback.b`;
  return null;
}
