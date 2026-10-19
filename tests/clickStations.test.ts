import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import {
  CLICK,
  cadenceMultiplier,
  comboMultiplier,
  comboWindowMs,
  critChance,
  nextStreak,
  previewClickValue,
  resolveClick,
  synergyEmployees,
  synergyMultiplier,
  type ComboTracker,
} from '../src/sim/clickStations';
import { CLICK_STATIONS, CLICK_STATIONS_BY_ID, stationsInRoom } from '../src/content/clickStations';
import { ROOMS_BY_ID } from '../src/content/rooms';
import { isRoomIdUnlocked } from '../src/sim/rooms';

const CRATE = CLICK_STATIONS_BY_ID['nut-crate'];
const CHUTE = CLICK_STATIONS_BY_ID['sorting-chute']; // burst
const URN = CLICK_STATIONS_BY_ID['coffee-urn']; // charge

function fresh() {
  return new GameEngine(createInitialState(0), { deterministic: true });
}

/** Unlock every room so any station can be tapped in a test. */
function openTheBuilding(engine: GameEngine) {
  engine.state.resources.reputation = 100_000;
  for (const room of Object.values(ROOMS_BY_ID)) {
    if (room.unlock.upgradeId) engine.state.upgrades[room.unlock.upgradeId] = 1;
  }
}

describe('click station catalogue', () => {
  it('gives every station a real room', () => {
    for (const s of CLICK_STATIONS) {
      expect(ROOMS_BY_ID[s.roomId], `${s.id} -> ${s.roomId}`).toBeDefined();
    }
  });

  it('uses unique station ids', () => {
    const ids = CLICK_STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('spreads clicker gameplay across the building, not just one box', () => {
    const rooms = new Set(CLICK_STATIONS.map((s) => s.roomId));
    // The whole point of the system: more than a single clickable room.
    expect(rooms.size).toBeGreaterThan(8);
    expect(stationsInRoom('founder-desk').length).toBeGreaterThan(0);
  });

  it('does not make every room a copy of the same nut box', () => {
    const kinds = new Set(CLICK_STATIONS.map((s) => s.kind));
    expect(kinds.size).toBe(CLICK_STATIONS.length);
    const cadences = new Set(CLICK_STATIONS.map((s) => s.cadence));
    expect(cadences.size).toBeGreaterThan(1);
  });

  it('keeps stations inside the room stage', () => {
    for (const s of CLICK_STATIONS) {
      expect(s.x).toBeGreaterThan(0.05);
      expect(s.x).toBeLessThan(0.95);
      expect(s.bottom).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('combo mechanics', () => {
  it('starts a streak at 1 and grows it inside the window', () => {
    expect(nextStreak(CRATE, null, 1_000)).toBe(1);
    const tracker: ComboTracker = { stationId: CRATE.id, streak: 3, lastTapAt: 1_000 };
    expect(nextStreak(CRATE, tracker, 1_100)).toBe(4);
  });

  it('lapses a streak once the window passes', () => {
    const tracker: ComboTracker = { stationId: CRATE.id, streak: 9, lastTapAt: 1_000 };
    const late = 1_000 + comboWindowMs(CRATE.cadence) + 1;
    expect(nextStreak(CRATE, tracker, late)).toBe(1);
  });

  it('resets when the player switches station', () => {
    const tracker: ComboTracker = { stationId: CHUTE.id, streak: 12, lastTapAt: 1_000 };
    expect(nextStreak(CRATE, tracker, 1_050)).toBe(1);
  });

  it('gives burst stations a longer window and a higher ceiling', () => {
    expect(comboWindowMs('burst')).toBeGreaterThan(comboWindowMs('steady'));
    expect(comboMultiplier(CHUTE, 40)).toBeGreaterThan(comboMultiplier(CRATE, 40));
  });

  it('caps the combo multiplier at the cadence ceiling', () => {
    const capped = comboMultiplier(CRATE, 10_000);
    const ceiling = 1 + CLICK.comboCeiling[CRATE.cadence] * CLICK.comboStepBonus;
    expect(capped).toBeCloseTo(ceiling, 6);
  });
});

describe('cadence', () => {
  it('never charges a steady or burst station', () => {
    const tracker: ComboTracker = { stationId: CHUTE.id, streak: 2, lastTapAt: 1_000 };
    expect(cadenceMultiplier(CHUTE, tracker, 1_010)).toBe(1);
  });

  it('pays a charge station in full once it has recovered', () => {
    const tracker: ComboTracker = { stationId: URN.id, streak: 2, lastTapAt: 1_000 };
    expect(cadenceMultiplier(URN, tracker, 1_000 + CLICK.chargeRecoveryMs)).toBe(1);
  });

  it('reduces but never zeroes a charge station tapped early', () => {
    const tracker: ComboTracker = { stationId: URN.id, streak: 2, lastTapAt: 1_000 };
    const immediate = cadenceMultiplier(URN, tracker, 1_000);
    expect(immediate).toBeCloseTo(CLICK.chargeMinShare, 6);
    expect(immediate).toBeGreaterThan(0);
    // Mashing degrades gracefully rather than being blocked.
    expect(cadenceMultiplier(URN, tracker, 1_300)).toBeGreaterThan(immediate);
  });
});

describe('employee synergy', () => {
  it('finds only hired teammates actually assigned to the room', () => {
    const engine = fresh();
    openTheBuilding(engine);
    expect(synergyEmployees(engine.state, CHUTE)).toEqual([]);

    engine.state.employees.pingo.hired = true;
    engine.state.employees.pingo.room = CHUTE.roomId;
    expect(synergyEmployees(engine.state, CHUTE)).toContain('pingo');
  });

  it('raises the station payout for a matching animal', () => {
    const engine = fresh();
    openTheBuilding(engine);
    const before = synergyMultiplier(engine.state, CHUTE);
    engine.state.employees.pingo.hired = true;
    engine.state.employees.pingo.room = CHUTE.roomId;
    expect(synergyMultiplier(engine.state, CHUTE)).toBeGreaterThan(before);
  });

  it('makes personalities matter: the wrong animal gives no station bonus', () => {
    const engine = fresh();
    openTheBuilding(engine);
    // Bea is a construction beaver; she does nothing for the sorting chute.
    engine.state.employees.bea.hired = true;
    engine.state.employees.bea.room = CHUTE.roomId;
    expect(synergyEmployees(engine.state, CHUTE)).toEqual([]);
    expect(synergyMultiplier(engine.state, CHUTE)).toBe(1);
  });
});

describe('crit chance', () => {
  it('stays a probability', () => {
    const engine = fresh();
    for (const s of CLICK_STATIONS) {
      const c = critChance(engine.state, s);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('improves with morale', () => {
    const engine = fresh();
    engine.state.resources.morale = 0;
    const low = critChance(engine.state, CRATE);
    engine.state.resources.morale = 100;
    expect(critChance(engine.state, CRATE)).toBeGreaterThan(low);
  });
});

describe('engine.tapStation', () => {
  it('pays out on EVERY tap with no cooldown (rapid clicking is reliable)', () => {
    const engine = fresh();
    let previous = engine.state.resources.nuts;
    // 200 taps back-to-back at the same instant: every one must pay.
    for (let i = 0; i < 200; i += 1) {
      const result = engine.tapStation('nut-crate');
      expect(result, `tap ${i}`).not.toBeNull();
      expect(engine.state.resources.nuts, `tap ${i}`).toBeGreaterThan(previous);
      previous = engine.state.resources.nuts;
    }
    expect(engine.state.clicker.stationTaps['nut-crate']).toBe(200);
  });

  it('refuses a station whose room is still locked', () => {
    const engine = fresh();
    expect(isRoomIdUnlocked(engine.state, 'vault')).toBe(false);
    expect(engine.tapStation('deposit-wheel')).toBeNull();
  });

  it('accepts the station once its room unlocks', () => {
    const engine = fresh();
    openTheBuilding(engine);
    expect(engine.tapStation('deposit-wheel')).not.toBeNull();
  });

  it('ignores an unknown station', () => {
    expect(fresh().tapStation('not-a-station')).toBeNull();
  });

  it('builds and reports a combo across quick taps', () => {
    const engine = fresh();
    const a = engine.tapStation('nut-crate');
    const b = engine.tapStation('nut-crate');
    expect(a?.streak).toBe(1);
    expect(b?.streak).toBe(2);
    expect(b!.comboMultiplier).toBeGreaterThan(a!.comboMultiplier);
    expect(engine.comboStreak('nut-crate')).toBe(2);
  });

  it('records lifetime clicker progress', () => {
    const engine = fresh();
    for (let i = 0; i < 12; i += 1) engine.tapStation('nut-crate');
    expect(engine.state.clicker.stationTaps['nut-crate']).toBe(12);
    expect(engine.state.clicker.bestStreak).toBe(12);
    expect(engine.state.stats.totalClicks).toBe(12);
  });

  it('counts the founder crate toward the crate stat and daily challenge', () => {
    const engine = fresh();
    const before = engine.state.stats.cratesCollected;
    engine.tapStation('nut-crate');
    expect(engine.state.stats.cratesCollected).toBe(before + 1);
  });

  it('pays a golden-nut station in golden nuts, not nuts', () => {
    const engine = fresh();
    openTheBuilding(engine);
    const nuts = engine.state.resources.nuts;
    const gold = engine.state.resources.goldenNuts;
    const result = engine.tapStation('furnace-valve');
    expect(result?.resource).toBe('goldenNuts');
    // It refines gold: dust toward the next whole golden nut (never a fraction of one).
    expect(
      engine.state.resources.goldenNuts + (engine.state.clicker.goldenDust ?? 0),
    ).toBeGreaterThan(gold);
    expect(Number.isInteger(engine.state.resources.goldenNuts)).toBe(true);
    expect(engine.state.resources.nuts).toBe(nuts);
  });

  it('reports a streak of 0 once the combo lapses', () => {
    let clock = 1_000;
    const engine = new GameEngine(createInitialState(0), {
      deterministic: true,
      now: () => clock,
    });
    engine.tapStation('nut-crate');
    expect(engine.comboStreak('nut-crate')).toBe(1);
    clock += comboWindowMs(CRATE.cadence) + 50;
    expect(engine.comboStreak('nut-crate')).toBe(0);
  });

  it('never persists the combo itself', () => {
    const engine = fresh();
    engine.tapStation('nut-crate');
    // The live tracker is engine-transient; nothing about it is in GameState.
    expect(JSON.stringify(engine.state)).not.toContain('lastTapAt');
  });
});

describe('resolveClick payout shape', () => {
  it('multiplies power, station, cadence, combo and synergy', () => {
    const engine = fresh();
    const plain = resolveClick(engine.state, CRATE, null, 0, { critical: false, golden: false });
    const sources = plain.breakdown.map((b) => b.source);
    expect(sources).toEqual(['clickPower', 'station', 'cadence', 'combo', 'synergy']);
  });

  it('adds a critical entry and multiplies the payout when a tap crits', () => {
    const engine = fresh();
    const plain = resolveClick(engine.state, CRATE, null, 0, { critical: false, golden: false });
    const crit = resolveClick(engine.state, CRATE, null, 0, { critical: true, golden: false });
    expect(crit.critical).toBe(true);
    expect(crit.amount).toBeCloseTo(plain.amount * CLICK.critMultiplier, 4);
    expect(crit.breakdown.map((b) => b.source)).toContain('critical');
  });

  it('only drops a golden nut from nut-paying stations', () => {
    const engine = fresh();
    const nutTap = resolveClick(engine.state, CRATE, null, 0, { critical: false, golden: true });
    expect(nutTap.golden).toBe(true);
    const goldStation = CLICK_STATIONS_BY_ID['furnace-valve'];
    const goldTap = resolveClick(engine.state, goldStation, null, 0, {
      critical: false,
      golden: true,
    });
    expect(goldTap.golden).toBe(false);
  });

  it('always pays a nut station at least one nut', () => {
    const engine = fresh();
    const result = resolveClick(engine.state, CRATE, null, 0, { critical: false, golden: false });
    expect(result.amount).toBeGreaterThanOrEqual(1);
  });

  it('previews the next tap without mutating anything', () => {
    const engine = fresh();
    const snapshot = JSON.stringify(engine.state);
    const preview = previewClickValue(engine.state, 'nut-crate', null, 0);
    expect(preview).toBeGreaterThan(0);
    expect(JSON.stringify(engine.state)).toBe(snapshot);
  });

  it('previews 0 for an unknown station', () => {
    expect(previewClickValue(fresh().state, 'nope', null, 0)).toBe(0);
  });
});
