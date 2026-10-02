import type { EmployeeMood } from '../sim/types';
import type { RoomEffectKind } from './roomProfiles';

// Room play: what each room is FOR, in play.
//
// Every room keeps its tap station (the clicker's core verb). On top of that the
// station has a routine of its own: one of five small verbs, each reused by a
// handful of rooms with their own content, timing and payoff, so the building
// plays differently floor by floor without twenty-one copies of one button:
//
//   brew     prepare something, come back when it is ready, share it out
//   tend     the machine acts up; three quick taps free it and the room rushes
//   watch    something shows up on the screen for a moment; catch it
//   deliver  something arrives for someone; hand it over
//   tune     set the room's mode; each mode is one plain, steady bonus
//
// Helpers make a room's routine better, and say so in its tooltip: the room's
// specialists and the player's close friends working there (and, for brewing,
// watching and deliveries, a complete decoration set in the room).
//
// Curiosities ("oddities") are the room's small surprises. Some turn up on
// their own at the room's wall fixture or in a corner, where a teammate in the
// room usually notices first; others only come out of the room's routine (a
// dream in the nap room, a page from the archive scanner, a nut in the sorting
// chute). Each is noticed once, remembered for good, and logged in the Archive.
// Twenty-one of them are the Nut Encyclopedia's missing nuts.
//
// Words live in the locales: `play.<roomId>.*` for routines and
// `oddity.<id>.title|hint|found` for curiosities.

export type RoutineKind = 'brew' | 'tend' | 'watch' | 'deliver' | 'tune';

/** What a routine (or a curiosity) pays. Small, readable pieces of existing systems. */
export interface RoomReward {
  /** nuts worth this many seconds of current production (never less than a floor). */
  output?: number;
  golden?: number;
  /** chance (0..1) of one golden nut on top. */
  goldenChance?: number;
  morale?: number;
  reputation?: number;
  /** a temporary company-wide production boost. */
  boost?: { value: number; seconds: number };
  /** the room rushes (its people work double) for this long. */
  rush?: number;
  /** how the room's people (for deliveries: the recipient) feel afterwards. */
  mood?: { emotion: EmployeeMood; seconds: number };
  /** friendship for the room's people (for deliveries: the recipient). */
  friendship?: number;
  /** friendship for every hired teammate (the whole company had lunch). */
  everyone?: number;
}

export interface BrewOutcome {
  id: string;
  weight: number;
  reward: RoomReward;
  /** this outcome brings out one of the room's routine-only curiosities, if any is left. */
  reveal?: boolean;
}

export interface TuneMode {
  id: string;
  /** the one steady bonus the mode gives while someone works in the room. */
  effect: { kind: RoomEffectKind; value: number };
  /** how the room's people take it. */
  mood: EmployeeMood;
}

export type RoutineDef =
  | {
      kind: 'brew';
      seconds: number;
      /** someone has to be in the room for it to start (a dream needs a sleeper). */
      needsSomeone?: boolean;
      outcomes: readonly BrewOutcome[];
    }
  | { kind: 'tend'; taps: number; reward: RoomReward; revealChance: number }
  | { kind: 'watch'; seconds: number; reward: RoomReward; revealChance: number }
  | { kind: 'deliver'; to: 'teammate' | 'company'; reward: RoomReward; revealChance: number }
  | { kind: 'tune'; modes: readonly TuneMode[] };

/** Timing for the moments the office produces on its own. */
export const ROOM_PLAY = {
  /** nothing turns up until a new founder has had this long with the crate. */
  firstAfterSeconds: 120,
  /** how often the office rolls for something to happen. */
  rollSeconds: 10,
  /** average time between a machine acting up (one at a time, staffed rooms). */
  tendMeanSeconds: 240,
  /** average time between blips on a screen (one at a time). */
  watchMeanSeconds: 200,
  /** average time between deliveries, and how many may wait. */
  deliverMeanSeconds: 240,
  maxParcels: 2,
  /** average time between curiosities turning up, and how many may wait. */
  oddityMeanSeconds: 420,
  maxOddities: 1,
  /** a curiosity nobody notices fades after this long. */
  oddityLingerSeconds: 20 * 60,
  /** a helper frees a stuck machine on their own after this long. */
  selfFixSeconds: 45,
  /** each helper takes this share off a brew (up to two helpers). */
  brewHelperCut: 0.2,
  /** a helper keeps a blip on screen this much longer. */
  watchHelperBonus: 0.5,
  /** a helper's room gets deliveries this much more often. */
  deliverHelperWeight: 1.5,
  /** nuts rewards never fall below this. */
  minOutput: 25,
  /** noticing every curiosity in a room is worth this. */
  roomCompleteGolden: 2,
  /** curiosities in a facility room that make its discovery stand out. */
  discoveryAfter: 2,
} as const;

export const ROOM_ROUTINES: Record<string, RoutineDef> = {
  // --- deliver: something arrives for someone ---------------------------------
  'founder-desk': {
    kind: 'deliver',
    to: 'teammate',
    reward: { output: 25, friendship: 2, mood: { emotion: 'happy', seconds: 300 } },
    revealChance: 0,
  },
  mailroom: {
    kind: 'deliver',
    to: 'teammate',
    reward: { output: 35, friendship: 3, mood: { emotion: 'happy', seconds: 300 } },
    revealChance: 0,
  },
  procurement: {
    kind: 'deliver',
    to: 'company',
    reward: { output: 60, goldenChance: 0.1 },
    revealChance: 0.35,
  },

  // --- tend: the machine acts up --------------------------------------------
  sorting: {
    kind: 'tend',
    taps: 3,
    reward: { rush: 30, output: 15, mood: { emotion: 'proud', seconds: 240 } },
    revealChance: 0.4,
  },
  construction: {
    kind: 'tend',
    taps: 3,
    reward: { rush: 30, output: 30, mood: { emotion: 'proud', seconds: 240 } },
    revealChance: 0.25,
  },
  repair: {
    kind: 'tend',
    taps: 3,
    reward: { rush: 30, morale: 3, mood: { emotion: 'proud', seconds: 240 } },
    revealChance: 0,
  },
  basement: {
    kind: 'tend',
    taps: 3,
    reward: { rush: 30, goldenChance: 0.35, mood: { emotion: 'proud', seconds: 240 } },
    revealChance: 0.25,
  },

  // --- brew: prepare, wait, share --------------------------------------------
  morale: {
    kind: 'brew',
    seconds: 180,
    outcomes: [
      {
        id: 'pot',
        weight: 1,
        reward: {
          output: 30,
          morale: 5,
          boost: { value: 1.1, seconds: 180 },
          mood: { emotion: 'happy', seconds: 600 },
        },
      },
    ],
  },
  cafeteria: {
    kind: 'brew',
    seconds: 360,
    outcomes: [
      {
        id: 'lunch',
        weight: 1,
        reward: { output: 40, morale: 6, everyone: 1, mood: { emotion: 'happy', seconds: 600 } },
      },
    ],
  },
  lab: {
    kind: 'brew',
    seconds: 240,
    outcomes: [
      {
        id: 'stable',
        weight: 5,
        reward: { boost: { value: 1.15, seconds: 240 }, mood: { emotion: 'proud', seconds: 300 } },
      },
      {
        id: 'unstable',
        weight: 3,
        reward: { output: 50, mood: { emotion: 'curious', seconds: 240 } },
      },
      {
        id: 'anomalous',
        weight: 2,
        reveal: true,
        reward: { output: 20, reputation: 3, mood: { emotion: 'excited', seconds: 300 } },
      },
    ],
  },
  incubator: {
    kind: 'brew',
    seconds: 900,
    outcomes: [
      {
        id: 'sprout',
        weight: 4,
        reward: { golden: 1, output: 60, mood: { emotion: 'excited', seconds: 600 } },
      },
      {
        id: 'bloom',
        weight: 1,
        reveal: true,
        reward: { golden: 2, output: 60, mood: { emotion: 'excited', seconds: 600 } },
      },
    ],
  },
  conservatory: {
    kind: 'brew',
    seconds: 480,
    outcomes: [
      {
        id: 'harvest',
        weight: 4,
        reward: { output: 40, morale: 6, mood: { emotion: 'relaxed', seconds: 600 } },
      },
      {
        id: 'chestnut',
        weight: 1,
        reveal: true,
        reward: { output: 40, morale: 4, mood: { emotion: 'excited', seconds: 300 } },
      },
    ],
  },
  nap: {
    kind: 'brew',
    seconds: 300,
    needsSomeone: true,
    outcomes: [
      {
        id: 'dream',
        weight: 1,
        reveal: true,
        reward: { output: 45, morale: 3, mood: { emotion: 'relaxed', seconds: 600 } },
      },
    ],
  },

  // --- watch: something on the screen ----------------------------------------
  security: {
    kind: 'watch',
    seconds: 35,
    reward: { output: 20, reputation: 2 },
    revealChance: 0.45,
  },
  research: {
    kind: 'watch',
    seconds: 35,
    reward: { output: 40, reputation: 1 },
    revealChance: 0.35,
  },
  rooftop: {
    kind: 'watch',
    seconds: 35,
    reward: { output: 30, goldenChance: 0.15 },
    revealChance: 0.4,
  },
  archive: {
    kind: 'watch',
    seconds: 35,
    reward: { output: 20, reputation: 2 },
    revealChance: 0.45,
  },

  // --- tune: the room's mode -------------------------------------------------
  broadcast: {
    kind: 'tune',
    modes: [
      { id: 'calm', effect: { kind: 'moraleRegen', value: 0.15 }, mood: 'relaxed' },
      { id: 'upbeat', effect: { kind: 'comboWindow', value: 0.15 }, mood: 'excited' },
      { id: 'late', effect: { kind: 'reputationRate', value: 0.015 }, mood: 'curious' },
    ],
  },
  meeting: {
    kind: 'tune',
    modes: [
      { id: 'plan', effect: { kind: 'costReduction', value: 0.03 }, mood: 'focused' },
      { id: 'ship', effect: { kind: 'production', value: 0.05 }, mood: 'focused' },
      { id: 'retro', effect: { kind: 'moraleTarget', value: 4 }, mood: 'relaxed' },
    ],
  },
  marketing: {
    kind: 'tune',
    modes: [
      { id: 'brand', effect: { kind: 'reputationRate', value: 0.02 }, mood: 'proud' },
      { id: 'buzz', effect: { kind: 'clickPower', value: 0.1 }, mood: 'excited' },
      { id: 'giveaway', effect: { kind: 'eventLuck', value: 0.04 }, mood: 'happy' },
    ],
  },
  vault: {
    kind: 'tune',
    modes: [
      { id: 'hoard', effect: { kind: 'goldenChance', value: 0.004 }, mood: 'suspicious' },
      { id: 'invest', effect: { kind: 'production', value: 0.04 }, mood: 'focused' },
      { id: 'audit', effect: { kind: 'costReduction', value: 0.025 }, mood: 'focused' },
    ],
  },
};

/** Where a curiosity turns up in its room (null: only the room's routine brings it out). */
export type OddityAnchor = 'wall' | 'wallRight' | 'corner' | 'ceiling';

export interface OddityDef {
  id: string;
  roomId: string;
  anchor: OddityAnchor | null;
  kind: 'note' | 'glimpse' | 'object' | 'nut';
  tone: 'funny' | 'wholesome' | 'strange' | 'absurd' | 'paranormal';
  /** an Nut Encyclopedia entry this curiosity is. */
  nutId?: string;
  reward: RoomReward;
  requires?: {
    /** a decoration placed in this room. */
    decoration?: string;
    /** a durable mark the company already has. */
    flag?: string;
    /** a teammate on the payroll. */
    hired?: string;
    /** only in the player's local evening and night. */
    night?: boolean;
  };
}

function oddity(def: OddityDef): OddityDef {
  return def;
}

/** Every curiosity in the building. Ids are unique across rooms. */
export const ODDITIES: readonly OddityDef[] = [
  // Founder's Desk
  oddity({
    id: 'memo',
    roomId: 'founder-desk',
    anchor: 'wall',
    kind: 'note',
    tone: 'funny',
    reward: { morale: 2 },
  }),
  oddity({
    id: 'first-acorn',
    roomId: 'founder-desk',
    anchor: 'corner',
    kind: 'nut',
    tone: 'wholesome',
    nutId: 'founder-acorn',
    reward: { golden: 1 },
    // Pip shows you the first acorn in his story; then it can be found.
    requires: { flag: 'pip.arc.1' },
  }),
  // Sorting
  oddity({
    id: 'bin-seven',
    roomId: 'sorting',
    anchor: 'wall',
    kind: 'object',
    tone: 'strange',
    reward: { output: 25 },
  }),
  oddity({
    id: 'intern-acorn',
    roomId: 'sorting',
    anchor: null,
    kind: 'nut',
    tone: 'funny',
    nutId: 'intern-acorn',
    reward: { output: 10 },
  }),
  oddity({
    id: 'corporate-cashew',
    roomId: 'sorting',
    anchor: null,
    kind: 'nut',
    tone: 'funny',
    nutId: 'corporate-cashew',
    reward: { output: 10 },
  }),
  oddity({
    id: 'onboarding-walnut',
    roomId: 'sorting',
    anchor: null,
    kind: 'nut',
    tone: 'absurd',
    nutId: 'onboarding-walnut',
    reward: { output: 10 },
  }),
  oddity({
    id: 'agile-almond',
    roomId: 'sorting',
    anchor: null,
    kind: 'nut',
    tone: 'funny',
    nutId: 'agile-almond',
    reward: { output: 10 },
  }),
  oddity({
    id: 'compliance-cob-nut',
    roomId: 'sorting',
    anchor: null,
    kind: 'nut',
    tone: 'absurd',
    nutId: 'compliance-cob-nut',
    reward: { output: 10 },
  }),
  // Break Room
  oddity({
    id: 'special',
    roomId: 'morale',
    anchor: 'wall',
    kind: 'note',
    tone: 'funny',
    reward: { morale: 3 },
  }),
  oddity({
    id: 'fish-arrow',
    roomId: 'morale',
    anchor: 'corner',
    kind: 'object',
    tone: 'strange',
    reward: { morale: 2, output: 20 },
    requires: { decoration: 'aquarium' },
  }),
  // Procurement
  oddity({
    id: 'missing-stapler',
    roomId: 'procurement',
    anchor: 'wall',
    kind: 'note',
    tone: 'funny',
    reward: { reputation: 1, output: 15 },
  }),
  oddity({
    id: 'stakeholder-cashew',
    roomId: 'procurement',
    anchor: null,
    kind: 'nut',
    tone: 'funny',
    nutId: 'stakeholder-cashew',
    reward: { output: 10 },
  }),
  oddity({
    id: 'crypto-nut',
    roomId: 'procurement',
    anchor: null,
    kind: 'nut',
    tone: 'absurd',
    nutId: 'crypto-nut',
    reward: { output: 10 },
  }),
  oddity({
    id: 'synergy-pecan',
    roomId: 'procurement',
    anchor: null,
    kind: 'nut',
    tone: 'funny',
    nutId: 'synergy-pecan',
    reward: { output: 10 },
  }),
  // Construction
  oddity({
    id: 'outline',
    roomId: 'construction',
    anchor: 'wall',
    kind: 'object',
    tone: 'wholesome',
    reward: { morale: 2 },
  }),
  oddity({
    id: 'overtime-acorn',
    roomId: 'construction',
    anchor: null,
    kind: 'nut',
    tone: 'strange',
    nutId: 'overtime-acorn',
    reward: { output: 10 },
  }),
  // Lab
  oddity({
    id: 'glowing-flask',
    roomId: 'lab',
    anchor: 'wall',
    kind: 'object',
    tone: 'paranormal',
    reward: { boost: { value: 1.1, seconds: 120 } },
  }),
  oddity({
    id: 'smiley-sample',
    roomId: 'lab',
    anchor: null,
    kind: 'glimpse',
    tone: 'absurd',
    reward: { reputation: 2 },
  }),
  oddity({
    id: 'disruptive-pine-nut',
    roomId: 'lab',
    anchor: null,
    kind: 'nut',
    tone: 'absurd',
    nutId: 'disruptive-pine-nut',
    reward: { output: 10 },
  }),
  // Marketing
  oddity({
    id: 'slogan',
    roomId: 'marketing',
    anchor: 'wall',
    kind: 'note',
    tone: 'funny',
    reward: { reputation: 2 },
  }),
  oddity({
    id: 'focus-macadamia',
    roomId: 'marketing',
    anchor: 'corner',
    kind: 'nut',
    tone: 'absurd',
    nutId: 'management-macadamia',
    reward: { output: 15 },
  }),
  // Vault
  oddity({
    id: 'extra-nut',
    roomId: 'vault',
    anchor: 'corner',
    kind: 'object',
    tone: 'strange',
    reward: { golden: 1 },
  }),
  oddity({
    id: 'kernel',
    roomId: 'vault',
    anchor: 'ceiling',
    kind: 'nut',
    tone: 'strange',
    nutId: 'golden-kernel',
    reward: { golden: 1 },
    requires: { decoration: 'nut-statue' },
  }),
  // Research
  oddity({
    id: 'equation',
    roomId: 'research',
    anchor: 'wall',
    kind: 'note',
    tone: 'absurd',
    reward: { reputation: 2 },
  }),
  oddity({
    id: 'hello-tremor',
    roomId: 'research',
    anchor: null,
    kind: 'glimpse',
    tone: 'paranormal',
    reward: { reputation: 2 },
  }),
  // Meeting
  oddity({
    id: 'item-four',
    roomId: 'meeting',
    anchor: 'wall',
    kind: 'note',
    tone: 'funny',
    reward: { morale: 2 },
  }),
  oddity({
    id: 'brazil-chair',
    roomId: 'meeting',
    anchor: 'corner',
    kind: 'nut',
    tone: 'absurd',
    nutId: 'quarterly-brazil-nut',
    reward: { output: 15 },
  }),
  // Nap Room: its dreams come out of the dream log.
  oddity({
    id: 'snore-round',
    roomId: 'nap',
    anchor: 'ceiling',
    kind: 'object',
    tone: 'wholesome',
    reward: { morale: 3 },
  }),
  oddity({
    id: 'dream-floor-zero',
    roomId: 'nap',
    anchor: null,
    kind: 'glimpse',
    tone: 'paranormal',
    reward: { morale: 2 },
  }),
  oddity({
    id: 'dream-fish-slides',
    roomId: 'nap',
    anchor: null,
    kind: 'glimpse',
    tone: 'absurd',
    reward: { morale: 2 },
  }),
  oddity({
    id: 'burnout-brazil',
    roomId: 'nap',
    anchor: null,
    kind: 'nut',
    tone: 'wholesome',
    nutId: 'burnout-brazil',
    reward: { morale: 2 },
  }),
  // Basement
  oddity({
    id: 'pipe-jingle',
    roomId: 'basement',
    anchor: 'wall',
    kind: 'object',
    tone: 'paranormal',
    reward: { output: 30 },
  }),
  oddity({
    id: 'forbidden-peanut',
    roomId: 'basement',
    anchor: null,
    kind: 'nut',
    tone: 'strange',
    nutId: 'forbidden-peanut',
    reward: { output: 10 },
  }),
  // Rooftop: the dish picks things up.
  oddity({
    id: 'skyline-blink',
    roomId: 'rooftop',
    anchor: 'wall',
    kind: 'glimpse',
    tone: 'wholesome',
    reward: { reputation: 2 },
  }),
  oddity({
    id: 'moon-thanks',
    roomId: 'rooftop',
    anchor: null,
    kind: 'glimpse',
    tone: 'paranormal',
    reward: { golden: 1 },
    requires: { night: true },
  }),
  oddity({
    id: 'weather-elsewhere',
    roomId: 'rooftop',
    anchor: null,
    kind: 'glimpse',
    tone: 'strange',
    reward: { reputation: 2 },
  }),
  // Cafeteria
  oddity({
    id: 'soup-week',
    roomId: 'cafeteria',
    anchor: 'wall',
    kind: 'note',
    tone: 'funny',
    reward: { morale: 2 },
  }),
  oddity({
    id: 'tray-almond',
    roomId: 'cafeteria',
    anchor: 'corner',
    kind: 'nut',
    tone: 'wholesome',
    nutId: 'emotional-support-almond',
    reward: { morale: 2 },
  }),
  // Mailroom
  oddity({
    id: 'letter-1987',
    roomId: 'mailroom',
    anchor: 'wallRight',
    kind: 'note',
    tone: 'strange',
    reward: { reputation: 2 },
  }),
  oddity({
    id: 'pigeon',
    roomId: 'mailroom',
    anchor: 'wall',
    kind: 'object',
    tone: 'absurd',
    reward: { output: 20 },
  }),
  // Security: the cameras catch things.
  oddity({
    id: 'wanted-fridge',
    roomId: 'security',
    anchor: 'wallRight',
    kind: 'note',
    tone: 'funny',
    reward: { morale: 2 },
  }),
  oddity({
    id: 'tie-corridor',
    roomId: 'security',
    anchor: null,
    kind: 'glimpse',
    tone: 'paranormal',
    reward: { reputation: 2 },
  }),
  oddity({
    id: 'stapler-return',
    roomId: 'security',
    anchor: null,
    kind: 'glimpse',
    tone: 'funny',
    reward: { output: 20 },
  }),
  oddity({
    id: 'severance-acorn',
    roomId: 'security',
    anchor: null,
    kind: 'nut',
    tone: 'wholesome',
    nutId: 'severance-acorn',
    reward: { output: 10 },
  }),
  // Archive: the scanner turns things up.
  oddity({
    id: 'sticky-box',
    roomId: 'archive',
    anchor: 'wallRight',
    kind: 'object',
    tone: 'wholesome',
    reward: { morale: 3 },
  }),
  oddity({
    id: 'future-minutes',
    roomId: 'archive',
    anchor: null,
    kind: 'note',
    tone: 'strange',
    reward: { reputation: 2 },
  }),
  oddity({
    id: 'legacy-hazelnut',
    roomId: 'archive',
    anchor: null,
    kind: 'nut',
    tone: 'strange',
    nutId: 'legacy-hazelnut',
    reward: { output: 10 },
  }),
  // Incubator
  oddity({
    id: 'seedling-tag',
    roomId: 'incubator',
    anchor: 'wall',
    kind: 'object',
    tone: 'wholesome',
    reward: { morale: 3 },
  }),
  oddity({
    id: 'visionary-pistachio',
    roomId: 'incubator',
    anchor: null,
    kind: 'nut',
    tone: 'absurd',
    nutId: 'visionary-pistachio',
    reward: { output: 10 },
  }),
  // Broadcast
  oddity({
    id: 'applause-reel',
    roomId: 'broadcast',
    anchor: 'wall',
    kind: 'glimpse',
    tone: 'paranormal',
    reward: { morale: 3 },
  }),
  oddity({
    id: 'fern-request',
    roomId: 'broadcast',
    anchor: 'corner',
    kind: 'note',
    tone: 'wholesome',
    reward: { morale: 2 },
  }),
  // Repair
  oddity({
    id: 'borrowed-wrench',
    roomId: 'repair',
    anchor: 'wall',
    kind: 'note',
    tone: 'funny',
    reward: { output: 20 },
  }),
  oddity({
    id: 'dont-button',
    roomId: 'repair',
    anchor: 'corner',
    kind: 'object',
    tone: 'strange',
    reward: { reputation: 1 },
  }),
  // Conservatory
  oddity({
    id: 'rainbow',
    roomId: 'conservatory',
    anchor: 'wall',
    kind: 'glimpse',
    tone: 'wholesome',
    reward: { morale: 3 },
  }),
  oddity({
    id: 'startup-chestnut',
    roomId: 'conservatory',
    anchor: null,
    kind: 'nut',
    tone: 'funny',
    nutId: 'startup-chestnut',
    reward: { output: 10 },
  }),
];

export const ODDITIES_BY_ID: Record<string, OddityDef> = Object.fromEntries(
  ODDITIES.map((def) => [def.id, def]),
);

/** A room's curiosities, in authored order. */
export function odditiesInRoom(roomId: string): readonly OddityDef[] {
  return ODDITIES.filter((def) => def.roomId === roomId);
}

/** Where each Nut Encyclopedia entry turns up in the office. */
export const NUT_SOURCES: Record<string, string> = Object.fromEntries(
  ODDITIES.filter((def) => def.nutId).map((def) => [def.nutId as string, def.roomId]),
);

/** The flag a noticed curiosity leaves. */
export function oddityFlag(id: string): string {
  return `oddity.${id}`;
}

/** The flag left when every curiosity in a room has been noticed. */
export function roomFileFlag(roomId: string): string {
  return `oddity.room.${roomId}`;
}
