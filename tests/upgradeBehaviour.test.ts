import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { UPGRADES, UPGRADES_BY_ID } from '../src/content/upgrades';
import { CLICK_STATIONS } from '../src/content/clickStations';
import { critChance, goldenTapChance, stationComboWindowMs } from '../src/sim/clickStations';
import { roomStaffing } from '../src/sim/companyModifiers';
import { upgradeBonus } from '../src/sim/upgradeEffects';
import { ROOM_CAP, employeesInRoom } from '../src/sim/rooms';
import { EMPLOYEES } from '../src/content/employees';
import type { GameState } from '../src/sim/types';

/** Every upgrade that uses one of the behavioural effect kinds. */
const BEHAVIOUR_KINDS = [
  'critChance',
  'goldenChance',
  'comboWindow',
  'eventReward',
  'roomEfficiency',
] as const;

function upgradesOfKind(kind: (typeof BEHAVIOUR_KINDS)[number]) {
  return UPGRADES.filter((u) => u.effect.kind === kind);
}

function stateWith(upgrades: Record<string, number>): GameState {
  const state = createInitialState(1);
  state.resources.reputation = 100_000;
  state.upgrades = { ...state.upgrades, ...upgrades };
  return state;
}

describe('behavioural upgrades exist and are reachable', () => {
  it('offers upgrades for every behavioural effect kind', () => {
    for (const kind of BEHAVIOUR_KINDS) {
      expect(upgradesOfKind(kind).length, `${kind} upgrades`).toBeGreaterThan(0);
    }
  });

  it('gates each behavioural upgrade behind something', () => {
    for (const kind of BEHAVIOUR_KINDS) {
      for (const def of upgradesOfKind(kind)) {
        // These are strategy-openers, not starting purchases.
        expect(def.unlock, `${def.id} should be gated`).toBeDefined();
        expect(def.maxLevel, `${def.id} should be shallow`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('names a prerequisite that actually exists', () => {
    for (const def of UPGRADES) {
      if (def.unlock?.upgradeId) {
        expect(
          UPGRADES_BY_ID[def.unlock.upgradeId],
          `${def.id} -> ${def.unlock.upgradeId}`,
        ).toBeDefined();
      }
    }
  });

  it('sums levels through upgradeBonus', () => {
    const def = upgradesOfKind('critChance')[0];
    const perLevel = 'perLevel' in def.effect ? def.effect.perLevel : 0;
    expect(upgradeBonus(stateWith({}), 'critChance')).toBe(0);
    expect(upgradeBonus(stateWith({ [def.id]: 3 }), 'critChance')).toBeCloseTo(perLevel * 3, 6);
  });
});

// The point of these upgrades is that they change the game's behaviour. Owning
// one has to move the system it names, or it is decoration.
describe('behavioural upgrades change the systems they name', () => {
  const station = CLICK_STATIONS[0];

  it('sharpens the critical-tap roll', () => {
    const before = critChance(stateWith({}), station);
    const after = critChance(stateWith({ 'calibrated-tools': 4 }), station);
    expect(after).toBeGreaterThan(before);
  });

  it('widens the combo window', () => {
    const before = stationComboWindowMs(stateWith({}), station);
    const after = stationComboWindowMs(stateWith({ 'muscle-memory': 5 }), station);
    expect(after).toBeGreaterThan(before);
  });

  it('raises the golden-nut drop rate', () => {
    const before = goldenTapChance(stateWith({}));
    const after = goldenTapChance(stateWith({ 'assay-desk': 5 }));
    expect(after).toBeGreaterThan(before);
  });

  it('makes a thinly staffed room count for more', () => {
    const base = stateWith({});
    const boosted = stateWith({ 'standard-procedures': 6 });
    // One teammate in a room, in both states.
    for (const state of [base, boosted]) {
      state.employees.pip = { ...state.employees.pip, hired: true, room: 'rooftop' };
      for (const employee of EMPLOYEES) {
        if (employee.id !== 'pip') {
          state.employees[employee.id] = {
            ...state.employees[employee.id],
            hired: false,
            room: null,
          };
        }
      }
    }
    expect(employeesInRoom(base, 'rooftop')).toEqual(['pip']);
    expect(roomStaffing(boosted, 'rooftop')).toBeGreaterThan(roomStaffing(base, 'rooftop'));
  });

  it('never lets room efficiency exceed a fully staffed room', () => {
    const state = stateWith({ 'standard-procedures': 6, 'internal-audit': 4 });
    const roster = EMPLOYEES.slice(0, ROOM_CAP).map((e) => e.id);
    for (const id of roster) {
      state.employees[id] = { ...state.employees[id], hired: true, room: 'rooftop' };
    }
    expect(roomStaffing(state, 'rooftop')).toBeLessThanOrEqual(1);
  });

  it('cannot conjure a department out of an empty room', () => {
    const state = stateWith({ 'standard-procedures': 6, 'internal-audit': 4 });
    for (const employee of EMPLOYEES) {
      state.employees[employee.id] = {
        ...state.employees[employee.id],
        hired: false,
        room: null,
      };
    }
    expect(roomStaffing(state, 'rooftop')).toBe(0);
  });

  it('pays more for a favourable decision but does not soften a penalty', () => {
    const plain = new GameEngine(stateWith({}), { deterministic: true, seed: 3 });
    const trained = new GameEngine(stateWith({ 'legal-review': 5 }), {
      deterministic: true,
      seed: 3,
    });

    const rewardOf = (engine: GameEngine) => {
      const before = engine.state.resources.reputation;
      engine.applyEffect({ type: 'reputation', value: 100 });
      return engine.state.resources.reputation - before;
    };
    expect(rewardOf(trained)).toBeGreaterThan(rewardOf(plain));

    // A penalty is a penalty. Investing in negotiation must not quietly turn the
    // game's downside risk off, or every decision becomes free.
    const penaltyOf = (engine: GameEngine) => {
      engine.state.resources.reputation = 1000;
      engine.applyEffect({ type: 'reputation', value: -100 });
      return 1000 - engine.state.resources.reputation;
    };
    expect(penaltyOf(trained)).toBe(penaltyOf(plain));
  });
});
