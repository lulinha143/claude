// The company's standing in the world, as a ladder rather than a raw number.
//
// Reputation was a bare float that quietly gated a few unlocks. As a named ladder
// it does three jobs at once: it tells the player how far they have come, it
// gives the next unlock a name worth reaching, and it lets the fiction escalate —
// Nutshell Inc. starts as an unregistered office and ends up as something the
// player is not entirely comfortable running.
//
// The tier names carry the arc deliberately: the company gets more respectable
// for a while, and then keeps going.

export interface ReputationTier {
  id: string;
  /** reputation required to reach this tier. */
  at: number;
  nameKey: string;
  /** the flavour line shown when the tier is reached. */
  blurbKey: string;
  /**
   * Perk granted for standing alone, independent of rooms and staffing. Small,
   * permanent and cumulative — the ladder should feel like it pays.
   */
  perk?: {
    /** additive share of production banked automatically. */
    automation?: number;
    /** additive purchase discount. */
    costReduction?: number;
    /** additive weighting toward rarer events. */
    eventLuck?: number;
    /** additive golden-nut chance on a tap. */
    goldenChance?: number;
  };
}

export const REPUTATION_TIERS: readonly ReputationTier[] = [
  {
    id: 'unlisted',
    at: 0,
    nameKey: 'repTier.unlisted.name',
    blurbKey: 'repTier.unlisted.blurb',
  },
  {
    id: 'registered',
    at: 10,
    nameKey: 'repTier.registered.name',
    blurbKey: 'repTier.registered.blurb',
    perk: { costReduction: 0.02 },
  },
  {
    id: 'local',
    at: 30,
    nameKey: 'repTier.local.name',
    blurbKey: 'repTier.local.blurb',
    perk: { costReduction: 0.03, automation: 0.02 },
  },
  {
    id: 'emerging',
    at: 70,
    nameKey: 'repTier.emerging.name',
    blurbKey: 'repTier.emerging.blurb',
    perk: { costReduction: 0.04, automation: 0.04, eventLuck: 0.02 },
  },
  {
    id: 'recognized',
    at: 140,
    nameKey: 'repTier.recognized.name',
    blurbKey: 'repTier.recognized.blurb',
    perk: { costReduction: 0.05, automation: 0.06, eventLuck: 0.04 },
  },
  {
    id: 'institution',
    at: 260,
    nameKey: 'repTier.institution.name',
    blurbKey: 'repTier.institution.blurb',
    perk: { costReduction: 0.07, automation: 0.08, eventLuck: 0.05, goldenChance: 0.002 },
  },
  {
    id: 'leader',
    at: 450,
    nameKey: 'repTier.leader.name',
    blurbKey: 'repTier.leader.blurb',
    perk: { costReduction: 0.09, automation: 0.1, eventLuck: 0.07, goldenChance: 0.004 },
  },
  {
    id: 'unaccountable',
    at: 750,
    nameKey: 'repTier.unaccountable.name',
    blurbKey: 'repTier.unaccountable.blurb',
    perk: { costReduction: 0.11, automation: 0.13, eventLuck: 0.09, goldenChance: 0.007 },
  },
  {
    id: 'irregular',
    at: 1200,
    nameKey: 'repTier.irregular.name',
    blurbKey: 'repTier.irregular.blurb',
    perk: { costReduction: 0.13, automation: 0.16, eventLuck: 0.12, goldenChance: 0.011 },
  },
];

/** The tier a given reputation currently sits in (never null: index 0 is at 0). */
export function reputationTier(reputation: number): ReputationTier {
  let current = REPUTATION_TIERS[0];
  for (const tier of REPUTATION_TIERS) {
    if (reputation >= tier.at) current = tier;
    else break;
  }
  return current;
}

/** The next tier up, or null when the company has run out of respectability. */
export function nextReputationTier(reputation: number): ReputationTier | null {
  return REPUTATION_TIERS.find((tier) => tier.at > reputation) ?? null;
}

/** 0..1 progress through the current tier toward the next one. */
export function reputationTierProgress(reputation: number): number {
  const current = reputationTier(reputation);
  const next = nextReputationTier(reputation);
  if (!next) return 1;
  const span = next.at - current.at;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (reputation - current.at) / span));
}

/** Zero-based index of the current tier, for display ("Tier 3 of 9"). */
export function reputationTierIndex(reputation: number): number {
  return REPUTATION_TIERS.indexOf(reputationTier(reputation));
}
