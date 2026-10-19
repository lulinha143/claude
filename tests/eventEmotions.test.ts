import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { employeeMood, moodProductivityMultiplier } from '../src/sim/mood';
import { migrate } from '../src/save/migrations';
import { SAVE_VERSION } from '../src/sim/config';

function engineWith(now = 1_000_000) {
  const e = new GameEngine(createInitialState(0), { deterministic: true, now: () => now });
  // hire the cast used by the seeded example events
  for (const id of ['bea', 'mina', 'corvus', 'marlow']) {
    e.state.employees[id].hired = true;
    e.state.employees[id].level = 1;
  }
  return e;
}

describe('event-driven individual emotions', () => {
  it('applies a per-employee emotion and the report matches real state', () => {
    const e = engineWith();
    const moraleBefore = e.state.resources.morale;
    e.triggerEvent('bea-wood');
    e.resolveEventChoice('approve'); // morale +4, bea friendship +6, bea → proud (600s)

    // real state changed
    expect(e.state.employees.bea.emotion?.id).toBe('proud');
    expect(employeeMood(e.state, 'bea', 1_000_000)).toBe('proud');
    expect(e.state.resources.morale).toBe(moraleBefore + 4);

    // the WHAT CHANGED report reflects that real change
    const report = e.lastConsequence!.report;
    expect(report.morale).toBe(4);
    const bea = report.employees.find((x) => x.id === 'bea')!;
    expect(bea).toBeTruthy();
    expect(bea.emotion).toBe('proud');
    expect(bea.friendshipDelta).toBe(6);
    expect(bea.productivityDelta).toBeCloseTo(moodProductivityMultiplier('proud') - 1, 6);
    expect(bea.emotionUntil).toBe(1_000_000 + 600_000);
  });

  it('splits a decision across two employees (Mina inspired, Bea worried)', () => {
    const e = engineWith();
    e.triggerEvent('mina-basement');
    e.resolveEventChoice('follow'); // advances chain, no result panel
    e.resolveEventChoice('dig'); // mina → inspired, bea → worried
    expect(e.state.employees.mina.emotion?.id).toBe('inspired');
    expect(e.state.employees.bea.emotion?.id).toBe('worried');
    const report = e.lastConsequence!.report;
    expect(report.employees.find((x) => x.id === 'mina')?.emotion).toBe('inspired');
    expect(report.employees.find((x) => x.id === 'bea')?.emotion).toBe('worried');
    // opposing productivity signs
    expect(report.employees.find((x) => x.id === 'mina')!.productivityDelta).toBeGreaterThan(0);
    expect(report.employees.find((x) => x.id === 'bea')!.productivityDelta).toBeLessThan(0);
  });

  it('temporary emotions override the derived mood, then expire on tick', () => {
    let now = 1_000_000;
    const e = new GameEngine(createInitialState(0), { deterministic: true, now: () => now });
    e.state.employees.bea.hired = true;
    e.state.employees.bea.level = 1;
    e.setEmployeeEmotion('bea', 'angry', 60); // 60s temporary
    expect(employeeMood(e.state, 'bea', now)).toBe('angry');
    // still active just before expiry
    now = 1_000_000 + 59_000;
    e.tick(1);
    expect(e.state.employees.bea.emotion?.id).toBe('angry');
    // expires after the duration passes
    now = 1_000_000 + 61_000;
    e.tick(1);
    expect(e.state.employees.bea.emotion).toBeNull();
    expect(employeeMood(e.state, 'bea', now)).not.toBe('angry');
  });

  it('never applies emotions/friendship/consequences to LOCKED (un-hired) employees', () => {
    const e = new GameEngine(createInitialState(0), { deterministic: true, now: () => 1_000_000 });
    // bea is NOT hired here
    expect(e.state.employees.bea.hired).toBe(false);
    e.triggerEvent('bea-wood');
    e.resolveEventChoice('approve'); // would set bea proud + friendship if she existed
    expect(e.state.employees.bea.emotion ?? null).toBeNull(); // no emotion applied
    expect(e.state.employees.bea.friendship).toBe(0); // no friendship applied
    // and the WHAT CHANGED report contains no entry for the locked employee
    expect(e.lastConsequence!.report.employees.find((x) => x.id === 'bea')).toBeUndefined();
    // a direct call is also ignored for locked employees
    e.setEmployeeEmotion('bea', 'angry');
    expect(e.state.employees.bea.emotion ?? null).toBeNull();
  });

  it('a persistent emotion (no duration) is not expired by ticking', () => {
    let now = 2_000_000;
    const e = new GameEngine(createInitialState(0), { deterministic: true, now: () => now });
    e.state.employees.corvus.hired = true;
    e.setEmployeeEmotion('corvus', 'suspicious'); // permanent
    expect(e.state.employees.corvus.emotion?.until).toBeNull();
    now += 10 * 60_000;
    e.tick(1);
    expect(e.state.employees.corvus.emotion?.id).toBe('suspicious');
  });
});

describe('save migration v4 -> v5 (emotions)', () => {
  it('defaults employee.emotion to null for old saves', () => {
    const raw = {
      version: 4,
      employees: { pip: { hired: true, level: 1, friendship: 20, room: null, x: 0.2 } },
    };
    const migrated = migrate(raw) as {
      version: number;
      employees: Record<string, { emotion: unknown }>;
    };
    // migrate() runs the full chain up to the current save version; the v4->v5
    // step must still default emotion to null regardless of later migrations.
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.employees.pip.emotion).toBeNull();
  });
});
