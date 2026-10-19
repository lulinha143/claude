import type { EventRarity } from '../sim/types';
import type { RoomReward } from './roomPlay';

// Happenings: how events reach the player.
//
// An event no longer opens itself. It STARTS HAPPENING somewhere in the office
// (an incident): the teammate it is about, or someone in the room, points it out,
// a marker waits where it is happening, and the elevator says which floor. The
// player looks into it when they choose to. Nothing stacks: a couple of things
// at most wait at once, each in its own room. Ignored, an ordinary incident is
// handled by the team after a while; a rare one simply passes.
//
// Not everything is an incident. Some things are just moments (WORLD_MOMENTS):
// two teammates say something, the room is a little nicer for it, and that is
// all. No choice, no popup.
//
// And choices are remembered (EVENT_MEMORIES): a decision leaves a mark that a
// teammate brings up later, unprompted, when the player is around, and then
// now and then in conversation.

export const HAPPENINGS = {
  /** nothing happens until a new founder has had this long with the crate. */
  firstAfterSeconds: 180,
  /** chance, per event roll, that something happens at all. */
  chance: 0.3,
  /** of the things that happen, this share are small moments rather than incidents. */
  momentShare: 0.35,
  /** at most this many incidents wait at once. */
  maxIncidents: 2,
  /** how long an incident waits before it resolves itself (or passes). */
  lingerSeconds: { common: 25 * 60, uncommon: 35 * 60, rare: 90 * 60, legendary: 6 * 3600 },
  /**
   * How likely each rarity is when an incident is picked. Within a rarity, the
   * events' own weights decide. A tier with nothing eligible is skipped.
   */
  tierOdds: { common: 52, uncommon: 32, rare: 12, legendary: 2 } as Record<EventRarity, number>,
  /**
   * A dry spell: after this many incidents without a rare one, rare and legendary
   * odds grow by `droughtStep` of themselves per further incident, so a long run
   * of ordinary days always ends, without making rare things common.
   */
  droughtAfter: 6,
  droughtStep: 0.25,
  /**
   * Event luck (rooms, passives, the prestige branch) scales rare odds by
   * 1 + luck × this, with luck counted up to `maxLuck`: a lucky company sees
   * rare things up to twice as often, never so often that they stop being rare.
   */
  luckScale: 1,
  maxLuck: 1,
  /** a remembered choice is brought up this long after (min, max seconds). */
  memoryDelay: [240, 600] as const,
  /** at most this many remarks wait to be said. */
  maxRemarks: 8,
  /** the diary keeps this many entries. */
  diarySize: 40,
  /** while away, at most one incident per this many seconds turns up (up to the cap). */
  awaySecondsPerIncident: 15 * 60,
  /** a follow-up with no room to happen in tries again this much later. */
  followUpRetrySeconds: 5 * 60,
} as const;

/**
 * Where the events that are not about one teammate happen: the first of these
 * rooms the company has. (Everything else happens where its teammate works, or
 * in its required room.) Falls back to the Founder's Desk.
 */
export const EVENT_PLACES: Record<string, readonly string[]> = {
  'printer-demands': ['mailroom', 'meeting'],
  'nut-audit': ['vault', 'procurement'],
  'mandatory-optional-meeting': ['meeting'],
  'coffee-consciousness': ['morale', 'cafeteria'],
  pigeon: ['rooftop', 'mailroom'],
  'technically-on-fire': ['construction', 'basement'],
  'golden-acorn': ['vault'],
  'reply-all': ['mailroom'],
  'chair-promoted': ['meeting'],
  'small-merger': ['meeting'],
  'stapler-disappearance': ['procurement'],
  'union-snacks': ['cafeteria', 'morale'],
  'mysterious-walnut': ['lab', 'research'],
  spreadsheet: ['procurement'],
  'existential-crisis': ['nap', 'morale'],
  'sunglasses-day': ['rooftop'],
  'break-room-independence': ['morale'],
  'acorn-water': ['cafeteria', 'morale'],
  'vault-humming': ['vault'],
  'fake-award': ['marketing'],
  'stolen-slogan': ['marketing'],
  'named-nuts': ['sorting'],
  'office-ghost': ['archive', 'basement'],
  'coffee-leave': ['morale', 'cafeteria'],
  'accountant-remembers': ['procurement'],
  'morale-petition': ['morale', 'cafeteria'],
  'morale-walkout': ['morale', 'cafeteria'],
  'morale-spontaneous-party': ['morale', 'cafeteria'],
  'anomaly-corridor': ['construction'],
  'research-grant': ['research', 'lab'],
  'golden-buyer': ['vault'],
  'the-previous-tenant': ['incubator'],
  'centrifuge-wont-stop': ['lab'],
};

/** What the presenter says when an incident starts, by rarity (unless the event has its own). */
export const HOOKS: Record<EventRarity, readonly string[]> = {
  common: ['incident.hook.common.1', 'incident.hook.common.2'],
  uncommon: ['incident.hook.uncommon.1', 'incident.hook.uncommon.2'],
  rare: ['incident.hook.rare.1', 'incident.hook.rare.2'],
  legendary: ['incident.hook.legendary.1'],
};

// ---- small moments ----------------------------------------------------------------

export interface WorldMomentDef {
  id: string;
  /** who is in it; lines alternate between them, starting with the first. */
  cast: readonly string[];
  /** how many lines it has (`scene.<id>.line1`, `line2`, …; its name is `scene.<id>.title`). */
  lines: number;
  weight: number;
  /** seconds before the same moment can happen again. */
  cooldownSeconds: number;
  requires?: {
    /** all of the cast work in the same room. */
    together?: boolean;
    night?: boolean;
    flag?: string;
    /** one of the cast works in this room. */
    room?: string;
  };
  /** small, and only ever good. */
  reward: RoomReward;
}

export const WORLD_MOMENTS: readonly WorldMomentDef[] = [
  {
    id: 'synchronised-watches',
    cast: ['junie', 'pingo'],
    lines: 2,
    weight: 5,
    cooldownSeconds: 3600,
    reward: { reputation: 1, morale: 1 },
  },
  {
    id: 'nap-on-the-agenda',
    cast: ['nino'],
    lines: 1,
    weight: 4,
    cooldownSeconds: 3600,
    reward: { morale: 2 },
  },
  {
    id: 'breathing-exercise',
    cast: ['marlow', 'pip'],
    lines: 2,
    weight: 5,
    cooldownSeconds: 3600,
    requires: { together: true },
    reward: { morale: 3, mood: { emotion: 'relaxed', seconds: 300 } },
  },
  {
    id: 'load-bearing-stapler',
    cast: ['bea'],
    lines: 1,
    weight: 4,
    cooldownSeconds: 3600,
    reward: { reputation: 1, output: 10 },
  },
  {
    id: 'fridge-at-night',
    cast: ['echo'],
    lines: 1,
    weight: 6,
    cooldownSeconds: 4 * 3600,
    requires: { night: true },
    reward: { morale: 1 },
  },
  {
    id: 'five-minute-runway',
    cast: ['rosa'],
    lines: 2,
    weight: 4,
    cooldownSeconds: 3600,
    reward: { morale: 2, mood: { emotion: 'excited', seconds: 300 } },
  },
  {
    id: 'leaf-count',
    cast: ['axel'],
    lines: 1,
    weight: 4,
    cooldownSeconds: 3600,
    reward: { morale: 2 },
  },
  {
    id: 'the-shortcut',
    cast: ['pingo'],
    lines: 1,
    weight: 3,
    cooldownSeconds: 3600,
    reward: { boost: { value: 1.05, seconds: 120 } },
  },
  {
    id: 'receipt-tower',
    cast: ['otto', 'rizzo'],
    lines: 2,
    weight: 4,
    cooldownSeconds: 3600,
    requires: { together: true },
    reward: { output: 15 },
  },
  {
    id: 'field-notes',
    cast: ['canela'],
    lines: 1,
    weight: 3,
    cooldownSeconds: 3600,
    reward: { reputation: 1 },
  },
  // Only ever as the payoff of a bet made in the lab (see the bug bounty).
  {
    id: 'lunch-bet',
    cast: ['quincy', 'nixie'],
    lines: 2,
    weight: 0,
    cooldownSeconds: 0,
    reward: { output: 30, morale: 2 },
  },
];

export const WORLD_MOMENTS_BY_ID: Record<string, WorldMomentDef> = Object.fromEntries(
  WORLD_MOMENTS.map((def) => [def.id, def]),
);

// ---- remembered choices ---------------------------------------------------------

/**
 * A mark a choice leaves, and the teammate who brings it up: once, unprompted,
 * a few minutes later; then now and then when the player pokes them. The line
 * lives at `memory.<key>`.
 */
export interface EventMemory {
  flag: string;
  employeeId: string;
  key: string;
}

function remember(flag: string, employeeId: string, key: string): EventMemory {
  return { flag, employeeId, key };
}

export const EVENT_MEMORIES: readonly EventMemory[] = [
  // Choices made in earlier events that nothing ever mentioned again.
  remember('trusted-bia', 'bia', 'trustedBia'),
  remember('reviewed-the-vault', 'bia', 'reviewedVault'),
  remember('trusted-quincy', 'quincy', 'trustedQuincy'),
  remember('ignored-quincy', 'quincy', 'ignoredQuincy'),
  remember('let-sonny-finish', 'dorm', 'letSonnyFinish'),
  remember('didnt-ask-inky', 'inky', 'didntAskInky'),
  remember('archived-the-hum', 'echo', 'archivedHum'),
  remember('deleted-the-hum', 'echo', 'deletedHum'),
  remember('funded-the-runway', 'rosa', 'fundedRunway'),
  remember('perry-no-questions', 'perry', 'perryNoQuestions'),
  remember('studied-the-regrowth', 'axel', 'studiedRegrowth'),
  remember('asked-marlow', 'marlow', 'askedMarlow'),
  remember('filed-the-manifest', 'pingo', 'filedManifest'),
  remember('resealed-the-pallet', 'pingo', 'resealedPallet'),
  remember('canela-surveyed', 'canela', 'canelaSurveyed'),
  remember('kept-the-parcel', 'junie', 'keptParcel'),
  remember('filed-the-parcel', 'junie', 'filedParcel'),
  remember('watched-the-tape', 'corvus', 'watchedTape'),
  remember('deleted-the-tape', 'corvus', 'deletedTape'),
  remember('adopted-the-hatchling', 'axel', 'adoptedHatchling'),
  remember('gave-the-day-off', 'marlow', 'gaveDayOff'),
  remember('ignored-walkout', 'marlow', 'ignoredWalkout'),
  remember('listened-to-staff', 'marlow', 'listenedToStaff'),
  remember('ignored-staff', 'marlow', 'ignoredStaff'),
  remember('ledger-buried', 'otto', 'ledgerBuried'),
  remember('ledger-reported', 'otto', 'ledgerReported'),
  remember('accountant-favour', 'otto', 'accountantFavour'),
  remember('vending-audited', 'otto', 'vendingAudited'),
  remember('sold-a-golden', 'rizzo', 'soldGolden'),
  remember('refused-the-buyer', 'rizzo', 'refusedBuyer'),
  remember('grant-embellished', 'mina', 'grantEmbellished'),
  remember('grant-honest', 'mina', 'grantHonest'),
  remember('box-reshelved', 'moss', 'boxReshelved'),
  remember('acted-on-the-box', 'moss', 'actedOnBox'),
  remember('remeasured-the-corridor', 'bea', 'remeasuredCorridor'),
  remember('amended-the-plan', 'bea', 'amendedPlan'),
  remember('basement-supplied', 'nixie', 'basementSupplied'),
  remember('basement-denied', 'nixie', 'basementDenied'),
  remember('desk-removed', 'echo', 'deskRemoved'),
  remember('intern-told-truth', 'pip', 'internTruth'),
  remember('corrected-the-record', 'pip', 'correctedRecord'),
  remember('documented-good-week', 'junie', 'goodWeek'),
  // This chapter's incidents.
  remember('bounty.quincy', 'nixie', 'bountyQuincy'),
  remember('bounty.nixie', 'quincy', 'bountyNixie'),
  remember('bounty.contest', 'quincy', 'bountyContest'),
  remember('rebrand.neon', 'rosa', 'rebrandNeon'),
  remember('rebrand.pink', 'corvus', 'rebrandPink'),
  remember('rebrand.neonpink', 'corvus', 'rebrandNeonPink'),
  remember('bidding.rizzo', 'perry', 'biddingRizzo'),
  remember('bidding.perry', 'rizzo', 'biddingPerry'),
  remember('bidding.audited', 'otto', 'biddingAudited'),
  remember('nightshift.played', 'echo', 'nightshiftPlayed'),
  remember('nightshift.secret', 'moss', 'nightshiftSecret'),
  remember('minutes.laminated', 'hazel', 'minutesLaminated'),
  remember('minutes.clause3', 'hazel', 'minutesClause3'),
  remember('minutes.clause3Stands', 'nino', 'minutesClause3Stands'),
  remember('sonny.carried', 'bia', 'sonnyCarried'),
  remember('sonny.vaultSleeper', 'dorm', 'sonnyVaultSleeper'),
  remember('centrifuge.spun', 'canela', 'centrifugeSpun'),
  remember('centrifuge.unplugged', 'canela', 'centrifugeUnplugged'),
  remember('soup.named', 'marlow', 'soupNamed'),
  remember('soup.served', 'bia', 'soupServed'),
  remember('treeParcel.planted', 'pip', 'treeParcelPlanted'),
  remember('treeParcel.vault', 'bia', 'treeParcelVault'),
  remember('acorn.axel', 'axel', 'acornAxel'),
  remember('scarf.catwalk', 'pingo', 'scarfCatwalk'),
  remember('scarf.scheduled', 'junie', 'scarfScheduled'),
  remember('thirteenth.pressed', 'moss', 'thirteenthPressed'),
  remember('thirteenth.told', 'echo', 'thirteenthTold'),
];

/** Every memory a flag leaves (a flag may be remembered by more than one teammate). */
export function memoriesOf(flag: string): EventMemory[] {
  return EVENT_MEMORIES.filter((memory) => memory.flag === flag);
}

/** The paranormal curiosities it takes for the building to start acting on it. */
export const ANOMALY_THREAD_AFTER = 3;
export const ANOMALY_THREAD_FLAG = 'anomaly.thread';
