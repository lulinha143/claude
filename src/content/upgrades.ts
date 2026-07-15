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

const roomUpgrades: UpgradeDef[] = [
  ['room-sorting', 'sorting', 500],
  ['room-lab', 'lab', 20000],
  ['room-vault', 'vault', 150000],
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
  ...roomUpgrades,
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);
