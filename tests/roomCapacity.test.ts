import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import {
  ROOM_CAP,
  bestRoomWithSpace,
  employeesInRoom,
  enforceRoomCapacity,
  resolveEmployeeRoom,
  roomHasSpace,
  unlockedRooms,
} from '../src/sim/rooms';
import { EMPLOYEES } from '../src/content/employees';
import { ROOMS } from '../src/content/rooms';
import type { GameState } from '../src/sim/types';

/** A state with plenty of standing and every teammate on the payroll. */
function fullRoster(): GameState {
  const state = createInitialState();
  state.resources.reputation = 100_000;
  state.resources.nuts = 1e12;
  for (const employee of EMPLOYEES) {
    state.employees[employee.id] = {
      ...state.employees[employee.id],
      hired: true,
      room: null,
    };
  }
  return state;
}

/** Every room that currently holds more teammates than it is allowed to. */
function overfullRooms(state: GameState): string[] {
  return ROOMS.filter((room) => employeesInRoom(state, room.id).length > ROOM_CAP).map((r) => r.id);
}

describe('room capacity', () => {
  it('is four', () => {
    expect(ROOM_CAP).toBe(4);
  });

  // The failure this whole mechanism exists for. Occupancy is DERIVED: a teammate
  // with no assignment resolves to their department, and failing that to the
  // Founder's Desk. So without a normalisation pass an entire roster piles into one
  // room having never made a single assignment — no amount of validation on the
  // click paths would catch it.
  it('never leaves a room over capacity, even with nobody assigned', () => {
    const state = fullRoster();
    expect(overfullRooms(state).length, 'unnormalised state should be broken').toBeGreaterThan(0);
    enforceRoomCapacity(state);
    expect(overfullRooms(state)).toEqual([]);
  });

  it('keeps every hired teammate somewhere real', () => {
    const state = fullRoster();
    enforceRoomCapacity(state);
    const open = new Set(unlockedRooms(state).map((r) => r.id));
    for (const employee of EMPLOYEES) {
      const room = resolveEmployeeRoom(state, employee.id);
      expect(open.has(room), `${employee.id} -> ${room}`).toBe(true);
    }
    // Nobody is duplicated or dropped.
    const seated = ROOMS.reduce((sum, room) => sum + employeesInRoom(state, room.id).length, 0);
    expect(seated).toBe(EMPLOYEES.length);
  });

  it('is idempotent', () => {
    const state = fullRoster();
    enforceRoomCapacity(state);
    const before = Object.fromEntries(EMPLOYEES.map((e) => [e.id, state.employees[e.id].room]));
    expect(enforceRoomCapacity(state)).toEqual([]);
    const after = Object.fromEntries(EMPLOYEES.map((e) => [e.id, state.employees[e.id].room]));
    expect(after).toEqual(before);
  });

  it('does not move teammates the player placed deliberately', () => {
    const state = fullRoster();
    // Four explicit assignments to one room, plus everyone else unassigned.
    const chosen = EMPLOYEES.slice(0, ROOM_CAP).map((e) => e.id);
    for (const id of chosen) state.employees[id].room = 'founder-desk';
    enforceRoomCapacity(state);
    for (const id of chosen) {
      expect(resolveEmployeeRoom(state, id), `${id} kept their desk`).toBe('founder-desk');
    }
    expect(overfullRooms(state)).toEqual([]);
  });

  it('prefers a teammate\u2019s own department when rehoming them', () => {
    const state = createInitialState();
    state.resources.reputation = 100_000;
    const marlow = EMPLOYEES.find((e) => e.id === 'marlow')!;
    state.employees.marlow = { ...state.employees.marlow, hired: true, room: null };
    expect(bestRoomWithSpace(state, 'marlow')).toBe(marlow.room);
  });

  it('reports space honestly', () => {
    const state = fullRoster();
    enforceRoomCapacity(state);
    for (const room of unlockedRooms(state)) {
      const occupied = employeesInRoom(state, room.id).length;
      expect(roomHasSpace(state, room.id), `${room.id} has ${occupied}`).toBe(occupied < ROOM_CAP);
    }
  });
});

describe('assignment paths respect the cap', () => {
  function engineWithRoster(): GameEngine {
    const engine = new GameEngine(fullRoster());
    return engine;
  }

  it('refuses a move into a full room', () => {
    // Exactly five teammates, so the target room can be filled deliberately and the
    // fifth genuinely has nowhere to go in it.
    const state = createInitialState();
    state.resources.reputation = 100_000;
    const roster = EMPLOYEES.slice(0, ROOM_CAP + 1).map((e) => e.id);
    for (const id of roster) {
      state.employees[id] = { ...state.employees[id], hired: true, room: null };
    }
    const engine = new GameEngine(state);
    const room = 'rooftop'; // reputation-gated, so it is open in this state
    const fillers = roster.slice(0, ROOM_CAP);
    for (const id of fillers) {
      expect(engine.assignEmployee(id, room), `${id} -> ${room}`).toBe(true);
    }
    expect(employeesInRoom(engine.state, room).length).toBe(ROOM_CAP);
    // The fifth is told no, rather than being accepted and quietly rehomed.
    expect(engine.assignEmployee(roster[ROOM_CAP], room)).toBe(false);
    expect(employeesInRoom(engine.state, room).length).toBe(ROOM_CAP);
    expect(resolveEmployeeRoom(engine.state, roster[ROOM_CAP])).not.toBe(room);
  });

  it('still allows re-assigning someone already in that room', () => {
    const engine = engineWithRoster();
    const room = resolveEmployeeRoom(engine.state, 'pip');
    expect(engine.assignEmployee('pip', room)).toBe(true);
  });

  it('normalises after an assignment is cleared back to automatic', () => {
    const engine = engineWithRoster();
    for (const employee of EMPLOYEES) engine.assignEmployee(employee.id, null);
    expect(overfullRooms(engine.state)).toEqual([]);
  });

  for (const strategy of ['department', 'balanced'] as const) {
    it(`keeps every room within capacity when auto-arranging (${strategy})`, () => {
      const engine = engineWithRoster();
      engine.autoArrangeEmployees(strategy);
      expect(overfullRooms(engine.state)).toEqual([]);
    });
  }

  it('seats a brand-new hire at a desk that exists', () => {
    const state = createInitialState();
    state.resources.reputation = 100_000;
    state.resources.nuts = 1e12;
    const engine = new GameEngine(state);
    for (const employee of EMPLOYEES) engine.hireOrLevelEmployee(employee.id);
    expect(overfullRooms(engine.state)).toEqual([]);
    for (const employee of EMPLOYEES) {
      if (!engine.state.employees[employee.id].hired) continue;
      expect(resolveEmployeeRoom(engine.state, employee.id)).toBeTruthy();
    }
  });

  // A room opening is the only way the seating can change without the player
  // touching anything, and it has no single call site — reputation just crosses a
  // threshold mid-tick.
  it('re-seats the team when a new room unlocks', () => {
    const state = createInitialState();
    state.resources.nuts = 1e12;
    for (const employee of EMPLOYEES) {
      state.employees[employee.id] = { ...state.employees[employee.id], hired: true, room: null };
    }
    const engine = new GameEngine(state);
    engine.state.resources.reputation = 100_000;
    engine.tick(1);
    expect(overfullRooms(engine.state)).toEqual([]);
  });
});
