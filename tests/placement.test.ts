import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import {
  resolveEmployeeRoom,
  employeesInRoom,
  repairPlacements,
  DEFAULT_ROOM,
} from '../src/sim/rooms';
import { EMPLOYEES } from '../src/content/employees';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { SAVE_VERSION } from '../src/sim/config';

describe('employee placement (disappearing-character fix)', () => {
  it('a hired employee whose department is locked falls back to the Founder\u2019s Desk', () => {
    const s = createInitialState(0);
    // Marlow's department (morale) unlocks at reputation 5; keep reputation 0.
    s.employees.marlow.hired = true;
    s.resources.reputation = 0;
    expect(resolveEmployeeRoom(s, 'marlow')).toBe('founder-desk');
    // and they are actually listed as occupying the founder desk (visible)
    expect(employeesInRoom(s, 'founder-desk')).toContain('marlow');
  });

  it('resolves to the department once it is unlocked', () => {
    const s = createInitialState(0);
    s.employees.marlow.hired = true;
    s.resources.reputation = 10; // morale room needs 5
    expect(resolveEmployeeRoom(s, 'marlow')).toBe('morale');
  });

  it('every hired employee always resolves to a valid, unlocked room', () => {
    const s = createInitialState(0);
    s.resources.reputation = 0; // nothing but founder-desk unlocked
    for (const def of EMPLOYEES) {
      s.employees[def.id].hired = true;
      const room = resolveEmployeeRoom(s, def.id);
      expect(room).toBeTruthy();
      // founder-desk is always unlocked; the resolver must never return a locked room
      expect(room).toBe('founder-desk');
    }
  });

  it('explicit assignment to an unlocked room persists; locked room is rejected', () => {
    const s = createInitialState(0);
    s.resources.reputation = 100;
    const engine = new GameEngine(s, { deterministic: true });
    expect(engine.assignEmployee('pip', 'morale')).toBe(true); // rep 100 unlocks morale
    expect(resolveEmployeeRoom(engine.state, 'pip')).toBe('morale');
    // basement needs an upgrade, not owned -> locked -> rejected
    expect(engine.assignEmployee('pip', 'basement')).toBe(false);
    expect(resolveEmployeeRoom(engine.state, 'pip')).toBe('morale');
  });

  it('null assignment reverts to the department default', () => {
    const s = createInitialState(0);
    s.resources.reputation = 100;
    const engine = new GameEngine(s, { deterministic: true });
    engine.assignEmployee('pip', 'morale');
    engine.assignEmployee('pip', null);
    expect(resolveEmployeeRoom(engine.state, 'pip')).toBe('founder-desk');
  });

  it('repairPlacements clears assignments pointing at nonexistent rooms', () => {
    const s = createInitialState(0);
    s.employees.pip.room = 'a-room-that-does-not-exist';
    const repaired = repairPlacements(s);
    expect(repaired).toContain('pip');
    expect(s.employees.pip.room).toBeNull();
    expect(resolveEmployeeRoom(s, 'pip')).toBe(DEFAULT_ROOM);
  });

  it('the engine repairs invalid placements on load and on replaceState', () => {
    const s = createInitialState(0);
    s.employees.pip.room = 'nope';
    const engine = new GameEngine(s, { deterministic: true });
    expect(engine.repairedOnLoad).toContain('pip');
    expect(engine.state.employees.pip.room).toBeNull();

    const s2 = createInitialState(0);
    s2.employees.marlow.room = 'also-nope';
    engine.replaceState(s2);
    expect(engine.repairedOnLoad).toContain('marlow');
  });
});

describe('save migration v3 -> v4 (room + eventHistory)', () => {
  it('adds room:null to employees and an empty eventHistory', () => {
    const v3 = {
      version: 3,
      employees: { pip: { hired: true, level: 1, friendship: 20, outfitId: 'pip-classic', nickname: null, x: 0.15 } },
    };
    const migrated = migrate(v3) as Record<string, unknown>;
    expect(migrated.version).toBe(SAVE_VERSION);
    const emps = migrated.employees as Record<string, Record<string, unknown>>;
    expect(emps.pip.room).toBeNull();
    expect(migrated.eventHistory).toEqual([]);
  });

  it('a migrated save parses and keeps the employee', () => {
    const v3 = {
      version: 3,
      resources: { nuts: 100 },
      employees: { pip: { hired: true, level: 2, x: 0.15 } },
    };
    const parsed = gameStateSchema.safeParse(migrate(v3));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.employees.pip.hired).toBe(true);
      expect(parsed.data.employees.pip.room).toBeNull();
    }
  });
});
