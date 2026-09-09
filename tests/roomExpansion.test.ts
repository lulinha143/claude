import { describe, it, expect } from 'vitest';
import { ROOMS, ROOMS_BY_ID } from '../src/content/rooms';
import { ROOM_PROFILES_BY_ID } from '../src/content/roomProfiles';
import { ROOM_BUILTIN, ROOM_SURFACES } from '../src/content/roomSurfaces';
import { CLICK_STATIONS, stationsInRoom } from '../src/content/clickStations';
import { UPGRADES_BY_ID } from '../src/content/upgrades';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { isRoomIdUnlocked, unlockedRooms } from '../src/sim/rooms';
import { characterSlots } from '../src/content/roomLayout';
import { aggregateCompanyModifiers } from '../src/sim/companyModifiers';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import en from '../src/i18n/locales/en.json';
import ptBR from '../src/i18n/locales/pt-BR.json';

const NEW_ROOMS = ['cafeteria', 'mailroom', 'security', 'archive', 'incubator'];

function fresh() {
  return new GameEngine(createInitialState(0), { deterministic: true });
}

describe('the building has genuinely expanded', () => {
  it('has substantially more rooms than the original thirteen', () => {
    expect(ROOMS.length).toBeGreaterThanOrEqual(18);
  });

  it('registers every new room end to end', () => {
    for (const id of NEW_ROOMS) {
      expect(ROOMS_BY_ID[id], `${id} room def`).toBeDefined();
      expect(ROOM_PROFILES_BY_ID[id], `${id} profile`).toBeDefined();
      expect(ROOM_BUILTIN[id], `${id} wall fixture`).toBeDefined();
      expect(ROOM_SURFACES[id], `${id} placement regions`).toBeDefined();
      expect(ROOM_SURFACES[id].length, `${id} regions`).toBe(3);
    }
  });

  it('uses unique room ids and floors that stack sensibly', () => {
    const ids = ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const room of ROOMS) {
      expect(Number.isInteger(room.floor), `${room.id} floor`).toBe(true);
    }
  });

  it('names and describes every room in both complete locales', () => {
    // Resolve through the room's own key rather than building `room.<id>`: the
    // locale keys are camelCased, so the definition is the only reliable path.
    const lookup = (bundle: unknown, path: string): unknown =>
      path.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object' && part in node) {
          return (node as Record<string, unknown>)[part];
        }
        return undefined;
      }, bundle);

    for (const [label, bundle] of [
      ['en', en],
      ['pt-BR', ptBR],
    ] as const) {
      for (const room of ROOMS) {
        const name = lookup(bundle, room.nameKey);
        const desc = lookup(bundle, room.descriptionKey);
        expect(typeof name, `${label} ${room.nameKey}`).toBe('string');
        expect((name as string).length, `${label} ${room.nameKey}`).toBeGreaterThan(2);
        expect(typeof desc, `${label} ${room.descriptionKey}`).toBe('string');
        expect((desc as string).length, `${label} ${room.descriptionKey}`).toBeGreaterThan(10);
      }
    }
  });

  it('gives every new room a distinct personality summary', () => {
    const summaries = NEW_ROOMS.map((id) => ROOM_PROFILES_BY_ID[id].summaryKey);
    expect(new Set(summaries).size).toBe(summaries.length);
    const tempers = NEW_ROOMS.map((id) => ROOM_PROFILES_BY_ID[id].temper);
    // Not five copies of the same kind of room.
    expect(new Set(tempers).size).toBeGreaterThanOrEqual(4);
  });

  it('lays out characters in every room without overlap', () => {
    for (const room of ROOMS) {
      for (let n = 1; n <= 6; n += 1) {
        const slots = characterSlots(n, room.id);
        expect(slots).toHaveLength(n);
        const xs = slots.map((s) => s.x).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i += 1) {
          expect(xs[i] - xs[i - 1], `${room.id} with ${n}`).toBeGreaterThan(0.02);
        }
      }
    }
  });
});

describe('every new room is playable', () => {
  it('gives each new room its own click station', () => {
    for (const id of NEW_ROOMS) {
      const stations = stationsInRoom(id);
      expect(stations.length, `${id} has no station`).toBeGreaterThan(0);
    }
  });

  it('does not reuse a station archetype', () => {
    const kinds = CLICK_STATIONS.map((s) => s.kind);
    expect(new Set(kinds).size, 'each station should look distinct').toBe(kinds.length);
    const ids = CLICK_STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('spreads clicker gameplay across most of the building', () => {
    const withStations = new Set(CLICK_STATIONS.map((s) => s.roomId));
    expect(withStations.size).toBeGreaterThanOrEqual(18);
  });

  it('names every station in both complete locales', () => {
    for (const [label, bundle] of [
      ['en', en],
      ['pt-BR', ptBR],
    ] as const) {
      const flat = JSON.stringify(bundle);
      for (const station of CLICK_STATIONS) {
        const leaf = station.nameKey.split('.').pop()!;
        expect(flat.includes(`"${leaf}"`), `${label} missing ${station.nameKey}`).toBe(true);
      }
    }
  });

  it('only names real employees as station specialists', () => {
    for (const station of CLICK_STATIONS) {
      for (const id of station.synergy) {
        expect(EMPLOYEES_BY_ID[id], `${station.id} synergy ${id}`).toBeDefined();
      }
    }
  });

  it('pays out on the new stations once their room is open', () => {
    const engine = fresh();
    engine.state.resources.reputation = 100_000;
    for (const room of ROOMS) {
      if (room.unlock.upgradeId) engine.state.upgrades[room.unlock.upgradeId] = 1;
    }
    for (const id of NEW_ROOMS) {
      const station = stationsInRoom(id)[0];
      const result = engine.tapStation(station.id);
      expect(result, `${station.id} paid nothing`).not.toBeNull();
      expect(result!.amount).toBeGreaterThan(0);
    }
  });
});

describe('the new rooms unlock progressively', () => {
  it('starts with none of them open', () => {
    const engine = fresh();
    for (const id of NEW_ROOMS) {
      expect(isRoomIdUnlocked(engine.state, id), `${id} should start locked`).toBe(false);
    }
  });

  it('gates each new room behind reputation or a purchase', () => {
    for (const id of NEW_ROOMS) {
      const room = ROOMS_BY_ID[id];
      const gated = Boolean(room.unlock.reputation || room.unlock.upgradeId);
      expect(gated, `${id} has no unlock condition`).toBe(true);
      if (room.unlock.upgradeId) {
        // A purchase gate needs a real, buyable upgrade behind it.
        const upgrade = UPGRADES_BY_ID[room.unlock.upgradeId];
        expect(upgrade, `${id} names a missing upgrade`).toBeDefined();
        expect(upgrade.effect.kind).toBe('unlockRoom');
        expect(upgrade.baseCost).toBeGreaterThan(0);
      }
    }
  });

  it('opens the cheap morale room long before the late-game ones', () => {
    const cafeteria = ROOMS_BY_ID.cafeteria.unlock.reputation!;
    const incubator = ROOMS_BY_ID.incubator.unlock.reputation!;
    expect(cafeteria).toBeLessThan(incubator);
    // And the cafeteria is reachable well inside the early game.
    expect(cafeteria).toBeLessThan(20);
  });

  it('grows the building as reputation climbs', () => {
    const engine = fresh();
    const counts: number[] = [];
    for (const rep of [0, 10, 50, 150, 350]) {
      engine.state.resources.reputation = rep;
      counts.push(unlockedRooms(engine.state).length);
    }
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
    expect(counts.at(-1)!).toBeGreaterThan(counts[0]);
  });
});

describe('the new rooms join the synergy network', () => {
  function staffed(roomId: string, ids: string[]) {
    const engine = fresh();
    engine.state.resources.reputation = 100_000;
    for (const room of ROOMS) {
      if (room.unlock.upgradeId) engine.state.upgrades[room.unlock.upgradeId] = 1;
    }
    for (const id of ids) {
      const rt = engine.state.employees[id];
      rt.hired = true;
      rt.level = Math.max(1, rt.level);
      rt.room = roomId;
    }
    return engine;
  }

  it('makes the cafeteria raise the morale the company settles at', () => {
    const engine = staffed('cafeteria', ['marlow', 'bia', 'hazel']);
    expect(aggregateCompanyModifiers(engine.state).moraleTarget).toBeGreaterThan(0);
  });

  it('makes the mail room cheapen the rest of the building', () => {
    const engine = staffed('mailroom', ['junie', 'perry', 'otto']);
    expect(aggregateCompanyModifiers(engine.state).costReduction).toBeGreaterThan(0);
  });

  it('makes the incubator a golden-nut engine that costs morale', () => {
    const engine = staffed('incubator', ['axel', 'quincy', 'nixie']);
    const mods = aggregateCompanyModifiers(engine.state);
    expect(mods.goldenChance).toBeGreaterThan(0);
    expect(mods.moraleTarget).toBeLessThan(0);
  });

  it('keeps a partner-gated new effect dormant until its partner runs', () => {
    const alone = staffed('archive', ['moss', 'mina', 'nino']);
    const before = aggregateCompanyModifiers(alone.state).production;
    // The archive's production effect needs Research staffed.
    const rt = alone.state.employees.canela;
    rt.hired = true;
    rt.level = Math.max(1, rt.level);
    rt.room = 'research';
    expect(aggregateCompanyModifiers(alone.state).production).toBeGreaterThan(before);
  });

  it('only names real rooms as dependencies and real employees as specialists', () => {
    for (const id of NEW_ROOMS) {
      const profile = ROOM_PROFILES_BY_ID[id];
      for (const effect of [...profile.effects, ...profile.tradeoffs]) {
        if (effect.requiresRoom) expect(ROOMS_BY_ID[effect.requiresRoom], effect.requiresRoom).toBeDefined();
      }
      for (const spec of profile.specialists ?? []) {
        expect(EMPLOYEES_BY_ID[spec], `${id} specialist ${spec}`).toBeDefined();
      }
      for (const fed of profile.feeds ?? []) {
        expect(ROOMS_BY_ID[fed], `${id} feeds ${fed}`).toBeDefined();
      }
    }
  });
});
