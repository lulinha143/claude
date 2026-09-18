// Conversation eligibility and option gating.
//
// Pure and framework-free (per CONTRIBUTING, `sim/` may not import React or the DOM),
// so the rules that decide what an employee is willing to talk about are unit-testable
// without a renderer. The engine owns the mutation; this module only answers questions.

import { EMPLOYEES_BY_ID } from '../content/employees';
import {
  topicsForEmployee,
  type TalkChoice,
  type TalkRequirement,
  type TalkTopic,
} from '../content/employeeTalks';
import { employeeMood } from './mood';
import { resolveEmployeeRoom } from './rooms';
import type { GameState } from './types';

/** Why an option cannot be taken, in a form the UI can localise. */
export interface TalkRequirementFailure {
  kind: 'nuts' | 'goldenNuts' | 'friendship' | 'flag' | 'missingFlag' | 'room' | 'mood' | 'morale';
  messageKey: string;
  required?: number;
}

export interface EvaluatedTalkChoice {
  choice: TalkChoice;
  enabled: boolean;
  failures: TalkRequirementFailure[];
}

/**
 * How long after a conversation before the same employee has anything new to say.
 *
 * This is not an anti-spam timer for its own sake: a talk moves real numbers, so
 * without it the interaction mode becomes the dominant way to farm friendship and
 * every other affordance stops mattering. Two minutes is long enough that a talk feels
 * like an occasion and short enough that it is never a wall.
 */
export const TALK_COOLDOWN_SECONDS = 120;

function talkMemory(state: GameState, employeeId: string) {
  return state.employees[employeeId]?.talks ?? { count: 0, lastAt: 0, seen: {} };
}

/** Seconds until this employee will talk again; 0 when they are ready now. */
export function talkCooldownRemaining(state: GameState, employeeId: string, now: number): number {
  const { lastAt } = talkMemory(state, employeeId);
  if (!lastAt) return 0;
  const elapsed = (now - lastAt) / 1000;
  return Math.max(0, Math.ceil(TALK_COOLDOWN_SECONDS - elapsed));
}

/** Has this employee already been through a `once` topic? */
export function topicSpent(state: GameState, employeeId: string, topicId: string): boolean {
  return Boolean(talkMemory(state, employeeId).seen[topicId]);
}

/**
 * Check a requirement block against live state. Returns every reason it fails, so the
 * UI can explain an option rather than silently hiding it.
 */
export function checkTalkRequirement(
  state: GameState,
  employeeId: string,
  req: TalkRequirement | undefined,
  now: number,
): TalkRequirementFailure[] {
  if (!req) return [];
  const out: TalkRequirementFailure[] = [];
  const rt = state.employees[employeeId];
  if (req.nuts !== undefined && state.resources.nuts < req.nuts) {
    out.push({ kind: 'nuts', messageKey: 'talk.req.nuts', required: req.nuts });
  }
  if (req.goldenNuts !== undefined && state.resources.goldenNuts < req.goldenNuts) {
    out.push({ kind: 'goldenNuts', messageKey: 'talk.req.goldenNuts', required: req.goldenNuts });
  }
  if (req.friendship !== undefined && (rt?.friendship ?? 0) < req.friendship) {
    out.push({ kind: 'friendship', messageKey: 'talk.req.friendship', required: req.friendship });
  }
  if (req.flag && !(req.flag in state.flags)) {
    out.push({ kind: 'flag', messageKey: 'talk.req.flag' });
  }
  if (req.missingFlag && req.missingFlag in state.flags) {
    out.push({ kind: 'missingFlag', messageKey: 'talk.req.missingFlag' });
  }
  if (req.room && !req.room.includes(resolveEmployeeRoom(state, employeeId))) {
    out.push({ kind: 'room', messageKey: 'talk.req.room' });
  }
  if (req.mood && !req.mood.includes(employeeMood(state, employeeId, now))) {
    out.push({ kind: 'mood', messageKey: 'talk.req.mood' });
  }
  if (req.moraleAbove !== undefined && state.resources.morale <= req.moraleAbove) {
    out.push({ kind: 'morale', messageKey: 'talk.req.moraleAbove', required: req.moraleAbove });
  }
  if (req.moraleBelow !== undefined && state.resources.morale >= req.moraleBelow) {
    out.push({ kind: 'morale', messageKey: 'talk.req.moraleBelow', required: req.moraleBelow });
  }
  return out;
}

/** Topics this employee is willing to open right now, best first. */
export function eligibleTopics(state: GameState, employeeId: string, now: number): TalkTopic[] {
  const rt = state.employees[employeeId];
  if (!rt?.hired) return [];
  if (!EMPLOYEES_BY_ID[employeeId]) return [];
  return topicsForEmployee(employeeId)
    .filter((topic) => {
      if (topic.once && topicSpent(state, employeeId, topic.id)) return false;
      return checkTalkRequirement(state, employeeId, topic.requires, now).length === 0;
    })
    .slice()
    .sort((a, b) => {
      // Urgent situations retain priority. Otherwise give unseen material a turn,
      // then revisit the oldest exchange: a repeatable check-in must not permanently
      // hide gifts, discoveries or any lower-weight authored topic.
      if (a.weight >= 14 || b.weight >= 14) return b.weight - a.weight;
      const seen = talkMemory(state, employeeId).seen;
      return (
        (seen[a.id] ?? 0) - (seen[b.id] ?? 0) || b.weight - a.weight || a.id.localeCompare(b.id)
      );
    });
}

/**
 * The topic to open. Highest weight wins so a company in a morale crisis gets the
 * conversation about the crisis rather than small talk, and ties break on id so the
 * choice is deterministic (which is what makes it testable).
 */
export function pickTopic(state: GameState, employeeId: string, now: number): TalkTopic | null {
  return eligibleTopics(state, employeeId, now)[0] ?? null;
}

/** Can this employee be talked to at all right now? */
export function canTalk(state: GameState, employeeId: string, now: number): boolean {
  if (talkCooldownRemaining(state, employeeId, now) > 0) return false;
  return pickTopic(state, employeeId, now) !== null;
}

/**
 * Evaluate a node's options.
 *
 * Options that fail are returned DISABLED WITH REASONS rather than dropped, because a
 * conversation where the interesting option silently vanishes teaches the player
 * nothing. If every door closes, offer a consequence-free exit; never bypass a
 * resource or relationship requirement to repair a dead end.
 */
export function evaluateTalkNode(
  state: GameState,
  employeeId: string,
  choices: readonly TalkChoice[],
  now: number,
): EvaluatedTalkChoice[] {
  const evaluated = choices.map((choice) => {
    const failures = checkTalkRequirement(state, employeeId, choice.requires, now);
    return { choice, enabled: failures.length === 0, failures };
  });
  if (evaluated.length > 0 && !evaluated.some((e) => e.enabled)) {
    let id = 'defer';
    while (choices.some((choice) => choice.id === id)) id += '-exit';
    evaluated.push({
      choice: {
        id,
        labelKey: 'talk.defer.label',
        replyKey: 'talk.defer.reply',
        effects: [],
      },
      enabled: true,
      failures: [],
    });
  }
  return evaluated;
}
