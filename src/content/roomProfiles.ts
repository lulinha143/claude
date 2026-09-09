// What each room DOES for the company, and what it costs to run.
//
// This is the synergy network. Rooms are not isolated upgrade containers: each
// one contributes effects to shared company-wide modifiers, several of them only
// pay out when a partner room is also running, and the strongest rooms carry real
// penalties that other rooms exist to cancel. That is what turns "unlock
// everything" into "design a company".
//
// The intended shape of the network:
//
//   Sorting / Construction  →  raw output, at the cost of morale
//   Lab                     →  the biggest output boost, the biggest morale hit
//   Break Room / Nap        →  morale, and they specifically offset the above
//   Marketing               →  turns HIGH MORALE into reputation
//   Reputation              →  unlocks rooms, teammates and rarer events
//   Vault / Basement        →  turn the late company into golden nuts
//   Research / Rooftop      →  sharpen the ACTIVE layer (crits, combos, luck)
//   Meeting / Procurement   →  make the whole building cheaper and steadier
//
// So a player who only stacks output rooms watches morale collapse and
// production fall with it; a player who balances them unlocks the reputation
// ladder and the premium currency. Both are legible in the Company screen.
//
// Everything here is DATA. `sim/companyModifiers.ts` interprets it generically —
// there is no per-room code anywhere.

/**
 * A room's temperament. Drives its interaction personality, its accent colour and
 * the kind of events that favour it, so a player recognises what a room is for
 * before reading a single number.
 */
export type RoomTemper =
  /** dependable, everyday company operations. */
  | 'operational'
  /** people-focused: morale, recovery, chemistry. */
  | 'social'
  /** measurement, research, precision. */
  | 'analytical'
  /** heavy output, noisy, wearing. */
  | 'industrial'
  /** money, storage, control. */
  | 'secure'
  /** the parts of Nutshell Inc. nobody puts in the brochure. */
  | 'irregular';

/** Company-wide levers a room can push. */
export type RoomEffectKind =
  /** multiplier on all nut production. */
  | 'production'
  /** multiplier on the value of a manual tap. */
  | 'clickPower'
  /** additive shift to the morale the company settles at. */
  | 'moraleTarget'
  /** multiplier on how fast morale moves toward its target. */
  | 'moraleRegen'
  /** additive reputation per second. */
  | 'reputationRate'
  /** additive chance that a tap also yields a golden nut. */
  | 'goldenChance'
  /** additive critical-tap chance. */
  | 'critChance'
  /** multiplier on how long a combo survives between taps. */
  | 'comboWindow'
  /** additive discount on purchases. */
  | 'costReduction'
  /** additive weighting toward rarer, better events. */
  | 'eventLuck'
  /** additive share of production banked automatically. */
  | 'automation';

export interface RoomEffect {
  kind: RoomEffectKind;
  /**
   * The effect at FULL staffing. Additive kinds add; multiplier kinds
   * (`production`, `clickPower`, `moraleRegen`, `comboWindow`) express a
   * fractional change, so 0.2 means +20% and -0.1 means -10%.
   */
  value: number;
  /**
   * Structural effects apply as soon as the room is unlocked and do not scale
   * with who is standing in it. Use for "the room itself does this".
   */
  fixed?: boolean;
  /**
   * Cross-room dependency: this effect is inert unless the named room is also
   * unlocked AND staffed. This is what creates genuine chains rather than a flat
   * list of bonuses.
   */
  requiresRoom?: string;
  /**
   * Morale-gated scaling. The effect scales with how far morale sits ABOVE this
   * pivot (0 at the pivot, full value at the morale cap). Lets a room convert
   * company mood into something else — Marketing turning happiness into
   * reputation is the clearest case.
   */
  moralePivot?: number;
}

export interface RoomProfile {
  roomId: string;
  temper: RoomTemper;
  /** i18n key for the one-line "what is this room for" summary. */
  summaryKey: string;
  /** What the room gives the company. */
  effects: RoomEffect[];
  /** What running it costs. Same shape; authored separately so the UI can say so. */
  tradeoffs: RoomEffect[];
  /** Rooms this one meaningfully supports, for the synergy map in the UI. */
  feeds?: readonly string[];
  /**
   * Teammates who are unusually effective here, beyond ordinary home-room
   * affinity. A specialist in the room boosts that room's own effects.
   */
  specialists?: readonly string[];
}

/**
 * Employees needed for a room's staffed effects to reach full strength. Below
 * this the effects scale down proportionally, so a half-staffed room is worth
 * roughly half as much — assignment is a real decision, not a checkbox.
 */
export const ROOM_FULL_STAFF = 3;

/** How much one specialist adds to the room's own staffed effects. */
export const SPECIALIST_BONUS = 0.25;

export const ROOM_PROFILES: readonly RoomProfile[] = [
  // --- The company as it starts: modest, and the home of the first tap -------
  {
    roomId: 'founder-desk',
    temper: 'operational',
    summaryKey: 'roomProfile.founderDesk',
    effects: [
      { kind: 'clickPower', value: 0.15, fixed: true },
      { kind: 'production', value: 0.05, fixed: true },
    ],
    tradeoffs: [],
    feeds: ['sorting'],
    specialists: ['pip'],
  },

  // --- Output, at a cost ----------------------------------------------------
  {
    roomId: 'sorting',
    temper: 'industrial',
    summaryKey: 'roomProfile.sorting',
    effects: [
      { kind: 'production', value: 0.18 },
      { kind: 'comboWindow', value: 0.2 },
    ],
    // Repetitive work wears people down.
    tradeoffs: [{ kind: 'moraleTarget', value: -4 }],
    feeds: ['procurement'],
    specialists: ['pingo', 'junie', 'inky'],
  },
  {
    roomId: 'construction',
    temper: 'industrial',
    summaryKey: 'roomProfile.construction',
    effects: [
      { kind: 'production', value: 0.12, fixed: true },
      // The workshop is where the company's automation actually gets built.
      { kind: 'automation', value: 0.08 },
    ],
    tradeoffs: [{ kind: 'moraleTarget', value: -5 }],
    feeds: ['procurement', 'vault'],
    specialists: ['bea'],
  },

  // --- The classic trade: the Lab is the strongest and the most costly ------
  {
    roomId: 'lab',
    temper: 'analytical',
    summaryKey: 'roomProfile.lab',
    effects: [
      { kind: 'production', value: 0.35 },
      { kind: 'eventLuck', value: 0.05 },
    ],
    // Deliberately steep: the Lab is meant to CREATE a problem the social rooms
    // solve, so balancing the building is an actual decision.
    tradeoffs: [
      { kind: 'moraleTarget', value: -10 },
      { kind: 'reputationRate', value: -0.01 },
    ],
    feeds: ['research'],
    specialists: ['nixie', 'quincy', 'axel'],
  },

  // --- People rooms: they exist to make the output rooms survivable ---------
  {
    roomId: 'morale',
    temper: 'social',
    summaryKey: 'roomProfile.morale',
    effects: [
      { kind: 'moraleTarget', value: 9 },
      { kind: 'moraleRegen', value: 0.4 },
    ],
    tradeoffs: [],
    feeds: ['sorting', 'lab', 'marketing'],
    specialists: ['marlow', 'hazel'],
  },
  {
    roomId: 'nap',
    temper: 'social',
    summaryKey: 'roomProfile.nap',
    effects: [
      { kind: 'moraleTarget', value: 12 },
      { kind: 'moraleRegen', value: 0.6 },
      // Rested people make fewer expensive mistakes.
      { kind: 'costReduction', value: 0.05 },
    ],
    tradeoffs: [
      // Nobody in the nap room is producing anything.
      { kind: 'production', value: -0.06 },
    ],
    feeds: ['lab', 'basement'],
    specialists: ['dorm', 'marlow'],
  },

  // --- Morale becomes reputation -------------------------------------------
  {
    roomId: 'marketing',
    temper: 'social',
    summaryKey: 'roomProfile.marketing',
    effects: [
      { kind: 'reputationRate', value: 0.05 },
      // The pitch only lands if the company is actually a nice place to work:
      // this doubles down when morale is high and pays nothing when it is not.
      { kind: 'reputationRate', value: 0.09, moralePivot: 65 },
    ],
    tradeoffs: [{ kind: 'production', value: -0.04 }],
    feeds: ['rooftop'],
    specialists: ['corvus', 'fenn', 'rosa'],
  },

  // --- Efficiency and steadiness ------------------------------------------
  {
    roomId: 'procurement',
    temper: 'operational',
    summaryKey: 'roomProfile.procurement',
    effects: [
      { kind: 'costReduction', value: 0.1 },
      // Good supply lines only matter if something is being built.
      { kind: 'production', value: 0.1, requiresRoom: 'construction' },
    ],
    tradeoffs: [],
    feeds: ['construction', 'vault'],
    specialists: ['rizzo', 'otto', 'perry'],
  },
  {
    roomId: 'meeting',
    temper: 'operational',
    summaryKey: 'roomProfile.meeting',
    effects: [
      // Coordination: modest on its own, but it steadies the whole company.
      { kind: 'production', value: 0.08, fixed: true },
      { kind: 'moraleRegen', value: 0.25 },
      { kind: 'reputationRate', value: 0.02 },
    ],
    tradeoffs: [
      // Meetings are, famously, where output goes.
      { kind: 'production', value: -0.05 },
    ],
    feeds: ['marketing', 'research'],
    specialists: ['hazel', 'nino'],
  },

  // --- The active layer gets sharper ---------------------------------------
  {
    roomId: 'research',
    temper: 'analytical',
    summaryKey: 'roomProfile.research',
    effects: [
      { kind: 'critChance', value: 0.06 },
      { kind: 'eventLuck', value: 0.06 },
      // Findings compound on the Lab's raw experiments.
      { kind: 'production', value: 0.14, requiresRoom: 'lab' },
    ],
    tradeoffs: [{ kind: 'moraleTarget', value: -3 }],
    feeds: ['lab'],
    specialists: ['mina', 'moss', 'canela', 'echo'],
  },
  {
    roomId: 'rooftop',
    temper: 'irregular',
    summaryKey: 'roomProfile.rooftop',
    effects: [
      { kind: 'comboWindow', value: 0.35 },
      { kind: 'critChance', value: 0.04 },
      // The dish is only worth aiming if somebody is listening for the signal.
      { kind: 'reputationRate', value: 0.06, requiresRoom: 'marketing' },
    ],
    tradeoffs: [],
    feeds: ['marketing'],
    specialists: ['corvus', 'echo'],
  },

  // --- Where the golden nuts come from ------------------------------------
  {
    roomId: 'vault',
    temper: 'secure',
    summaryKey: 'roomProfile.vault',
    effects: [
      { kind: 'goldenChance', value: 0.006 },
      { kind: 'costReduction', value: 0.06 },
      // A vault is only as good as what is coming in.
      { kind: 'goldenChance', value: 0.008, requiresRoom: 'procurement' },
    ],
    tradeoffs: [],
    feeds: ['basement'],
    specialists: ['bia', 'otto'],
  },
  {
    roomId: 'basement',
    temper: 'irregular',
    summaryKey: 'roomProfile.basement',
    effects: [
      { kind: 'goldenChance', value: 0.016 },
      { kind: 'eventLuck', value: 0.1 },
    ],
    // The most productive room per golden nut, and by far the least pleasant.
    // It is meant to need the Nap Room and the Break Room to be viable.
    tradeoffs: [
      { kind: 'moraleTarget', value: -12 },
      { kind: 'reputationRate', value: -0.02 },
    ],
    feeds: ['vault'],
    specialists: ['nixie', 'inky'],
  },
];

export const ROOM_PROFILES_BY_ID: Record<string, RoomProfile> = Object.fromEntries(
  ROOM_PROFILES.map((p) => [p.roomId, p]),
);

export function roomProfile(roomId: string): RoomProfile | undefined {
  return ROOM_PROFILES_BY_ID[roomId];
}

/** Rooms whose effects name `roomId` as a dependency — i.e. what it enables. */
export function roomsDependingOn(roomId: string): RoomProfile[] {
  return ROOM_PROFILES.filter((p) =>
    [...p.effects, ...p.tradeoffs].some((e) => e.requiresRoom === roomId),
  );
}
