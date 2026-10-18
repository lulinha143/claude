import { EMPLOYEES } from './employees';
import type { TalkTopic } from './employeeTalks';
import type { EventEffect } from './types';

// These are personal objects, not a second inventory. Spending time on one leaves
// a remembered choice, a modest consequence and a personnel note in the album.
// Costs stay within the early office economy; the alternative is always affordable.
//
// Each teammate has one (`favoriteItemKey`, drawn by art/KeepsakeArt). Talking
// about it leaves `favorite.<id>.cared` (you looked after it: it goes on their
// desk) or `favorite.<id>.discussed` (it stays put away until their story is
// told in full, which also puts it on the desk). sim/bonds.ts reads the rest.

/** The conversation about a teammate's keepsake. */
export function keepsakeTopicId(employeeId: string): string {
  return `keepsake-${employeeId}`;
}

/** What that conversation decided, as the mark it leaves. */
export type KeepsakeDecision = 'cared' | 'discussed';

export function keepsakeFlag(employeeId: string, decision: KeepsakeDecision): string {
  return `favorite.${employeeId}.${decision}`;
}

/** Which answer in the conversation leaves which mark. */
export const KEEPSAKE_ANSWER: Record<KeepsakeDecision, 'care' | 'other'> = {
  cared: 'care',
  discussed: 'other',
};
const outcomes: Record<string, { cost: number; care: EventEffect[]; other: EventEffect[] }> = {
  pip: {
    cost: 60,
    care: [
      { type: 'friendship', value: 7 },
      { type: 'emotion', emotion: 'inspired', durationSeconds: 600 },
    ],
    other: [
      { type: 'reputation', value: 3 },
      { type: 'friendship', value: -2 },
    ],
  },
  marlow: {
    cost: 120,
    care: [
      { type: 'morale', value: 6 },
      { type: 'friendship', value: 4 },
    ],
    other: [
      { type: 'friendship', value: -2 },
      { type: 'productionBoost', value: 1.08, durationSeconds: 180 },
    ],
  },
  rizzo: {
    cost: 80,
    care: [
      { type: 'friendship', value: 5 },
      { type: 'productionBoost', value: 1.12, durationSeconds: 180 },
    ],
    other: [
      { type: 'reputation', value: 4 },
      { type: 'emotion', emotion: 'suspicious', durationSeconds: 300 },
    ],
  },
  bea: {
    cost: 180,
    care: [
      { type: 'morale', value: 4 },
      { type: 'friendship', value: 6 },
    ],
    other: [
      { type: 'friendship', value: 3 },
      { type: 'setFlag', flagId: 'bea.savedPlank' },
    ],
  },
  corvus: {
    cost: 90,
    care: [
      { type: 'morale', value: 5 },
      { type: 'friendship', value: 2 },
    ],
    other: [
      { type: 'reputation', value: 6 },
      { type: 'morale', value: -3 },
    ],
  },
  mina: {
    cost: 200,
    care: [
      { type: 'friendship', value: 5 },
      { type: 'unlockSecret', secretId: 'memo.basement' },
    ],
    other: [
      { type: 'morale', value: 3 },
      { type: 'friendship', value: -2 },
    ],
  },
  nixie: {
    cost: 180,
    care: [
      { type: 'productionBoost', value: 1.15, durationSeconds: 240 },
      { type: 'friendship', value: 4 },
    ],
    other: [
      { type: 'friendship', employeeId: 'quincy', value: 4 },
      { type: 'reputation', value: 3 },
    ],
  },
  otto: {
    cost: 140,
    care: [
      { type: 'morale', value: 6 },
      { type: 'friendship', value: 5 },
    ],
    other: [
      { type: 'reputation', value: 3 },
      { type: 'friendship', value: -3 },
    ],
  },
  hazel: {
    cost: 100,
    care: [
      { type: 'morale', value: 5 },
      { type: 'friendship', value: 5 },
    ],
    other: [
      { type: 'reputation', value: 5 },
      { type: 'emotion', emotion: 'focused', durationSeconds: 300 },
    ],
  },
  junie: {
    cost: 240,
    care: [
      { type: 'friendship', value: 6 },
      { type: 'emotion', emotion: 'happy', durationSeconds: 600 },
    ],
    other: [
      { type: 'morale', value: 3 },
      { type: 'friendship', employeeId: 'nino', value: 3 },
    ],
  },
  moss: {
    cost: 110,
    care: [
      { type: 'friendship', value: 7 },
      { type: 'setFlag', flagId: 'moss.privateObservation' },
    ],
    other: [
      { type: 'reputation', value: 4 },
      { type: 'emotion', emotion: 'suspicious', durationSeconds: 480 },
    ],
  },
  fenn: {
    cost: 200,
    care: [
      { type: 'friendship', value: 5 },
      { type: 'reputation', value: 4 },
    ],
    other: [
      { type: 'morale', value: 2 },
      { type: 'friendship', value: 3 },
    ],
  },
  pingo: {
    cost: 130,
    care: [
      { type: 'morale', value: 4 },
      { type: 'friendship', value: 6 },
    ],
    other: [
      { type: 'productionBoost', value: 1.12, durationSeconds: 240 },
      { type: 'friendship', value: 1 },
    ],
  },
  canela: {
    cost: 90,
    care: [
      { type: 'morale', value: 5 },
      { type: 'friendship', value: 4 },
    ],
    other: [
      { type: 'reputation', value: 3 },
      { type: 'friendship', value: 3 },
    ],
  },
  nino: {
    cost: 50,
    care: [
      { type: 'emotion', emotion: 'happy', durationSeconds: 900 },
      { type: 'friendship', value: 4 },
    ],
    other: [
      { type: 'productionBoost', value: 1.1, durationSeconds: 180 },
      { type: 'friendship', employeeId: 'junie', value: 3 },
    ],
  },
  bia: {
    cost: 160,
    care: [
      { type: 'morale', value: 5 },
      { type: 'friendship', value: 5 },
    ],
    other: [
      { type: 'morale', value: 3 },
      { type: 'emotion', emotion: 'happy', durationSeconds: 300 },
    ],
  },
  quincy: {
    cost: 80,
    care: [
      { type: 'friendship', value: 6 },
      { type: 'morale', value: 3 },
    ],
    other: [
      { type: 'reputation', value: 4 },
      { type: 'friendship', value: 2 },
    ],
  },
  dorm: {
    cost: 120,
    care: [
      { type: 'friendship', value: 5 },
      { type: 'emotion', emotion: 'happy', durationSeconds: 900 },
    ],
    other: [
      { type: 'morale', value: 5 },
      { type: 'friendship', employeeId: 'marlow', value: 3 },
    ],
  },
  inky: {
    cost: 140,
    care: [
      { type: 'friendship', value: 6 },
      { type: 'productionBoost', value: 1.1, durationSeconds: 240 },
    ],
    other: [
      { type: 'setFlag', flagId: 'inky.buildingMail' },
      { type: 'emotion', emotion: 'suspicious', durationSeconds: 300 },
    ],
  },
  echo: {
    cost: 180,
    care: [
      { type: 'friendship', value: 6 },
      { type: 'morale', value: 3 },
    ],
    other: [
      { type: 'friendship', value: 4 },
      { type: 'setFlag', flagId: 'echo.recordedAnswer' },
    ],
  },
  rosa: {
    cost: 130,
    care: [
      { type: 'morale', value: 5 },
      { type: 'friendship', value: 4 },
    ],
    other: [
      { type: 'reputation', value: 4 },
      { type: 'friendship', value: 3 },
    ],
  },
  perry: {
    cost: 220,
    care: [
      { type: 'friendship', value: 6 },
      { type: 'reputation', value: 3 },
    ],
    other: [
      { type: 'setFlag', flagId: 'perry.outgoingFootprints' },
      { type: 'friendship', employeeId: 'rizzo', value: 3 },
    ],
  },
  axel: {
    cost: 100,
    care: [
      { type: 'morale', value: 4 },
      { type: 'friendship', value: 5 },
    ],
    other: [
      { type: 'friendship', value: 3 },
      { type: 'setFlag', flagId: 'axel.secondLabel' },
    ],
  },
};

export const KEEPSAKE_TALKS: readonly TalkTopic[] = EMPLOYEES.map((employee) => {
  const outcome = outcomes[employee.id];
  const prefix = `keepsake.${employee.id}`;
  return {
    id: keepsakeTopicId(employee.id),
    employeeId: employee.id,
    titleKey: employee.favoriteItemKey,
    blurbKey: `${prefix}.scene`,
    root: 'open',
    weight: 9,
    once: true,
    requires: { friendship: 20 },
    nodes: {
      open: {
        id: 'open',
        promptKey: `${prefix}.prompt`,
        choices: [
          {
            id: 'care',
            labelKey: `${prefix}.care.label`,
            replyKey: `${prefix}.care.reply`,
            requires: { nuts: outcome.cost },
            tone: 'costly',
            effects: [
              { type: 'nuts', value: -outcome.cost },
              ...outcome.care,
              { type: 'setFlag', flagId: keepsakeFlag(employee.id, 'cared') },
              { type: 'momentCard' },
            ],
          },
          {
            id: 'other',
            labelKey: `${prefix}.other.label`,
            replyKey: `${prefix}.other.reply`,
            tone: 'curious',
            effects: [
              ...outcome.other,
              { type: 'setFlag', flagId: keepsakeFlag(employee.id, 'discussed') },
              { type: 'momentCard' },
            ],
          },
        ],
      },
    },
  };
});
