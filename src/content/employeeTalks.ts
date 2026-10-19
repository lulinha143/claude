// Employee conversations: the content behind the full-screen interaction mode.
//
// WHY THIS IS DATA
// ----------------
// A conversation is a small graph of nodes, and every consequence it can have is an
// `EventEffect` — the same vocabulary random events use. That is deliberate: effects
// go through `GameEngine.applyEffect`, the single funnel that already knows how to
// move nuts, bend morale within the caps in force, set an employee's emotion, write a
// durable flag into consequence memory and PROMISE effects that land minutes later.
// So a talk gets delayed consequences, measured before/after reporting and save
// persistence without a parallel system, and adding a conversation is pure content.
//
// WHAT MAKES A CHOICE REAL
// ------------------------
// The brief for this feature was explicit that fake choices — three buttons that all
// pay +5 nuts — are the failure mode. So each topic here is written so its options
// diverge in KIND, not in magnitude:
//
//   * one option usually trades a resource for a relationship, or the reverse
//   * one option usually costs nothing now and schedules something later
//   * flags mean a choice is remembered: `eligibleEvents` and other topics read them,
//     so declining to look inside the filing cabinet closes a door that stays closed
//   * emotions change how an employee reads in the office afterwards, and mood feeds
//     the production multiplier, so being careless with someone is measurable
//
// Requirements gate on things the player can see (friendship, mood, room, resources,
// flags), and a topic whose requirements no longer hold simply stops being offered.

import type { EmployeeMood } from '../sim/types';
import type { EventEffect } from './types';
import { ANNEX_TALKS } from './annexTalks';
import {
  GIFTS,
  REACTION_EFFECTS,
  giftFlag,
  giftReaction,
  giftReplyKey,
  type GiftId,
} from './employeeGifts';
import { KEEPSAKE_TALKS } from './employeeKeepsakes';
import { STORY_TALKS } from './stories';
import { CHARACTERS } from './characters';

/** What a conversation option needs before it can be offered. */
export interface TalkRequirement {
  nuts?: number;
  goldenNuts?: number;
  /** minimum trust with THIS employee (0..100). */
  friendship?: number;
  /** only while the company remembers this. */
  flag?: string;
  /** only while it does NOT. */
  missingFlag?: string;
  /** only for an employee currently seated in one of these rooms. */
  room?: string[];
  /** only when the employee is feeling one of these ways. */
  mood?: EmployeeMood[];
  /** company morale floor / ceiling. */
  moraleAbove?: number;
  moraleBelow?: number;
  /** only once this flag has been set for at least this long (a story's "later"). */
  after?: { flag: string; seconds: number };
}

export interface TalkChoice {
  id: string;
  labelKey: string;
  /** what the employee says back. This is the payoff, so every choice has one. */
  replyKey: string;
  effects: EventEffect[];
  /** next node, or omitted to end the conversation after the reply. */
  next?: string;
  requires?: TalkRequirement;
  /** shown greyed out with this reason rather than hidden, when it is close. */
  disabledKey?: string;
  /** marks the option as the one that costs the player something real. */
  tone?: 'warm' | 'firm' | 'curious' | 'costly' | 'risky';
}

/**
 * Something said instead of a node's usual prompt when every condition it names
 * holds. Conditions about the teammate themselves (where they sit, how they feel,
 * what happened since you last spoke) need to know who is speaking; without that
 * context such a variant is simply skipped.
 */
export interface TalkVariant {
  promptKey: string;
  /** the company remembers this. */
  flag?: string;
  /**
   * this was (re)stamped at or after the teammate's last time on this topic:
   * "since we last spoke".
   */
  since?: string;
  /** how the room they are sitting in suits them. */
  affinity?: 'favorite' | 'acceptable' | 'disliked';
  /** they are visibly in a low mood (a negative emotion sticker). */
  lowMood?: boolean;
}

export interface TalkNode {
  id: string;
  /** what the employee says on arriving at this node. */
  promptKey: string;
  /**
   * Alternative openings that remember an earlier choice or read the moment: the
   * first whose conditions hold is said instead of `promptKey`.
   */
  variants?: TalkVariant[];
  choices: TalkChoice[];
}

export interface TalkTopic {
  id: string;
  /** omit for a topic anyone can have; set to scope it to one animal. */
  employeeId?: string;
  titleKey: string;
  /** short line under the title, setting the scene. */
  blurbKey: string;
  root: string;
  nodes: Record<string, TalkNode>;
  requires?: TalkRequirement;
  /** once resolved, never offered again. */
  once?: boolean;
  /** higher is likelier when several topics are eligible. */
  weight: number;
  /** for a personal story: whose story it is, and which part (1-3). */
  story?: string;
  part?: number;
}

const k = (topic: string, rest: string) => `talk.${topic}.${rest}`;

/* -------------------------------------------------------------------------- */
/* Universal topics: any hired animal can have these.                          */
/* -------------------------------------------------------------------------- */

const CHECK_IN: TalkTopic = {
  id: 'check-in',
  titleKey: k('check-in', 'title'),
  blurbKey: k('check-in', 'blurb'),
  root: 'open',
  weight: 10,
  nodes: {
    open: {
      id: 'open',
      promptKey: k('check-in', 'open.prompt'),
      choices: [
        {
          id: 'listen',
          tone: 'warm',
          labelKey: k('check-in', 'open.listen.label'),
          replyKey: k('check-in', 'open.listen.reply'),
          // Listening costs a moment and buys real trust. No resources move.
          effects: [{ type: 'friendship', value: 6 }],
          next: 'listened',
        },
        {
          id: 'praise',
          tone: 'warm',
          labelKey: k('check-in', 'open.praise.label'),
          replyKey: k('check-in', 'open.praise.reply'),
          effects: [
            { type: 'friendship', value: 3 },
            { type: 'morale', value: 3 },
            { type: 'emotion', emotion: 'proud', durationSeconds: 420 },
          ],
        },
        {
          id: 'quota',
          tone: 'firm',
          labelKey: k('check-in', 'open.quota.label'),
          replyKey: k('check-in', 'open.quota.reply'),
          // The productivity-now-for-goodwill-later trade, and it is remembered.
          effects: [
            { type: 'productionBoost', value: 1.18, durationSeconds: 300 },
            { type: 'friendship', value: -5 },
            { type: 'emotion', emotion: 'frustrated', durationSeconds: 360 },
            { type: 'setFlag', flagId: 'talk.pushedForQuota' },
          ],
        },
      ],
    },
    listened: {
      id: 'listened',
      promptKey: k('check-in', 'listened.prompt'),
      choices: [
        {
          id: 'fix',
          tone: 'costly',
          labelKey: k('check-in', 'listened.fix.label'),
          replyKey: k('check-in', 'listened.fix.reply'),
          requires: { nuts: 2500 },
          effects: [
            { type: 'nuts', value: -2500 },
            { type: 'friendship', value: 8 },
            { type: 'morale', value: 5 },
            { type: 'emotion', emotion: 'happy', durationSeconds: 600 },
            { type: 'setFlag', flagId: 'talk.fixedSomething' },
          ],
        },
        {
          id: 'promise',
          tone: 'risky',
          labelKey: k('check-in', 'listened.promise.label'),
          replyKey: k('check-in', 'listened.promise.reply'),
          // Costs nothing now. Lands later, whether or not the player remembers.
          effects: [
            { type: 'friendship', value: 4 },
            {
              type: 'schedule',
              delaySeconds: 600,
              flagId: 'talk.brokenPromise',
              scheduleTitleKey: 'talk.consequence.promise.title',
              scheduleBodyKey: 'talk.consequence.promise.body',
              scheduled: [
                { type: 'morale', value: -6 },
                { type: 'friendship', value: -9 },
                { type: 'setFlag', flagId: 'talk.brokenPromise' },
              ],
            },
          ],
        },
        {
          id: 'thanks',
          tone: 'warm',
          labelKey: k('check-in', 'listened.thanks.label'),
          replyKey: k('check-in', 'listened.thanks.reply'),
          effects: [{ type: 'friendship', value: 2 }],
        },
      ],
    },
  },
};

const SUSPICIOUS_MEMO: TalkTopic = {
  id: 'suspicious-memo',
  titleKey: k('suspicious-memo', 'title'),
  blurbKey: k('suspicious-memo', 'blurb'),
  root: 'open',
  weight: 6,
  once: true,
  requires: { friendship: 35 },
  nodes: {
    open: {
      id: 'open',
      promptKey: k('suspicious-memo', 'open.prompt'),
      choices: [
        {
          id: 'read',
          tone: 'curious',
          labelKey: k('suspicious-memo', 'open.read.label'),
          replyKey: k('suspicious-memo', 'open.read.reply'),
          effects: [
            { type: 'emotion', emotion: 'suspicious', durationSeconds: 900 },
            { type: 'setFlag', flagId: 'memo.read' },
          ],
          next: 'read',
        },
        {
          id: 'shred',
          tone: 'firm',
          labelKey: k('suspicious-memo', 'open.shred.label'),
          replyKey: k('suspicious-memo', 'open.shred.reply'),
          // Closing this door is itself durable: content can ask about it later.
          effects: [
            { type: 'reputation', value: 4 },
            { type: 'friendship', value: -3 },
            { type: 'setFlag', flagId: 'memo.shredded' },
          ],
        },
      ],
    },
    read: {
      id: 'read',
      promptKey: k('suspicious-memo', 'read.prompt'),
      choices: [
        {
          id: 'escalate',
          tone: 'risky',
          labelKey: k('suspicious-memo', 'read.escalate.label'),
          replyKey: k('suspicious-memo', 'read.escalate.reply'),
          effects: [
            { type: 'reputation', value: -6 },
            { type: 'friendship', value: 10 },
            { type: 'morale', value: 6 },
            { type: 'setFlag', flagId: 'memo.escalated' },
            { type: 'unlockSecret', secretId: 'memo.basement' },
            {
              type: 'schedule',
              delaySeconds: 900,
              scheduleTitleKey: 'talk.consequence.escalated.title',
              scheduleBodyKey: 'talk.consequence.escalated.body',
              scheduled: [
                { type: 'reputation', value: 14 },
                { type: 'goldenNuts', value: 2 },
              ],
            },
          ],
        },
        {
          id: 'bury',
          tone: 'firm',
          labelKey: k('suspicious-memo', 'read.bury.label'),
          replyKey: k('suspicious-memo', 'read.bury.reply'),
          effects: [
            { type: 'nuts', value: 9000 },
            { type: 'friendship', value: -8 },
            { type: 'emotion', emotion: 'worried', durationSeconds: 900 },
            { type: 'setFlag', flagId: 'memo.buried' },
          ],
        },
        {
          id: 'ask',
          tone: 'curious',
          labelKey: k('suspicious-memo', 'read.ask.label'),
          replyKey: k('suspicious-memo', 'read.ask.reply'),
          effects: [
            { type: 'friendship', value: 5 },
            { type: 'momentCard' },
            { type: 'setFlag', flagId: 'memo.discussed' },
          ],
        },
      ],
    },
  },
};

// The gift topic is a TEMPLATE: six presents, each with its own cost. Who
// receives it decides the reply and how much it means (see employeeGifts.ts and
// `topicsForEmployee` below), so a gift only ever teaches you how that one
// teammate felt about that one present.
const giftCost = (gift: (typeof GIFTS)[number]) => {
  const requires: TalkRequirement = {};
  const effects: EventEffect[] = [];
  if (gift.cost.nuts) {
    requires.nuts = gift.cost.nuts;
    effects.push({ type: 'nuts', value: -gift.cost.nuts });
  }
  if (gift.cost.goldenNuts) {
    requires.goldenNuts = gift.cost.goldenNuts;
    effects.push({ type: 'goldenNuts', value: -gift.cost.goldenNuts });
  }
  return { requires: Object.keys(requires).length ? requires : undefined, effects };
};

const GIFT: TalkTopic = {
  id: 'gift',
  titleKey: k('gift', 'title'),
  blurbKey: k('gift', 'blurb'),
  root: 'open',
  weight: 7,
  nodes: {
    open: {
      id: 'open',
      promptKey: k('gift', 'open.prompt'),
      choices: GIFTS.map((gift) => {
        const cost = giftCost(gift);
        return {
          id: gift.id,
          tone: gift.cost.nuts || gift.cost.goldenNuts ? ('costly' as const) : ('warm' as const),
          labelKey: k('gift', `open.${gift.id}.label`),
          replyKey: k('gift', `open.${gift.id}.reply`),
          requires: cost.requires,
          effects: [...cost.effects, ...gift.base],
        };
      }),
    },
  },
};

const LOW_MORALE: TalkTopic = {
  id: 'slump',
  titleKey: k('slump', 'title'),
  blurbKey: k('slump', 'blurb'),
  root: 'open',
  weight: 14,
  // Only when there is genuinely something wrong, so it never reads as filler.
  requires: { moraleBelow: 45 },
  nodes: {
    open: {
      id: 'open',
      promptKey: k('slump', 'open.prompt'),
      choices: [
        {
          id: 'own-it',
          tone: 'warm',
          labelKey: k('slump', 'open.own-it.label'),
          replyKey: k('slump', 'open.own-it.reply'),
          effects: [
            { type: 'morale', value: 9 },
            { type: 'friendship', value: 7 },
            { type: 'reputation', value: -2 },
            { type: 'setFlag', flagId: 'talk.tookResponsibility' },
          ],
        },
        {
          id: 'deflect',
          tone: 'firm',
          labelKey: k('slump', 'open.deflect.label'),
          replyKey: k('slump', 'open.deflect.reply'),
          effects: [
            { type: 'morale', value: -4 },
            { type: 'friendship', value: -6 },
            { type: 'emotion', emotion: 'angry', durationSeconds: 600 },
          ],
        },
        {
          id: 'buy-lunch',
          tone: 'costly',
          labelKey: k('slump', 'open.buy-lunch.label'),
          replyKey: k('slump', 'open.buy-lunch.reply'),
          requires: { nuts: 4000 },
          effects: [
            { type: 'nuts', value: -4000 },
            { type: 'morale', value: 12 },
            { type: 'friendship', value: 4 },
            { type: 'emotion', emotion: 'relaxed', durationSeconds: 480 },
          ],
        },
      ],
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Character topics: these are the ones that make an animal a person.          */
/* -------------------------------------------------------------------------- */

const PIP_DOUBT: TalkTopic = {
  id: 'pip-doubt',
  employeeId: 'pip',
  titleKey: k('pip-doubt', 'title'),
  blurbKey: k('pip-doubt', 'blurb'),
  root: 'open',
  weight: 12,
  once: true,
  requires: { friendship: 45 },
  nodes: {
    open: {
      id: 'open',
      promptKey: k('pip-doubt', 'open.prompt'),
      choices: [
        {
          id: 'reassure',
          tone: 'warm',
          labelKey: k('pip-doubt', 'open.reassure.label'),
          replyKey: k('pip-doubt', 'open.reassure.reply'),
          effects: [
            { type: 'friendship', value: 9 },
            { type: 'morale', value: 5 },
            { type: 'emotion', emotion: 'inspired', durationSeconds: 900 },
            { type: 'setFlag', flagId: 'pip.reassured' },
          ],
          next: 'reassured',
        },
        {
          id: 'honest',
          tone: 'firm',
          labelKey: k('pip-doubt', 'open.honest.label'),
          replyKey: k('pip-doubt', 'open.honest.reply'),
          effects: [
            { type: 'friendship', value: 4 },
            { type: 'reputation', value: 8 },
            { type: 'emotion', emotion: 'focused', durationSeconds: 900 },
            { type: 'setFlag', flagId: 'pip.toldTheTruth' },
          ],
          next: 'reassured',
        },
      ],
    },
    reassured: {
      id: 'reassured',
      promptKey: k('pip-doubt', 'reassured.prompt'),
      choices: [
        {
          id: 'share',
          tone: 'warm',
          labelKey: k('pip-doubt', 'reassured.share.label'),
          replyKey: k('pip-doubt', 'reassured.share.reply'),
          effects: [
            { type: 'momentCard' },
            { type: 'friendship', value: 6 },
            { type: 'productionBoost', value: 1.25, durationSeconds: 600 },
          ],
        },
        {
          id: 'work',
          tone: 'firm',
          labelKey: k('pip-doubt', 'reassured.work.label'),
          replyKey: k('pip-doubt', 'reassured.work.reply'),
          effects: [
            { type: 'productionBoost', value: 1.35, durationSeconds: 420 },
            { type: 'friendship', value: -2 },
          ],
        },
      ],
    },
  },
};

const DORM_SLEEP: TalkTopic = {
  id: 'dorm-sleep',
  employeeId: 'dorm',
  titleKey: k('dorm-sleep', 'title'),
  blurbKey: k('dorm-sleep', 'blurb'),
  root: 'open',
  weight: 12,
  nodes: {
    open: {
      id: 'open',
      promptKey: k('dorm-sleep', 'open.prompt'),
      choices: [
        {
          id: 'let-sleep',
          tone: 'warm',
          labelKey: k('dorm-sleep', 'open.let-sleep.label'),
          replyKey: k('dorm-sleep', 'open.let-sleep.reply'),
          effects: [
            { type: 'friendship', value: 7 },
            { type: 'emotion', emotion: 'relaxed', durationSeconds: 900 },
            {
              type: 'schedule',
              delaySeconds: 480,
              scheduleTitleKey: 'talk.consequence.wellRested.title',
              scheduleBodyKey: 'talk.consequence.wellRested.body',
              scheduled: [
                { type: 'productionBoost', value: 1.3, durationSeconds: 600 },
                { type: 'morale', value: 4 },
              ],
            },
          ],
        },
        {
          id: 'wake',
          tone: 'firm',
          labelKey: k('dorm-sleep', 'open.wake.label'),
          replyKey: k('dorm-sleep', 'open.wake.reply'),
          effects: [
            { type: 'productionBoost', value: 1.1, durationSeconds: 240 },
            { type: 'friendship', value: -6 },
            { type: 'emotion', emotion: 'tired', durationSeconds: 900 },
          ],
        },
        {
          id: 'join',
          tone: 'curious',
          labelKey: k('dorm-sleep', 'open.join.label'),
          replyKey: k('dorm-sleep', 'open.join.reply'),
          effects: [
            { type: 'friendship', value: 11 },
            { type: 'morale', value: 7 },
            { type: 'momentCard' },
            { type: 'setFlag', flagId: 'dorm.napped' },
          ],
        },
      ],
    },
  },
};

const RIZZO_INVENTORY: TalkTopic = {
  id: 'rizzo-inventory',
  employeeId: 'rizzo',
  titleKey: k('rizzo-inventory', 'title'),
  blurbKey: k('rizzo-inventory', 'blurb'),
  root: 'open',
  weight: 12,
  once: true,
  nodes: {
    open: {
      id: 'open',
      promptKey: k('rizzo-inventory', 'open.prompt'),
      choices: [
        {
          id: 'ask-where',
          tone: 'curious',
          labelKey: k('rizzo-inventory', 'open.ask-where.label'),
          replyKey: k('rizzo-inventory', 'open.ask-where.reply'),
          effects: [{ type: 'emotion', emotion: 'embarrassed', durationSeconds: 420 }],
          next: 'confessed',
        },
        {
          id: 'dont-ask',
          tone: 'firm',
          labelKey: k('rizzo-inventory', 'open.dont-ask.label'),
          replyKey: k('rizzo-inventory', 'open.dont-ask.reply'),
          effects: [
            { type: 'nuts', value: 6000 },
            { type: 'friendship', value: 6 },
            { type: 'reputation', value: -4 },
            { type: 'setFlag', flagId: 'rizzo.dontAsk' },
          ],
        },
      ],
    },
    confessed: {
      id: 'confessed',
      promptKey: k('rizzo-inventory', 'confessed.prompt'),
      choices: [
        {
          id: 'return-it',
          tone: 'firm',
          labelKey: k('rizzo-inventory', 'confessed.return-it.label'),
          replyKey: k('rizzo-inventory', 'confessed.return-it.reply'),
          effects: [
            { type: 'reputation', value: 12 },
            { type: 'friendship', value: -4 },
            { type: 'setFlag', flagId: 'rizzo.returnedIt' },
          ],
        },
        {
          id: 'split-it',
          tone: 'risky',
          labelKey: k('rizzo-inventory', 'confessed.split-it.label'),
          replyKey: k('rizzo-inventory', 'confessed.split-it.reply'),
          effects: [
            { type: 'nuts', value: 12000 },
            { type: 'friendship', value: 12 },
            { type: 'setFlag', flagId: 'rizzo.accomplice' },
            {
              type: 'schedule',
              delaySeconds: 720,
              scheduleTitleKey: 'talk.consequence.audit.title',
              scheduleBodyKey: 'talk.consequence.audit.body',
              scheduled: [
                { type: 'reputation', value: -16 },
                { type: 'morale', value: -5 },
              ],
            },
          ],
        },
        {
          id: 'promote',
          tone: 'curious',
          labelKey: k('rizzo-inventory', 'confessed.promote.label'),
          replyKey: k('rizzo-inventory', 'confessed.promote.reply'),
          requires: { friendship: 50 },
          effects: [
            { type: 'friendship', value: 8 },
            { type: 'morale', value: 3 },
            { type: 'momentCard' },
            { type: 'setFlag', flagId: 'rizzo.promoted' },
          ],
        },
      ],
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Personal arcs, continued.                                                   */
/*                                                                            */
/* The catalogue had four universal topics and personal ones for exactly three  */
/* animals — Pip, Dorm and Rizzo. With a cast of 23 that meant twenty employees */
/* shared the same four conversations, so talking to the bear, the owl and the  */
/* octopus produced identical dialogue and the roster read as interchangeable   */
/* however distinct the artwork was.                                            */
/*                                                                            */
/* These are written to each animal's established role and voice (see           */
/* `employee.<id>.story` in the locales) rather than being generic lines with a  */
/* name swapped in. Breadth over volume: three authored topics, one of which is  */
/* only reachable because of a choice made in another, is worth more than fifty  */
/* interchangeable ones.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Moss, Night Operations & Observation. She notices what everyone else misses and
 * says so gently, which is what makes it unsettling.
 *
 * Step one of a two-part arc. Each option leaves a DIFFERENT mark, and only one of
 * them opens `MOSS_LEDGER` below — so the follow-up is a consequence of a specific
 * decision rather than a timer.
 */
const MOSS_COUNT: TalkTopic = {
  id: 'moss-count',
  employeeId: 'moss',
  titleKey: k('moss-count', 'title'),
  blurbKey: k('moss-count', 'blurb'),
  root: 'open',
  weight: 13,
  once: true,
  requires: { friendship: 30 },
  nodes: {
    open: {
      id: 'open',
      promptKey: k('moss-count', 'open.prompt'),
      choices: [
        {
          id: 'log',
          tone: 'curious',
          labelKey: k('moss-count', 'open.log.label'),
          replyKey: k('moss-count', 'open.log.reply'),
          // The only option that opens the follow-up. Filing it officially is what
          // gives the company something to later disagree with.
          effects: [
            { type: 'friendship', value: 7 },
            { type: 'reputation', value: 10 },
            { type: 'emotion', emotion: 'focused', durationSeconds: 900 },
            { type: 'setFlag', flagId: 'moss.counted' },
          ],
          next: 'filed',
        },
        {
          id: 'hush',
          tone: 'firm',
          labelKey: k('moss-count', 'open.hush.label'),
          replyKey: k('moss-count', 'open.hush.reply'),
          // Cheaper now, and it closes the door permanently: MOSS_LEDGER requires
          // the flag this option does not set.
          effects: [
            { type: 'friendship', value: -8 },
            { type: 'morale', value: -3 },
            { type: 'emotion', emotion: 'worried', durationSeconds: 1200 },
            { type: 'setFlag', flagId: 'moss.hushed' },
          ],
        },
        {
          id: 'join',
          tone: 'costly',
          labelKey: k('moss-count', 'open.join.label'),
          replyKey: k('moss-count', 'open.join.reply'),
          // Costs a night of production now and pays back later, in her company.
          effects: [
            { type: 'friendship', value: 14 },
            { type: 'productionBoost', value: 0.85, durationSeconds: 300 },
            { type: 'setFlag', flagId: 'moss.counted' },
            {
              type: 'schedule',
              delaySeconds: 720,
              scheduleTitleKey: 'talk.consequence.mossNight.title',
              scheduleBodyKey: 'talk.consequence.mossNight.body',
              scheduled: [
                { type: 'reputation', value: 16 },
                { type: 'goldenNuts', value: 2 },
                { type: 'momentCard' },
              ],
            },
          ],
          next: 'filed',
        },
      ],
    },
    filed: {
      id: 'filed',
      promptKey: k('moss-count', 'filed.prompt'),
      choices: [
        {
          id: 'thank',
          tone: 'warm',
          labelKey: k('moss-count', 'filed.thank.label'),
          replyKey: k('moss-count', 'filed.thank.reply'),
          effects: [
            { type: 'friendship', value: 5 },
            { type: 'morale', value: 3 },
          ],
        },
        {
          id: 'ask',
          tone: 'curious',
          labelKey: k('moss-count', 'filed.ask.label'),
          replyKey: k('moss-count', 'filed.ask.reply'),
          effects: [
            { type: 'friendship', value: 3 },
            { type: 'emotion', emotion: 'suspicious', durationSeconds: 900 },
          ],
        },
      ],
    },
  },
};

/**
 * The payoff. Reachable ONLY because the count was filed — the company has now
 * returned the paperwork with a different number on it, which is the sort of thing
 * Nutshell Inc. does without explaining itself.
 *
 * This is the arc the header of this file promised and nothing yet delivered: a
 * conversation that exists because of an earlier conversation.
 */
const MOSS_LEDGER: TalkTopic = {
  id: 'moss-ledger',
  employeeId: 'moss',
  titleKey: k('moss-ledger', 'title'),
  blurbKey: k('moss-ledger', 'blurb'),
  root: 'open',
  weight: 16,
  once: true,
  requires: { flag: 'moss.counted', friendship: 35 },
  nodes: {
    open: {
      id: 'open',
      promptKey: k('moss-ledger', 'open.prompt'),
      choices: [
        {
          id: 'accept',
          tone: 'firm',
          labelKey: k('moss-ledger', 'open.accept.label'),
          replyKey: k('moss-ledger', 'open.accept.reply'),
          // Taking the company's number is the profitable, slightly cowardly option.
          effects: [
            { type: 'reputation', value: 18 },
            { type: 'friendship', value: -6 },
            { type: 'emotion', emotion: 'tired', durationSeconds: 1200 },
            { type: 'setFlag', flagId: 'moss.acceptedRevision' },
          ],
        },
        {
          id: 'recount',
          tone: 'risky',
          labelKey: k('moss-ledger', 'open.recount.label'),
          replyKey: k('moss-ledger', 'open.recount.reply'),
          effects: [
            { type: 'goldenNuts', value: -2 },
            { type: 'friendship', value: 12 },
            { type: 'unlockSecret', secretId: 'memo.basement' },
            { type: 'momentCard' },
            { type: 'setFlag', flagId: 'moss.recounted' },
          ],
          requires: { goldenNuts: 2 },
          disabledKey: 'talk.req.goldenNuts',
        },
      ],
    },
  },
};

/**
 * Bia, Security & Facilities — the newest of the cast and the one who is told
 * things. Big paws, bigger heart, and a corridor she has been instructed to walk
 * past. Her arc is about whether the player backs their own security officer.
 */
const BIA_DOOR: TalkTopic = {
  id: 'bia-door',
  employeeId: 'bia',
  titleKey: k('bia-door', 'title'),
  blurbKey: k('bia-door', 'blurb'),
  root: 'open',
  weight: 13,
  once: true,
  requires: { friendship: 25 },
  nodes: {
    open: {
      id: 'open',
      promptKey: k('bia-door', 'open.prompt'),
      choices: [
        {
          id: 'back',
          tone: 'warm',
          labelKey: k('bia-door', 'open.back.label'),
          replyKey: k('bia-door', 'open.back.reply'),
          effects: [
            { type: 'friendship', value: 12 },
            { type: 'morale', value: 5 },
            { type: 'emotion', emotion: 'proud', durationSeconds: 900 },
            { type: 'setFlag', flagId: 'bia.backed' },
          ],
          next: 'settled',
        },
        {
          id: 'open-it',
          tone: 'risky',
          labelKey: k('bia-door', 'open.open-it.label'),
          replyKey: k('bia-door', 'open.open-it.reply'),
          // The interesting one: good for the company's standing now, and something
          // arrives later that nobody asked for.
          effects: [
            { type: 'reputation', value: 12 },
            { type: 'friendship', value: -4 },
            { type: 'setFlag', flagId: 'bia.openedTheDoor' },
            {
              type: 'schedule',
              delaySeconds: 840,
              scheduleTitleKey: 'talk.consequence.biaDoor.title',
              scheduleBodyKey: 'talk.consequence.biaDoor.body',
              scheduled: [
                { type: 'morale', value: -7 },
                { type: 'reputation', value: -6 },
                {
                  type: 'emotion',
                  employeeId: 'bia',
                  emotion: 'suspicious',
                  durationSeconds: 1800,
                },
                { type: 'momentCard' },
              ],
            },
          ],
          next: 'settled',
        },
        {
          id: 'seal',
          tone: 'firm',
          labelKey: k('bia-door', 'open.seal.label'),
          replyKey: k('bia-door', 'open.seal.reply'),
          effects: [
            { type: 'morale', value: 4 },
            { type: 'friendship', value: 6 },
            { type: 'setFlag', flagId: 'bia.sealed' },
          ],
          next: 'settled',
        },
      ],
    },
    settled: {
      id: 'settled',
      promptKey: k('bia-door', 'settled.prompt'),
      choices: [
        {
          id: 'snacks',
          tone: 'warm',
          labelKey: k('bia-door', 'settled.snacks.label'),
          replyKey: k('bia-door', 'settled.snacks.reply'),
          effects: [
            { type: 'nuts', value: -400 },
            { type: 'friendship', value: 8 },
            { type: 'morale', value: 4 },
            { type: 'emotion', emotion: 'happy', durationSeconds: 900 },
          ],
          requires: { nuts: 400 },
          disabledKey: 'talk.req.nuts',
        },
        {
          id: 'rounds',
          tone: 'firm',
          labelKey: k('bia-door', 'settled.rounds.label'),
          replyKey: k('bia-door', 'settled.rounds.reply'),
          effects: [
            { type: 'productionBoost', value: 1.2, durationSeconds: 600 },
            { type: 'friendship', value: 2 },
          ],
        },
      ],
    },
  },
};

export const EMPLOYEE_TALKS: readonly TalkTopic[] = [
  MOSS_LEDGER,
  LOW_MORALE,
  PIP_DOUBT,
  DORM_SLEEP,
  RIZZO_INVENTORY,
  MOSS_COUNT,
  BIA_DOOR,
  SUSPICIOUS_MEMO,
  CHECK_IN,
  GIFT,
  ...STORY_TALKS,
  ...KEEPSAKE_TALKS,
  ...ANNEX_TALKS,
];

export const TALKS_BY_ID: Record<string, TalkTopic> = Object.fromEntries(
  EMPLOYEE_TALKS.map((topic) => [topic.id, topic]),
);

/* -------------------------------------------------------------------------- */
/* The check-in, in each teammate's own words.                                 */
/*                                                                            */
/* "A quick word" is the conversation the whole cast shares, and it used to be  */
/* word for word the same from the bear, the owl and the octopus. It keeps its  */
/* shape (the same three openings, the same costs and consequences, so balance */
/* and old saves are untouched) but every line is now theirs, under            */
/* `checkin.<id>.*`: the small thing that bothers them, how they take praise,  */
/* how they take being pushed.                                                 */
/*                                                                            */
/* How they open reads the moment, best match first:                           */
/*   1. what happened since you last had this word: the promise that lapsed,   */
/*      the thing you fixed, the push, the praise (stamped per teammate)       */
/*   2. a low mood, the one their sticker is showing                           */
/*   3. the room: a room that clashes with their work, or their own department */
/*   4. otherwise, their ordinary hello                                        */
/* -------------------------------------------------------------------------- */

/** What the last check-in with someone left behind, for them to bring up. */
export type CheckInMemory = 'praised' | 'pushed' | 'fixed' | 'broken';

export function checkInMemoryFlag(employeeId: string, memory: CheckInMemory): string {
  return `${employeeId}.checkin.${memory}`;
}

/** Re-stamp a memory each time it happens, so "since we last spoke" stays true. */
function remember(employeeId: string, memory: CheckInMemory): EventEffect[] {
  const flagId = checkInMemoryFlag(employeeId, memory);
  return [
    { type: 'clearFlag', flagId },
    { type: 'setFlag', flagId },
  ];
}

/** The check-in as one particular teammate has it. */
function checkInTopicFor(employeeId: string): TalkTopic {
  const key = (rest: string) => `checkin.${employeeId}.${rest}`;
  const open = CHECK_IN.nodes.open;
  const listened = CHECK_IN.nodes.listened;
  const personal = (
    choice: TalkChoice,
    replyKey: string,
    extra: EventEffect[] = [],
    labelKey = choice.labelKey,
  ): TalkChoice => ({ ...choice, labelKey, replyKey, effects: [...choice.effects, ...extra] });
  const pick = (node: TalkNode, id: string) => node.choices.find((choice) => choice.id === id)!;
  const promise = pick(listened, 'promise');
  return {
    ...CHECK_IN,
    nodes: {
      open: {
        ...open,
        promptKey: key('open'),
        variants: [
          { since: checkInMemoryFlag(employeeId, 'broken'), promptKey: key('broken') },
          { since: checkInMemoryFlag(employeeId, 'fixed'), promptKey: key('fixed') },
          { since: checkInMemoryFlag(employeeId, 'pushed'), promptKey: key('pushed') },
          { since: checkInMemoryFlag(employeeId, 'praised'), promptKey: key('praised') },
          { lowMood: true, promptKey: key('down') },
          { affinity: 'disliked', promptKey: key('away') },
          { affinity: 'favorite', promptKey: key('home') },
        ],
        choices: [
          personal(pick(open, 'listen'), key('listen')),
          personal(pick(open, 'praise'), key('praise'), remember(employeeId, 'praised')),
          personal(pick(open, 'quota'), key('quota'), remember(employeeId, 'pushed')),
        ],
      },
      listened: {
        ...listened,
        promptKey: key('problem'),
        choices: [
          personal(
            pick(listened, 'fix'),
            key('fix'),
            remember(employeeId, 'fixed'),
            key('fixLabel'),
          ),
          {
            ...promise,
            replyKey: key('promise'),
            // The lapse is theirs to bring up: it lands with the consequence.
            effects: promise.effects.map((effect) =>
              effect.type === 'schedule'
                ? {
                    ...effect,
                    scheduled: [...(effect.scheduled ?? []), ...remember(employeeId, 'broken')],
                  }
                : effect,
            ),
          },
          personal(pick(listened, 'thanks'), key('thanks')),
        ],
      },
    },
  };
}

/** The gift topic as one particular teammate receives it. */
function giftTopicFor(employeeId: string): TalkTopic {
  return {
    ...GIFT,
    nodes: {
      open: {
        ...GIFT.nodes.open,
        choices: GIFT.nodes.open.choices.map((choice) => {
          const gift = choice.id as GiftId;
          const reaction = giftReaction(employeeId, gift);
          return {
            ...choice,
            replyKey: giftReplyKey(employeeId, reaction),
            effects: [
              ...choice.effects,
              ...REACTION_EFFECTS[reaction],
              // What you learned: how THIS teammate feels about THIS gift.
              { type: 'setFlag' as const, flagId: giftFlag(employeeId, gift) },
            ],
          };
        }),
      },
    },
  };
}

const topicCache = new Map<string, readonly TalkTopic[]>();

/** Every topic that could ever be offered to this employee, ignoring live state. */
export function topicsForEmployee(employeeId: string): readonly TalkTopic[] {
  const cached = topicCache.get(employeeId);
  if (cached) return cached;
  const personal = employeeId in CHARACTERS;
  const topics = EMPLOYEE_TALKS.filter((t) => !t.employeeId || t.employeeId === employeeId).map(
    (topic) =>
      topic.id === 'gift'
        ? giftTopicFor(employeeId)
        : topic.id === 'check-in' && personal
          ? checkInTopicFor(employeeId)
          : topic,
  );
  topicCache.set(employeeId, topics);
  return topics;
}
