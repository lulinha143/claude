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

export interface TalkNode {
  id: string;
  /** what the employee says on arriving at this node. */
  promptKey: string;
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

const GIFT: TalkTopic = {
  id: 'gift',
  titleKey: k('gift', 'title'),
  blurbKey: k('gift', 'blurb'),
  root: 'open',
  weight: 7,
  requires: { nuts: 500 },
  nodes: {
    open: {
      id: 'open',
      promptKey: k('gift', 'open.prompt'),
      choices: [
        {
          id: 'acorn',
          tone: 'costly',
          labelKey: k('gift', 'open.acorn.label'),
          replyKey: k('gift', 'open.acorn.reply'),
          requires: { nuts: 500 },
          effects: [
            { type: 'nuts', value: -500 },
            { type: 'friendship', value: 5 },
            { type: 'emotion', emotion: 'happy', durationSeconds: 300 },
          ],
        },
        {
          id: 'golden',
          tone: 'costly',
          labelKey: k('gift', 'open.golden.label'),
          replyKey: k('gift', 'open.golden.reply'),
          requires: { goldenNuts: 1 },
          // A genuinely expensive gift, and it reads that way: a lasting emotion
          // plus a durable mark that this employee was singled out.
          effects: [
            { type: 'goldenNuts', value: -1 },
            { type: 'friendship', value: 16 },
            { type: 'morale', value: 4 },
            { type: 'emotion', emotion: 'inspired', durationSeconds: 1200 },
            { type: 'setFlag', flagId: 'gift.golden' },
          ],
        },
        {
          id: 'coffee',
          tone: 'warm',
          labelKey: k('gift', 'open.coffee.label'),
          replyKey: k('gift', 'open.coffee.reply'),
          effects: [
            { type: 'friendship', value: 3 },
            { type: 'emotion', emotion: 'overcaffeinated', durationSeconds: 240 },
            { type: 'productionBoost', value: 1.08, durationSeconds: 240 },
          ],
        },
      ],
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

export const EMPLOYEE_TALKS: readonly TalkTopic[] = [
  LOW_MORALE,
  PIP_DOUBT,
  DORM_SLEEP,
  RIZZO_INVENTORY,
  SUSPICIOUS_MEMO,
  CHECK_IN,
  GIFT,
];

export const TALKS_BY_ID: Record<string, TalkTopic> = Object.fromEntries(
  EMPLOYEE_TALKS.map((topic) => [topic.id, topic]),
);

/** Every topic that could ever be offered to this employee, ignoring live state. */
export function topicsForEmployee(employeeId: string): readonly TalkTopic[] {
  return EMPLOYEE_TALKS.filter((t) => !t.employeeId || t.employeeId === employeeId);
}
