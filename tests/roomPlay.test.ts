import { describe, expect, it } from 'vitest';

import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { performPrestige } from '../src/sim/prestige';
import { ROOMS } from '../src/content/rooms';
import { NUTS } from '../src/content/nuts';
import { GAME_EVENTS } from '../src/content/events';
import { CLICK_STATIONS, stationsInRoom } from '../src/content/clickStations';
import { ROOM_PROFILES_BY_ID } from '../src/content/roomProfiles';
import {
  NUT_SOURCES,
  ODDITIES,
  ODDITIES_BY_ID,
  ROOM_PLAY,
  ROOM_ROUTINES,
  odditiesInRoom,
  oddityFlag,
  roomFileFlag,
  type RoutineKind,
} from '../src/content/roomPlay';
import {
  activeModeEffects,
  brewSeconds,
  curiosityProgress,
  oddityAvailable,
  roomHelpers,
  routineView,
  spontaneousOddities,
  watchSeconds,
} from '../src/sim/roomPlay';
import { aggregateCompanyModifiers } from '../src/sim/companyModifiers';
import { availableFacilityDiscoveries } from '../src/sim/facilityDiscoveries';
import { employeeMood } from '../src/sim/mood';
import { employeesInRoom } from '../src/sim/rooms';
import type { GameState } from '../src/sim/types';

/**
 * Gameplay chapter 3: the office as a playground.
 *
 * Every room's station has a routine of its own (brew, tend, watch, deliver,
 * tune), the office produces moments on its own, and curiosities turn up to be
 * noticed. These play each verb through the engine the way the office does,
 * check the words exist in both shipped languages, and check that what the
 * player did survives a save, an old save and a restructure.
 */

const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
const LOCALES = { en, 'pt-BR': pt } as Record<string, unknown>;

function text(locale: string, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      LOCALES[locale],
    );
}

/** A company with every room open, on a clock we control. */
function office(mutate?: (s: GameState) => void) {
  let clock = T0;
  const state = createInitialState(T0);
  state.resources.reputation = 5_000;
  state.resources.nuts = 1_000_000;
  state.resources.morale = 60;
  for (const room of ROOMS) if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  state.stats.playTimeSeconds = 10_000;
  mutate?.(state);
  const engine = new GameEngine(state, { deterministic: true, now: () => clock });
  return {
    engine,
    get state() {
      return engine.state;
    },
    now: () => clock,
    wait(seconds: number) {
      clock += seconds * 1000;
      engine.tick(0.1);
    },
    /** Let the office run for a while, as the game loop would. */
    run(seconds: number) {
      clock += seconds * 1000;
      engine.tick(seconds);
    },
  };
}

/** Put `ids` to work in `roomId`. */
function staff(s: GameState, roomId: string, ids: string[], friendship = 30) {
  for (const id of ids) {
    s.employees[id] = { ...s.employees[id], hired: true, level: 3, friendship, room: roomId };
  }
}

const KINDS: RoutineKind[] = ['brew', 'tend', 'watch', 'deliver', 'tune'];

describe('every room plays its own way', () => {
  it('gives each of the 21 rooms one routine, out of five verbs each used several times', () => {
    expect(Object.keys(ROOM_ROUTINES).sort()).toEqual(ROOMS.map((room) => room.id).sort());
    const byKind = new Map<RoutineKind, string[]>();
    for (const [room, routine] of Object.entries(ROOM_ROUTINES)) {
      byKind.set(routine.kind, [...(byKind.get(routine.kind) ?? []), room]);
    }
    expect([...byKind.keys()].sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) expect(byKind.get(kind)!.length, kind).toBeGreaterThanOrEqual(3);
    // ...and each fits the room's temperament rather than being dealt at random.
    for (const room of byKind.get('tend')!) {
      expect(['industrial', 'irregular']).toContain(ROOM_PROFILES_BY_ID[room].temper);
    }
    for (const room of byKind.get('watch')!) {
      expect(['secure', 'analytical', 'irregular']).toContain(ROOM_PROFILES_BY_ID[room].temper);
    }
  });

  it('attaches every routine to a real station in its room', () => {
    for (const room of Object.keys(ROOM_ROUTINES)) {
      expect(stationsInRoom(room).length, room).toBeGreaterThan(0);
    }
    expect(CLICK_STATIONS.length).toBe(21);
  });

  it('has its words in both languages, and never the same line for two rooms', () => {
    for (const locale of Object.keys(LOCALES)) {
      const seen = new Map<string, string>();
      for (const [room, routine] of Object.entries(ROOM_ROUTINES)) {
        const keys = ['name', 'tip', 'say'];
        if (routine.kind === 'brew') {
          keys.push('start', 'ready', ...routine.outcomes.map((o) => `done.${o.id}`));
        }
        if (routine.kind === 'tend') keys.push('problem', 'jam', 'fixed', 'selfFix');
        if (routine.kind === 'watch') keys.push('blip', 'spot', 'caught');
        if (routine.kind === 'deliver') keys.push('delivered');
        if (routine.kind === 'tune') {
          keys.push('off');
          for (const mode of routine.modes) {
            keys.push(`mode.${mode.id}.name`, `mode.${mode.id}.effect`, `mode.${mode.id}.react`);
          }
        }
        for (const key of keys) {
          const value = text(locale, `play.${room}.${key}`);
          expect(
            typeof value === 'string' && value.length > 0,
            `${locale} play.${room}.${key}`,
          ).toBe(true);
          // Names may echo (two rooms can share a word for their gear) and a mode's
          // effect line states the mechanic plainly, so the same lever reads the same.
          if (key === 'name' || key.endsWith('.name') || key.endsWith('.effect')) continue;
          const other = seen.get(value as string);
          expect(other, `${locale} play.${room}.${key} repeats ${other}`).toBeUndefined();
          seen.set(value as string, `${room}.${key}`);
        }
      }
    }
  });

  it('says what each mode does in plain words, and every mode is a different lever', () => {
    for (const routine of Object.values(ROOM_ROUTINES)) {
      if (routine.kind !== 'tune') continue;
      const kinds = routine.modes.map((mode) => mode.effect.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });
});

describe('brew: prepare, wait, share', () => {
  it('starts, runs on real time (away too), and is shared out once ready', () => {
    const w = office();
    expect(routineView(w.state, 'morale', w.now())?.status).toBe('idle');
    expect(w.engine.collectRoutine('morale')).toBeNull();
    expect(w.engine.startRoutine('morale')).toBe(true);
    expect(w.engine.startRoutine('morale')).toBe(false);
    expect(routineView(w.state, 'morale', w.now())?.status).toBe('running');
    w.wait(ROOM_ROUTINES.morale.kind === 'brew' ? ROOM_ROUTINES.morale.seconds - 5 : 0);
    expect(w.engine.collectRoutine('morale')).toBeNull();
    w.wait(10);
    expect(routineView(w.state, 'morale', w.now())?.status).toBe('ready');
    const nuts = w.state.resources.nuts;
    const morale = w.state.resources.morale;
    const result = w.engine.collectRoutine('morale')!;
    expect(result.kind).toBe('brew');
    expect(result.payout.nuts).toBeGreaterThan(0);
    expect(w.state.resources.nuts).toBeGreaterThan(nuts);
    expect(w.state.resources.morale).toBeGreaterThan(morale);
    expect(w.engine.currentBoostMultiplier()).toBeGreaterThan(1);
    expect(routineView(w.state, 'morale', w.now())).toMatchObject({ status: 'idle', done: 1 });
  });

  it('cheers up the people in the room, and helpers make it quicker', () => {
    const w = office((s) => staff(s, 'morale', ['marlow', 'otto']));
    const base = ROOM_ROUTINES.morale.kind === 'brew' ? ROOM_ROUTINES.morale.seconds : 0;
    // Marlow is the Break Room's specialist; Otto is just there.
    expect(roomHelpers(w.state, 'morale').map((h) => h.id)).toEqual(['marlow']);
    expect(brewSeconds(w.state, 'morale')).toBe(Math.round(base * 0.8));
    // A close friend helps too.
    w.state.employees.otto.friendship = 75;
    expect(brewSeconds(w.state, 'morale')).toBe(Math.round(base * 0.6));
    w.engine.startRoutine('morale');
    w.wait(base);
    const result = w.engine.collectRoutine('morale')!;
    expect(result.speaker).not.toBeNull();
    for (const id of ['marlow', 'otto']) expect(employeeMood(w.state, id, w.now())).toBe('happy');
  });

  it('feeds the whole company at lunch', () => {
    const w = office((s) => {
      staff(s, 'cafeteria', ['bia']);
      staff(s, 'research', ['moss'], 20);
    });
    w.engine.startRoutine('cafeteria');
    w.wait(400);
    const before = w.state.employees.moss.friendship;
    w.engine.collectRoutine('cafeteria');
    expect(w.state.employees.moss.friendship).toBe(before + 1);
  });

  it('needs a sleeper for a dream, and dreams are curiosities worth collecting', () => {
    const w = office();
    expect(routineView(w.state, 'nap', w.now())?.status).toBe('needsSomeone');
    expect(w.engine.startRoutine('nap')).toBe(false);
    staff(w.state, 'nap', ['dorm']);
    const dreams = odditiesInRoom('nap').filter((def) => def.anchor === null);
    const told = new Set<string>();
    for (let i = 0; i < dreams.length + 2; i += 1) {
      expect(w.engine.startRoutine('nap')).toBe(true);
      w.wait(400);
      const result = w.engine.collectRoutine('nap')!;
      if (result.oddityId) told.add(result.oddityId);
    }
    // Every dream turns up once, then the log is quiet (plain dreams after that).
    expect([...told].sort()).toEqual(dreams.map((d) => d.id).sort());
    expect(w.state.collections.nuts).toContain('burnout-brazil');
  });

  it('can turn out differently in the lab', () => {
    const w = office((s) => staff(s, 'lab', ['axel']));
    const outcomes = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      w.engine.startRoutine('lab');
      w.wait(300);
      outcomes.add(w.engine.collectRoutine('lab')!.outcome);
    }
    expect([...outcomes].sort()).toEqual(['anomalous', 'stable', 'unstable']);
  });
});

describe('tend: the machine acts up', () => {
  it('only happens to machines someone is using, one at a time', () => {
    const w = office();
    expect(w.engine.spawnOfficeMoment('tend')).toBe(false);
    staff(w.state, 'sorting', ['bia']);
    expect(w.engine.spawnOfficeMoment('tend', 'sorting')).toBe(true);
    staff(w.state, 'construction', ['dorm']);
    expect(w.engine.spawnOfficeMoment('tend', 'construction')).toBe(false);
  });

  it('is freed by three taps on the machine, and the room rushes', () => {
    const w = office((s) => staff(s, 'construction', ['dorm']));
    w.engine.spawnOfficeMoment('tend', 'construction');
    const station = stationsInRoom('construction')[0];
    expect(routineView(w.state, 'construction', w.now())?.status).toBe('jammed');
    const one = w.engine.tapStation(station.id)!;
    expect(one.tend).toEqual({ taps: 1, needed: 3 });
    expect(one.amount).toBeGreaterThan(0);
    w.engine.tapStation(station.id);
    const third = w.engine.tapStation(station.id)!;
    expect(third.tend?.fixed?.outcome).toBe('fixed');
    expect(third.tend?.fixed?.payout.rush).toBe(30);
    expect(w.engine.rushEndsAt('construction')).toBeGreaterThan(w.now());
    expect(routineView(w.state, 'construction', w.now())?.status).toBe('quiet');
    expect(employeeMood(w.state, 'dorm', w.now())).toBe('proud');
  });

  it('is freed by a specialist on their own, given a minute', () => {
    const w = office((s) => staff(s, 'construction', ['bea']));
    w.engine.spawnOfficeMoment('tend', 'construction');
    w.wait(ROOM_PLAY.selfFixSeconds - 5);
    expect(routineView(w.state, 'construction', w.now())?.status).toBe('jammed');
    w.wait(10);
    expect(routineView(w.state, 'construction', w.now())?.status).toBe('quiet');
    const news = w.engine.drainOfficeNews().find((item) => item.kind === 'selfFix');
    expect(news?.result?.speaker).toBe('bea');
    expect(news?.result?.payout.rush).toBe(15);
  });

  it('turns odd nuts out of the sorting chute into the Nut Encyclopedia', () => {
    const w = office((s) => staff(s, 'sorting', ['otto']));
    const station = stationsInRoom('sorting')[0];
    const found = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      w.engine.spawnOfficeMoment('tend', 'sorting');
      for (let tap = 0; tap < 3; tap += 1) {
        const fixed = w.engine.tapStation(station.id)?.tend?.fixed;
        if (fixed?.nutId) found.add(fixed.nutId);
      }
    }
    const pool = odditiesInRoom('sorting')
      .filter((d) => d.nutId)
      .map((d) => d.nutId!);
    expect([...found].sort()).toEqual([...pool].sort());
    for (const nut of pool) expect(w.state.collections.nuts).toContain(nut);
  });
});

describe('watch: catch it while it lasts', () => {
  it('shows for half a minute (longer with a helper), then goes', () => {
    const w = office();
    expect(watchSeconds(w.state, 'security')).toBe(35);
    staff(w.state, 'security', ['corvus']);
    expect(watchSeconds(w.state, 'security')).toBe(53);
    w.engine.spawnOfficeMoment('watch', 'security');
    expect(routineView(w.state, 'security', w.now())?.status).toBe('blip');
    w.wait(60);
    expect(routineView(w.state, 'security', w.now())?.status).toBe('quiet');
    expect(w.engine.catchBlip('security')).toBeNull();
  });

  it('pays when caught, and the cameras sometimes catch something worth keeping', () => {
    const w = office((s) => staff(s, 'security', ['perry']));
    const caught = new Set<string>();
    let reputation = w.state.resources.reputation;
    for (let i = 0; i < 30; i += 1) {
      w.engine.spawnOfficeMoment('watch', 'security');
      const result = w.engine.catchBlip('security')!;
      expect(w.state.resources.reputation).toBeGreaterThan(reputation);
      reputation = w.state.resources.reputation;
      if (result.oddityId) caught.add(result.oddityId);
    }
    const footage = odditiesInRoom('security')
      .filter((d) => d.anchor === null)
      .map((d) => d.id);
    expect([...caught].sort()).toEqual(footage.sort());
  });
});

describe('deliver: something for someone', () => {
  it('addresses parcels to the team, and the recipient is glad of it', () => {
    const w = office((s) => staff(s, 'research', ['moss'], 20));
    expect(w.engine.spawnOfficeMoment('deliver', 'mailroom')).toBe(true);
    const view = routineView(w.state, 'mailroom', w.now())!;
    expect(view.status).toBe('parcel');
    const to = view.parcelFor!;
    expect(w.state.employees[to].hired).toBe(true);
    const before = w.state.employees[to].friendship;
    const result = w.engine.deliverParcel('mailroom')!;
    expect(result.recipient).toBe(to);
    expect(result.speaker).toBe(to);
    expect(w.state.employees[to].friendship).toBe(before + 3);
    expect(employeeMood(w.state, to, w.now())).toBe('happy');
    expect(text('en', `play.parcel.${to}`)).toBeTruthy();
    expect(w.engine.deliverParcel('mailroom')).toBeNull();
  });

  it('brings orders for the company to procurement, nuts and all', () => {
    const w = office();
    w.engine.spawnOfficeMoment('deliver', 'procurement');
    expect(routineView(w.state, 'procurement', w.now())?.parcelFor).toBe('');
    const result = w.engine.deliverParcel('procurement')!;
    expect(result.recipient).toBeUndefined();
    expect(result.payout.nuts).toBeGreaterThanOrEqual(ROOM_PLAY.minOutput);
  });

  it('keeps no more than a couple waiting', () => {
    const w = office();
    expect(w.engine.spawnOfficeMoment('deliver')).toBe(true);
    expect(w.engine.spawnOfficeMoment('deliver')).toBe(true);
    expect(w.engine.spawnOfficeMoment('deliver')).toBe(false);
  });
});

describe('tune: the room has a mode', () => {
  it('starts with no mode, and each mode is a steady bonus while someone works there', () => {
    const w = office();
    expect(routineView(w.state, 'meeting', w.now())).toMatchObject({
      status: 'needsSomeone',
      mode: null,
    });
    // Plan, then Ship it.
    w.engine.cycleRoomMode('meeting');
    expect(w.engine.cycleRoomMode('meeting')?.outcome).toBe('ship');
    // Nobody there yet: the mode is chosen but idle.
    expect(activeModeEffects(w.state)).toEqual([]);
    staff(w.state, 'meeting', ['hazel']);
    expect(activeModeEffects(w.state).map((e) => e.mode.id)).toEqual(['ship']);
    const withMode = aggregateCompanyModifiers(w.state).production;
    delete w.state.office.rooms.meeting.mode;
    expect(withMode - aggregateCompanyModifiers(w.state).production).toBeCloseTo(0.05, 5);
  });

  it('changes how the room feels', () => {
    const w = office((s) => staff(s, 'broadcast', ['echo', 'rosa']));
    const result = w.engine.cycleRoomMode('broadcast')!;
    expect(result.outcome).toBe('calm');
    for (const id of ['echo', 'rosa']) expect(employeeMood(w.state, id, w.now())).toBe('relaxed');
    w.engine.cycleRoomMode('broadcast');
    for (const id of ['echo', 'rosa']) expect(employeeMood(w.state, id, w.now())).toBe('excited');
  });
});

describe('curiosities', () => {
  it('gives every room something to notice, in both languages', () => {
    for (const room of ROOMS) {
      const here = odditiesInRoom(room.id);
      expect(here.length, room.id).toBeGreaterThanOrEqual(2);
      // At least one turns up on its own, so every room can surprise the player.
      expect(
        here.some((def) => def.anchor !== null),
        room.id,
      ).toBe(true);
    }
    const ids = ODDITIES.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const locale of Object.keys(LOCALES)) {
      const found = new Set<unknown>();
      for (const def of ODDITIES) {
        const line = text(locale, `oddity.${def.id}.found`);
        expect(typeof line, `${locale} oddity.${def.id}.found`).toBe('string');
        expect(found.has(line), `${locale} ${def.id} repeats`).toBe(false);
        found.add(line);
        if (!def.nutId) expect(typeof text(locale, `oddity.${def.id}.title`)).toBe('string');
        if (def.anchor) expect(typeof text(locale, `oddity.${def.id}.hint`)).toBe('string');
      }
    }
    // A spread of tones: funny, wholesome, strange, absurd and now and then paranormal.
    expect(new Set(ODDITIES.map((def) => def.tone)).size).toBe(5);
  });

  it('makes the whole Nut Encyclopedia findable', () => {
    const fromEvents = new Set(
      JSON.stringify(GAME_EVENTS)
        .match(/"nutId":"([a-z-]+)"/g)!
        .map((m) => m.slice(9, -1)),
    );
    for (const nut of NUTS) {
      expect(fromEvents.has(nut.id) || nut.id in NUT_SOURCES, nut.id).toBe(true);
    }
  });

  it('turns up on its own, waits, and is noticed once and for good', () => {
    const w = office();
    expect(w.engine.spawnOfficeMoment('oddity', 'meeting')).toBe(true);
    expect(w.engine.spawnOfficeMoment('oddity')).toBe(false);
    const waiting = w.state.office.oddities[0];
    expect(ODDITIES_BY_ID[waiting.id].roomId).toBe('meeting');
    const result = w.engine.noticeOddity(waiting.id)!;
    expect(result.kind).toBe('oddity');
    expect(oddityFlag(waiting.id) in w.state.flags).toBe(true);
    expect(w.state.office.oddities).toEqual([]);
    expect(w.engine.noticeOddity(waiting.id)).toBeNull();
    expect(spontaneousOddities(w.state, w.now()).some((def) => def.id === waiting.id)).toBe(false);
  });

  it('fades if nobody looks', () => {
    const w = office();
    w.engine.spawnOfficeMoment('oddity');
    w.wait(ROOM_PLAY.oddityLingerSeconds + 1);
    expect(w.state.office.oddities).toEqual([]);
  });

  it('can depend on a decoration, a story told, or the hour', () => {
    const w = office();
    const fish = ODDITIES_BY_ID['fish-arrow'];
    const acorn = ODDITIES_BY_ID['first-acorn'];
    const moon = ODDITIES_BY_ID['moon-thanks'];
    expect(oddityAvailable(w.state, fish, w.now())).toBe(false);
    w.state.decorationInstances.push({
      instanceId: 'deco-aquarium',
      decorationId: 'aquarium',
      roomId: 'morale',
      surfaceType: 'floor',
      normalizedX: 0.5,
      normalizedY: 0.1,
      depth: 0,
      interactionState: {},
    } as GameState['decorationInstances'][number]);
    expect(oddityAvailable(w.state, fish, w.now())).toBe(true);
    expect(oddityAvailable(w.state, acorn, w.now())).toBe(false);
    w.state.flags['pip.arc.1'] = w.now();
    expect(oddityAvailable(w.state, acorn, w.now())).toBe(true);
    const noon = new Date(2026, 8, 30, 12).getTime();
    const late = new Date(2026, 8, 30, 23).getTime();
    expect(oddityAvailable(w.state, moon, noon)).toBe(false);
    expect(oddityAvailable(w.state, moon, late)).toBe(true);
  });

  it("completes a room file, and brings a facility room's secret forward", () => {
    const w = office((s) => staff(s, 'repair', ['bea']));
    expect(availableFacilityDiscoveries(w.state).map((d) => d.id)).not.toContain('repair');
    for (const def of odditiesInRoom('repair')) {
      expect(w.engine.spawnOfficeMoment('oddity', 'repair')).toBe(true);
      const id = w.state.office.oddities[0].id;
      const result = w.engine.noticeOddity(id)!;
      if (def === odditiesInRoom('repair').at(-1)) expect(result.roomComplete).toBe(true);
    }
    expect(curiosityProgress(w.state, 'repair')).toEqual({ noticed: 2, total: 2 });
    expect(roomFileFlag('repair') in w.state.flags).toBe(true);
    // Noticing enough there is a way into the room's secret.
    expect(availableFacilityDiscoveries(w.state).map((d) => d.id)).toContain('repair');
  });
});

describe('the office keeps itself interesting', () => {
  it('produces moments while it runs, in rooms that exist', () => {
    const w = office((s) => {
      staff(s, 'sorting', ['bia']);
      staff(s, 'security', ['perry']);
    });
    const kinds = new Set<string>();
    for (let minute = 0; minute < 120; minute += 1) {
      w.run(60);
      for (const item of w.engine.drainOfficeNews()) kinds.add(item.kind);
      // Deal with what turned up, so new things can.
      for (const [room, play] of Object.entries(w.state.office.rooms)) {
        if (play.parcelAt) w.engine.deliverParcel(room);
        if (play.jamAt)
          for (let i = 0; i < 3; i += 1) w.engine.tapStation(stationsInRoom(room)[0].id);
      }
      for (const item of [...w.state.office.oddities]) w.engine.noticeOddity(item.id);
    }
    expect([...kinds].sort()).toEqual(['blip', 'jam', 'oddity', 'parcel']);
  });

  it('stays quiet for a brand-new founder', () => {
    let clock = T0;
    const engine = new GameEngine(createInitialState(T0), {
      deterministic: true,
      now: () => clock,
    });
    for (let i = 0; i < 100; i += 1) {
      clock += 1000;
      engine.tick(1);
    }
    expect(engine.drainOfficeNews()).toEqual([]);
  });
});

describe('persistence', () => {
  it('survives a save and load: brews, stuck machines, parcels, modes and curiosities', () => {
    const w = office((s) => {
      staff(s, 'sorting', ['bia']);
      staff(s, 'broadcast', ['echo']);
    });
    w.engine.startRoutine('incubator');
    w.engine.spawnOfficeMoment('tend', 'sorting');
    w.engine.spawnOfficeMoment('deliver', 'mailroom');
    w.engine.cycleRoomMode('broadcast');
    w.engine.spawnOfficeMoment('oddity', 'cafeteria');
    const raw = JSON.parse(JSON.stringify(w.state));
    const loaded = gameStateSchema.parse(migrate(raw)) as GameState;
    expect(loaded.office).toEqual(w.state.office);
    for (const room of ['incubator', 'sorting', 'mailroom', 'broadcast']) {
      expect(routineView(loaded, room, w.now())).toEqual(routineView(w.state, room, w.now()));
    }
  });

  it('opens an old save with an empty office, and drops a broken entry rather than the save', () => {
    const old = JSON.parse(JSON.stringify(createInitialState(T0))) as Record<string, unknown>;
    delete old.office;
    expect((gameStateSchema.parse(migrate(old)) as GameState).office).toEqual({
      rooms: {},
      oddities: [],
    });
    const messy = JSON.parse(JSON.stringify(createInitialState(T0))) as Record<string, unknown>;
    messy.office = {
      rooms: { morale: { readyAt: 'soon' }, lab: { readyAt: T0, startedAt: T0 - 1 } },
      oddities: [{ id: 'memo' }, { id: 'memo', roomId: 'founder-desk', at: T0 }],
    };
    const parsed = gameStateSchema.parse(migrate(messy)) as GameState;
    expect(parsed.office.rooms.lab).toEqual({ readyAt: T0, startedAt: T0 - 1 });
    expect(parsed.office.rooms.morale).toEqual({});
    expect(parsed.office.oddities).toEqual([{ id: 'memo', roomId: 'founder-desk', at: T0 }]);
    // An engine on a state that never had an office at all copes too.
    const bare = createInitialState(T0) as Partial<GameState>;
    delete bare.office;
    const engine = new GameEngine(bare as GameState, { deterministic: true, now: () => T0 });
    expect(engine.state.office).toEqual({ rooms: {}, oddities: [] });
  });

  it('keeps what was noticed through a restructure, and starts the rooms afresh', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel']));
    w.engine.spawnOfficeMoment('oddity', 'meeting');
    w.engine.noticeOddity(w.state.office.oddities[0].id);
    w.engine.cycleRoomMode('meeting');
    w.engine.startRoutine('morale');
    w.state.stats.totalNutsEarned = 1e15;
    const after = performPrestige(w.state, 'cooperative', w.now() + 1000);
    expect(after.prestige.count).toBe(1);
    expect(curiosityProgress(after, 'meeting').noticed).toBe(1);
    expect(after.office).toEqual({ rooms: {}, oddities: [] });
  });

  it('never leaves a parcel addressed to someone who is not on the payroll', () => {
    const w = office();
    const hired = Object.keys(w.state.employees).filter((id) => w.state.employees[id].hired);
    for (let i = 0; i < 10; i += 1) {
      w.engine.spawnOfficeMoment('deliver', 'founder-desk');
      const to = routineView(w.state, 'founder-desk', w.now())!.parcelFor!;
      expect(hired).toContain(to);
      w.engine.deliverParcel('founder-desk');
    }
    expect(employeesInRoom(w.state, 'founder-desk')).toContain('pip');
  });
});
