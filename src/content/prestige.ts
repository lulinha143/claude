import type { PrestigeBranchDef, PrestigeSkillDef } from './types';

// Five permanent company branches chosen at prestige ("Go Completely Nuts").
export const PRESTIGE_BRANCHES: PrestigeBranchDef[] = [
  {
    id: 'industrial',
    nameKey: 'prestige.branch.industrial.name',
    descriptionKey: 'prestige.branch.industrial.desc',
    productionMultiplier: 1.35,
    moraleBonus: -5,
    rareEventChance: 0,
  },
  {
    id: 'cooperative',
    nameKey: 'prestige.branch.cooperative.name',
    descriptionKey: 'prestige.branch.cooperative.desc',
    productionMultiplier: 1.1,
    moraleBonus: 20,
    rareEventChance: 0.02,
  },
  {
    id: 'science',
    nameKey: 'prestige.branch.science.name',
    descriptionKey: 'prestige.branch.science.desc',
    productionMultiplier: 1.2,
    moraleBonus: 0,
    rareEventChance: 0.05,
  },
  {
    id: 'marketing',
    nameKey: 'prestige.branch.marketing.name',
    descriptionKey: 'prestige.branch.marketing.desc',
    productionMultiplier: 1.15,
    moraleBonus: 5,
    rareEventChance: 0.1,
  },
  {
    id: 'underground',
    nameKey: 'prestige.branch.underground.name',
    descriptionKey: 'prestige.branch.underground.desc',
    productionMultiplier: 1.25,
    moraleBonus: 0,
    rareEventChance: 0.03,
  },
];

export const PRESTIGE_BRANCHES_BY_ID = Object.fromEntries(PRESTIGE_BRANCHES.map((b) => [b.id, b]));

// Permanent skill tree bought with Permanent Kernels.
export const PRESTIGE_SKILLS: PrestigeSkillDef[] = [
  {
    id: 'head-start',
    nameKey: 'prestige.skill.headStart.name',
    descriptionKey: 'prestige.skill.headStart.desc',
    cost: 1,
    maxLevel: 10,
    effect: { kind: 'startNuts', perLevel: 500 },
  },
  {
    id: 'compound-nuts',
    nameKey: 'prestige.skill.compound.name',
    descriptionKey: 'prestige.skill.compound.desc',
    cost: 2,
    maxLevel: 20,
    effect: { kind: 'globalMultiplier', perLevel: 0.05 },
  },
  {
    id: 'kernel-refinery',
    nameKey: 'prestige.skill.refinery.name',
    descriptionKey: 'prestige.skill.refinery.desc',
    cost: 3,
    maxLevel: 10,
    effect: { kind: 'kernelGain', perLevel: 0.1 },
  },
  {
    id: 'deep-storage',
    nameKey: 'prestige.skill.deepStorage.name',
    descriptionKey: 'prestige.skill.deepStorage.desc',
    cost: 2,
    maxLevel: 8,
    effect: { kind: 'offlineCapHours', perLevel: 1 },
  },
  {
    id: 'good-vibes',
    nameKey: 'prestige.skill.goodVibes.name',
    descriptionKey: 'prestige.skill.goodVibes.desc',
    cost: 2,
    maxLevel: 5,
    effect: { kind: 'moraleFloor', perLevel: 8 },
  },
];

export const PRESTIGE_SKILLS_BY_ID = Object.fromEntries(PRESTIGE_SKILLS.map((s) => [s.id, s]));
