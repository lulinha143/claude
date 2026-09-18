import type { UpgradeDef } from './types';

// 50+ standard upgrades. Repeatable "tiered" families are generated so the
// catalogue is easy to extend, while key one-off unlocks (rooms, automation)
// are declared explicitly. All display text flows through localization keys;
// tiered families interpolate {{tier}} into a shared family key.

function tieredFamily(
  prefix: string,
  familyKey: string,
  category: UpgradeDef['category'],
  count: number,
  baseCost: number,
  costGrowthBetweenTiers: number,
  perLevel: number,
): UpgradeDef[] {
  const out: UpgradeDef[] = [];
  for (let i = 0; i < count; i += 1) {
    const tier = i + 1;
    out.push({
      id: `${prefix}-${tier}`,
      nameKey: `${familyKey}.name`,
      descriptionKey: `${familyKey}.desc`,
      nameParams: { tier },
      category,
      resource: 'nuts',
      baseCost: Math.round(baseCost * Math.pow(costGrowthBetweenTiers, i)),
      costMult: 1.55,
      maxLevel: 25,
      effect: { kind: 'globalMultiplier', perLevel },
      unlock: i === 0 ? undefined : { upgradeId: `${prefix}-${tier - 1}` },
    });
  }
  return out;
}

const productionFamily = tieredFamily(
  'prod',
  'upgrade.family.production',
  'production',
  12,
  50,
  9,
  0.1,
);
const furnitureFamily = tieredFamily(
  'furniture',
  'upgrade.family.furniture',
  'furniture',
  10,
  120,
  7,
  0.06,
);
const coffeeFamily = tieredFamily('coffee', 'upgrade.family.coffee', 'coffee', 8, 300, 6, 0.08);
const qualityFamily = tieredFamily('quality', 'upgrade.family.quality', 'quality', 6, 800, 6, 0.05);

const clickFamily: UpgradeDef[] = [1, 2, 3, 4, 5].map((tier) => ({
  id: `click-${tier}`,
  nameKey: 'upgrade.family.click.name',
  descriptionKey: 'upgrade.family.click.desc',
  nameParams: { tier },
  category: 'production',
  resource: 'nuts',
  baseCost: Math.round(80 * Math.pow(8, tier - 1)),
  costMult: 1.6,
  maxLevel: 30,
  effect: { kind: 'clickPower', perLevel: 1 + tier },
  unlock: tier === 1 ? undefined : { upgradeId: `click-${tier - 1}` },
}));

const automationUpgrades: UpgradeDef[] = [
  {
    id: 'auto-collector',
    nameKey: 'upgrade.autoCollector.name',
    descriptionKey: 'upgrade.autoCollector.desc',
    category: 'automation',
    resource: 'nuts',
    baseCost: 5000,
    costMult: 3,
    maxLevel: 5,
    effect: { kind: 'autoCollect', perLevel: 0.25 },
  },
  {
    id: 'conveyor',
    nameKey: 'upgrade.conveyor.name',
    descriptionKey: 'upgrade.conveyor.desc',
    category: 'automation',
    resource: 'nuts',
    baseCost: 25000,
    costMult: 2.4,
    maxLevel: 10,
    effect: { kind: 'globalMultiplier', perLevel: 0.15 },
    unlock: { upgradeId: 'auto-collector' },
  },
  {
    id: 'offline-cap-1',
    nameKey: 'upgrade.offlineCap.name',
    descriptionKey: 'upgrade.offlineCap.desc',
    nameParams: { tier: 1 },
    category: 'automation',
    resource: 'goldenNuts',
    baseCost: 2,
    costMult: 2,
    maxLevel: 8,
    effect: { kind: 'offlineCapHours', perLevel: 2 },
  },
  {
    id: 'reputation-engine',
    nameKey: 'upgrade.reputationEngine.name',
    descriptionKey: 'upgrade.reputationEngine.desc',
    category: 'automation',
    resource: 'nuts',
    baseCost: 40000,
    costMult: 2.2,
    maxLevel: 15,
    effect: { kind: 'reputationRate', perLevel: 0.4 },
  },
  {
    id: 'morale-cap',
    nameKey: 'upgrade.moraleCap.name',
    descriptionKey: 'upgrade.moraleCap.desc',
    category: 'quality',
    resource: 'nuts',
    baseCost: 15000,
    costMult: 2,
    maxLevel: 5,
    effect: { kind: 'moraleCap', perLevel: 10 },
  },
];

/**
 * Upgrades that change how the company PLAYS, not how big its numbers are.
 *
 * Each one hooks a system that already exists — the tap crit roll, the combo
 * window, the golden-nut drop, event payouts, room staffing — through
 * `upgradeBonus`, and stacks with the room network's contribution to the same
 * thing rather than replacing it. They are deliberately few, expensive, and
 * shallow (small maxLevel), because their job is to open a strategy, not to be
 * bought forty times.
 */
const behaviourUpgrades: UpgradeDef[] = [
  // --- Sharper taps ----------------------------------------------------------
  {
    id: 'calibrated-tools',
    nameKey: 'upgrade.calibratedTools.name',
    descriptionKey: 'upgrade.calibratedTools.desc',
    category: 'production',
    resource: 'nuts',
    baseCost: 9000,
    costMult: 2.5,
    maxLevel: 6,
    effect: { kind: 'critChance', perLevel: 0.02 },
    unlock: { upgradeId: 'click-2' },
  },
  {
    id: 'technique-manual',
    nameKey: 'upgrade.techniqueManual.name',
    descriptionKey: 'upgrade.techniqueManual.desc',
    category: 'production',
    resource: 'goldenNuts',
    baseCost: 4,
    costMult: 2.2,
    maxLevel: 4,
    effect: { kind: 'critChance', perLevel: 0.035 },
    unlock: { upgradeId: 'calibrated-tools' },
  },
  // --- Longer combos: rewards actually staying at a station ------------------
  {
    id: 'muscle-memory',
    nameKey: 'upgrade.muscleMemory.name',
    descriptionKey: 'upgrade.muscleMemory.desc',
    category: 'production',
    resource: 'nuts',
    baseCost: 14000,
    costMult: 2.6,
    maxLevel: 5,
    effect: { kind: 'comboWindow', perLevel: 0.12 },
    unlock: { upgradeId: 'click-3' },
  },
  {
    id: 'shift-rhythm',
    nameKey: 'upgrade.shiftRhythm.name',
    descriptionKey: 'upgrade.shiftRhythm.desc',
    category: 'quality',
    resource: 'nuts',
    baseCost: 120000,
    costMult: 2.8,
    maxLevel: 4,
    effect: { kind: 'comboWindow', perLevel: 0.18 },
    unlock: { upgradeId: 'muscle-memory' },
  },
  // --- Premium currency as a strategy, not a trickle ------------------------
  {
    id: 'assay-desk',
    nameKey: 'upgrade.assayDesk.name',
    descriptionKey: 'upgrade.assayDesk.desc',
    category: 'quality',
    resource: 'nuts',
    baseCost: 60000,
    costMult: 3,
    maxLevel: 5,
    effect: { kind: 'goldenChance', perLevel: 0.008 },
    unlock: { reputation: 45 },
  },
  {
    id: 'gilding-programme',
    nameKey: 'upgrade.gildingProgramme.name',
    descriptionKey: 'upgrade.gildingProgramme.desc',
    category: 'quality',
    resource: 'goldenNuts',
    baseCost: 6,
    costMult: 2.4,
    maxLevel: 4,
    effect: { kind: 'goldenChance', perLevel: 0.014 },
    unlock: { upgradeId: 'assay-desk' },
  },
  // --- Decisions worth more, without making them safer ----------------------
  {
    id: 'legal-review',
    nameKey: 'upgrade.legalReview.name',
    descriptionKey: 'upgrade.legalReview.desc',
    category: 'quality',
    resource: 'nuts',
    baseCost: 35000,
    costMult: 2.7,
    maxLevel: 5,
    effect: { kind: 'eventReward', perLevel: 0.12 },
    unlock: { reputation: 30 },
  },
  {
    id: 'negotiation-training',
    nameKey: 'upgrade.negotiationTraining.name',
    descriptionKey: 'upgrade.negotiationTraining.desc',
    category: 'quality',
    resource: 'nuts',
    baseCost: 260000,
    costMult: 2.9,
    maxLevel: 4,
    effect: { kind: 'eventReward', perLevel: 0.18 },
    unlock: { upgradeId: 'legal-review' },
  },
  // --- Make a thin department punch above its headcount ---------------------
  {
    id: 'standard-procedures',
    nameKey: 'upgrade.standardProcedures.name',
    descriptionKey: 'upgrade.standardProcedures.desc',
    category: 'quality',
    resource: 'nuts',
    baseCost: 45000,
    costMult: 2.6,
    maxLevel: 6,
    effect: { kind: 'roomEfficiency', perLevel: 0.07 },
    unlock: { reputation: 50 },
  },
  {
    id: 'internal-audit',
    nameKey: 'upgrade.internalAudit.name',
    descriptionKey: 'upgrade.internalAudit.desc',
    category: 'automation',
    resource: 'nuts',
    baseCost: 500000,
    costMult: 3,
    maxLevel: 4,
    effect: { kind: 'roomEfficiency', perLevel: 0.11 },
    unlock: { upgradeId: 'standard-procedures' },
  },
];

const roomUpgrades: UpgradeDef[] = [
  ['room-sorting', 'sorting', 500],
  // The mail room is cheap and early: it is the first room that makes the REST of
  // the building cheaper, so finding it early is its own reward.
  ['room-mailroom', 'mailroom', 4000],
  ['room-lab', 'lab', 20000],
  ['room-vault', 'vault', 150000],
  // The archive turns the company's own paperwork into discoveries.
  ['room-archive', 'archive', 400000],
  ['room-meeting', 'meeting', 1000000],
  ['room-basement', 'basement', 3000000],
].map(([id, roomId, cost]) => ({
  id: id as string,
  nameKey: `upgrade.room.${roomId}.name`,
  descriptionKey: `upgrade.room.${roomId}.desc`,
  category: 'room',
  resource: 'nuts',
  baseCost: cost as number,
  costMult: 1,
  maxLevel: 1,
  effect: { kind: 'unlockRoom', roomId: roomId as string },
}));

export const UPGRADES: UpgradeDef[] = [
  ...productionFamily,
  ...furnitureFamily,
  ...coffeeFamily,
  ...qualityFamily,
  ...clickFamily,
  ...automationUpgrades,
  ...behaviourUpgrades,
  ...roomUpgrades,
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);
