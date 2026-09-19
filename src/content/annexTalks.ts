import type { TalkTopic } from './employeeTalks';
export const ANNEX_TALKS: TalkTopic[] = [
  {
    id: 'annex-broadcast-return',
    employeeId: 'echo',
    titleKey: 'annex.broadcast.title',
    blurbKey: 'annex.broadcast.reply',
    root: 'return',
    once: true,
    weight: 12,
    requires: {
      flag: 'annex.broadcast.returned',
    },
    nodes: {
      return: {
        id: 'return',
        promptKey: 'annex.broadcast.evidence',
        choices: [
          {
            id: 'remember',
            labelKey: 'annex.broadcast.remember',
            replyKey: 'annex.broadcast.reply',
            effects: [
              { type: 'setFlag', flagId: 'annex.broadcast.kept' },
              {
                type: 'friendship',
                value: 5,
              },
              {
                type: 'emotion',
                emotion: 'inspired',
                durationSeconds: 240,
              },
            ],
          },
          {
            id: 'work',
            labelKey: 'annex.broadcast.work',
            replyKey: 'annex.broadcast.workReply',
            effects: [
              {
                type: 'productionBoost',
                value: 1.06,
                durationSeconds: 120,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'annex-repair-return',
    employeeId: 'bea',
    titleKey: 'annex.repair.title',
    blurbKey: 'annex.repair.reply',
    root: 'return',
    once: true,
    weight: 12,
    requires: {
      flag: 'annex.repair.returned',
    },
    nodes: {
      return: {
        id: 'return',
        promptKey: 'annex.repair.evidence',
        choices: [
          {
            id: 'remember',
            labelKey: 'annex.repair.remember',
            replyKey: 'annex.repair.keptReply',
            effects: [
              { type: 'setFlag', flagId: 'annex.repair.kept' },
              {
                type: 'friendship',
                value: 5,
              },
              {
                type: 'emotion',
                emotion: 'inspired',
                durationSeconds: 240,
              },
            ],
          },
          {
            id: 'work',
            labelKey: 'annex.repair.work',
            replyKey: 'annex.repair.workReply',
            effects: [
              {
                type: 'productionBoost',
                value: 1.06,
                durationSeconds: 120,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'annex-conservatory-return',
    employeeId: 'axel',
    titleKey: 'annex.conservatory.title',
    blurbKey: 'annex.conservatory.reply',
    root: 'return',
    once: true,
    weight: 12,
    requires: {
      flag: 'annex.conservatory.returned',
    },
    nodes: {
      return: {
        id: 'return',
        promptKey: 'annex.conservatory.evidence',
        choices: [
          {
            id: 'remember',
            labelKey: 'annex.conservatory.remember',
            replyKey: 'annex.conservatory.keptReply',
            effects: [
              { type: 'setFlag', flagId: 'annex.conservatory.kept' },
              {
                type: 'friendship',
                value: 5,
              },
              {
                type: 'emotion',
                emotion: 'inspired',
                durationSeconds: 240,
              },
            ],
          },
          {
            id: 'work',
            labelKey: 'annex.conservatory.work',
            replyKey: 'annex.conservatory.workReply',
            effects: [
              {
                type: 'productionBoost',
                value: 1.06,
                durationSeconds: 120,
              },
            ],
          },
        ],
      },
    },
  },
];
