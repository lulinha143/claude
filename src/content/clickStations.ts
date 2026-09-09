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
  | 'antenna';

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
    x: 0.8,
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
];

export const CLICK_STATIONS_BY_ID: Record<string, ClickStationDef> = Object.fromEntries(
  CLICK_STATIONS.map((s) => [s.id, s]),
);

/** Stations belonging to a room (in authored order). */
export function stationsInRoom(roomId: string): readonly ClickStationDef[] {
  return CLICK_STATIONS.filter((s) => s.roomId === roomId);
}
