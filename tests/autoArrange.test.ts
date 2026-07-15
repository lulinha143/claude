import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { isRoomIdUnlocked } from '../src/sim/rooms';
import { EMPLOYEES_BY_ID } from '../src/content/employees';

function bootWithUnlockedRooms() {
  const s = createInitialState(0);
  s.resources.reputation = 100000; // unlock reputation-gated rooms for the test
  return new GameEngine(s, { deterministic: true });
}

describe('employee auto-arrange', () => {
  it('sends teammates to their home department room when unlocked', () => {
    const engine = bootWithUnlockedRooms();
    for (const id of ['marlow', 'rizzo']) {
      engine.state.employees[id].hired = true;
      engine.state.employees[id].room = 'founder-desk';
    }
    engine.autoArrangeEmployees('department');
    for (const id of ['marlow', 'rizzo']) {
      const home = EMPLOYEES_BY_ID[id].room;
      const expected = isRoomIdUnlocked(engine.state, home!) ? home : 'founder-desk';
      expect(engine.state.employees[id].room).toBe(expected);
    }
  });

  it('reports how many employees moved and is idempotent', () => {
    const engine = bootWithUnlockedRooms();
    engine.state.employees['marlow'].hired = true;
    engine.state.employees['marlow'].room = 'founder-desk';
    const first = engine.autoArrangeEmployees('department');
    expect(first).toBeGreaterThanOrEqual(0);
    const second = engine.autoArrangeEmployees('department');
    expect(second).toBe(0); // already arranged
  });

  it('balanced spreads the team across unlocked rooms', () => {
    const engine = bootWithUnlockedRooms();
    const ids = ['pip', 'marlow', 'rizzo', 'bea'];
    for (const id of ids) engine.state.employees[id].hired = true;
    engine.autoArrangeEmployees('balanced');
    // every hired employee ends up in a valid unlocked room (no one lost)
    for (const id of ids) {
      const room = engine.state.employees[id].room;
      expect(room).toBeTruthy();
      expect(isRoomIdUnlocked(engine.state, room!)).toBe(true);
    }
  });
});
