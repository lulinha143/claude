import { describe, expect, it } from 'vitest';

import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { canPrestige, performPrestige } from '../src/sim/prestige';
import { shiftTimeline } from '../src/sim/timeline';
import { isRoomIdUnlocked } from '../src/sim/rooms';
import { EVENT_HISTORY_SIZE } from '../src/sim/config';
import { ROOMS } from '../src/content/rooms';
import { GAME_EVENTS_BY_ID } from '../src/content/events';
import { HAPPENINGS, WORLD_MOMENTS_BY_ID } from '../src/content/happenings';
import {
  OBSERVATION_LIMIT,
  dayKey,
  decisionBy,
  groupByDay,
  hasObservations,
  observationReport,
  type ObservationRow,
} from '../src/sim/observation';
import type { DiaryEntry, EventHistoryEntry, GameState } from '../src/sim/types';

/**
 * The observation report tells what happened in the office from what the game
 * already records: the company's decisions (now saying who took them, and where)
 * and the office diary. Each thing that happened is one row, nobody's decision is
 * claimed for someone else, and nothing unseen is named.
 */

const T0 = Date.UTC(2026, 9, 21, 12, 0, 0);

/** A company with every room open and nobody on the payroll but the founder. */
function office(mutate?: (s: GameState) => void) {
  let clock = T0;
  const state = createInitialState(T0);
  state.resources.reputation = 5_000;
  state.resources.nuts = 5_000_000;
  state.resources.morale = 60;
  for (const room of ROOMS) if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  state.stats.playTimeSeconds = 10_000;
  mutate?.(state);
  const engine = new GameEngine(state, { deterministic: true, seed: 1, now: () => clock });
  return {
    engine,
    get state() {
      return engine.state;
    },
    now: () => clock,
    /** Time passes, with the office in sight, without it rolling for anything new. */
    wait(seconds: number) {
      clock += seconds * 1000;
      engine.tick(0.1);
    },
  };
}

type World = ReturnType<typeof office>;

function staff(s: GameState, roomId: string, ids: string[]) {
  for (const id of ids) {
    s.employees[id] = { ...s.employees[id], hired: true, level: 3, friendship: 30, room: roomId };
  }
}

/** Look into whatever is waiting for `eventId` (or bring it up) and take `choices`. */
function decide(w: World, eventId: string, ...choices: string[]) {
  const incident = w.engine.pendingIncidents().find((item) => item.eventId === eventId);
  if (incident) expect(w.engine.openIncident(incident.id)).toBe(true);
  else expect(w.engine.triggerEvent(eventId)).toBe(true);
  for (const choice of choices) expect(w.engine.resolveEventChoice(choice)).toBe(true);
  w.engine.clearConsequence();
}

/** A bare save (only the founder's desk open) with these records. */
function saved(history: EventHistoryEntry[], diary: DiaryEntry[] = []): GameState {
  const state = createInitialState(T0);
  state.eventHistory = history;
  state.happenings.diary = diary;
  return state;
}

const decisions = (rows: ObservationRow[]) =>
  rows.map((row) => (row.kind === 'decision' ? [row.by, ...row.choiceIds] : [row.kind]));

describe('who decided is recorded when it is decided', () => {
  it('records the player’s own call as theirs, in the room the card was set in', () => {
    const w = office((s) => staff(s, 'lab', ['axel']));
    expect(w.engine.queueIncident('centrifuge-wont-stop')).toBe(true);
    decide(w, 'centrifuge-wont-stop', 'unplug');
    expect(w.state.eventHistory).toEqual([
      {
        eventId: 'centrifuge-wont-stop',
        choiceId: 'unplug',
        at: w.now(),
        by: 'player',
        roomId: 'lab',
      },
    ]);
    expect(observationReport(w.state)).toEqual({
      waiting: [],
      rows: [
        {
          kind: 'decision',
          key: expect.any(String),
          at: w.now(),
          roomId: 'lab',
          target: 'lab',
          eventId: 'centrifuge-wont-stop',
          choiceIds: ['unplug'],
          by: 'player',
        },
      ],
    });
  });

  it('records an incident nobody looked into in time as the team’s call, and tells it once', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    expect(w.engine.queueIncident('the-minutes')).toBe(true);
    w.wait(HAPPENINGS.lingerSeconds.common + 1);
    expect(w.engine.pendingIncidents()).toEqual([]);
    const entry = w.state.eventHistory.at(-1)!;
    expect(entry).toMatchObject({ eventId: 'the-minutes', by: 'team', roomId: 'meeting' });
    // The diary saw it start and saw the team handle it; the report tells it once,
    // by what became of it.
    const told = ['incident', 'opened', 'handled', 'faded'];
    expect(
      w.state.happenings.diary.map((item) => item.kind).filter((kind) => told.includes(kind)),
    ).toEqual(['incident', 'handled']);
    const { rows, waiting } = observationReport(w.state);
    expect(waiting).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'decision',
      eventId: 'the-minutes',
      choiceIds: [entry.choiceId],
      by: 'team',
      roomId: 'meeting',
      target: 'meeting',
    });
    // The outcome told is the one that happened: its mark is set, the others' are not.
    const marks: Record<string, string> = {
      wake: 'minutes.woke',
      sign: 'minutes.forged',
      laminate: 'minutes.laminated',
    };
    for (const [choiceId, flag] of Object.entries(marks)) {
      expect(flag in w.state.flags, flag).toBe(choiceId === entry.choiceId);
    }
    // ...and it is what the team's notice said at the time.
    const def = GAME_EVENTS_BY_ID['the-minutes'];
    expect(w.engine.lastAutoResolved?.choiceLabelKey).toBe(
      def.choices.find((choice) => choice.id === entry.choiceId)?.labelKey,
    );
  });

  it('records “decide for me” as the team’s call too, though no incident ever waited', () => {
    const w = office((s) => {
      staff(s, 'lab', ['quincy']);
      staff(s, 'procurement', ['nixie']);
      s.settings.autoResolveEvents = true;
    });
    expect(w.engine.queueIncident('bug-bounty')).toBe(true);
    const entries = w.state.eventHistory.filter((entry) => entry.eventId === 'bug-bounty');
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.by).toBe('team');
      expect(ROOMS.some((room) => room.id === entry.roomId)).toBe(true);
    }
    expect(w.state.happenings.diary.some((item) => item.kind === 'handled')).toBe(false);
    const { rows } = observationReport(w.state);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'decision', eventId: 'bug-bounty', by: 'team' });
  });

  it('hands the next decision back to the player as soon as the team is done', () => {
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'lab', ['axel']);
    });
    w.engine.queueIncident('the-minutes');
    w.wait(HAPPENINGS.lingerSeconds.common + 1);
    decide(w, 'centrifuge-wont-stop', 'spin');
    expect(w.state.eventHistory.map((entry) => [entry.eventId, entry.by])).toEqual([
      ['the-minutes', 'team'],
      ['centrifuge-wont-stop', 'player'],
    ]);
  });

  it('keeps conversations the player’s, and out of the office’s report', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel']));
    expect(w.engine.openTalk('hazel', undefined, true)).toBe(true);
    const talk = w.engine.activeTalk!;
    const node = talk.topic.nodes[talk.nodeId];
    expect(
      node.choices.some((choice) => w.engine.chooseTalkOption(choice.id, talk.instanceId)),
    ).toBe(true);
    w.engine.closeTalk();
    const entry = w.state.eventHistory.at(-1)!;
    expect(entry.eventId.startsWith('talk:')).toBe(true);
    expect(entry.by).toBe('player');
    expect(decisionBy(entry)).toBe('player');
    // Only the player ever holds a conversation, in an old save too.
    expect(decisionBy({ eventId: entry.eventId, choiceId: entry.choiceId, at: entry.at })).toBe(
      'player',
    );
    expect(observationReport(w.state).rows.filter((row) => row.kind === 'decision')).toEqual([]);
  });
});

describe('each thing that happened is one row', () => {
  it('joins the steps of one card into one row, and never two separate occurrences', () => {
    const w = office((s) => {
      staff(s, 'research', ['moss']);
      staff(s, 'broadcast', ['echo']);
    });
    expect(w.engine.queueIncident('night-shift-report')).toBe(true);
    const [incident] = w.engine.pendingIncidents();
    decide(w, 'night-shift-report', 'ask', 'leave');
    expect(w.state.eventHistory.map((entry) => entry.choiceId)).toEqual(['ask', 'leave']);
    const { rows } = observationReport(w.state);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'decision',
      eventId: 'night-shift-report',
      choiceIds: ['ask', 'leave'],
      by: 'player',
      roomId: incident.roomId,
      at: w.now(),
    });

    // The same card twice is two rows.
    const m = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    decide(m, 'the-minutes', 'wake');
    m.wait(60);
    decide(m, 'the-minutes', 'laminate');
    expect(decisions(observationReport(m.state).rows)).toEqual([
      ['player', 'laminate'],
      ['player', 'wake'],
    ]);
  });

  it('joins only what the card’s own steps join: a chain left halfway, another hand', () => {
    const at = (s: number) => T0 + s * 1000;
    const night = (choiceId: string, s: number, by: 'player' | 'team' = 'player') => ({
      eventId: 'night-shift-report',
      choiceId,
      at: at(s),
      by,
      roomId: 'research',
    });
    const state = saved([
      night('ask', 1), // left halfway (a restructure, a lost card)
      night('ask', 2),
      night('leave', 3),
      night('ask', 4),
      night('leave', 5, 'team'), // the team finished what the player started
      night('play', 6),
    ]);
    expect(decisions(observationReport(state).rows)).toEqual([
      ['player', 'play'],
      ['team', 'leave'],
      ['player', 'ask'],
      ['player', 'ask', 'leave'],
      ['player', 'ask'],
    ]);
  });

  it('tells the newest first, and keeps a bounded file however long the company runs', () => {
    const w = office((s) => staff(s, 'lab', ['axel']));
    for (let i = 0; i < EVENT_HISTORY_SIZE + 6; i += 1) {
      decide(w, 'centrifuge-wont-stop', 'unplug');
      w.wait(5);
    }
    expect(w.state.eventHistory).toHaveLength(EVENT_HISTORY_SIZE);
    const { rows } = observationReport(w.state);
    expect(rows).toHaveLength(OBSERVATION_LIMIT);
    expect(rows[0].at).toBe(w.state.eventHistory.at(-1)!.at);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i - 1].at).toBeGreaterThan(rows[i].at);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    // The diary it reads is bounded too.
    for (let i = 0; i < HAPPENINGS.diarySize + 5; i += 1) {
      w.engine.playMoment(WORLD_MOMENTS_BY_ID['load-bearing-stapler']);
    }
    expect(w.state.happenings.diary).toHaveLength(HAPPENINGS.diarySize);
    expect(observationReport(w.state).rows).toHaveLength(OBSERVATION_LIMIT);
  });

  it('puts what a choice set off above the choice when both happen at once', () => {
    const state = saved(
      [{ eventId: 'the-minutes', choiceId: 'laminate', at: T0, by: 'player', roomId: 'meeting' }],
      [{ at: T0, kind: 'moment', momentId: 'nap-on-the-agenda', roomId: 'meeting' }],
    );
    expect(observationReport(state).rows.map((row) => row.kind)).toEqual(['moment', 'decision']);
  });

  it('groups the rows by day: today, yesterday, then the date', () => {
    const local = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).getTime();
    const row = (at: number): ObservationRow => ({
      kind: 'passed',
      key: `p:${at}`,
      at,
      roomId: null,
      target: null,
    });
    const days = groupByDay(
      [row(local(21, 14)), row(local(21, 9)), row(local(20, 23)), row(local(18, 8))],
      local(21, 15),
    );
    expect(days.map((day) => [day.key, day.when, day.rows.length])).toEqual([
      ['2026-10-21', 'today', 2],
      ['2026-10-20', 'yesterday', 1],
      ['2026-10-18', null, 1],
    ]);
    // Across the end of a month.
    expect(
      groupByDay([row(new Date(2026, 9, 31, 22).getTime())], new Date(2026, 10, 1, 8).getTime())[0]
        .when,
    ).toBe('yesterday');
    expect(dayKey(new Date(2027, 0, 5, 0, 30).getTime())).toBe('2027-01-05');
  });
});

describe('what nobody saw stays unnamed', () => {
  it('tells a rare incident that passed unseen without its name or what it hid', () => {
    const w = office((s) => {
      staff(s, 'research', ['moss']);
      staff(s, 'broadcast', ['echo']);
    });
    expect(w.engine.queueIncident('night-shift-report')).toBe(true);
    const [incident] = w.engine.pendingIncidents();
    // While it waits, the office already shows it (its marker has the title).
    expect(observationReport(w.state).waiting).toHaveLength(1);
    w.wait(HAPPENINGS.lingerSeconds.rare + 1);
    expect(w.state.happenings.diary.at(-1)).toMatchObject({
      kind: 'faded',
      eventId: 'night-shift-report',
    });
    const report = observationReport(w.state);
    expect(report).toEqual({
      waiting: [],
      rows: [
        {
          kind: 'passed',
          key: expect.any(String),
          at: w.now(),
          roomId: incident.roomId,
          target: incident.roomId,
        },
      ],
    });
    // Nothing in the report names it, or what choosing would have found.
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('night-shift-report');
    expect(serialized).not.toContain('nightShift');
    expect(serialized).not.toContain('anomaly');
  });

  it('tells rare and legendary alike, and nothing at all about the unknown or the ordinary', () => {
    const state = saved(
      [],
      [
        { at: T0 + 1, kind: 'faded', eventId: 'thirteenth-button', roomId: 'founder-desk' },
        { at: T0 + 2, kind: 'faded', eventId: 'night-shift-report', roomId: 'research' },
        { at: T0 + 3, kind: 'faded', eventId: 'gone-from-the-game', roomId: 'lab' },
        { at: T0 + 4, kind: 'faded', eventId: 'the-minutes', roomId: 'meeting' },
        { at: T0 + 5, kind: 'faded', roomId: 'lab' },
      ],
    );
    const { rows } = observationReport(state);
    expect(rows.map((row) => [row.kind, row.roomId, row.target])).toEqual([
      ['passed', 'research', null], // the research floor is not open in this save
      ['passed', 'founder-desk', 'founder-desk'],
    ]);
    expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(rows[1]).sort());
  });

  it('carries only what each row says: never a reward, an effect or a secret', () => {
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'research', ['moss']);
      staff(s, 'broadcast', ['echo']);
      staff(s, 'lab', ['axel']);
    });
    w.engine.queueIncident('night-shift-report');
    w.wait(HAPPENINGS.lingerSeconds.rare + 1);
    decide(w, 'centrifuge-wont-stop', 'talk');
    w.engine.playMoment(WORLD_MOMENTS_BY_ID['nap-on-the-agenda']);
    w.engine.queueIncident('the-minutes');
    const report = observationReport(w.state);
    const shapes = new Map<string, string>();
    for (const row of [...report.waiting, ...report.rows]) {
      shapes.set(row.kind, Object.keys(row).sort().join(','));
    }
    expect(Object.fromEntries(shapes)).toEqual({
      waiting: 'at,employeeId,eventId,key,kind,roomId,target',
      decision: 'at,by,choiceIds,eventId,key,kind,roomId,target',
      passed: 'at,key,kind,roomId,target',
      moment: 'at,key,kind,momentId,roomId,target',
    });
  });

  it('makes no row of the diary’s bookkeeping: starts, looks, hand-offs, arrivals, remarks', () => {
    const state = saved(
      [],
      [
        { at: T0 + 1, kind: 'incident', eventId: 'the-minutes', roomId: 'meeting' },
        { at: T0 + 2, kind: 'opened', eventId: 'the-minutes', roomId: 'meeting' },
        { at: T0 + 3, kind: 'handled', eventId: 'the-minutes', roomId: 'meeting' },
        { at: T0 + 4, kind: 'landed', eventId: 'the-minutes', roomId: 'meeting' },
        { at: T0 + 5, kind: 'remark', employeeId: 'hazel' },
        { at: T0 + 6, kind: 'moment', momentId: 'not-a-moment', roomId: 'meeting' },
      ],
    );
    expect(observationReport(state)).toEqual({ waiting: [], rows: [] });
    expect(hasObservations(state)).toBe(false);
  });
});

describe('where each row leads', () => {
  it('leads to the room it happened in, while that room is open', () => {
    const decision = (choiceId: string, s: number, roomId?: string): EventHistoryEntry => ({
      eventId: 'the-minutes',
      choiceId,
      at: T0 + s * 1000,
      by: 'team',
      ...(roomId ? { roomId } : {}),
    });
    const state = saved([
      decision('wake', 1, 'founder-desk'),
      decision('sign', 2, 'lab'),
      decision('laminate', 3, 'the-moon'),
      decision('wake', 4),
    ]);
    expect(isRoomIdUnlocked(state, 'lab')).toBe(false);
    const where = (s: GameState) =>
      observationReport(s).rows.map((row) => [row.roomId, row.target]);
    expect(where(state)).toEqual([
      [null, null], // not recorded
      [null, null], // not a room this game knows
      ['lab', null], // recorded, but closed now
      ['founder-desk', 'founder-desk'],
    ]);
    // Read from the save as it is: once the lab opens, its row leads there.
    state.upgrades[ROOMS.find((room) => room.id === 'lab')!.unlock.upgradeId!] = 1;
    state.resources.reputation = 5_000;
    expect(isRoomIdUnlocked(state, 'lab')).toBe(true);
    expect(where(state)[2]).toEqual(['lab', 'lab']);
  });

  it('shows what is waiting right now, with whoever noticed it, until someone looks', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    expect(hasObservations(w.state)).toBe(false);
    w.engine.queueIncident('the-minutes');
    expect(observationReport(w.state)).toEqual({
      waiting: [
        {
          kind: 'waiting',
          key: expect.any(String),
          at: w.now(),
          eventId: 'the-minutes',
          roomId: 'meeting',
          employeeId: 'hazel',
          target: 'meeting',
        },
      ],
      rows: [],
    });
    expect(hasObservations(w.state)).toBe(true);
    // Someone no longer on the payroll is not said to be waiting.
    w.state.employees.hazel.hired = false;
    expect(observationReport(w.state).waiting[0].employeeId).toBeNull();
    w.state.employees.hazel.hired = true;
    w.wait(30);
    decide(w, 'the-minutes', 'wake');
    const report = observationReport(w.state);
    expect(report.waiting).toEqual([]);
    expect(decisions(report.rows)).toEqual([['player', 'wake']]);
  });
});

describe('old saves, the save itself, and a fresh start', () => {
  it('reads an older save’s decisions without claiming who took them, or where', () => {
    const old = JSON.parse(JSON.stringify(createInitialState(T0))) as Record<string, unknown>;
    old.version = 12;
    const history = [
      { eventId: 'the-minutes', choiceId: 'wake', at: T0 - 5000 },
      { eventId: 'talk:check-in', choiceId: 'fine', at: T0 - 4000 },
      { eventId: 'an-event-since-retired', choiceId: 'x', at: T0 - 3000 },
    ];
    old.eventHistory = history;
    const loaded = gameStateSchema.parse(migrate(old)) as GameState;
    expect(loaded.eventHistory).toEqual(history);
    expect(loaded.eventHistory.map(decisionBy)).toEqual([null, 'player', null]);
    expect(observationReport(loaded).rows).toEqual([
      {
        kind: 'decision',
        key: expect.any(String),
        at: T0 - 5000,
        roomId: null,
        target: null,
        eventId: 'the-minutes',
        choiceIds: ['wake'],
        by: null,
      },
    ]);
  });

  it('keeps every good decision when one record, or one field of it, is damaged', () => {
    const raw = JSON.parse(JSON.stringify(createInitialState(T0))) as Record<string, unknown>;
    raw.eventHistory = [
      { eventId: 'the-minutes', choiceId: 'wake', at: T0, by: 'team', roomId: 'meeting' },
      { eventId: 'the-minutes', choiceId: 'sign' },
      { eventId: 7, choiceId: 'x', at: T0 },
      'a coffee ring',
      { eventId: 'bug-bounty', choiceId: 'pay', at: T0 + 1, by: 'the boss', roomId: 42 },
      { eventId: 'bug-bounty', choiceId: 'pay', at: T0 + 2, by: 'player', roomId: 'x'.repeat(200) },
    ];
    const parsed = gameStateSchema.parse(migrate(raw)) as GameState;
    expect(parsed.eventHistory).toEqual([
      { eventId: 'the-minutes', choiceId: 'wake', at: T0, by: 'team', roomId: 'meeting' },
      { eventId: 'bug-bounty', choiceId: 'pay', at: T0 + 1 },
      { eventId: 'bug-bounty', choiceId: 'pay', at: T0 + 2, by: 'player' },
    ]);
    // Not a list at all: an empty history, not a rejected save.
    raw.eventHistory = 'lost';
    expect((gameStateSchema.parse(migrate(raw)) as GameState).eventHistory).toEqual([]);
    // As long as the engine's: the newest are kept.
    raw.eventHistory = Array.from({ length: EVENT_HISTORY_SIZE + 10 }, (_, i) => ({
      eventId: 'the-minutes',
      choiceId: 'wake',
      at: T0 + i,
    }));
    const long = (gameStateSchema.parse(migrate(raw)) as GameState).eventHistory;
    expect(long).toHaveLength(EVENT_HISTORY_SIZE);
    expect(long[0].at).toBe(T0 + 10);
  });

  it('keeps who decided and where through a save, and goes on recording after it', () => {
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'lab', ['axel']);
      staff(s, 'research', ['moss']);
      staff(s, 'broadcast', ['echo']);
    });
    w.engine.queueIncident('the-minutes');
    w.wait(HAPPENINGS.lingerSeconds.common + 1);
    decide(w, 'centrifuge-wont-stop', 'unplug');
    w.engine.playMoment(WORLD_MOMENTS_BY_ID['nap-on-the-agenda']);
    // A card left on its second page when the game closes...
    w.engine.queueIncident('night-shift-report');
    const [incident] = w.engine.pendingIncidents();
    expect(w.engine.openIncident(incident.id)).toBe(true);
    expect(w.engine.resolveEventChoice('ask')).toBe(true);
    const raw = JSON.parse(JSON.stringify(w.state));
    const loaded = gameStateSchema.parse(migrate(raw)) as GameState;
    expect(loaded.eventHistory).toEqual(w.state.eventHistory);
    expect(observationReport(loaded)).toEqual(observationReport(w.state));
    // ...reopens in its room, and its last step is still the same row.
    let clock = w.now();
    const again = new GameEngine(loaded, { deterministic: true, now: () => clock });
    expect(again.activeEvent?.step).toBe('source');
    clock += 2000;
    expect(again.resolveEventChoice('leave')).toBe(true);
    expect(again.state.eventHistory.at(-1)).toMatchObject({
      choiceId: 'leave',
      by: 'player',
      roomId: incident.roomId,
    });
    const rows = observationReport(again.state).rows;
    expect(decisions(rows)).toEqual([
      ['player', 'ask', 'leave'],
      ['moment'],
      ['player', 'unplug'],
      ['team', expect.any(String)],
    ]);
  });

  it('follows the clock when it is corrected, keeping the order', () => {
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'lab', ['axel']);
    });
    decide(w, 'centrifuge-wont-stop', 'unplug');
    w.wait(10);
    w.engine.playMoment(WORLD_MOMENTS_BY_ID['nap-on-the-agenda']);
    const before = observationReport(w.state).rows;
    shiftTimeline(w.state, -3_600_000);
    const after = observationReport(w.state).rows;
    expect(after.map((row) => row.kind)).toEqual(before.map((row) => row.kind));
    expect(after.map((row) => row.at)).toEqual(before.map((row) => row.at - 3_600_000));
  });

  it('starts over with a restructure, like the history and the diary it reads', () => {
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'lab', ['axel']);
    });
    w.engine.queueIncident('the-minutes');
    w.wait(HAPPENINGS.lingerSeconds.common + 1);
    w.engine.playMoment(WORLD_MOMENTS_BY_ID['nap-on-the-agenda']);
    w.engine.queueIncident('centrifuge-wont-stop');
    expect(hasObservations(w.state)).toBe(true);
    w.state.stats.totalNutsEarned = 1e15;
    expect(canPrestige(w.state)).toBe(true);
    const after = performPrestige(w.state, 'cooperative', w.now() + 1000);
    expect(observationReport(after)).toEqual({ waiting: [], rows: [] });
    expect(hasObservations(after)).toBe(false);
  });
});
