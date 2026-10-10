// Click stations — the hands-on half of the game loop.
//
// Nutshell Inc. is a clicker, so every room the player unlocks has to give them
// something to physically do in it. A station is a piece of room equipment the
// player taps: a nut crate, a sorting chute, a behavioural centrifuge, the thing
// in the basement. Tapping it pays out immediately, builds a combo, and can crit.
//
// Rooms are NOT interchangeable copies of the same nut box. Each station differs
// in four authored ways so a room feels like a place with its own job:
//
//   payout      — how much a single tap is worth, as a multiple of click power.
//   cadence     — 'steady' pays every tap; 'charge' pays more but needs a beat
//                 between taps; 'burst' rewards fast streaks with a wider combo.
//   resource    — most pay nuts; a couple deal in golden nuts directly.
//   synergy     — the teammates whose specialty makes this station noticeably
//                 better, so assigning the right animal to the right room matters.
//
// Adding a station is pure data: register it here and the office renders it, the
// engine resolves taps against it, and the save records its use. There is no
// per-station code anywhere else.

/** Visual/behavioural archetype. Drives the station's art and feedback. */
export type ClickStationKind =
  | 'mixing-desk'
  | 'test-bench'
  | 'rain-gauge'
  | 'crate'
  | 'chute'
  | 'urn'
  | 'ledger'
  | 'press'
  | 'centrifuge'
  | 'megaphone'
  | 'safe'
  | 'observation'
  | 'agenda'
  | 'dreamlog'
  | 'furnace'
  | 'antenna'
  | 'servery'
  | 'tube'
  | 'monitors'
  | 'scanner'
  | 'pod';

/**
 * How a station responds to repeated tapping.
 *  - `steady`: pays on every tap. The dependable baseline.
 *  - `charge`: pays a larger amount but wants a short beat between taps; tapping
 *    faster than its recharge still pays, just at a reduced rate (never zero, so
 *    mashing is never *punished* — it simply isn't the optimal rhythm).
 *  - `burst`: small per-tap payout with a longer combo window and a higher combo
 *    ceiling, so sustained fast clicking is the point.
 */
export type ClickStationCadence = 'steady' | 'charge' | 'burst';

export interface ClickStationDef {
  id: string;
  /** the room this station lives in; it is available whenever the room is. */
  roomId: string;
  kind: ClickStationKind;
  nameKey: string;
  hintKey: string;
  /** normalized 0..1 position across the room stage. */
  x: number;
  /** pixels up from the floor line (stations sit on furniture or the floor). */
  bottom: number;
  cadence: ClickStationCadence;
  /** payout per tap as a multiple of click power. */
  payout: number;
  /** what a tap pays out. */
  resource: 'nuts' | 'goldenNuts';
  /** teammates whose specialty suits this equipment. */
  synergy: readonly string[];
  /** extra critical-tap chance this station contributes (0..1). */
  critBonus?: number;
}

function station(def: ClickStationDef): ClickStationDef {
  return def;
}

export const CLICK_STATIONS: readonly ClickStationDef[] = [
  {
    id: 'broadcast-station',
    roomId: 'broadcast',
    kind: 'mixing-desk',
    nameKey: 'station.broadcast.name',
    hintKey: 'station.broadcast.hint',
    // Close enough to the wall that a full room still sits clear of it.
    x: 0.18,
    bottom: 0,
    cadence: 'burst',
    payout: 0.7,
    resource: 'nuts',
    synergy: ['echo'],
  },
  {
    id: 'repair-station',
    roomId: 'repair',
    kind: 'test-bench',
    nameKey: 'station.repair.name',
    hintKey: 'station.repair.hint',
    // In the middle of the bay door, and far enough along that a full room sits clear of it.
    x: 0.82,
    bottom: 0,
    cadence: 'charge',
    payout: 1.3,
    resource: 'nuts',
    synergy: ['bea'],
  },
  {
    id: 'conservatory-station',
    roomId: 'conservatory',
    kind: 'rain-gauge',
    nameKey: 'station.conservatory.name',
    hintKey: 'station.conservatory.hint',
    // Close enough to the wall that a full room still sits clear of it.
    x: 0.18,
    bottom: 0,
    cadence: 'steady',
    payout: 0.8,
    resource: 'nuts',
    synergy: ['axel'],
  },
  // --- Founder's desk: where the whole company starts -----------------------
  station({
    id: 'nut-crate',
    roomId: 'founder-desk',
    kind: 'crate',
    nameKey: 'station.nutCrate.name',
    hintKey: 'station.nutCrate.hint',
    x: 0.87,
    bottom: 2,
    cadence: 'steady',
    payout: 1,
    resource: 'nuts',
    synergy: ['pip'],
  }),

  // --- Sorting: the fast, mashable station ---------------------------------
  station({
    id: 'sorting-chute',
    roomId: 'sorting',
    kind: 'chute',
    nameKey: 'station.sortingChute.name',
    hintKey: 'station.sortingChute.hint',
    x: 0.84,
    bottom: 4,
    cadence: 'burst',
    payout: 0.7,
    resource: 'nuts',
    synergy: ['pingo', 'marlow'],
    critBonus: 0.02,
  }),

  // --- Morale: pays in goodwill as much as nuts ----------------------------
  station({
    id: 'coffee-urn',
    roomId: 'morale',
    kind: 'urn',
    nameKey: 'station.coffeeUrn.name',
    hintKey: 'station.coffeeUrn.hint',
    x: 0.14,
    bottom: 6,
    cadence: 'charge',
    payout: 1.6,
    resource: 'nuts',
    synergy: ['marlow'],
  }),

  // --- Procurement: bigger, slower, ledger-driven --------------------------
  station({
    id: 'purchase-ledger',
    roomId: 'procurement',
    kind: 'ledger',
    nameKey: 'station.purchaseLedger.name',
    hintKey: 'station.purchaseLedger.hint',
    x: 0.83,
    bottom: 8,
    cadence: 'charge',
    payout: 2.1,
    resource: 'nuts',
    synergy: ['pingo'],
    critBonus: 0.01,
  }),

  // --- Construction: heavy machinery ---------------------------------------
  station({
    id: 'shell-press',
    roomId: 'construction',
    kind: 'press',
    nameKey: 'station.shellPress.name',
    hintKey: 'station.shellPress.hint',
    x: 0.17,
    bottom: 4,
    cadence: 'charge',
    payout: 2.6,
    resource: 'nuts',
    synergy: ['bea'],
    critBonus: 0.03,
  }),

  // --- Lab: the first genuinely strange one --------------------------------
  station({
    id: 'behaviour-centrifuge',
    roomId: 'lab',
    kind: 'centrifuge',
    nameKey: 'station.centrifuge.name',
    hintKey: 'station.centrifuge.hint',
    x: 0.82,
    bottom: 6,
    cadence: 'burst',
    payout: 1.1,
    resource: 'nuts',
    synergy: ['canela'],
    critBonus: 0.04,
  }),

  // --- Marketing: loud, streaky -------------------------------------------
  station({
    id: 'announcement-horn',
    roomId: 'marketing',
    kind: 'megaphone',
    nameKey: 'station.announcementHorn.name',
    hintKey: 'station.announcementHorn.hint',
    x: 0.16,
    bottom: 10,
    cadence: 'burst',
    payout: 1.2,
    resource: 'nuts',
    synergy: ['marlow', 'canela'],
    critBonus: 0.03,
  }),

  // --- Vault: the golden nut station ---------------------------------------
  station({
    id: 'deposit-wheel',
    roomId: 'vault',
    kind: 'safe',
    nameKey: 'station.depositWheel.name',
    hintKey: 'station.depositWheel.hint',
    x: 0.85,
    bottom: 4,
    cadence: 'charge',
    payout: 3.4,
    resource: 'nuts',
    synergy: ['pingo', 'bea'],
    critBonus: 0.05,
  }),

  // --- Research: slow, high value ------------------------------------------
  station({
    id: 'observation-terminal',
    roomId: 'research',
    kind: 'observation',
    nameKey: 'station.observationTerminal.name',
    hintKey: 'station.observationTerminal.hint',
    x: 0.18,
    bottom: 8,
    cadence: 'charge',
    payout: 3.8,
    resource: 'nuts',
    synergy: ['canela'],
    critBonus: 0.04,
  }),

  // --- Meeting: the bell nobody admits to enjoying -------------------------
  station({
    id: 'agenda-bell',
    roomId: 'meeting',
    kind: 'agenda',
    nameKey: 'station.agendaBell.name',
    hintKey: 'station.agendaBell.hint',
    x: 0.83,
    bottom: 10,
    cadence: 'steady',
    payout: 2.4,
    resource: 'nuts',
    synergy: ['marlow', 'pip'],
  }),

  // --- Nap: quiet, generous, slightly uncanny ------------------------------
  station({
    id: 'dream-log',
    roomId: 'nap',
    kind: 'dreamlog',
    nameKey: 'station.dreamLog.name',
    hintKey: 'station.dreamLog.hint',
    x: 0.15,
    bottom: 6,
    cadence: 'charge',
    payout: 4.2,
    resource: 'nuts',
    synergy: ['marlow'],
    critBonus: 0.06,
  }),

  // --- Basement: pays golden nuts, asks no questions -----------------------
  station({
    id: 'furnace-valve',
    roomId: 'basement',
    kind: 'furnace',
    nameKey: 'station.furnaceValve.name',
    hintKey: 'station.furnaceValve.hint',
    // Close enough to the wall that a full room still sits clear of it.
    x: 0.82,
    bottom: 3,
    cadence: 'charge',
    payout: 0.02,
    resource: 'goldenNuts',
    synergy: ['bea'],
    critBonus: 0.08,
  }),

  // --- Rooftop: the signal dish -------------------------------------------
  station({
    id: 'signal-dish',
    roomId: 'rooftop',
    kind: 'antenna',
    nameKey: 'station.signalDish.name',
    hintKey: 'station.signalDish.hint',
    x: 0.18,
    bottom: 12,
    cadence: 'burst',
    payout: 2.2,
    resource: 'nuts',
    synergy: ['pingo', 'canela'],
    critBonus: 0.05,
  }),

  // --- Second expansion: each new room brings its own way of being played -----

  // The friendliest station in the building: fast, forgiving, low payout. It is
  // what the early game clicks while waiting to afford anything better.
  station({
    id: 'serving-line',
    roomId: 'cafeteria',
    kind: 'servery',
    nameKey: 'station.servingLine.name',
    hintKey: 'station.servingLine.hint',
    x: 0.82,
    bottom: 4,
    cadence: 'burst',
    payout: 0.55,
    resource: 'nuts',
    synergy: ['marlow', 'bia'],
  }),

  // Pneumatic tubes: a charge station whose rhythm is the point.
  station({
    id: 'pneumatic-tube',
    roomId: 'mailroom',
    kind: 'tube',
    nameKey: 'station.pneumaticTube.name',
    hintKey: 'station.pneumaticTube.hint',
    x: 0.16,
    bottom: 8,
    cadence: 'charge',
    payout: 1.9,
    resource: 'nuts',
    synergy: ['junie', 'perry', 'otto'],
    critBonus: 0.02,
  }),

  // The camera bank rewards patient, deliberate taps and crits often — you are
  // looking for something, and occasionally you find it.
  station({
    id: 'camera-bank',
    roomId: 'security',
    kind: 'monitors',
    nameKey: 'station.cameraBank.name',
    hintKey: 'station.cameraBank.hint',
    x: 0.84,
    bottom: 10,
    cadence: 'steady',
    payout: 2.2,
    resource: 'nuts',
    synergy: ['corvus', 'echo', 'perry'],
    critBonus: 0.07,
  }),

  // The document scanner: slow, high value, and the room's whole personality.
  station({
    id: 'document-scanner',
    roomId: 'archive',
    kind: 'scanner',
    nameKey: 'station.documentScanner.name',
    hintKey: 'station.documentScanner.hint',
    x: 0.18,
    bottom: 6,
    cadence: 'charge',
    payout: 3.6,
    resource: 'nuts',
    synergy: ['moss', 'mina', 'nino'],
    critBonus: 0.05,
  }),

  // The second golden-nut station, and the better one — it should feel like a
  // reward for having built the whole building.
  station({
    id: 'incubation-pod',
    roomId: 'incubator',
    kind: 'pod',
    nameKey: 'station.incubationPod.name',
    hintKey: 'station.incubationPod.hint',
    x: 0.83,
    bottom: 5,
    cadence: 'charge',
    payout: 0.035,
    resource: 'goldenNuts',
    synergy: ['axel', 'quincy', 'nixie'],
    critBonus: 0.06,
  }),
];

export const CLICK_STATIONS_BY_ID: Record<string, ClickStationDef> = Object.fromEntries(
  CLICK_STATIONS.map((s) => [s.id, s]),
);

/** Stations belonging to a room (in authored order). */
export function stationsInRoom(roomId: string): readonly ClickStationDef[] {
  return CLICK_STATIONS.filter((s) => s.roomId === roomId);
}
