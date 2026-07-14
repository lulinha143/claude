import type { NutDef } from './types';

// The Nut Encyclopedia — 24 collectible fictional nuts. Discovered through
// events, micro-games, milestones and secrets.
export const NUTS: NutDef[] = [
  { id: 'intern-acorn', nameKey: 'nut.internAcorn.name', descriptionKey: 'nut.internAcorn.desc', rarity: 'common', color: '#a9743b' },
  { id: 'corporate-cashew', nameKey: 'nut.corporateCashew.name', descriptionKey: 'nut.corporateCashew.desc', rarity: 'common', color: '#e8c98a' },
  { id: 'management-macadamia', nameKey: 'nut.managementMacadamia.name', descriptionKey: 'nut.managementMacadamia.desc', rarity: 'uncommon', color: '#f0e6d2' },
  { id: 'suspicious-pistachio', nameKey: 'nut.suspiciousPistachio.name', descriptionKey: 'nut.suspiciousPistachio.desc', rarity: 'uncommon', color: '#9cbf6a' },
  { id: 'legally-distinct-walnut', nameKey: 'nut.walnut.name', descriptionKey: 'nut.walnut.desc', rarity: 'rare', color: '#6b4b2a' },
  { id: 'forbidden-peanut', nameKey: 'nut.forbiddenPeanut.name', descriptionKey: 'nut.forbiddenPeanut.desc', rarity: 'rare', color: '#d9a441' },
  { id: 'executive-hazelnut', nameKey: 'nut.executiveHazelnut.name', descriptionKey: 'nut.executiveHazelnut.desc', rarity: 'legendary', color: '#b8860b' },
  { id: 'emotional-support-almond', nameKey: 'nut.almond.name', descriptionKey: 'nut.almond.desc', rarity: 'uncommon', color: '#e6c9a8' },
  { id: 'startup-chestnut', nameKey: 'nut.chestnut.name', descriptionKey: 'nut.chestnut.desc', rarity: 'common', color: '#7a3b1d' },
  { id: 'quarterly-brazil-nut', nameKey: 'nut.brazilNut.name', descriptionKey: 'nut.brazilNut.desc', rarity: 'uncommon', color: '#5a4632' },
  { id: 'synergy-pecan', nameKey: 'nut.pecan.name', descriptionKey: 'nut.pecan.desc', rarity: 'common', color: '#8a5a2b' },
  { id: 'disruptive-pine-nut', nameKey: 'nut.pineNut.name', descriptionKey: 'nut.pineNut.desc', rarity: 'rare', color: '#e9dcae' },
  { id: 'onboarding-walnut', nameKey: 'nut.onboardingWalnut.name', descriptionKey: 'nut.onboardingWalnut.desc', rarity: 'common', color: '#6b4b2a' },
  { id: 'overtime-acorn', nameKey: 'nut.overtimeAcorn.name', descriptionKey: 'nut.overtimeAcorn.desc', rarity: 'uncommon', color: '#8a5f30' },
  { id: 'stakeholder-cashew', nameKey: 'nut.stakeholderCashew.name', descriptionKey: 'nut.stakeholderCashew.desc', rarity: 'uncommon', color: '#e8c98a' },
  { id: 'golden-kernel', nameKey: 'nut.goldenKernel.name', descriptionKey: 'nut.goldenKernel.desc', rarity: 'legendary', color: '#ffd700' },
  { id: 'crypto-nut', nameKey: 'nut.cryptoNut.name', descriptionKey: 'nut.cryptoNut.desc', rarity: 'rare', color: '#7c5cff' },
  { id: 'compliance-cob-nut', nameKey: 'nut.cobNut.name', descriptionKey: 'nut.cobNut.desc', rarity: 'common', color: '#b98a4b' },
  { id: 'severance-acorn', nameKey: 'nut.severanceAcorn.name', descriptionKey: 'nut.severanceAcorn.desc', rarity: 'uncommon', color: '#9a6a30' },
  { id: 'legacy-hazelnut', nameKey: 'nut.legacyHazelnut.name', descriptionKey: 'nut.legacyHazelnut.desc', rarity: 'rare', color: '#a9743b' },
  { id: 'agile-almond', nameKey: 'nut.agileAlmond.name', descriptionKey: 'nut.agileAlmond.desc', rarity: 'common', color: '#e6c9a8' },
  { id: 'burnout-brazil', nameKey: 'nut.burnoutBrazil.name', descriptionKey: 'nut.burnoutBrazil.desc', rarity: 'uncommon', color: '#5a4632' },
  { id: 'visionary-pistachio', nameKey: 'nut.visionaryPistachio.name', descriptionKey: 'nut.visionaryPistachio.desc', rarity: 'rare', color: '#9cbf6a' },
  { id: 'founder-acorn', nameKey: 'nut.founderAcorn.name', descriptionKey: 'nut.founderAcorn.desc', rarity: 'legendary', color: '#c65b3c' },
];

export const NUTS_BY_ID: Record<string, NutDef> = Object.fromEntries(NUTS.map((n) => [n.id, n]));
