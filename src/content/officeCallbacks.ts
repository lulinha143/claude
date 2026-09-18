import type { GameEventDef } from './types';

/** Payoffs for decisions made away from the event screen. */
export const OFFICE_CALLBACKS: GameEventDef[] = [
  {
    id: 'building-replies',
    titleKey: 'callback.mail.title',
    bodyKey: 'callback.mail.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 3600,
    employeeId: 'inky',
    momentWorthy: true,
    requires: { flag: 'inky.buildingMail', missingFlag: 'mail.answered', hiredEmployee: 'inky' },
    choices: [
      {
        id: 'read',
        labelKey: 'callback.mail.read',
        effects: [{ type: 'setFlag', flagId: 'mail.read' }],
        next: 'request',
      },
      {
        id: 'return',
        labelKey: 'callback.mail.return',
        effects: [
          { type: 'reputation', value: 4 },
          { type: 'setFlag', flagId: 'mail.answered' },
        ],
        reactions: ['callback.mail.returnReply'],
      },
    ],
    steps: {
      request: {
        bodyKey: 'callback.mail.request',
        choices: [
          {
            id: 'quiet',
            labelKey: 'callback.mail.quiet',
            effects: [
              { type: 'nuts', value: -120 },
              { type: 'friendship', value: 6 },
              { type: 'morale', value: 4 },
              { type: 'setFlag', flagId: 'mail.answered' },
            ],
            requires: { nuts: 120 },
            reactions: ['callback.mail.quietReply'],
          },
          {
            id: 'listen',
            labelKey: 'callback.mail.listen',
            requires: { flag: 'echo.recordedAnswer' },
            disabledKey: 'callback.needsRecording',
            effects: [
              { type: 'friendship', employeeId: 'echo', value: 6 },
              { type: 'reputation', value: 5 },
              { type: 'setFlag', flagId: 'mail.answered' },
            ],
            reactions: ['callback.mail.listenReply'],
          },
          {
            id: 'file',
            labelKey: 'callback.mail.file',
            effects: [
              { type: 'morale', value: -2 },
              { type: 'setFlag', flagId: 'mail.answered' },
            ],
            reactions: ['callback.mail.fileReply'],
          },
        ],
      },
    },
  },
  {
    id: 'a-second-thank-you',
    titleKey: 'callback.cutting.title',
    bodyKey: 'callback.cutting.body',
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 3600,
    employeeId: 'axel',
    momentWorthy: true,
    requires: { flag: 'axel.secondLabel', missingFlag: 'axel.thankedBack', hiredEmployee: 'axel' },
    choices: [
      {
        id: 'answer',
        labelKey: 'callback.cutting.answer',
        effects: [
          { type: 'friendship', value: 6 },
          { type: 'setFlag', flagId: 'axel.thankedBack' },
          {
            type: 'schedule',
            delaySeconds: 240,
            scheduleTitleKey: 'callback.cutting.laterTitle',
            scheduleBodyKey: 'callback.cutting.laterBody',
            scheduled: [
              { type: 'morale', value: 5 },
              { type: 'emotion', emotion: 'happy', durationSeconds: 600 },
            ],
          },
        ],
        reactions: ['callback.cutting.answerReply'],
      },
      {
        id: 'measure',
        labelKey: 'callback.cutting.measure',
        effects: [
          { type: 'reputation', value: 6 },
          { type: 'friendship', value: -2 },
          { type: 'setFlag', flagId: 'axel.thankedBack' },
        ],
        reactions: ['callback.cutting.measureReply'],
      },
    ],
  },
  {
    id: 'coffee-for-the-night-shift',
    titleKey: 'callback.coffee.title',
    bodyKey: 'callback.coffee.body',
    rarity: 'uncommon',
    weight: 8,
    cooldownSeconds: 1800,
    employeeId: 'pip',
    momentWorthy: true,
    requires: { flag: 'microgame.coffeeRescue.mastered', missingFlag: 'coffee.shiftShared' },
    choices: [
      {
        id: 'serve',
        labelKey: 'callback.coffee.serve',
        effects: [
          { type: 'morale', value: 5 },
          { type: 'friendship', value: 4 },
          { type: 'setFlag', flagId: 'coffee.shiftShared' },
        ],
      },
      {
        id: 'old-mug',
        labelKey: 'callback.coffee.mug',
        requires: { flag: 'favorite.pip.cared' },
        disabledKey: 'callback.needsMug',
        effects: [
          { type: 'friendship', value: 7 },
          { type: 'emotion', emotion: 'inspired', durationSeconds: 480 },
          { type: 'setFlag', flagId: 'coffee.shiftShared' },
        ],
        reactions: ['callback.coffee.mugReply'],
      },
      {
        id: 'sell',
        labelKey: 'callback.coffee.sell',
        effects: [
          { type: 'nuts', value: 180 },
          { type: 'morale', value: -2 },
          { type: 'setFlag', flagId: 'coffee.shiftShared' },
        ],
      },
    ],
  },
  {
    id: 'quality-is-a-kindness',
    titleKey: 'callback.bugs.title',
    bodyKey: 'callback.bugs.body',
    rarity: 'uncommon',
    weight: 8,
    cooldownSeconds: 1800,
    employeeId: 'quincy',
    momentWorthy: true,
    requires: {
      flag: 'microgame.bugSquash.mastered',
      missingFlag: 'bugs.reviewed',
      hiredEmployee: 'quincy',
    },
    choices: [
      {
        id: 'credit',
        labelKey: 'callback.bugs.credit',
        effects: [
          { type: 'reputation', value: 5 },
          { type: 'friendship', value: 5 },
          { type: 'setFlag', flagId: 'bugs.reviewed' },
        ],
        reactions: ['callback.bugs.creditReply'],
      },
      {
        id: 'habitat',
        labelKey: 'callback.bugs.habitat',
        requires: { flag: 'favorite.quincy.cared' },
        disabledKey: 'callback.needsHabitat',
        effects: [
          { type: 'morale', value: 6 },
          { type: 'friendship', value: 6 },
          { type: 'setFlag', flagId: 'bugs.reviewed' },
        ],
        reactions: ['callback.bugs.habitatReply'],
      },
      {
        id: 'deadline',
        labelKey: 'callback.bugs.deadline',
        effects: [
          { type: 'productionBoost', value: 1.2, durationSeconds: 180 },
          { type: 'friendship', value: -3 },
          { type: 'setFlag', flagId: 'bugs.reviewed' },
        ],
      },
    ],
  },
  {
    id: 'the-unlabelled-cable',
    titleKey: 'callback.cable.title',
    bodyKey: 'callback.cable.body',
    rarity: 'rare',
    weight: 6,
    cooldownSeconds: 1800,
    employeeId: 'nixie',
    momentWorthy: true,
    requires: {
      flag: 'microgame.cableUntangle.mastered',
      missingFlag: 'cable.traced',
      hiredEmployee: 'nixie',
    },
    choices: [
      {
        id: 'trace',
        labelKey: 'callback.cable.trace',
        effects: [{ type: 'setFlag', flagId: 'cable.traced' }],
        next: 'wall',
      },
      {
        id: 'label',
        labelKey: 'callback.cable.label',
        effects: [
          { type: 'reputation', value: 4 },
          { type: 'friendship', value: 3 },
          { type: 'setFlag', flagId: 'cable.traced' },
        ],
        reactions: ['callback.cable.labelReply'],
      },
    ],
    steps: {
      wall: {
        bodyKey: 'callback.cable.wall',
        choices: [
          {
            id: 'release',
            labelKey: 'callback.cable.release',
            requires: { flag: 'favorite.nixie.cared' },
            disabledKey: 'callback.needsManual',
            effects: [
              { type: 'friendship', value: 7 },
              { type: 'morale', value: 4 },
            ],
            reactions: ['callback.cable.releaseReply'],
          },
          {
            id: 'leave',
            labelKey: 'callback.cable.leave',
            effects: [
              { type: 'friendship', value: 4 },
              { type: 'emotion', emotion: 'curious', durationSeconds: 300 },
            ],
            reactions: ['callback.cable.leaveReply'],
          },
        ],
      },
    },
  },
];
