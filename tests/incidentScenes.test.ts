import { describe, expect, it } from 'vitest';

import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { ROOMS } from '../src/content/rooms';
import { EMPLOYEES } from '../src/content/employees';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../src/content/events';
import { ODDITIES, ODDITIES_BY_ID } from '../src/content/roomPlay';
import { eventChoicesForState, previewEventChoice } from '../src/sim/eventChoices';
import { employeeMood } from '../src/sim/mood';
import {
  curiosityLeads,
  curiosityOrigins,
  decisionSetting,
  eventCast,
  openLeads,
  pointedAt,
  secretSource,
} from '../src/sim/happenings';
import type { GameState } from '../src/sim/types';

/**
 * Chapter 6: incidents, events and discoveries.
 *
 * A card says what each answer will do before it is taken, and that is what
 * the answer then does; it is set where it is happening, with its people, and
 * stays so across a reload; what it sets in motion waits for somebody to see it;
 * and what the player has noticed says where it came from and where it led,
 * without naming anything still unnoticed.
 */

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

/** A mature company: every room open, the whole cast hired and spread over it. */
function company(mutate?: (s: GameState) => void) {
  let clock = T0;
  const state = createInitialState(T0);
  state.resources.reputation = 6_000;
  state.resources.nuts = 50_000_000;
  state.resources.goldenNuts = 40;
  state.resources.morale = 60;
  for (const room of ROOMS) if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  state.stats.playTimeSeconds = 20_000;
  const rooms = ROOMS.map((room) => room.id);
  EMPLOYEES.forEach((employee, index) => {
    state.employees[employee.id] = {
      ...state.employees[employee.id],
      hired: true,
      level: 3,
      friendship: 40,
      room: employee.id === 'pip' ? 'founder-desk' : rooms[index % rooms.length],
    };
  });
  mutate?.(state);
  const engine = new GameEngine(state, { deterministic: true, seed: 7, now: () => clock });
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
  };
}

const copy = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;
/** A save as it is read back from disk, before the schema has seen it. */
const raw = (state: GameState) => JSON.parse(JSON.stringify(state)) as Record<string, unknown>;

describe('a card says what each answer will do, and that is what it does', () => {
  // Every authored answer, in every event and every part of one.
  const cases = GAME_EVENTS.flatMap((def) => [
    ...def.choices.map((choice) => ({
      def,
      step: null as string | null,
      path: [] as string[],
      choice,
    })),
    ...Object.entries(def.steps ?? {}).flatMap(([step, part]) => {
      const into = def.choices.find((choice) => choice.next === step);
      return into ? part.choices.map((choice) => ({ def, step, path: [into.id], choice })) : [];
    }),
  ]);

  it('matches what every answer in the event book does', () => {
    expect(cases.length).toBeGreaterThan(200);
    let checked = 0;
    for (const { def, path, step, choice } of cases) {
      const name = `${def.id}${step ? `/${step}` : ''} → ${choice.id}`;
      const w = company();
      expect(w.engine.triggerEvent(def.id), name).toBe(true);
      for (const id of path) expect(w.engine.resolveEventChoice(id), name).toBe(true);
      expect(w.engine.activeEvent?.step ?? null, name).toBe(step);
      const offered = eventChoicesForState(w.state, def, step).choices.find(
        (entry) => entry.choice.id === choice.id,
      );
      if (!offered?.enabled) continue; // a gated answer says what it needs instead
      const before = copy(w.state);
      const preview = previewEventChoice(w.state, def, choice, w.now());
      expect(w.engine.resolveEventChoice(choice.id), name).toBe(true);
      const after = w.state;
      // What it costs and pays.
      expect(Math.round(after.resources.nuts - before.resources.nuts), `${name}: nuts`).toBe(
        Math.round(preview.nuts),
      );
      expect(after.resources.goldenNuts - before.resources.goldenNuts, `${name}: golden`).toBe(
        preview.goldenNuts,
      );
      expect(after.resources.morale - before.resources.morale, `${name}: morale`).toBeCloseTo(
        preview.morale,
        6,
      );
      expect(
        after.resources.reputation - before.resources.reputation,
        `${name}: reputation`,
      ).toBeCloseTo(preview.reputation, 6);
      // Who it changes, and how.
      for (const person of preview.people) {
        expect(
          Math.round(
            after.employees[person.id].friendship - before.employees[person.id].friendship,
          ),
          `${name}: ${person.id} friendship`,
        ).toBe(person.friendship);
        if (person.emotion) {
          expect(employeeMood(after, person.id, w.now()), `${name}: ${person.id} mood`).toBe(
            person.emotion,
          );
        }
      }
      // ...and nobody it does not name (beyond what the whole team gets).
      for (const [id, rt] of Object.entries(after.employees)) {
        if (!rt.hired || preview.people.some((person) => person.id === id)) continue;
        expect(
          Math.round(rt.friendship - before.employees[id].friendship),
          `${name}: ${id} is not named`,
        ).toBe(preview.everyone);
      }
      // The room it changes.
      for (const room of preview.rooms) {
        if (room.mode)
          expect(after.office.rooms[room.roomId]?.mode, `${name}: mode`).toBe(room.mode);
      }
      // A souvenir, exactly when one is promised.
      expect(
        after.collections.moments.length - before.collections.moments.length,
        `${name}: souvenir`,
      ).toBe(preview.souvenir ? 1 : 0);
      // Something later, exactly when it is said that something may come back.
      const queued =
        after.scheduled.length > before.scheduled.length ||
        after.happenings.incidents.length > before.happenings.incidents.length ||
        after.office.oddities.length > before.office.oddities.length ||
        after.finds.length > before.finds.length;
      expect(queued, `${name}: set in motion`).toBe(preview.later);
      // Whoever is said to remember is who the outcome names.
      const remembered = w.engine.lastConsequence?.remembered;
      if (remembered) expect(preview.remembers, `${name}: remembers`).toContain(remembered);
      // And the card goes on exactly when it says there is more.
      expect(Boolean(w.engine.activeEvent), `${name}: continues`).toBe(preview.continues);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('counts the negotiation line in what a decision pays, and not in what it costs', () => {
    const plain = company();
    const bonus = company((s) => (s.upgrades['negotiation-training'] = 3));
    const def = GAME_EVENTS_BY_ID['ledger-discrepancy'];
    const report = def.choices.find((choice) => choice.id === 'report')!;
    const a = previewEventChoice(plain.state, def, report, plain.now());
    const b = previewEventChoice(bonus.state, def, report, bonus.now());
    expect(a.nuts).toBe(-400);
    expect(b.nuts).toBe(-400);
    expect(b.reputation).toBeGreaterThan(a.reputation);
  });

  it('never names a secret before it is found, but always says when something follows', () => {
    const w = company();
    const def = GAME_EVENTS_BY_ID['night-shift-report'];
    const keep = def.choices.find((choice) => choice.id === 'secret')!;
    const play = def.choices.find((choice) => choice.id === 'play')!;
    const preview = previewEventChoice(w.state, def, keep, w.now());
    expect(JSON.stringify(preview)).not.toContain('anomaly');
    expect(previewEventChoice(w.state, def, play, w.now()).later).toBe(true);
  });
});

describe('an incident waits for what it needs, then happens where it belongs', () => {
  it('only lets a follow-up happen once the curiosity before it was noticed', () => {
    const w = company();
    expect(w.engine.eligibleEventIds()).not.toContain('soup-week-two');
    expect(w.engine.eligibleEventIds()).not.toContain('night-shift-report');
    w.state.flags['oddity.soup-week'] = w.now();
    w.state.flags['oddity.pipe-jingle'] = w.now();
    expect(w.engine.eligibleEventIds()).toContain('soup-week-two');
    // The basement's knocking pipes lead to the night shift's tape.
    expect(w.engine.eligibleEventIds()).toContain('night-shift-report');
  });

  it('opens where it is happening, with whoever noticed it, and reopens there after a reload', () => {
    const w = company((s) => {
      s.employees.hazel.room = 'meeting';
      s.employees.nino.room = 'meeting';
    });
    expect(w.engine.queueIncident('the-minutes')).toBe(true);
    const [incident] = w.engine.pendingIncidents();
    expect(incident).toMatchObject({ roomId: 'meeting', employeeId: 'hazel' });
    expect(w.engine.openIncident(incident.id)).toBe(true);
    expect(w.engine.activeEvent?.place).toEqual({ roomId: 'meeting', employeeId: 'hazel' });
    expect(eventCast(w.state, w.engine.activeEvent!.def, w.engine.activeEvent!.place)).toEqual([
      'hazel',
      'nino',
    ]);
    // Filed with its place, so a reload reopens the same card in the same room.
    expect(w.state.eventInProgress).toEqual({
      eventId: 'the-minutes',
      step: null,
      roomId: 'meeting',
      employeeId: 'hazel',
    });
    const loaded = gameStateSchema.parse(migrate(raw(w.state))) as GameState;
    const again = new GameEngine(loaded, { deterministic: true, now: () => w.now() });
    expect(again.activeEvent?.def.id).toBe('the-minutes');
    expect(again.activeEvent?.place).toEqual({ roomId: 'meeting', employeeId: 'hazel' });
  });

  it('keeps the place of a card part-way through, and works it out for an older save', () => {
    const w = company((s) => {
      s.employees.moss.room = 'research';
      s.employees.echo.room = 'research';
      s.flags['oddity.pipe-jingle'] = T0;
    });
    w.engine.triggerEvent('night-shift-report', { roomId: 'research', employeeId: 'moss' });
    expect(w.engine.resolveEventChoice('ask')).toBe(true);
    expect(w.state.eventInProgress).toMatchObject({ step: 'source', roomId: 'research' });
    const old = copy(w.state);
    old.eventInProgress = { eventId: 'night-shift-report', step: 'source' };
    const loaded = gameStateSchema.parse(migrate(raw(old))) as GameState;
    const again = new GameEngine(loaded, { deterministic: true, now: () => w.now() });
    expect(again.activeEvent?.step).toBe('source');
    expect(again.activeEvent?.place?.employeeId).toBe('moss');
  });
});

describe('what a decision sets in motion waits for somebody to see it', () => {
  it('plays a promised moment once, when the office is seen again, not while minimized', () => {
    const w = company((s) => {
      s.employees.quincy.room = 'lab';
      s.employees.nixie.room = 'lab';
    });
    w.engine.triggerEvent('bug-bounty');
    expect(w.engine.resolveEventChoice('contest')).toBe(true);
    w.engine.clearConsequence();
    w.engine.drainOfficeNews();
    w.engine.setAttended(false);
    w.wait(600);
    expect(w.state.scheduled.map((item) => item.sourceEventId)).toContain('bug-bounty');
    expect(w.engine.drainOfficeNews().some((news) => news.kind === 'moment')).toBe(false);
    w.engine.setAttended(true);
    w.wait(1);
    expect(w.state.scheduled.some((item) => item.sourceEventId === 'bug-bounty')).toBe(false);
    const moments = w.engine.drainOfficeNews().filter((news) => news.kind === 'moment');
    expect(moments).toEqual([expect.objectContaining({ momentId: 'lunch-bet', roomId: 'lab' })]);
    // Exactly once.
    w.wait(600);
    expect(w.engine.drainOfficeNews().some((news) => news.kind === 'moment')).toBe(false);
    expect(w.state.happenings.diary.filter((entry) => entry.kind === 'landed')).toHaveLength(1);
  });

  it('bills a delayed cost when its notice can be read, and only once', () => {
    const w = company();
    w.engine.triggerEvent('ledger-discrepancy');
    w.engine.resolveEventChoice('quiet');
    expect(w.engine.resolveEventChoice('refuse')).toBe(true);
    w.engine.clearConsequence();
    const ledger = () =>
      w.state.scheduled.filter((item) => item.sourceEventId === 'ledger-discrepancy');
    // Due after 15 minutes; the window is minimized for longer than that.
    w.engine.setAttended(false);
    w.wait(1_000);
    expect(ledger()).toHaveLength(1);
    expect(w.engine.settledConsequences).toEqual([]);
    // Back in view: billed at once, with its notice.
    const before = w.state.resources.reputation;
    w.engine.setAttended(true);
    w.wait(1);
    expect(ledger()).toEqual([]);
    expect(before - w.state.resources.reputation).toBeGreaterThan(13);
    expect(w.engine.settledConsequences).toHaveLength(1);
    // Never twice.
    const billed = w.state.resources.reputation;
    w.wait(2_000);
    expect(w.engine.settledConsequences).toHaveLength(1);
    expect(w.state.resources.reputation).toBeGreaterThanOrEqual(billed);
  });

  it('keeps a promise through a save, and keeps it once', () => {
    const w = company((s) => {
      s.employees.corvus.room = 'marketing';
      s.employees.rosa.room = 'marketing';
    });
    w.engine.triggerEvent('the-rebrand');
    w.engine.resolveEventChoice('both');
    const loaded = gameStateSchema.parse(migrate(raw(w.state))) as GameState;
    expect(loaded.scheduled).toEqual(w.state.scheduled);
    let clock = w.now();
    const again = new GameEngine(loaded, { deterministic: true, now: () => clock });
    clock += 301_000;
    again.tick(0.1);
    expect(again.state.office.oddities.map((item) => item.id)).toEqual(['neon-pink-sign']);
    clock += 301_000;
    again.tick(0.1);
    expect(again.state.office.oddities.filter((item) => item.id === 'neon-pink-sign')).toHaveLength(
      1,
    );
  });
});

describe('discoveries say where they came from and where they led', () => {
  it('follows every lead somewhere: a curiosity or an incident that only it unlocks', () => {
    for (const def of ODDITIES.filter((oddity) => oddity.lead)) {
      expect(curiosityLeads(createInitialState(T0), def.id).length, def.id).toBeGreaterThan(0);
    }
  });

  it('knows what made a curiosity possible', () => {
    expect(curiosityOrigins(ODDITIES_BY_ID['stapler-return'])).toEqual([
      { kind: 'oddity', def: ODDITIES_BY_ID['missing-stapler'] },
    ]);
    const sign = curiosityOrigins(ODDITIES_BY_ID['neon-pink-sign']);
    expect(sign).toHaveLength(1);
    expect(sign[0]).toMatchObject({
      kind: 'decision',
      event: { id: 'the-rebrand' },
      choice: { id: 'both' },
    });
    expect(curiosityOrigins(ODDITIES_BY_ID['first-acorn'])).toEqual([
      { kind: 'story', employeeId: 'pip' },
    ]);
    expect(curiosityOrigins(ODDITIES_BY_ID['kernel'])).toEqual([
      { kind: 'decoration', decorationId: 'nut-statue' },
    ]);
    expect(curiosityOrigins(ODDITIES_BY_ID['moon-thanks'])).toEqual([{ kind: 'night' }]);
    // Every aftermath of a choice traces back to the decision that leaves it.
    for (const def of ODDITIES.filter((oddity) => oddity.extra)) {
      expect(decisionSetting(def.requires!.flag!), def.id).not.toBeNull();
    }
  });

  it('marks how far a lead has been followed, from a clue to a decision', () => {
    const w = company((s) => {
      s.employees.marlow.room = 'cafeteria';
      s.employees.axel.room = 'conservatory';
    });
    const soup = () => curiosityLeads(w.state, 'soup-week')[0];
    expect(soup()).toMatchObject({ kind: 'event', status: 'open' });
    w.state.flags['oddity.soup-week'] = w.now();
    expect(openLeads(w.state).map((def) => def.id)).toContain('soup-week');
    expect(w.engine.queueIncident('soup-week-two')).toBe(true);
    expect(soup()).toMatchObject({ status: 'happening' });
    const [incident] = w.engine.pendingIncidents();
    w.engine.openIncident(incident.id);
    w.engine.resolveEventChoice('name');
    expect(soup()).toMatchObject({ status: 'decided', choice: { id: 'name' } });
    expect(openLeads(w.state).map((def) => def.id)).not.toContain('soup-week');
  });

  it('points at a blank without naming it, and lets it go once it is found', () => {
    const w = company();
    expect(pointedAt(w.state).has('stapler-return')).toBe(false);
    w.state.flags['oddity.missing-stapler'] = w.now();
    expect(pointedAt(w.state).has('stapler-return')).toBe(true);
    expect(openLeads(w.state).map((def) => def.id)).toEqual(['missing-stapler']);
    w.state.flags['oddity.stapler-return'] = w.now();
    expect(pointedAt(w.state).has('stapler-return')).toBe(false);
    expect(openLeads(w.state)).toEqual([]);
  });

  it('keeps what was noticed, and what it led to, through a save', () => {
    const w = company();
    w.state.flags['oddity.soup-week'] = T0 + 5;
    w.state.flags['oddity.missing-stapler'] = T0 + 6;
    w.engine.queueIncident('soup-week-two');
    const loaded = gameStateSchema.parse(migrate(raw(w.state))) as GameState;
    expect(loaded.flags['oddity.soup-week']).toBe(T0 + 5);
    expect(curiosityLeads(loaded, 'soup-week')).toEqual(curiosityLeads(w.state, 'soup-week'));
    expect(openLeads(loaded).map((def) => def.id)).toEqual(['missing-stapler', 'soup-week']);
    expect([...pointedAt(loaded)]).toEqual(['stapler-return']);
  });

  it('files every secret a decision unlocks under the decision that filed it', () => {
    expect(secretSource('anomaly.hum')?.event.id).toBe('night-shift-report');
    expect(secretSource('anomaly.floorZero')?.event.id).toBe('thirteenth-button');
    expect(secretSource('not-a-secret')).toBeNull();
  });
});
