import type { DailyChallengeTemplate } from './types';

export const DAILY_TEMPLATES: DailyChallengeTemplate[] = [
  { id: 'produceNuts', type: 'produceNuts', nameKey: 'daily.produceNuts', baseGoal: 5000, goldenReward: 1 },
  { id: 'completeFocus', type: 'completeFocus', nameKey: 'daily.completeFocus', baseGoal: 1, goldenReward: 2 },
  { id: 'employeeConversations', type: 'employeeConversations', nameKey: 'daily.conversations', baseGoal: 3, goldenReward: 1 },
  { id: 'playMicrogame', type: 'playMicrogame', nameKey: 'daily.microgame', baseGoal: 1, goldenReward: 1 },
  { id: 'maintainMorale', type: 'maintainMorale', nameKey: 'daily.morale', baseGoal: 90, goldenReward: 1 },
  { id: 'collectCrates', type: 'collectCrates', nameKey: 'daily.crates', baseGoal: 20, goldenReward: 1 },
];
