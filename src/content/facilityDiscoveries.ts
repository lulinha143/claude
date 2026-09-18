import type { GameEventDef } from './types';

export const FACILITY_DISCOVERIES = [
  { id: 'archive', roomId: 'archive', ensembleId: 'paper-trail', eventId: 'file-dated-tomorrow' },
  { id: 'security', roomId: 'security', ensembleId: 'night-watch', eventId: 'camera-thirteen' },
  {
    id: 'incubator',
    roomId: 'incubator',
    ensembleId: 'sprout-club',
    eventId: 'the-plant-clocked-in',
  },
] as const;

// These are discoveries the player opens from the room, not interruptions that
// compete with ordinary office events. Resolving one leaves an archival memory.
export const FACILITY_EVENTS: GameEventDef[] = [
  {
    id: 'file-dated-tomorrow',
    titleKey: 'discovery.archive.title',
    bodyKey: 'discovery.archive.body',
    rarity: 'rare',
    weight: 0,
    cooldownSeconds: 86400,
    momentWorthy: true,
    requires: { room: 'archive' },
    choices: [
      { id: 'read', labelKey: 'discovery.archive.read', effects: [], next: 'signature' },
      {
        id: 'return',
        labelKey: 'discovery.archive.return',
        effects: [
          { type: 'morale', value: 4 },
          { type: 'setFlag', flagId: 'discovery.archive' },
        ],
        reactions: ['discovery.archive.returned'],
      },
    ],
    steps: {
      signature: {
        bodyKey: 'discovery.archive.signature',
        choices: [
          {
            id: 'correct',
            labelKey: 'discovery.archive.correct',
            effects: [
              { type: 'reputation', value: 8 },
              { type: 'setFlag', flagId: 'discovery.archive' },
              { type: 'unlockSecret', secretId: 'anomaly.tomorrow' },
            ],
            reactions: ['discovery.archive.corrected'],
          },
          {
            id: 'sign',
            labelKey: 'discovery.archive.sign',
            effects: [
              { type: 'goldenNuts', value: 2 },
              { type: 'morale', value: -3 },
              { type: 'setFlag', flagId: 'discovery.archive' },
              { type: 'unlockSecret', secretId: 'anomaly.signature' },
            ],
            reactions: ['discovery.archive.signed'],
          },
        ],
      },
    },
  },
  {
    id: 'camera-thirteen',
    titleKey: 'discovery.security.title',
    bodyKey: 'discovery.security.body',
    rarity: 'rare',
    weight: 0,
    cooldownSeconds: 86400,
    momentWorthy: true,
    requires: { room: 'security' },
    choices: [
      {
        id: 'wave',
        labelKey: 'discovery.security.wave',
        effects: [
          { type: 'morale', value: 5 },
          { type: 'setFlag', flagId: 'discovery.security' },
          { type: 'unlockSecret', secretId: 'anomaly.wave' },
        ],
        reactions: ['discovery.security.waved'],
      },
      {
        id: 'unplug',
        labelKey: 'discovery.security.unplug',
        effects: [
          { type: 'productionBoost', value: 1.15, durationSeconds: 240 },
          { type: 'setFlag', flagId: 'discovery.security' },
        ],
        reactions: ['discovery.security.unplugged'],
      },
      {
        id: 'trace',
        labelKey: 'discovery.security.trace',
        requires: { flag: 'microgame.cableUntangle.mastered' },
        disabledKey: 'discovery.security.needsMastery',
        effects: [
          { type: 'reputation', value: 8 },
          { type: 'setFlag', flagId: 'discovery.security' },
          { type: 'unlockSecret', secretId: 'anomaly.futureDesk' },
        ],
        reactions: ['discovery.security.traced'],
      },
    ],
  },
  {
    id: 'the-plant-clocked-in',
    titleKey: 'discovery.incubator.title',
    bodyKey: 'discovery.incubator.body',
    rarity: 'rare',
    weight: 0,
    cooldownSeconds: 86400,
    momentWorthy: true,
    requires: { room: 'incubator' },
    choices: [
      {
        id: 'badge',
        labelKey: 'discovery.incubator.badge',
        effects: [
          { type: 'morale', value: 6 },
          { type: 'setFlag', flagId: 'discovery.incubator' },
          { type: 'unlockSecret', secretId: 'anomaly.employee24' },
        ],
        reactions: ['discovery.incubator.badged'],
      },
      {
        id: 'observe',
        labelKey: 'discovery.incubator.observe',
        effects: [
          { type: 'reputation', value: 7 },
          { type: 'setFlag', flagId: 'discovery.incubator' },
          {
            type: 'schedule',
            delaySeconds: 180,
            scheduleTitleKey: 'discovery.incubator.laterTitle',
            scheduleBodyKey: 'discovery.incubator.laterBody',
            scheduled: [{ type: 'goldenNuts', value: 1 }],
          },
        ],
        reactions: ['discovery.incubator.observed'],
      },
    ],
  },
  {
    id: 'the-previous-tenant',
    titleKey: 'discovery.return.title',
    bodyKey: 'discovery.return.body',
    rarity: 'legendary',
    weight: 5,
    cooldownSeconds: 86400,
    momentWorthy: true,
    requires: { prestige: 1, flag: 'discovery.incubator', missingFlag: 'discovery.return' },
    choices: [
      {
        id: 'welcome',
        labelKey: 'discovery.return.welcome',
        effects: [
          { type: 'morale', value: 8 },
          { type: 'setFlag', flagId: 'discovery.return' },
          { type: 'unlockSecret', secretId: 'anomaly.previousTenant' },
        ],
        reactions: ['discovery.return.welcomed'],
      },
      {
        id: 'rent',
        labelKey: 'discovery.return.rent',
        effects: [
          { type: 'goldenNuts', value: 2 },
          { type: 'setFlag', flagId: 'discovery.return' },
        ],
        reactions: ['discovery.return.rented'],
      },
    ],
  },
];
