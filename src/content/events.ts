import type { EventChoice, GameEventDef } from './types';

export type EventFallbackKind = 'decline' | 'postpone';

/** Safe, localized paths used to repair malformed event content deterministically. */
export function createEventFallbackChoice(kind: EventFallbackKind): EventChoice {
  return kind === 'decline'
    ? {
        id: 'fallback-decline',
        labelKey: 'event.fallback.decline',
        effects: [
          { type: 'reputation', value: 1 },
          { type: 'morale', value: -1 },
        ],
        reactions: ['event.fallback.declineReaction'],
      }
    : {
        id: 'fallback-postpone',
        labelKey: 'event.fallback.postpone',
        effects: [
          { type: 'nuts', value: -10 },
          { type: 'morale', value: 2 },
        ],
        reactions: ['event.fallback.postponeReaction'],
      };
}

export interface EventContentRepair {
  eventId: string;
  step: string | null;
  reason: 'fewer-than-two' | 'duplicate-choice-id';
  originalChoiceCount: number;
}

// Data-driven random events. Every string is a localization key. The exported
// collection is normalized below so authored mistakes can never trap a player.
export const AUTHORED_GAME_EVENTS: GameEventDef[] = [
  {
    id: 'printer-demands',
    titleKey: 'event.printer.title',
    bodyKey: 'event.printer.body',
    rarity: 'uncommon',
    weight: 8,
    cooldownSeconds: 600,
    employeeId: null,
    momentWorthy: true,
    choices: [
      {
        id: 'negotiate',
        labelKey: 'event.printer.negotiate',
        effects: [{ type: 'morale', value: 5 }],
        next: 'peace',
      },
      {
        id: 'unplug',
        labelKey: 'event.printer.unplug',
        effects: [{ type: 'nuts', value: -50 }],
        next: 'revenge',
      },
    ],
    steps: {
      peace: {
        bodyKey: 'event.printer.peaceBody',
        choices: [
          {
            id: 'ok',
            labelKey: 'common.ok',
            effects: [{ type: 'productionBoost', value: 1.2, durationSeconds: 120 }],
          },
          createEventFallbackChoice('decline'),
        ],
      },
      revenge: {
        bodyKey: 'event.printer.revengeBody',
        choices: [
          {
            id: 'ok',
            labelKey: 'common.ok',
            effects: [{ type: 'morale', value: -3 }, { type: 'momentCard' }],
          },
          createEventFallbackChoice('decline'),
        ],
      },
    },
  },
  {
    id: 'nut-audit',
    titleKey: 'event.audit.title',
    bodyKey: 'event.audit.body',
    rarity: 'common',
    weight: 10,
    cooldownSeconds: 300,
    choices: [
      { id: 'comply', labelKey: 'event.audit.comply', effects: [{ type: 'reputation', value: 3 }] },
      {
        id: 'hide',
        labelKey: 'event.audit.hide',
        effects: [
          { type: 'nuts', value: 200 },
          { type: 'morale', value: -4 },
        ],
      },
    ],
  },
  {
    id: 'rizzo-found',
    titleKey: 'event.rizzoFound.title',
    bodyKey: 'event.rizzoFound.body',
    rarity: 'uncommon',
    weight: 7,
    cooldownSeconds: 480,
    requires: { hiredEmployee: 'rizzo' },
    employeeId: 'rizzo',
    momentWorthy: true,
    choices: [
      { id: 'inspect', labelKey: 'event.rizzoFound.inspect', effects: [], next: 'box' },
      {
        id: 'ignore',
        labelKey: 'event.rizzoFound.ignore',
        effects: [{ type: 'nuts', value: 100 }],
      },
    ],
    steps: {
      box: {
        bodyKey: 'event.rizzoFound.boxBody',
        choices: [
          {
            id: 'open',
            labelKey: 'event.rizzoFound.open',
            effects: [
              { type: 'goldenNuts', value: 1 },
              { type: 'collectNut', nutId: 'suspicious-pistachio' },
              { type: 'momentCard' },
            ],
          },
          {
            id: 'return',
            labelKey: 'event.rizzoFound.return',
            effects: [
              { type: 'reputation', value: 5 },
              { type: 'friendship', value: 8, employeeId: 'rizzo' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'mandatory-optional-meeting',
    titleKey: 'event.meeting.title',
    bodyKey: 'event.meeting.body',
    rarity: 'common',
    weight: 9,
    cooldownSeconds: 300,
    choices: [
      {
        id: 'attend',
        labelKey: 'event.meeting.attend',
        effects: [
          { type: 'morale', value: -2 },
          { type: 'reputation', value: 2 },
        ],
      },
      {
        id: 'skip',
        labelKey: 'event.meeting.skip',
        effects: [{ type: 'productionBoost', value: 1.15, durationSeconds: 90 }],
      },
    ],
  },
  {
    id: 'coffee-consciousness',
    titleKey: 'event.coffeeAI.title',
    bodyKey: 'event.coffeeAI.body',
    rarity: 'rare',
    weight: 4,
    cooldownSeconds: 900,
    momentWorthy: true,
    choices: [
      {
        id: 'befriend',
        labelKey: 'event.coffeeAI.befriend',
        effects: [{ type: 'morale', value: 10 }, { type: 'momentCard' }],
        reactions: ['react.teamHappy', 'react.beaConcerned'],
      },
      {
        id: 'unplug',
        labelKey: 'event.coffeeAI.unplug',
        effects: [{ type: 'nuts', value: 500 }],
        reactions: ['react.teamNervous'],
      },
    ],
  },
  {
    id: 'pie-chart',
    titleKey: 'event.pieChart.title',
    bodyKey: 'event.pieChart.body',
    rarity: 'common',
    weight: 9,
    cooldownSeconds: 300,
    employeeId: 'pip',
    choices: [
      {
        id: 'applaud',
        labelKey: 'event.pieChart.applaud',
        effects: [
          { type: 'friendship', value: 5, employeeId: 'pip' },
          { type: 'morale', value: 3 },
        ],
      },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'pigeon',
    titleKey: 'event.pigeon.title',
    bodyKey: 'event.pigeon.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 400,
    choices: [
      { id: 'shoo', labelKey: 'event.pigeon.shoo', effects: [{ type: 'morale', value: 2 }] },
      {
        id: 'hire',
        labelKey: 'event.pigeon.hire',
        effects: [
          { type: 'productionBoost', value: 1.25, durationSeconds: 120 },
          { type: 'momentCard' },
        ],
      },
    ],
  },
  {
    id: 'bea-wood',
    titleKey: 'event.beaWood.title',
    bodyKey: 'event.beaWood.body',
    rarity: 'common',
    weight: 8,
    cooldownSeconds: 360,
    requires: { hiredEmployee: 'bea' },
    employeeId: 'bea',
    choices: [
      {
        id: 'approve',
        labelKey: 'event.beaWood.approve',
        effects: [
          { type: 'morale', value: 4 },
          { type: 'friendship', value: 6, employeeId: 'bea' },
          { type: 'emotion', employeeId: 'bea', emotion: 'proud', durationSeconds: 600 },
        ],
      },
      {
        id: 'decline',
        labelKey: 'event.beaWood.decline',
        effects: [
          { type: 'nuts', value: 150 },
          { type: 'emotion', employeeId: 'bea', emotion: 'sad', durationSeconds: 480 },
        ],
      },
    ],
  },
  {
    id: 'technically-on-fire',
    titleKey: 'event.fire.title',
    bodyKey: 'event.fire.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 600,
    momentWorthy: true,
    choices: [
      {
        id: 'evacuate',
        labelKey: 'event.fire.evacuate',
        effects: [
          { type: 'morale', value: 3 },
          { type: 'nuts', value: -50 },
        ],
        reactions: ['react.marlowCalm'],
      },
      {
        id: 'contain',
        labelKey: 'event.fire.contain',
        effects: [
          { type: 'reputation', value: 3 },
          { type: 'morale', value: 1 },
        ],
        requires: { hiredEmployee: 'bea' },
        disabledKey: 'event.fire.needBea',
        reactions: ['react.beaProud'],
      },
      {
        id: 'livestream',
        labelKey: 'event.fire.livestream',
        effects: [
          { type: 'nuts', value: 400 },
          { type: 'reputation', value: -2 },
          { type: 'productionBoost', value: 1.3, durationSeconds: 90 },
          { type: 'momentCard' },
        ],
        reactions: ['react.corvusExcited', 'react.teamNervous'],
      },
      {
        id: 'study',
        labelKey: 'event.fire.study',
        effects: [
          { type: 'goldenNuts', value: 1 },
          { type: 'unlockSecret', secretId: 'fire-science' },
        ],
        reactions: ['react.minaCurious'],
      },
    ],
  },
  {
    id: 'casual-friday',
    titleKey: 'event.casualFriday.title',
    bodyKey: 'event.casualFriday.body',
    rarity: 'common',
    weight: 7,
    cooldownSeconds: 500,
    choices: [
      { id: 'ok', labelKey: 'common.ok', effects: [{ type: 'morale', value: 5 }] },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'corvus-nutcoin',
    titleKey: 'event.nutcoin.title',
    bodyKey: 'event.nutcoin.body',
    rarity: 'rare',
    weight: 3,
    cooldownSeconds: 1200,
    requires: { hiredEmployee: 'corvus' },
    employeeId: 'corvus',
    momentWorthy: true,
    choices: [
      {
        id: 'invest',
        labelKey: 'event.nutcoin.invest',
        effects: [
          { type: 'nuts', value: -500 },
          { type: 'emotion', employeeId: 'corvus', emotion: 'excited', durationSeconds: 600 },
          { type: 'emotion', employeeId: 'marlow', emotion: 'embarrassed', durationSeconds: 600 },
        ],
        next: 'crash',
      },
      {
        id: 'refuse',
        labelKey: 'event.nutcoin.refuse',
        effects: [
          { type: 'reputation', value: 4 },
          { type: 'unlockSecret', secretId: 'nutcoin' },
        ],
      },
    ],
    steps: {
      crash: {
        bodyKey: 'event.nutcoin.crashBody',
        choices: [
          {
            id: 'sigh',
            labelKey: 'event.nutcoin.sigh',
            effects: [
              { type: 'morale', value: -3 },
              { type: 'unlockSecret', secretId: 'nutcoin' },
              { type: 'momentCard' },
            ],
          },
          createEventFallbackChoice('decline'),
        ],
      },
    },
  },
  {
    id: 'mina-basement',
    titleKey: 'event.minaBasement.title',
    bodyKey: 'event.minaBasement.body',
    rarity: 'rare',
    weight: 3,
    cooldownSeconds: 1200,
    requires: { hiredEmployee: 'mina' },
    employeeId: 'mina',
    momentWorthy: true,
    choices: [
      { id: 'follow', labelKey: 'event.minaBasement.follow', effects: [], next: 'deep' },
      {
        id: 'stay',
        labelKey: 'event.minaBasement.stay',
        effects: [
          { type: 'nuts', value: 300 },
          // Ignoring Mina's discovery has a real cost: she's frustrated for a
          // while and morale dips (brief §4 — stronger negative consequences).
          { type: 'emotion', employeeId: 'mina', emotion: 'frustrated', durationSeconds: 480 },
          { type: 'morale', value: -6 },
        ],
      },
    ],
    steps: {
      deep: {
        bodyKey: 'event.minaBasement.deepBody',
        choices: [
          {
            id: 'dig',
            labelKey: 'event.minaBasement.dig',
            effects: [
              { type: 'goldenNuts', value: 2 },
              { type: 'unlockSecret', secretId: 'basement-basement' },
              { type: 'emotion', employeeId: 'mina', emotion: 'inspired', durationSeconds: 600 },
              { type: 'emotion', employeeId: 'bea', emotion: 'worried', durationSeconds: 600 },
              { type: 'momentCard' },
            ],
          },
          {
            id: 'back',
            labelKey: 'event.minaBasement.back',
            effects: [{ type: 'reputation', value: 6 }],
          },
        ],
      },
    },
  },
  {
    id: 'golden-acorn',
    titleKey: 'event.goldenAcorn.title',
    bodyKey: 'event.goldenAcorn.body',
    rarity: 'legendary',
    weight: 1,
    cooldownSeconds: 1800,
    momentWorthy: true,
    choices: [
      {
        id: 'grab',
        labelKey: 'event.goldenAcorn.grab',
        effects: [
          { type: 'goldenNuts', value: 3 },
          { type: 'collectNut', nutId: 'executive-hazelnut' },
          { type: 'momentCard' },
        ],
      },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'employee-of-minute',
    titleKey: 'event.employeeMinute.title',
    bodyKey: 'event.employeeMinute.body',
    rarity: 'common',
    weight: 8,
    cooldownSeconds: 400,
    choices: [
      {
        id: 'celebrate',
        labelKey: 'event.employeeMinute.celebrate',
        effects: [
          { type: 'morale', value: 4 },
          { type: 'friendship', value: 4 },
        ],
      },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'reply-all',
    titleKey: 'event.replyAll.title',
    bodyKey: 'event.replyAll.body',
    rarity: 'common',
    weight: 7,
    cooldownSeconds: 400,
    choices: [
      {
        id: 'apologize',
        labelKey: 'event.replyAll.apologize',
        effects: [{ type: 'morale', value: -1 }],
      },
      {
        id: 'double-down',
        labelKey: 'event.replyAll.doubleDown',
        effects: [
          { type: 'reputation', value: -1 },
          { type: 'morale', value: 3 },
        ],
      },
    ],
  },
  {
    id: 'chair-promoted',
    titleKey: 'event.chairPromoted.title',
    bodyKey: 'event.chairPromoted.body',
    rarity: 'rare',
    weight: 3,
    cooldownSeconds: 1000,
    momentWorthy: true,
    choices: [
      {
        id: 'approve',
        labelKey: 'event.chairPromoted.approve',
        effects: [
          { type: 'unlockSecret', secretId: 'chair' },
          { type: 'morale', value: 5 },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamHappy', 'react.pipProud'],
      },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'small-merger',
    titleKey: 'event.merger.title',
    bodyKey: 'event.merger.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 700,
    requires: { reputation: 40 },
    choices: [
      {
        id: 'accept',
        labelKey: 'event.merger.accept',
        effects: [
          { type: 'nuts', value: 1000 },
          { type: 'reputation', value: 5 },
        ],
      },
      { id: 'reject', labelKey: 'event.merger.reject', effects: [{ type: 'morale', value: 4 }] },
    ],
  },
  {
    id: 'stapler-disappearance',
    titleKey: 'event.stapler.title',
    bodyKey: 'event.stapler.body',
    rarity: 'common',
    weight: 7,
    cooldownSeconds: 400,
    choices: [
      {
        id: 'investigate',
        labelKey: 'event.stapler.investigate',
        effects: [{ type: 'reputation', value: 1 }],
      },
      { id: 'shrug', labelKey: 'event.stapler.shrug', effects: [{ type: 'morale', value: 1 }] },
    ],
  },
  {
    id: 'meeting-about-meetings',
    titleKey: 'event.metaMeeting.title',
    bodyKey: 'event.metaMeeting.body',
    rarity: 'common',
    weight: 6,
    cooldownSeconds: 500,
    employeeId: 'pip',
    choices: [
      {
        id: 'endure',
        labelKey: 'event.metaMeeting.endure',
        effects: [
          { type: 'morale', value: -2 },
          { type: 'productionBoost', value: 1.1, durationSeconds: 60 },
        ],
      },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'union-snacks',
    titleKey: 'event.union.title',
    bodyKey: 'event.union.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 700,
    choices: [
      {
        id: 'grant',
        labelKey: 'event.union.grant',
        effects: [
          { type: 'nuts', value: -300 },
          { type: 'morale', value: 10 },
        ],
      },
      {
        id: 'negotiate',
        labelKey: 'event.union.negotiate',
        effects: [{ type: 'morale', value: 4 }],
      },
    ],
  },
  {
    id: 'pip-mascot',
    titleKey: 'event.mascot.title',
    bodyKey: 'event.mascot.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 700,
    employeeId: 'pip',
    momentWorthy: true,
    choices: [
      {
        id: 'approve',
        labelKey: 'event.mascot.approve',
        effects: [{ type: 'reputation', value: 3 }, { type: 'momentCard' }],
      },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'mysterious-walnut',
    titleKey: 'event.walnut.title',
    bodyKey: 'event.walnut.body',
    rarity: 'rare',
    weight: 3,
    cooldownSeconds: 900,
    choices: [
      {
        id: 'eat',
        labelKey: 'event.walnut.eat',
        effects: [
          { type: 'collectNut', nutId: 'legally-distinct-walnut' },
          { type: 'goldenNuts', value: 1 },
        ],
      },
      { id: 'study', labelKey: 'event.walnut.study', effects: [{ type: 'reputation', value: 4 }] },
    ],
  },
  {
    id: 'bring-human',
    titleKey: 'event.human.title',
    bodyKey: 'event.human.body',
    rarity: 'uncommon',
    weight: 4,
    cooldownSeconds: 800,
    momentWorthy: true,
    choices: [
      {
        id: 'wave',
        labelKey: 'event.human.wave',
        effects: [{ type: 'morale', value: 6 }, { type: 'momentCard' }],
      },
      createEventFallbackChoice('decline'),
    ],
  },
  {
    id: 'spreadsheet',
    titleKey: 'event.spreadsheet.title',
    bodyKey: 'event.spreadsheet.body',
    rarity: 'rare',
    weight: 2,
    cooldownSeconds: 1500,
    momentWorthy: true,
    choices: [
      { id: 'ask', labelKey: 'event.spreadsheet.ask', effects: [], next: 'answer' },
      {
        id: 'close',
        labelKey: 'event.spreadsheet.close',
        effects: [{ type: 'morale', value: -1 }],
      },
    ],
    steps: {
      answer: {
        bodyKey: 'event.spreadsheet.answerBody',
        choices: [
          {
            id: 'accept',
            labelKey: 'event.spreadsheet.accept',
            effects: [
              { type: 'unlockSecret', secretId: 'spreadsheet' },
              { type: 'goldenNuts', value: 1 },
              { type: 'momentCard' },
            ],
          },
          createEventFallbackChoice('decline'),
        ],
      },
    },
  },
  {
    id: 'existential-crisis',
    titleKey: 'event.existential.title',
    bodyKey: 'event.existential.body',
    rarity: 'uncommon',
    weight: 4,
    cooldownSeconds: 800,
    choices: [
      {
        id: 'reflect',
        labelKey: 'event.existential.reflect',
        effects: [{ type: 'morale', value: 3 }],
      },
      {
        id: 'work',
        labelKey: 'event.existential.work',
        effects: [{ type: 'productionBoost', value: 1.2, durationSeconds: 120 }],
      },
    ],
  },
  {
    id: 'sunglasses-day',
    titleKey: 'event.sunglasses.title',
    bodyKey: 'event.sunglasses.body',
    rarity: 'rare',
    weight: 2,
    cooldownSeconds: 1500,
    momentWorthy: true,
    choices: [
      {
        id: 'cool',
        labelKey: 'event.sunglasses.cool',
        effects: [{ type: 'morale', value: 8 }, { type: 'momentCard' }],
      },
      createEventFallbackChoice('decline'),
    ],
  },

  // ======================================================================
  // Second wave: employee story chains + more absurd office events
  // ======================================================================

  // --- Nixie (mouse / IT): a two-step machine chain ---
  {
    id: 'nixie-machine',
    titleKey: 'event.nixieMachine.title',
    bodyKey: 'event.nixieMachine.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 600,
    requires: { hiredEmployee: 'nixie' },
    employeeId: 'nixie',
    momentWorthy: true,
    choices: [
      {
        id: 'trust',
        labelKey: 'event.nixieMachine.trust',
        effects: [],
        next: 'whir',
        reactions: ['react.nixieProud'],
      },
      {
        id: 'unplug',
        labelKey: 'event.nixieMachine.unplug',
        effects: [
          { type: 'morale', value: -2 },
          { type: 'nuts', value: 200 },
        ],
        reactions: ['react.nixieProud'],
      },
    ],
    steps: {
      whir: {
        bodyKey: 'event.nixieMachine.whirBody',
        choices: [
          {
            id: 'ship',
            labelKey: 'event.nixieMachine.ship',
            effects: [
              { type: 'productionBoost', value: 1.4, durationSeconds: 180 },
              { type: 'momentCard' },
            ],
            reactions: ['react.nixieProud', 'react.teamHappy'],
          },
          {
            id: 'recall',
            labelKey: 'event.nixieMachine.recall',
            effects: [{ type: 'reputation', value: 5 }],
            reactions: ['react.hazelApproves'],
          },
        ],
      },
    },
  },

  // --- Otto (otter / finance) ---
  {
    id: 'otto-audit',
    titleKey: 'event.ottoAudit.title',
    bodyKey: 'event.ottoAudit.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 500,
    requires: { hiredEmployee: 'otto' },
    employeeId: 'otto',
    choices: [
      {
        id: 'investigate',
        labelKey: 'event.ottoAudit.investigate',
        effects: [
          { type: 'goldenNuts', value: 1 },
          { type: 'reputation', value: 3 },
        ],
        reactions: ['react.ottoDistracted'],
      },
      {
        id: 'ignore',
        labelKey: 'event.ottoAudit.ignore',
        effects: [
          { type: 'nuts', value: 500 },
          { type: 'morale', value: -2 },
        ],
        reactions: ['react.hazelApproves'],
      },
      {
        id: 'frame',
        labelKey: 'event.ottoAudit.frame',
        effects: [
          { type: 'morale', value: 4 },
          { type: 'unlockSecret', secretId: 'negative-nut' },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamHappy'],
      },
    ],
  },

  // --- Hazel (hedgehog / legal) ---
  {
    id: 'hazel-loophole',
    titleKey: 'event.hazelLoophole.title',
    bodyKey: 'event.hazelLoophole.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 600,
    requires: { hiredEmployee: 'hazel' },
    employeeId: 'hazel',
    momentWorthy: true,
    choices: [
      {
        id: 'redesign',
        labelKey: 'event.hazelLoophole.redesign',
        effects: [
          { type: 'nuts', value: -400 },
          { type: 'reputation', value: 6 },
        ],
        reactions: ['react.hazelApproves', 'react.corvusExcited'],
      },
      {
        id: 'fight',
        labelKey: 'event.hazelLoophole.fight',
        effects: [
          { type: 'morale', value: 5 },
          { type: 'unlockSecret', secretId: 'too-round' },
          { type: 'momentCard' },
        ],
        reactions: ['react.hazelApproves'],
      },
      {
        id: 'squares',
        labelKey: 'event.hazelLoophole.squares',
        effects: [
          { type: 'reputation', value: -2 },
          { type: 'nuts', value: 300 },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },

  // --- Junie (rabbit / logistics) ---
  {
    id: 'junie-schedule',
    titleKey: 'event.junieSchedule.title',
    bodyKey: 'event.junieSchedule.body',
    rarity: 'common',
    weight: 8,
    cooldownSeconds: 420,
    requires: { hiredEmployee: 'junie' },
    employeeId: 'junie',
    choices: [
      {
        id: 'protect-nap',
        labelKey: 'event.junieSchedule.protectNap',
        effects: [{ type: 'morale', value: 6 }],
        reactions: ['react.marlowCalm', 'react.teamHappy'],
      },
      {
        id: 'hold-meeting',
        labelKey: 'event.junieSchedule.holdMeeting',
        effects: [
          { type: 'productionBoost', value: 1.15, durationSeconds: 120 },
          { type: 'morale', value: -3 },
        ],
        reactions: ['react.junieReady', 'react.teamNervous'],
      },
    ],
  },

  // --- Moss (owl / night ops): a two-step prophecy chain ---
  {
    id: 'moss-night',
    titleKey: 'event.mossNight.title',
    bodyKey: 'event.mossNight.body',
    rarity: 'rare',
    weight: 4,
    cooldownSeconds: 900,
    requires: { hiredEmployee: 'moss' },
    employeeId: 'moss',
    momentWorthy: true,
    choices: [
      {
        id: 'listen',
        labelKey: 'event.mossNight.listen',
        effects: [],
        next: 'omen',
        reactions: ['react.mossKnowing'],
      },
      {
        id: 'dismiss',
        labelKey: 'event.mossNight.dismiss',
        effects: [{ type: 'nuts', value: 300 }],
      },
    ],
    steps: {
      omen: {
        bodyKey: 'event.mossNight.omenBody',
        choices: [
          {
            id: 'invest',
            labelKey: 'event.mossNight.invest',
            effects: [
              { type: 'goldenNuts', value: 2 },
              { type: 'reputation', value: 4 },
              { type: 'momentCard' },
            ],
            reactions: ['react.mossKnowing', 'react.fennGrin'],
          },
          {
            id: 'record',
            labelKey: 'event.mossNight.record',
            effects: [
              { type: 'unlockSecret', secretId: 'wind-chime' },
              { type: 'reputation', value: 6 },
            ],
            reactions: ['react.minaCurious'],
          },
        ],
      },
    },
  },

  // --- Fenn (fox / sales) ---
  {
    id: 'fenn-deal',
    titleKey: 'event.fennDeal.title',
    bodyKey: 'event.fennDeal.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 500,
    requires: { hiredEmployee: 'fenn' },
    employeeId: 'fenn',
    choices: [
      {
        id: 'refund',
        labelKey: 'event.fennDeal.refund',
        effects: [
          { type: 'nuts', value: -600 },
          { type: 'reputation', value: 8 },
        ],
        reactions: ['react.fennGrin', 'react.hazelApproves'],
      },
      {
        id: 'upsell',
        labelKey: 'event.fennDeal.upsell',
        effects: [
          { type: 'nuts', value: 1200 },
          { type: 'reputation', value: -3 },
        ],
        reactions: ['react.fennGrin', 'react.teamNervous'],
      },
      {
        id: 'walnuts',
        labelKey: 'event.fennDeal.walnuts',
        effects: [
          { type: 'collectNut', nutId: 'legally-distinct-walnut' },
          { type: 'morale', value: 3 },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamHappy'],
      },
    ],
  },

  // --- absurd standalone events ---
  {
    id: 'break-room-independence',
    titleKey: 'event.breakRoom.title',
    bodyKey: 'event.breakRoom.body',
    rarity: 'rare',
    weight: 3,
    cooldownSeconds: 1000,
    momentWorthy: true,
    choices: [
      { id: 'negotiate', labelKey: 'event.breakRoom.negotiate', effects: [], next: 'treaty' },
      {
        id: 'annex',
        labelKey: 'event.breakRoom.annex',
        effects: [
          { type: 'morale', value: -6 },
          { type: 'nuts', value: 400 },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
    steps: {
      treaty: {
        bodyKey: 'event.breakRoom.treatyBody',
        choices: [
          {
            id: 'sign',
            labelKey: 'event.breakRoom.sign',
            effects: [
              { type: 'morale', value: 8 },
              { type: 'unlockSecret', secretId: 'break-room-nation' },
              { type: 'momentCard' },
            ],
            reactions: ['react.marlowApproves', 'react.hazelApproves'],
          },
          createEventFallbackChoice('decline'),
        ],
      },
    },
  },
  {
    id: 'acorn-water',
    titleKey: 'event.acornWater.title',
    bodyKey: 'event.acornWater.body',
    rarity: 'common',
    weight: 7,
    cooldownSeconds: 400,
    choices: [
      {
        id: 'drink',
        labelKey: 'event.acornWater.drink',
        effects: [
          { type: 'morale', value: -4 },
          { type: 'productionBoost', value: 1.2, durationSeconds: 90 },
        ],
        reactions: ['react.teamNervous'],
      },
      {
        id: 'replace',
        labelKey: 'event.acornWater.replace',
        effects: [{ type: 'morale', value: 4 }],
        reactions: ['react.teamHappy'],
      },
    ],
  },
  {
    id: 'seventeen-staplers',
    titleKey: 'event.staplers17.title',
    bodyKey: 'event.staplers17.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 700,
    requires: { hiredEmployee: 'rizzo' },
    employeeId: 'rizzo',
    momentWorthy: true,
    choices: [
      {
        id: 'return',
        labelKey: 'event.staplers17.return',
        effects: [{ type: 'reputation', value: 3 }],
        reactions: ['react.hazelApproves'],
      },
      {
        id: 'keep',
        labelKey: 'event.staplers17.keep',
        effects: [
          { type: 'nuts', value: 250 },
          { type: 'friendship', value: 6, employeeId: 'rizzo' },
        ],
        reactions: ['react.rizzoSuspicious'],
      },
    ],
  },
  {
    id: 'sideways-elevator',
    titleKey: 'event.elevator.title',
    bodyKey: 'event.elevator.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 600,
    choices: [
      {
        id: 'fix',
        labelKey: 'event.elevator.fix',
        effects: [
          { type: 'nuts', value: -300 },
          { type: 'morale', value: 3 },
        ],
        reactions: ['react.beaProud'],
      },
      {
        id: 'embrace',
        labelKey: 'event.elevator.embrace',
        effects: [
          { type: 'morale', value: 5 },
          { type: 'unlockSecret', secretId: 'sideways' },
        ],
        reactions: ['react.teamHappy'],
      },
    ],
  },
  {
    id: 'vault-humming',
    titleKey: 'event.vaultHum.title',
    bodyKey: 'event.vaultHum.body',
    rarity: 'rare',
    weight: 3,
    cooldownSeconds: 1000,
    requires: { reputation: 60 },
    momentWorthy: true,
    choices: [
      {
        id: 'investigate',
        labelKey: 'event.vaultHum.investigate',
        effects: [{ type: 'goldenNuts', value: 2 }, { type: 'momentCard' }],
        reactions: ['react.minaCurious'],
      },
      {
        id: 'harmonize',
        labelKey: 'event.vaultHum.harmonize',
        effects: [{ type: 'morale', value: 7 }],
        reactions: ['react.teamHappy'],
      },
    ],
  },
  {
    id: 'fake-award',
    titleKey: 'event.fakeAward.title',
    bodyKey: 'event.fakeAward.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 700,
    choices: [
      {
        id: 'accept',
        labelKey: 'event.fakeAward.accept',
        effects: [
          { type: 'reputation', value: 5 },
          { type: 'morale', value: 4 },
          { type: 'momentCard' },
        ],
        reactions: ['react.corvusExcited', 'react.pipProud'],
      },
      {
        id: 'decline',
        labelKey: 'event.fakeAward.decline',
        effects: [{ type: 'reputation', value: 2 }],
        reactions: ['react.hazelApproves'],
      },
    ],
  },
  {
    id: 'stolen-slogan',
    titleKey: 'event.slogan.title',
    bodyKey: 'event.slogan.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 700,
    choices: [
      {
        id: 'sue',
        labelKey: 'event.slogan.sue',
        effects: [
          { type: 'reputation', value: 4 },
          { type: 'nuts', value: -200 },
        ],
        reactions: ['react.hazelApproves'],
      },
      {
        id: 'rebrand',
        labelKey: 'event.slogan.rebrand',
        effects: [{ type: 'productionBoost', value: 1.2, durationSeconds: 120 }],
        reactions: ['react.corvusExcited'],
      },
      {
        id: 'petty',
        labelKey: 'event.slogan.petty',
        effects: [
          { type: 'morale', value: 5 },
          { type: 'reputation', value: -1 },
        ],
        reactions: ['react.teamHappy'],
      },
    ],
  },
  {
    id: 'named-nuts',
    titleKey: 'event.namedNuts.title',
    bodyKey: 'event.namedNuts.body',
    rarity: 'common',
    weight: 6,
    cooldownSeconds: 500,
    choices: [
      {
        id: 'allow',
        labelKey: 'event.namedNuts.allow',
        effects: [
          { type: 'morale', value: 5 },
          { type: 'productionBoost', value: 0.9, durationSeconds: 60 },
        ],
        reactions: ['react.teamHappy'],
      },
      {
        id: 'forbid',
        labelKey: 'event.namedNuts.forbid',
        effects: [
          { type: 'productionBoost', value: 1.1, durationSeconds: 60 },
          { type: 'morale', value: -2 },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },
  {
    id: 'office-ghost',
    titleKey: 'event.ghost.title',
    bodyKey: 'event.ghost.body',
    rarity: 'rare',
    weight: 2,
    cooldownSeconds: 1200,
    momentWorthy: true,
    choices: [
      {
        id: 'grant',
        labelKey: 'event.ghost.grant',
        effects: [
          { type: 'nuts', value: -300 },
          { type: 'morale', value: 8 },
          { type: 'unlockSecret', secretId: 'ghost' },
          { type: 'momentCard' },
        ],
        reactions: ['react.marlowApproves'],
      },
      {
        id: 'deny',
        labelKey: 'event.ghost.deny',
        effects: [{ type: 'morale', value: -4 }],
        reactions: ['react.teamNervous'],
      },
    ],
  },
  {
    id: 'coffee-leave',
    titleKey: 'event.coffeeLeave.title',
    bodyKey: 'event.coffeeLeave.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 800,
    choices: [
      {
        id: 'approve',
        labelKey: 'event.coffeeLeave.approve',
        effects: [
          { type: 'morale', value: 6 },
          { type: 'productionBoost', value: 0.85, durationSeconds: 90 },
        ],
        reactions: ['react.marlowApproves'],
      },
      {
        id: 'deny',
        labelKey: 'event.coffeeLeave.deny',
        effects: [
          { type: 'productionBoost', value: 1.15, durationSeconds: 90 },
          { type: 'morale', value: -3 },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },

  // ==========================================================================
  //  CONSEQUENCE-MEMORY CONTENT
  // ==========================================================================
  // These events use the three systems that let choices become stories rather
  // than stat buttons:
  //
  //   `setFlag`   — leave a durable mark on the save.
  //   `requires.flag` / `missingFlag` — content that only exists BECAUSE of an
  //                 earlier decision, so a callback can only reach a player who
  //                 actually earned it.
  //   `schedule`  — bill the company later, so "take the money" is a real
  //                 gamble instead of free value.
  //
  // Situational gates (`moraleBelow`, `moraleAbove`, `room`) keep them in
  // context: a morale crisis only turns up when there is one.

  // --- The audit favour: a three-step chain that leaves a lasting debt --------
  {
    id: 'ledger-discrepancy',
    titleKey: 'event.ledgerDiscrepancy.title',
    bodyKey: 'event.ledgerDiscrepancy.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 1400,
    requires: { room: 'procurement', missingFlag: 'accountant-favour' },
    momentWorthy: true,
    choices: [
      {
        id: 'report',
        labelKey: 'event.ledgerDiscrepancy.report',
        effects: [
          { type: 'reputation', value: 8 },
          { type: 'nuts', value: -400 },
          { type: 'setFlag', flagId: 'ledger-reported' },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'quiet',
        labelKey: 'event.ledgerDiscrepancy.quiet',
        // No immediate effect: this branch exists to open the next step.
        effects: [],
        next: 'accountant',
      },
    ],
    steps: {
      accountant: {
        bodyKey: 'event.ledgerDiscrepancy.accountantBody',
        choices: [
          {
            id: 'pay',
            labelKey: 'event.ledgerDiscrepancy.pay',
            requires: { nuts: 1200 },
            disabledKey: 'event.ledgerDiscrepancy.payLocked',
            effects: [
              { type: 'nuts', value: -1200 },
              // The favour is the point: it unlocks a callback event later.
              { type: 'setFlag', flagId: 'accountant-favour' },
              { type: 'momentCard' },
            ],
            reactions: ['react.ottoImpressed'],
          },
          {
            id: 'refuse',
            labelKey: 'event.ledgerDiscrepancy.refuse',
            effects: [
              { type: 'nuts', value: 900 },
              { type: 'setFlag', flagId: 'ledger-buried' },
              // Looks free. Is not: the discrepancy resurfaces.
              {
                type: 'schedule',
                flagId: 'ledger-buried',
                delaySeconds: 900,
                scheduleTitleKey: 'event.ledgerDiscrepancy.laterTitle',
                scheduleBodyKey: 'event.ledgerDiscrepancy.laterBody',
                scheduled: [
                  { type: 'reputation', value: -14 },
                  { type: 'morale', value: -8 },
                ],
              },
            ],
            reactions: ['react.teamNervous'],
          },
        ],
      },
    },
  },

  // --- The callback. Only exists if the player paid the accountant. ----------
  {
    id: 'accountant-remembers',
    titleKey: 'event.accountantRemembers.title',
    bodyKey: 'event.accountantRemembers.body',
    rarity: 'rare',
    weight: 4,
    cooldownSeconds: 3600,
    requires: { flag: 'accountant-favour' },
    momentWorthy: true,
    choices: [
      {
        id: 'accept',
        labelKey: 'event.accountantRemembers.accept',
        effects: [
          { type: 'goldenNuts', value: 3 },
          { type: 'reputation', value: 6 },
          { type: 'unlockSecret', secretId: 'secret-ledger' },
        ],
        reactions: ['react.ottoImpressed'],
      },
      {
        id: 'decline',
        labelKey: 'event.accountantRemembers.decline',
        effects: [
          { type: 'reputation', value: 12 },
          { type: 'morale', value: 5 },
          // Settling the debt closes the thread cleanly.
          { type: 'clearFlag', flagId: 'accountant-favour' },
        ],
        reactions: ['react.teamRelieved'],
      },
    ],
  },

  // --- A morale crisis that can only fire when the company is genuinely bad --
  {
    id: 'morale-petition',
    titleKey: 'event.moralePetition.title',
    bodyKey: 'event.moralePetition.body',
    rarity: 'uncommon',
    weight: 14,
    cooldownSeconds: 1200,
    requires: { moraleBelow: 34 },
    momentWorthy: true,
    choices: [
      {
        id: 'concede',
        labelKey: 'event.moralePetition.concede',
        effects: [
          { type: 'morale', value: 22 },
          { type: 'nuts', value: -2500 },
          { type: 'setFlag', flagId: 'listened-to-staff' },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'partial',
        labelKey: 'event.moralePetition.partial',
        effects: [
          { type: 'morale', value: 10 },
          { type: 'nuts', value: -800 },
        ],
      },
      {
        id: 'refuse',
        labelKey: 'event.moralePetition.refuse',
        effects: [
          { type: 'morale', value: -6 },
          { type: 'reputation', value: -5 },
          { type: 'setFlag', flagId: 'ignored-staff' },
          // Ignoring a petition has a tail: word gets out.
          {
            type: 'schedule',
            flagId: 'ignored-staff',
            delaySeconds: 1200,
            scheduleTitleKey: 'event.moralePetition.laterTitle',
            scheduleBodyKey: 'event.moralePetition.laterBody',
            scheduled: [{ type: 'reputation', value: -10 }],
          },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },

  // --- The reward for running a genuinely happy company ----------------------
  {
    id: 'unusually-good-week',
    titleKey: 'event.goodWeek.title',
    bodyKey: 'event.goodWeek.body',
    rarity: 'uncommon',
    weight: 9,
    cooldownSeconds: 1500,
    requires: { moraleAbove: 88 },
    momentWorthy: true,
    choices: [
      {
        id: 'celebrate',
        labelKey: 'event.goodWeek.celebrate',
        effects: [
          { type: 'productionBoost', value: 1.6, durationSeconds: 240 },
          { type: 'morale', value: 4 },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamCheers'],
      },
      {
        id: 'document',
        labelKey: 'event.goodWeek.document',
        effects: [
          { type: 'reputation', value: 14 },
          { type: 'setFlag', flagId: 'documented-good-week' },
        ],
      },
      {
        id: 'bank',
        labelKey: 'event.goodWeek.bank',
        effects: [{ type: 'goldenNuts', value: 2 }],
      },
    ],
  },

  // --- Something in the basement is filing paperwork ------------------------
  {
    id: 'basement-requisition',
    titleKey: 'event.basementRequisition.title',
    bodyKey: 'event.basementRequisition.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 2400,
    requires: { room: 'basement' },
    momentWorthy: true,
    choices: [
      {
        id: 'approve',
        labelKey: 'event.basementRequisition.approve',
        effects: [
          { type: 'goldenNuts', value: 4 },
          { type: 'morale', value: -7 },
          { type: 'setFlag', flagId: 'basement-supplied' },
          { type: 'unlockSecret', secretId: 'secret-requisition' },
        ],
        reactions: ['react.teamNervous'],
      },
      {
        id: 'query',
        labelKey: 'event.basementRequisition.query',
        effects: [],
        next: 'reply',
      },
      {
        id: 'deny',
        labelKey: 'event.basementRequisition.deny',
        effects: [
          { type: 'morale', value: 4 },
          { type: 'setFlag', flagId: 'basement-denied' },
        ],
      },
    ],
    steps: {
      reply: {
        bodyKey: 'event.basementRequisition.replyBody',
        choices: [
          {
            id: 'sign',
            labelKey: 'event.basementRequisition.sign',
            effects: [
              { type: 'goldenNuts', value: 6 },
              { type: 'reputation', value: -4 },
              { type: 'setFlag', flagId: 'basement-supplied' },
              { type: 'momentCard' },
            ],
          },
          {
            id: 'file',
            labelKey: 'event.basementRequisition.file',
            effects: [
              { type: 'nuts', value: 1500 },
              { type: 'unlockSecret', secretId: 'secret-requisition' },
            ],
          },
        ],
      },
    },
  },

  // ==========================================================================
  //  DEPARTMENT CONTENT AND CONSEQUENCE CHAINS
  // ==========================================================================
  // Events that belong to a specific part of the building, so opening a room
  // opens its stories too, plus situational content that only appears when the
  // company is in the state it describes (a walkout needs a morale crisis; a
  // celebration needs the opposite). Several set flags that later events read,
  // so a decision can be referred back to rather than merely scored.

  // --- The vending machine has opinions -------------------------------------
  {
    id: 'cafeteria-vending',
    titleKey: 'event.vending.title',
    bodyKey: 'event.vending.body',
    rarity: 'common',
    weight: 9,
    cooldownSeconds: 700,
    requires: { room: 'cafeteria' },
    choices: [
      {
        id: 'audit',
        labelKey: 'event.vending.audit',
        effects: [
          { type: 'nuts', value: -160 },
          { type: 'reputation', value: 5 },
          { type: 'setFlag', flagId: 'vending-audited' },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'sell',
        labelKey: 'event.vending.sell',
        effects: [
          { type: 'nuts', value: 520 },
          { type: 'morale', value: -4 },
        ],
        reactions: ['react.teamNervous'],
      },
      {
        id: 'leave',
        labelKey: 'event.vending.leave',
        effects: [
          { type: 'morale', value: 4 },
          {
            type: 'schedule',
            flagId: 'vending-ignored',
            delaySeconds: 780,
            scheduleTitleKey: 'event.vending.laterTitle',
            scheduleBodyKey: 'event.vending.laterBody',
            scheduled: [{ type: 'reputation', value: -4 }],
          },
        ],
      },
    ],
  },
  // --- Post for a company that does not exist -------------------------------
  {
    id: 'mailroom-misdirected',
    titleKey: 'event.misdirected.title',
    bodyKey: 'event.misdirected.body',
    rarity: 'uncommon',
    weight: 7,
    cooldownSeconds: 1100,
    requires: { room: 'mailroom' },
    momentWorthy: true,
    choices: [
      {
        id: 'return',
        labelKey: 'event.misdirected.return',
        effects: [
          { type: 'reputation', value: 7 },
          { type: 'morale', value: 2 },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'open',
        labelKey: 'event.misdirected.open',
        effects: [],
        next: 'contents',
      },
    ],
    steps: {
      contents: {
        bodyKey: 'event.misdirected.contentsBody',
        choices: [
          {
            id: 'file',
            labelKey: 'event.misdirected.file',
            effects: [
              { type: 'reputation', value: 4 },
              { type: 'setFlag', flagId: 'filed-the-parcel' },
              { type: 'momentCard' },
            ],
          },
          {
            id: 'keep',
            labelKey: 'event.misdirected.keep',
            effects: [
              { type: 'nuts', value: 1400 },
              { type: 'morale', value: -6 },
              { type: 'setFlag', flagId: 'kept-the-parcel' },
              {
                type: 'schedule',
                flagId: 'kept-the-parcel',
                delaySeconds: 1200,
                scheduleTitleKey: 'event.misdirected.laterTitle',
                scheduleBodyKey: 'event.misdirected.laterBody',
                scheduled: [
                  { type: 'reputation', value: -12 },
                  { type: 'nuts', value: -600 },
                ],
              },
            ],
            reactions: ['react.teamNervous'],
          },
        ],
      },
    },
  },
  // --- Camera four, at three in the morning ---------------------------------
  {
    id: 'security-night-footage',
    titleKey: 'event.nightFootage.title',
    bodyKey: 'event.nightFootage.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 1600,
    requires: { room: 'security' },
    momentWorthy: true,
    choices: [
      {
        id: 'review',
        labelKey: 'event.nightFootage.review',
        effects: [
          { type: 'reputation', value: 9 },
          { type: 'morale', value: -3 },
          { type: 'setFlag', flagId: 'watched-the-tape' },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamNervous'],
      },
      {
        id: 'delete',
        labelKey: 'event.nightFootage.delete',
        effects: [
          { type: 'morale', value: 6 },
          {
            type: 'schedule',
            flagId: 'deleted-the-tape',
            delaySeconds: 1500,
            scheduleTitleKey: 'event.nightFootage.laterTitle',
            scheduleBodyKey: 'event.nightFootage.laterBody',
            scheduled: [
              { type: 'reputation', value: -10 },
              { type: 'morale', value: -6 },
            ],
          },
          { type: 'setFlag', flagId: 'deleted-the-tape' },
        ],
      },
      {
        id: 'noticeboard',
        labelKey: 'event.nightFootage.noticeboard',
        effects: [
          { type: 'nuts', value: -220 },
          { type: 'morale', value: 9 },
          { type: 'reputation', value: 3 },
        ],
        reactions: ['react.teamDelighted'],
      },
    ],
  },
  // --- A box filed ahead of time --------------------------------------------
  {
    id: 'archive-future-box',
    titleKey: 'event.futureBox.title',
    bodyKey: 'event.futureBox.body',
    rarity: 'rare',
    weight: 4,
    cooldownSeconds: 1800,
    requires: { room: 'archive' },
    momentWorthy: true,
    choices: [
      {
        id: 'open-now',
        labelKey: 'event.futureBox.openNow',
        effects: [],
        next: 'inside',
      },
      {
        id: 'reshelve',
        labelKey: 'event.futureBox.reshelve',
        effects: [
          { type: 'reputation', value: 6 },
          { type: 'setFlag', flagId: 'box-reshelved' },
        ],
        reactions: ['react.teamRelieved'],
      },
    ],
    steps: {
      inside: {
        bodyKey: 'event.futureBox.insideBody',
        choices: [
          {
            id: 'act',
            labelKey: 'event.futureBox.act',
            effects: [
              { type: 'goldenNuts', value: 2 },
              { type: 'reputation', value: 12 },
              { type: 'setFlag', flagId: 'acted-on-the-box' },
              { type: 'momentCard' },
            ],
            reactions: ['react.minaFascinated'],
          },
          {
            id: 'shred',
            labelKey: 'event.futureBox.shred',
            effects: [
              { type: 'morale', value: 7 },
              { type: 'reputation', value: -3 },
            ],
          },
        ],
      },
    },
  },
  // --- Something in the incubator is fine and friendly ----------------------
  {
    id: 'incubator-hatched',
    titleKey: 'event.hatched.title',
    bodyKey: 'event.hatched.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 1500,
    requires: { room: 'incubator' },
    momentWorthy: true,
    choices: [
      {
        id: 'mascot',
        labelKey: 'event.hatched.mascot',
        effects: [
          { type: 'morale', value: 14 },
          { type: 'reputation', value: 4 },
          { type: 'setFlag', flagId: 'adopted-the-hatchling' },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamDelighted'],
      },
      {
        id: 'observe',
        labelKey: 'event.hatched.observe',
        effects: [
          { type: 'reputation', value: 11 },
          { type: 'goldenNuts', value: 1 },
        ],
        reactions: ['react.minaFascinated'],
      },
      {
        id: 'return',
        labelKey: 'event.hatched.return',
        effects: [
          { type: 'nuts', value: 700 },
          { type: 'morale', value: -5 },
        ],
      },
    ],
  },
  // --- A real morale crisis, and three real ways out ------------------------
  {
    id: 'morale-walkout',
    titleKey: 'event.walkout.title',
    bodyKey: 'event.walkout.body',
    rarity: 'uncommon',
    weight: 12,
    cooldownSeconds: 1200,
    requires: { moraleBelow: 26 },
    momentWorthy: true,
    choices: [
      {
        id: 'day-off',
        labelKey: 'event.walkout.dayOff',
        requires: { nuts: 900 },
        disabledKey: 'event.walkout.dayOffLocked',
        effects: [
          { type: 'nuts', value: -900 },
          { type: 'morale', value: 26 },
          { type: 'setFlag', flagId: 'gave-the-day-off' },
        ],
        reactions: ['react.teamDelighted'],
      },
      {
        id: 'address',
        labelKey: 'event.walkout.address',
        effects: [
          { type: 'morale', value: 13 },
          { type: 'reputation', value: 3 },
          { type: 'setFlag', flagId: 'listened-to-staff' },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'ignore',
        labelKey: 'event.walkout.ignore',
        effects: [
          { type: 'nuts', value: 400 },
          { type: 'setFlag', flagId: 'ignored-walkout' },
          {
            type: 'schedule',
            flagId: 'ignored-walkout',
            delaySeconds: 600,
            scheduleTitleKey: 'event.walkout.laterTitle',
            scheduleBodyKey: 'event.walkout.laterBody',
            scheduled: [
              { type: 'morale', value: -14 },
              { type: 'reputation', value: -16 },
            ],
          },
        ],
      },
    ],
  },
  // --- The opposite problem -------------------------------------------------
  {
    id: 'morale-spontaneous-party',
    titleKey: 'event.party.title',
    bodyKey: 'event.party.body',
    rarity: 'uncommon',
    weight: 8,
    cooldownSeconds: 1300,
    requires: { moraleAbove: 88 },
    choices: [
      {
        id: 'fund',
        labelKey: 'event.party.fund',
        effects: [
          { type: 'nuts', value: -450 },
          { type: 'morale', value: 8 },
          { type: 'reputation', value: 6 },
        ],
        reactions: ['react.teamDelighted'],
      },
      {
        id: 'join',
        labelKey: 'event.party.join',
        effects: [
          { type: 'morale', value: 5 },
          { type: 'friendship', value: 4 },
        ],
        reactions: ['react.teamDelighted'],
      },
      {
        id: 'back-to-work',
        labelKey: 'event.party.backToWork',
        effects: [
          { type: 'nuts', value: 520 },
          { type: 'morale', value: -8 },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },
  // --- The building disagrees with its own floor plan -----------------------
  {
    id: 'anomaly-corridor',
    titleKey: 'event.corridor.title',
    bodyKey: 'event.corridor.body',
    rarity: 'rare',
    weight: 4,
    cooldownSeconds: 2000,
    requires: { reputation: 60 },
    momentWorthy: true,
    choices: [
      {
        id: 'remeasure',
        labelKey: 'event.corridor.remeasure',
        effects: [
          { type: 'nuts', value: -300 },
          { type: 'reputation', value: 10 },
          { type: 'setFlag', flagId: 'remeasured-the-corridor' },
        ],
        reactions: ['react.beaSuspicious'],
      },
      {
        id: 'amend',
        labelKey: 'event.corridor.amend',
        effects: [
          { type: 'morale', value: 7 },
          { type: 'reputation', value: 2 },
          { type: 'setFlag', flagId: 'amended-the-plan' },
        ],
      },
      {
        id: 'ignore',
        labelKey: 'event.corridor.ignore',
        effects: [
          { type: 'nuts', value: 250 },
          {
            type: 'schedule',
            flagId: 'ignored-the-corridor',
            delaySeconds: 1700,
            scheduleTitleKey: 'event.corridor.laterTitle',
            scheduleBodyKey: 'event.corridor.laterBody',
            scheduled: [{ type: 'morale', value: -9 }],
          },
        ],
      },
    ],
  },
  // --- A grant, and the temptation to round upward --------------------------
  {
    id: 'research-grant',
    titleKey: 'event.grant.title',
    bodyKey: 'event.grant.body',
    rarity: 'uncommon',
    weight: 7,
    cooldownSeconds: 1600,
    requires: { reputation: 40 },
    choices: [
      {
        id: 'honest',
        labelKey: 'event.grant.honest',
        effects: [
          { type: 'nuts', value: 900 },
          { type: 'reputation', value: 8 },
          { type: 'setFlag', flagId: 'grant-honest' },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'embellish',
        labelKey: 'event.grant.embellish',
        effects: [],
        next: 'awarded',
      },
    ],
    steps: {
      awarded: {
        bodyKey: 'event.grant.awardedBody',
        choices: [
          {
            id: 'spend',
            labelKey: 'event.grant.spend',
            effects: [
              { type: 'nuts', value: 3200 },
              { type: 'setFlag', flagId: 'grant-embellished' },
              {
                type: 'schedule',
                flagId: 'grant-embellished',
                delaySeconds: 1500,
                scheduleTitleKey: 'event.grant.laterTitle',
                scheduleBodyKey: 'event.grant.laterBody',
                scheduled: [
                  { type: 'reputation', value: -18 },
                  { type: 'nuts', value: -1400 },
                ],
              },
            ],
            reactions: ['react.teamNervous'],
          },
          {
            id: 'withdraw',
            labelKey: 'event.grant.withdraw',
            effects: [
              { type: 'reputation', value: 6 },
              { type: 'morale', value: 4 },
              { type: 'setFlag', flagId: 'grant-withdrawn' },
            ],
            reactions: ['react.teamRelieved'],
          },
        ],
      },
    },
  },
  // --- The question, and the callback that remembers the answer -------------
  {
    id: 'intern-question',
    titleKey: 'event.intern.title',
    bodyKey: 'event.intern.body',
    rarity: 'common',
    weight: 9,
    cooldownSeconds: 900,
    requires: { missingFlag: 'answered-the-intern' },
    choices: [
      {
        id: 'honest',
        labelKey: 'event.intern.honest',
        effects: [
          { type: 'morale', value: 6 },
          { type: 'reputation', value: 3 },
          { type: 'setFlag', flagId: 'answered-the-intern' },
          { type: 'setFlag', flagId: 'intern-told-truth' },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'brochure',
        labelKey: 'event.intern.brochure',
        effects: [
          { type: 'reputation', value: 6 },
          { type: 'morale', value: -2 },
          { type: 'setFlag', flagId: 'answered-the-intern' },
          { type: 'setFlag', flagId: 'intern-told-brochure' },
        ],
      },
      {
        id: 'deflect',
        labelKey: 'event.intern.deflect',
        effects: [
          { type: 'nuts', value: 180 },
          { type: 'morale', value: -4 },
          { type: 'setFlag', flagId: 'answered-the-intern' },
          { type: 'setFlag', flagId: 'intern-deflected' },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },

  // --- Years later. Which version of us they repeat is the player's doing. ---
  {
    id: 'intern-returns',
    titleKey: 'event.internReturns.title',
    bodyKey: 'event.internReturns.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 2400,
    requires: { flag: 'answered-the-intern', reputation: 120 },
    momentWorthy: true,
    /* The first two paths are always open. The last two are the callback actually
       REMEMBERING: `intern-question` has always recorded which of the three answers
       was given, but nothing ever read those marks back, so all three histories
       arrived at an identical scene. Now the intern can quote you — and only the
       version of the conversation that really happened is offered. */
    choices: [
      {
        id: 'partner',
        labelKey: 'event.internReturns.partner',
        effects: [
          { type: 'reputation', value: 16 },
          { type: 'nuts', value: 1500 },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamDelighted'],
      },
      {
        id: 'decline',
        labelKey: 'event.internReturns.decline',
        effects: [
          { type: 'morale', value: 8 },
          { type: 'reputation', value: 4 },
        ],
      },
      {
        id: 'stand-by-the-truth',
        labelKey: 'event.internReturns.standBy',
        requires: { flag: 'intern-told-truth' },
        disabledKey: 'event.internReturns.standByLocked',
        effects: [
          { type: 'reputation', value: 22 },
          { type: 'morale', value: 10 },
          { type: 'setFlag', flagId: 'kept-our-word' },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamCheers'],
      },
      {
        id: 'correct-the-record',
        labelKey: 'event.internReturns.correct',
        requires: { flag: 'answered-the-intern' },
        disabledKey: 'event.internReturns.correctLocked',
        effects: [
          { type: 'reputation', value: 9 },
          { type: 'nuts', value: -600 },
          { type: 'morale', value: 6 },
          { type: 'setFlag', flagId: 'corrected-the-record' },
        ],
        reactions: ['react.teamRelieved'],
      },
    ],
  },
  // --- Somebody wants to buy a golden nut, and will not say why ------------
  {
    id: 'golden-buyer',
    titleKey: 'event.goldenBuyer.title',
    bodyKey: 'event.goldenBuyer.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 1900,
    requires: { reputation: 70 },
    choices: [
      {
        id: 'sell',
        labelKey: 'event.goldenBuyer.sell',
        requires: { goldenNuts: 1 },
        disabledKey: 'event.goldenBuyer.sellLocked',
        effects: [
          { type: 'goldenNuts', value: -1 },
          { type: 'nuts', value: 6000 },
          { type: 'setFlag', flagId: 'sold-a-golden' },
        ],
        reactions: ['react.ottoImpressed'],
      },
      {
        id: 'refuse',
        labelKey: 'event.goldenBuyer.refuse',
        effects: [
          { type: 'reputation', value: 9 },
          { type: 'morale', value: 3 },
          { type: 'setFlag', flagId: 'refused-the-buyer' },
        ],
        reactions: ['react.teamRelieved'],
      },
      {
        id: 'ask',
        labelKey: 'event.goldenBuyer.ask',
        effects: [
          { type: 'reputation', value: 4 },
          { type: 'goldenNuts', value: 1 },
          { type: 'morale', value: -3 },
          { type: 'momentCard' },
        ],
        reactions: ['react.beaSuspicious'],
      },
    ],
  },
  // --- Payroll has one more entry than the building does -------------------
  {
    id: 'unaccounted-desk',
    titleKey: 'event.unaccounted.title',
    bodyKey: 'event.unaccounted.body',
    rarity: 'rare',
    weight: 4,
    cooldownSeconds: 2100,
    requires: { reputation: 90, missingFlag: 'desk-resolved' },
    momentWorthy: true,
    choices: [
      {
        id: 'investigate',
        labelKey: 'event.unaccounted.investigate',
        effects: [
          { type: 'nuts', value: -500 },
          { type: 'reputation', value: 13 },
          { type: 'setFlag', flagId: 'desk-resolved' },
          { type: 'momentCard' },
        ],
        reactions: ['react.beaSuspicious'],
      },
      {
        id: 'keep-paying',
        labelKey: 'event.unaccounted.keepPaying',
        effects: [
          { type: 'morale', value: 6 },
          { type: 'nuts', value: -140 },
        ],
      },
      {
        id: 'remove',
        labelKey: 'event.unaccounted.remove',
        effects: [
          { type: 'nuts', value: 900 },
          { type: 'morale', value: -7 },
          { type: 'setFlag', flagId: 'desk-removed' },
          {
            type: 'schedule',
            flagId: 'desk-removed',
            delaySeconds: 1400,
            scheduleTitleKey: 'event.unaccounted.laterTitle',
            scheduleBodyKey: 'event.unaccounted.laterBody',
            scheduled: [{ type: 'morale', value: -8 }],
          },
        ],
      },
    ],
  },

  /* =========================================================================
   * One story event per member of the cast.
   *
   * Every employee already declared a `rareEventId`, but twelve of the
   * twenty-three pointed at events that were never written — so most of the cast
   * had a promise in their data and nothing behind it. The hires late in the
   * reputation ladder were the ones missing out, which is exactly backwards: by
   * then the player has spent a long time with these characters.
   *
   * Each of these is gated on its own employee being hired and stamped with
   * `employeeId`, so the moment card it leaves is attributed to them.
   * ======================================================================= */

  // --- Marlow (HR capybara). The joke is that nothing moves him. -------------
  {
    id: 'calm-capybara',
    titleKey: 'event.calmCapybara.title',
    bodyKey: 'event.calmCapybara.body',
    rarity: 'uncommon',
    weight: 7,
    cooldownSeconds: 1200,
    requires: { hiredEmployee: 'marlow' },
    employeeId: 'marlow',
    momentWorthy: true,
    choices: [
      {
        id: 'drill-anyway',
        labelKey: 'event.calmCapybara.drill',
        effects: [
          { type: 'reputation', value: 5 },
          { type: 'morale', value: -2 },
          { type: 'nuts', value: -200 },
        ],
      },
      {
        id: 'ask-marlow',
        labelKey: 'event.calmCapybara.ask',
        effects: [
          { type: 'friendship', value: 10 },
          { type: 'morale', value: 6 },
          { type: 'setFlag', flagId: 'asked-marlow' },
          { type: 'momentCard' },
        ],
        reactions: ['react.marlowCalm'],
      },
      {
        id: 'check-panel',
        labelKey: 'event.calmCapybara.panel',
        effects: [
          { type: 'reputation', value: 4 },
          { type: 'nuts', value: -120 },
        ],
      },
    ],
  },

  // --- Pingo (logistics penguin). A pallet that arrived before it was sent. --
  {
    id: 'pingo-manifest',
    titleKey: 'event.pingoManifest.title',
    bodyKey: 'event.pingoManifest.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 1800,
    requires: { hiredEmployee: 'pingo' },
    employeeId: 'pingo',
    momentWorthy: true,
    choices: [
      {
        id: 'file-it',
        labelKey: 'event.pingoManifest.file',
        effects: [
          { type: 'reputation', value: 4 },
          { type: 'morale', value: -1 },
          { type: 'setFlag', flagId: 'filed-the-manifest' },
        ],
      },
      {
        id: 'open-it',
        labelKey: 'event.pingoManifest.open',
        // Deliberately empty: this branch exists to open the pallet.
        effects: [],
        next: 'inside',
      },
    ],
    steps: {
      inside: {
        bodyKey: 'event.pingoManifest.insideBody',
        choices: [
          {
            id: 'inventory',
            labelKey: 'event.pingoManifest.inventory',
            effects: [
              { type: 'nuts', value: 1200 },
              { type: 'reputation', value: 6 },
              { type: 'momentCard' },
            ],
            reactions: ['react.pingoPrecise'],
          },
          {
            id: 'reseal',
            labelKey: 'event.pingoManifest.reseal',
            effects: [
              { type: 'goldenNuts', value: 1 },
              { type: 'morale', value: 5 },
              { type: 'setFlag', flagId: 'resealed-the-pallet' },
            ],
            reactions: ['react.teamNervous'],
          },
        ],
      },
    },
  },

  // --- Canela (field research red panda). A room the floorplan denies. ------
  {
    id: 'canela-field-notes',
    titleKey: 'event.canelaNotes.title',
    bodyKey: 'event.canelaNotes.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 1500,
    requires: { hiredEmployee: 'canela' },
    employeeId: 'canela',
    momentWorthy: true,
    choices: [
      {
        id: 'fund-survey',
        labelKey: 'event.canelaNotes.fund',
        effects: [
          { type: 'nuts', value: -900 },
          { type: 'reputation', value: 9 },
          { type: 'friendship', value: 8 },
          { type: 'setFlag', flagId: 'canela-surveyed' },
          { type: 'momentCard' },
        ],
        reactions: ['react.canelaCurious'],
      },
      {
        id: 'file-notes',
        labelKey: 'event.canelaNotes.file',
        effects: [
          { type: 'reputation', value: 3 },
          { type: 'morale', value: 2 },
        ],
      },
      {
        id: 'assigned-floors',
        labelKey: 'event.canelaNotes.assigned',
        effects: [
          { type: 'reputation', value: 5 },
          { type: 'morale', value: -4 },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },

  // --- Nino (office cat). The nap is on the calendar and cannot be declined. -
  {
    id: 'nino-nap',
    titleKey: 'event.ninoNap.title',
    bodyKey: 'event.ninoNap.body',
    rarity: 'uncommon',
    weight: 7,
    cooldownSeconds: 1300,
    requires: { hiredEmployee: 'nino' },
    employeeId: 'nino',
    momentWorthy: true,
    choices: [
      {
        id: 'honour-nap',
        labelKey: 'event.ninoNap.honour',
        effects: [
          { type: 'morale', value: 14 },
          { type: 'productionBoost', value: 1.25, durationSeconds: 180 },
          { type: 'momentCard' },
        ],
        reactions: ['react.ninoUnbothered'],
      },
      {
        id: 'move-review',
        labelKey: 'event.ninoNap.move',
        effects: [
          { type: 'nuts', value: -400 },
          { type: 'morale', value: 6 },
        ],
      },
      {
        id: 'review-during',
        labelKey: 'event.ninoNap.during',
        effects: [
          { type: 'reputation', value: 7 },
          { type: 'morale', value: -6 },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },

  // --- Bia (bear, security). Nothing was taken. Something was left. ---------
  {
    id: 'bia-guard',
    titleKey: 'event.biaGuard.title',
    bodyKey: 'event.biaGuard.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 2000,
    requires: { hiredEmployee: 'bia' },
    employeeId: 'bia',
    momentWorthy: true,
    choices: [
      {
        id: 'review-footage',
        labelKey: 'event.biaGuard.review',
        effects: [
          { type: 'nuts', value: -600 },
          { type: 'reputation', value: 11 },
          { type: 'setFlag', flagId: 'reviewed-the-vault' },
          { type: 'momentCard' },
        ],
        reactions: ['react.biaSteady'],
      },
      {
        id: 'take-her-word',
        labelKey: 'event.biaGuard.trust',
        effects: [
          { type: 'friendship', value: 12 },
          { type: 'morale', value: 7 },
          { type: 'setFlag', flagId: 'trusted-bia' },
          // Trust is free right up until the next audit.
          {
            type: 'schedule',
            flagId: 'trusted-bia',
            delaySeconds: 1200,
            scheduleTitleKey: 'event.biaGuard.laterTitle',
            scheduleBodyKey: 'event.biaGuard.laterBody',
            scheduled: [
              { type: 'reputation', value: -5 },
              { type: 'morale', value: -6 },
            ],
          },
        ],
      },
      {
        id: 'second-lock',
        labelKey: 'event.biaGuard.lock',
        effects: [
          { type: 'nuts', value: -350 },
          { type: 'reputation', value: 4 },
          { type: 'morale', value: -3 },
        ],
      },
    ],
  },

  // --- Quincy (QA frog). The defect report predates the defect. -------------
  {
    id: 'quincy-bug',
    titleKey: 'event.quincyBug.title',
    bodyKey: 'event.quincyBug.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 1700,
    requires: { hiredEmployee: 'quincy' },
    employeeId: 'quincy',
    momentWorthy: true,
    choices: [
      {
        id: 'fix-now',
        labelKey: 'event.quincyBug.fix',
        effects: [
          { type: 'nuts', value: -700 },
          { type: 'reputation', value: 8 },
          { type: 'friendship', value: 8 },
          { type: 'setFlag', flagId: 'trusted-quincy' },
        ],
        reactions: ['react.quincyBlinks'],
      },
      {
        id: 'wait-for-it',
        labelKey: 'event.quincyBug.wait',
        effects: [
          { type: 'nuts', value: 400 },
          { type: 'setFlag', flagId: 'ignored-quincy' },
          // The report included a timestamp. It was correct.
          {
            type: 'schedule',
            flagId: 'ignored-quincy',
            delaySeconds: 900,
            scheduleTitleKey: 'event.quincyBug.laterTitle',
            scheduleBodyKey: 'event.quincyBug.laterBody',
            scheduled: [
              { type: 'nuts', value: -1500 },
              { type: 'morale', value: -7 },
            ],
          },
        ],
        reactions: ['react.teamNervous'],
      },
      {
        id: 'ask-how',
        labelKey: 'event.quincyBug.askHow',
        effects: [
          { type: 'reputation', value: 3 },
          { type: 'morale', value: 4 },
          { type: 'momentCard' },
        ],
      },
    ],
  },

  // --- Sonny (sloth, wellbeing). A rare POSITIVE delayed consequence. -------
  {
    id: 'dorm-slow',
    titleKey: 'event.sonnySlow.title',
    bodyKey: 'event.sonnySlow.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 1400,
    requires: { hiredEmployee: 'dorm' },
    employeeId: 'dorm',
    momentWorthy: true,
    choices: [
      {
        id: 'give-time',
        labelKey: 'event.sonnySlow.time',
        effects: [
          { type: 'morale', value: 6 },
          { type: 'setFlag', flagId: 'let-sonny-finish' },
          // Patience is the only investment in this game that pays in nuts.
          {
            type: 'schedule',
            flagId: 'let-sonny-finish',
            delaySeconds: 600,
            scheduleTitleKey: 'event.sonnySlow.laterTitle',
            scheduleBodyKey: 'event.sonnySlow.laterBody',
            scheduled: [
              { type: 'nuts', value: 2600 },
              { type: 'reputation', value: 7 },
            ],
          },
        ],
        reactions: ['react.sonnyEventually'],
      },
      {
        id: 'ship-it',
        labelKey: 'event.sonnySlow.ship',
        effects: [
          { type: 'nuts', value: 500 },
          { type: 'morale', value: -5 },
        ],
      },
      {
        id: 'pair-him',
        labelKey: 'event.sonnySlow.pair',
        effects: [
          { type: 'nuts', value: -200 },
          { type: 'reputation', value: 4 },
          { type: 'morale', value: 3 },
        ],
      },
    ],
  },

  // --- Inky (octopus, sorting). Nine tasks. Eight arms. --------------------
  {
    id: 'inky-multitask',
    titleKey: 'event.inkyMultitask.title',
    bodyKey: 'event.inkyMultitask.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 1500,
    requires: { hiredEmployee: 'inky' },
    employeeId: 'inky',
    momentWorthy: true,
    choices: [
      {
        id: 'audit-board',
        labelKey: 'event.inkyMultitask.audit',
        effects: [
          { type: 'nuts', value: -250 },
          { type: 'reputation', value: 7 },
          { type: 'momentCard' },
        ],
        reactions: ['react.inkyBusy'],
      },
      {
        id: 'promote-her',
        labelKey: 'event.inkyMultitask.promote',
        effects: [
          { type: 'nuts', value: -1100 },
          { type: 'productionBoost', value: 1.3, durationSeconds: 240 },
          { type: 'morale', value: 5 },
          { type: 'friendship', value: 10 },
        ],
      },
      {
        id: 'dont-ask',
        labelKey: 'event.inkyMultitask.dontAsk',
        effects: [
          { type: 'morale', value: 3 },
          { type: 'setFlag', flagId: 'didnt-ask-inky' },
        ],
        reactions: ['react.teamNervous'],
      },
    ],
  },

  // --- Echo (bat, night research). Three floors, one tune, in unison. ------
  {
    id: 'echo-night',
    titleKey: 'event.echoNight.title',
    bodyKey: 'event.echoNight.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 1900,
    requires: { hiredEmployee: 'echo' },
    employeeId: 'echo',
    momentWorthy: true,
    choices: [
      {
        id: 'archive-hum',
        labelKey: 'event.echoNight.archive',
        effects: [
          { type: 'reputation', value: 6 },
          { type: 'friendship', value: 8 },
          { type: 'setFlag', flagId: 'archived-the-hum' },
          { type: 'momentCard' },
        ],
        reactions: ['react.echoUpsideDown'],
      },
      {
        id: 'play-all-hands',
        labelKey: 'event.echoNight.play',
        effects: [
          { type: 'morale', value: 9 },
          { type: 'reputation', value: -4 },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamNervous'],
      },
      {
        id: 'delete-hum',
        labelKey: 'event.echoNight.delete',
        effects: [
          { type: 'reputation', value: 5 },
          { type: 'morale', value: -6 },
          { type: 'setFlag', flagId: 'deleted-the-hum' },
        ],
      },
    ],
  },

  // --- Rosa (flamingo, marketing). The invitations are already out. --------
  {
    id: 'rosa-runway',
    titleKey: 'event.rosaRunway.title',
    bodyKey: 'event.rosaRunway.body',
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 1600,
    requires: { hiredEmployee: 'rosa' },
    employeeId: 'rosa',
    momentWorthy: true,
    choices: [
      {
        id: 'fund-runway',
        labelKey: 'event.rosaRunway.fund',
        requires: { nuts: 1800 },
        disabledKey: 'event.rosaRunway.fundLocked',
        effects: [
          { type: 'nuts', value: -1800 },
          { type: 'reputation', value: 6 },
          { type: 'setFlag', flagId: 'funded-the-runway' },
          // A launch takes a while to land, and this one lands well.
          {
            type: 'schedule',
            flagId: 'funded-the-runway',
            delaySeconds: 720,
            scheduleTitleKey: 'event.rosaRunway.laterTitle',
            scheduleBodyKey: 'event.rosaRunway.laterBody',
            scheduled: [
              { type: 'reputation', value: 18 },
              { type: 'nuts', value: 2200 },
            ],
          },
        ],
        reactions: ['react.rosaFabulous'],
      },
      {
        id: 'scale-down',
        labelKey: 'event.rosaRunway.scale',
        effects: [
          { type: 'nuts', value: -300 },
          { type: 'reputation', value: 5 },
          { type: 'morale', value: 3 },
        ],
      },
      {
        id: 'cancel-show',
        labelKey: 'event.rosaRunway.cancel',
        effects: [
          { type: 'nuts', value: 200 },
          { type: 'reputation', value: -3 },
          { type: 'morale', value: -7 },
        ],
      },
    ],
  },

  // --- Perry (platypus, procurement). "Handled." ---------------------------
  {
    id: 'perry-oddjob',
    titleKey: 'event.perryOddjob.title',
    bodyKey: 'event.perryOddjob.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 1800,
    requires: { hiredEmployee: 'perry' },
    employeeId: 'perry',
    momentWorthy: true,
    choices: [
      {
        id: 'say-thank-you',
        labelKey: 'event.perryOddjob.accept',
        effects: [
          { type: 'goldenNuts', value: 2 },
          { type: 'morale', value: 4 },
          { type: 'setFlag', flagId: 'perry-no-questions' },
          { type: 'momentCard' },
        ],
        reactions: ['react.perryDeadpan'],
      },
      {
        id: 'insist-paperwork',
        labelKey: 'event.perryOddjob.paperwork',
        effects: [
          { type: 'nuts', value: -150 },
          { type: 'reputation', value: 9 },
          { type: 'morale', value: -3 },
        ],
      },
      {
        id: 'send-it-back',
        labelKey: 'event.perryOddjob.return',
        effects: [
          { type: 'nuts', value: -300 },
          { type: 'reputation', value: 4 },
          { type: 'morale', value: 6 },
        ],
        reactions: ['react.teamRelieved'],
      },
    ],
  },

  // --- Axel (axolotl, research). It includes the classified section. -------
  {
    id: 'axel-regen',
    titleKey: 'event.axelRegen.title',
    bodyKey: 'event.axelRegen.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 2000,
    requires: { hiredEmployee: 'axel' },
    employeeId: 'axel',
    momentWorthy: true,
    choices: [
      {
        id: 'study-it',
        labelKey: 'event.axelRegen.study',
        effects: [
          { type: 'nuts', value: -800 },
          { type: 'reputation', value: 12 },
          { type: 'setFlag', flagId: 'studied-the-regrowth' },
          { type: 'momentCard' },
        ],
        reactions: ['react.axelSunny'],
      },
      {
        id: 'destroy-again',
        labelKey: 'event.axelRegen.destroy',
        effects: [
          { type: 'reputation', value: 6 },
          { type: 'morale', value: -5 },
        ],
        reactions: ['react.teamNervous'],
      },
      {
        id: 'let-him-keep-it',
        labelKey: 'event.axelRegen.keep',
        effects: [
          { type: 'friendship', value: 12 },
          { type: 'morale', value: 8 },
          { type: 'momentCard' },
        ],
        reactions: ['react.teamDelighted'],
      },
    ],
  },
];

export const EVENT_CONTENT_REPAIRS: EventContentRepair[] = [];

function ensureMinimumChoices(
  eventId: string,
  step: string | null,
  choices: readonly EventChoice[],
): EventChoice[] {
  const repaired = choices.filter(
    (choice, index) => choices.findIndex((candidate) => candidate.id === choice.id) === index,
  );
  if (repaired.length !== choices.length) {
    EVENT_CONTENT_REPAIRS.push({
      eventId,
      step,
      reason: 'duplicate-choice-id',
      originalChoiceCount: choices.length,
    });
  }
  if (repaired.length >= 2) return repaired;
  EVENT_CONTENT_REPAIRS.push({
    eventId,
    step,
    reason: 'fewer-than-two',
    originalChoiceCount: choices.length,
  });
  const fallbackKinds: readonly EventFallbackKind[] = ['decline', 'postpone'];
  for (const kind of fallbackKinds) {
    if (repaired.length >= 2) break;
    const fallback = createEventFallbackChoice(kind);
    if (!repaired.some((choice) => choice.id === fallback.id)) repaired.push(fallback);
  }
  return repaired;
}

export const GAME_EVENTS: GameEventDef[] = AUTHORED_GAME_EVENTS.map((event) => ({
  ...event,
  choices: ensureMinimumChoices(event.id, null, event.choices),
  steps: event.steps
    ? Object.fromEntries(
        Object.entries(event.steps).map(([stepId, step]) => [
          stepId,
          {
            ...step,
            choices: ensureMinimumChoices(event.id, stepId, step.choices),
          },
        ]),
      )
    : undefined,
}));

export const GAME_EVENTS_BY_ID: Record<string, GameEventDef> = Object.fromEntries(
  GAME_EVENTS.map((e) => [e.id, e]),
);
