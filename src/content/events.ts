import type { GameEventDef } from './types';

// Data-driven random events. 26 events; five (rizzo-found, corvus-nutcoin,
// mina-basement, printer-demands, spreadsheet) include multi-step chains via
// `steps` + `choice.next`. Every string is a localization key.
export const GAME_EVENTS: GameEventDef[] = [
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
      { id: 'negotiate', labelKey: 'event.printer.negotiate', effects: [{ type: 'morale', value: 5 }], next: 'peace' },
      { id: 'unplug', labelKey: 'event.printer.unplug', effects: [{ type: 'nuts', value: -50 }], next: 'revenge' },
    ],
    steps: {
      peace: {
        bodyKey: 'event.printer.peaceBody',
        choices: [{ id: 'ok', labelKey: 'common.ok', effects: [{ type: 'productionBoost', value: 1.2, durationSeconds: 120 }] }],
      },
      revenge: {
        bodyKey: 'event.printer.revengeBody',
        choices: [{ id: 'ok', labelKey: 'common.ok', effects: [{ type: 'morale', value: -3 }, { type: 'momentCard' }] }],
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
      { id: 'hide', labelKey: 'event.audit.hide', effects: [{ type: 'nuts', value: 200 }, { type: 'morale', value: -4 }] },
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
      { id: 'ignore', labelKey: 'event.rizzoFound.ignore', effects: [{ type: 'nuts', value: 100 }] },
    ],
    steps: {
      box: {
        bodyKey: 'event.rizzoFound.boxBody',
        choices: [
          { id: 'open', labelKey: 'event.rizzoFound.open', effects: [{ type: 'goldenNuts', value: 1 }, { type: 'collectNut', nutId: 'suspicious-pistachio' }, { type: 'momentCard' }] },
          { id: 'return', labelKey: 'event.rizzoFound.return', effects: [{ type: 'reputation', value: 5 }, { type: 'friendship', value: 8, employeeId: 'rizzo' }] },
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
      { id: 'attend', labelKey: 'event.meeting.attend', effects: [{ type: 'morale', value: -2 }, { type: 'reputation', value: 2 }] },
      { id: 'skip', labelKey: 'event.meeting.skip', effects: [{ type: 'productionBoost', value: 1.15, durationSeconds: 90 }] },
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
      { id: 'applaud', labelKey: 'event.pieChart.applaud', effects: [{ type: 'friendship', value: 5, employeeId: 'pip' }, { type: 'morale', value: 3 }] },
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
      { id: 'hire', labelKey: 'event.pigeon.hire', effects: [{ type: 'productionBoost', value: 1.25, durationSeconds: 120 }, { type: 'momentCard' }] },
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
      { id: 'approve', labelKey: 'event.beaWood.approve', effects: [{ type: 'morale', value: 4 }, { type: 'friendship', value: 6, employeeId: 'bea' }, { type: 'emotion', employeeId: 'bea', emotion: 'proud', durationSeconds: 600 }] },
      { id: 'decline', labelKey: 'event.beaWood.decline', effects: [{ type: 'nuts', value: 150 }, { type: 'emotion', employeeId: 'bea', emotion: 'sad', durationSeconds: 480 }] },
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
    choices: [{ id: 'ok', labelKey: 'common.ok', effects: [{ type: 'morale', value: 5 }] }],
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
      { id: 'invest', labelKey: 'event.nutcoin.invest', effects: [{ type: 'nuts', value: -500 }, { type: 'emotion', employeeId: 'corvus', emotion: 'excited', durationSeconds: 600 }, { type: 'emotion', employeeId: 'marlow', emotion: 'embarrassed', durationSeconds: 600 }], next: 'crash' },
      { id: 'refuse', labelKey: 'event.nutcoin.refuse', effects: [{ type: 'reputation', value: 4 }, { type: 'unlockSecret', secretId: 'nutcoin' }] },
    ],
    steps: {
      crash: {
        bodyKey: 'event.nutcoin.crashBody',
        choices: [
          { id: 'sigh', labelKey: 'event.nutcoin.sigh', effects: [{ type: 'morale', value: -3 }, { type: 'unlockSecret', secretId: 'nutcoin' }, { type: 'momentCard' }] },
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
          { id: 'dig', labelKey: 'event.minaBasement.dig', effects: [{ type: 'goldenNuts', value: 2 }, { type: 'unlockSecret', secretId: 'basement-basement' }, { type: 'emotion', employeeId: 'mina', emotion: 'inspired', durationSeconds: 600 }, { type: 'emotion', employeeId: 'bea', emotion: 'worried', durationSeconds: 600 }, { type: 'momentCard' }] },
          { id: 'back', labelKey: 'event.minaBasement.back', effects: [{ type: 'reputation', value: 6 }] },
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
      { id: 'grab', labelKey: 'event.goldenAcorn.grab', effects: [{ type: 'goldenNuts', value: 3 }, { type: 'collectNut', nutId: 'executive-hazelnut' }, { type: 'momentCard' }] },
    ],
  },
  {
    id: 'employee-of-minute',
    titleKey: 'event.employeeMinute.title',
    bodyKey: 'event.employeeMinute.body',
    rarity: 'common',
    weight: 8,
    cooldownSeconds: 400,
    choices: [{ id: 'celebrate', labelKey: 'event.employeeMinute.celebrate', effects: [{ type: 'morale', value: 4 }, { type: 'friendship', value: 4 }] }],
  },
  {
    id: 'reply-all',
    titleKey: 'event.replyAll.title',
    bodyKey: 'event.replyAll.body',
    rarity: 'common',
    weight: 7,
    cooldownSeconds: 400,
    choices: [
      { id: 'apologize', labelKey: 'event.replyAll.apologize', effects: [{ type: 'morale', value: -1 }] },
      { id: 'double-down', labelKey: 'event.replyAll.doubleDown', effects: [{ type: 'reputation', value: -1 }, { type: 'morale', value: 3 }] },
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
        effects: [{ type: 'unlockSecret', secretId: 'chair' }, { type: 'morale', value: 5 }, { type: 'momentCard' }],
        reactions: ['react.teamHappy', 'react.pipProud'],
      },
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
      { id: 'accept', labelKey: 'event.merger.accept', effects: [{ type: 'nuts', value: 1000 }, { type: 'reputation', value: 5 }] },
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
      { id: 'investigate', labelKey: 'event.stapler.investigate', effects: [{ type: 'reputation', value: 1 }] },
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
    choices: [{ id: 'endure', labelKey: 'event.metaMeeting.endure', effects: [{ type: 'morale', value: -2 }, { type: 'productionBoost', value: 1.1, durationSeconds: 60 }] }],
  },
  {
    id: 'union-snacks',
    titleKey: 'event.union.title',
    bodyKey: 'event.union.body',
    rarity: 'uncommon',
    weight: 5,
    cooldownSeconds: 700,
    choices: [
      { id: 'grant', labelKey: 'event.union.grant', effects: [{ type: 'nuts', value: -300 }, { type: 'morale', value: 10 }] },
      { id: 'negotiate', labelKey: 'event.union.negotiate', effects: [{ type: 'morale', value: 4 }] },
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
    choices: [{ id: 'approve', labelKey: 'event.mascot.approve', effects: [{ type: 'reputation', value: 3 }, { type: 'momentCard' }] }],
  },
  {
    id: 'mysterious-walnut',
    titleKey: 'event.walnut.title',
    bodyKey: 'event.walnut.body',
    rarity: 'rare',
    weight: 3,
    cooldownSeconds: 900,
    choices: [
      { id: 'eat', labelKey: 'event.walnut.eat', effects: [{ type: 'collectNut', nutId: 'legally-distinct-walnut' }, { type: 'goldenNuts', value: 1 }] },
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
    choices: [{ id: 'wave', labelKey: 'event.human.wave', effects: [{ type: 'morale', value: 6 }, { type: 'momentCard' }] }],
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
      { id: 'close', labelKey: 'event.spreadsheet.close', effects: [{ type: 'morale', value: -1 }] },
    ],
    steps: {
      answer: {
        bodyKey: 'event.spreadsheet.answerBody',
        choices: [
          { id: 'accept', labelKey: 'event.spreadsheet.accept', effects: [{ type: 'unlockSecret', secretId: 'spreadsheet' }, { type: 'goldenNuts', value: 1 }, { type: 'momentCard' }] },
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
      { id: 'reflect', labelKey: 'event.existential.reflect', effects: [{ type: 'morale', value: 3 }] },
      { id: 'work', labelKey: 'event.existential.work', effects: [{ type: 'productionBoost', value: 1.2, durationSeconds: 120 }] },
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
    choices: [{ id: 'cool', labelKey: 'event.sunglasses.cool', effects: [{ type: 'morale', value: 8 }, { type: 'momentCard' }] }],
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
      { id: 'trust', labelKey: 'event.nixieMachine.trust', effects: [], next: 'whir', reactions: ['react.nixieProud'] },
      {
        id: 'unplug',
        labelKey: 'event.nixieMachine.unplug',
        effects: [{ type: 'morale', value: -2 }, { type: 'nuts', value: 200 }],
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
            effects: [{ type: 'productionBoost', value: 1.4, durationSeconds: 180 }, { type: 'momentCard' }],
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
        effects: [{ type: 'goldenNuts', value: 1 }, { type: 'reputation', value: 3 }],
        reactions: ['react.ottoDistracted'],
      },
      {
        id: 'ignore',
        labelKey: 'event.ottoAudit.ignore',
        effects: [{ type: 'nuts', value: 500 }, { type: 'morale', value: -2 }],
        reactions: ['react.hazelApproves'],
      },
      {
        id: 'frame',
        labelKey: 'event.ottoAudit.frame',
        effects: [{ type: 'morale', value: 4 }, { type: 'unlockSecret', secretId: 'negative-nut' }, { type: 'momentCard' }],
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
        effects: [{ type: 'nuts', value: -400 }, { type: 'reputation', value: 6 }],
        reactions: ['react.hazelApproves', 'react.corvusExcited'],
      },
      {
        id: 'fight',
        labelKey: 'event.hazelLoophole.fight',
        effects: [{ type: 'morale', value: 5 }, { type: 'unlockSecret', secretId: 'too-round' }, { type: 'momentCard' }],
        reactions: ['react.hazelApproves'],
      },
      {
        id: 'squares',
        labelKey: 'event.hazelLoophole.squares',
        effects: [{ type: 'reputation', value: -2 }, { type: 'nuts', value: 300 }],
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
        effects: [{ type: 'productionBoost', value: 1.15, durationSeconds: 120 }, { type: 'morale', value: -3 }],
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
      { id: 'listen', labelKey: 'event.mossNight.listen', effects: [], next: 'omen', reactions: ['react.mossKnowing'] },
      { id: 'dismiss', labelKey: 'event.mossNight.dismiss', effects: [{ type: 'nuts', value: 300 }] },
    ],
    steps: {
      omen: {
        bodyKey: 'event.mossNight.omenBody',
        choices: [
          {
            id: 'invest',
            labelKey: 'event.mossNight.invest',
            effects: [{ type: 'goldenNuts', value: 2 }, { type: 'reputation', value: 4 }, { type: 'momentCard' }],
            reactions: ['react.mossKnowing', 'react.fennGrin'],
          },
          {
            id: 'record',
            labelKey: 'event.mossNight.record',
            effects: [{ type: 'unlockSecret', secretId: 'wind-chime' }, { type: 'reputation', value: 6 }],
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
        effects: [{ type: 'nuts', value: -600 }, { type: 'reputation', value: 8 }],
        reactions: ['react.fennGrin', 'react.hazelApproves'],
      },
      {
        id: 'upsell',
        labelKey: 'event.fennDeal.upsell',
        effects: [{ type: 'nuts', value: 1200 }, { type: 'reputation', value: -3 }],
        reactions: ['react.fennGrin', 'react.teamNervous'],
      },
      {
        id: 'walnuts',
        labelKey: 'event.fennDeal.walnuts',
        effects: [{ type: 'collectNut', nutId: 'legally-distinct-walnut' }, { type: 'morale', value: 3 }, { type: 'momentCard' }],
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
      { id: 'annex', labelKey: 'event.breakRoom.annex', effects: [{ type: 'morale', value: -6 }, { type: 'nuts', value: 400 }], reactions: ['react.teamNervous'] },
    ],
    steps: {
      treaty: {
        bodyKey: 'event.breakRoom.treatyBody',
        choices: [
          {
            id: 'sign',
            labelKey: 'event.breakRoom.sign',
            effects: [{ type: 'morale', value: 8 }, { type: 'unlockSecret', secretId: 'break-room-nation' }, { type: 'momentCard' }],
            reactions: ['react.marlowApproves', 'react.hazelApproves'],
          },
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
      { id: 'drink', labelKey: 'event.acornWater.drink', effects: [{ type: 'morale', value: -4 }, { type: 'productionBoost', value: 1.2, durationSeconds: 90 }], reactions: ['react.teamNervous'] },
      { id: 'replace', labelKey: 'event.acornWater.replace', effects: [{ type: 'morale', value: 4 }], reactions: ['react.teamHappy'] },
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
      { id: 'return', labelKey: 'event.staplers17.return', effects: [{ type: 'reputation', value: 3 }], reactions: ['react.hazelApproves'] },
      { id: 'keep', labelKey: 'event.staplers17.keep', effects: [{ type: 'nuts', value: 250 }, { type: 'friendship', value: 6, employeeId: 'rizzo' }], reactions: ['react.rizzoSuspicious'] },
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
      { id: 'fix', labelKey: 'event.elevator.fix', effects: [{ type: 'nuts', value: -300 }, { type: 'morale', value: 3 }], reactions: ['react.beaProud'] },
      { id: 'embrace', labelKey: 'event.elevator.embrace', effects: [{ type: 'morale', value: 5 }, { type: 'unlockSecret', secretId: 'sideways' }], reactions: ['react.teamHappy'] },
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
      { id: 'investigate', labelKey: 'event.vaultHum.investigate', effects: [{ type: 'goldenNuts', value: 2 }, { type: 'momentCard' }], reactions: ['react.minaCurious'] },
      { id: 'harmonize', labelKey: 'event.vaultHum.harmonize', effects: [{ type: 'morale', value: 7 }], reactions: ['react.teamHappy'] },
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
      { id: 'accept', labelKey: 'event.fakeAward.accept', effects: [{ type: 'reputation', value: 5 }, { type: 'morale', value: 4 }, { type: 'momentCard' }], reactions: ['react.corvusExcited', 'react.pipProud'] },
      { id: 'decline', labelKey: 'event.fakeAward.decline', effects: [{ type: 'reputation', value: 2 }], reactions: ['react.hazelApproves'] },
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
      { id: 'sue', labelKey: 'event.slogan.sue', effects: [{ type: 'reputation', value: 4 }, { type: 'nuts', value: -200 }], reactions: ['react.hazelApproves'] },
      { id: 'rebrand', labelKey: 'event.slogan.rebrand', effects: [{ type: 'productionBoost', value: 1.2, durationSeconds: 120 }], reactions: ['react.corvusExcited'] },
      { id: 'petty', labelKey: 'event.slogan.petty', effects: [{ type: 'morale', value: 5 }, { type: 'reputation', value: -1 }], reactions: ['react.teamHappy'] },
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
      { id: 'allow', labelKey: 'event.namedNuts.allow', effects: [{ type: 'morale', value: 5 }, { type: 'productionBoost', value: 0.9, durationSeconds: 60 }], reactions: ['react.teamHappy'] },
      { id: 'forbid', labelKey: 'event.namedNuts.forbid', effects: [{ type: 'productionBoost', value: 1.1, durationSeconds: 60 }, { type: 'morale', value: -2 }], reactions: ['react.teamNervous'] },
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
      { id: 'grant', labelKey: 'event.ghost.grant', effects: [{ type: 'nuts', value: -300 }, { type: 'morale', value: 8 }, { type: 'unlockSecret', secretId: 'ghost' }, { type: 'momentCard' }], reactions: ['react.marlowApproves'] },
      { id: 'deny', labelKey: 'event.ghost.deny', effects: [{ type: 'morale', value: -4 }], reactions: ['react.teamNervous'] },
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
      { id: 'approve', labelKey: 'event.coffeeLeave.approve', effects: [{ type: 'morale', value: 6 }, { type: 'productionBoost', value: 0.85, durationSeconds: 90 }], reactions: ['react.marlowApproves'] },
      { id: 'deny', labelKey: 'event.coffeeLeave.deny', effects: [{ type: 'productionBoost', value: 1.15, durationSeconds: 90 }, { type: 'morale', value: -3 }], reactions: ['react.teamNervous'] },
    ],
  },
];

export const GAME_EVENTS_BY_ID: Record<string, GameEventDef> = Object.fromEntries(
  GAME_EVENTS.map((e) => [e.id, e]),
);
