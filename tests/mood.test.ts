import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import {
  employeeMood,
  moodProductivityMultiplier,
  teamMoodMultiplier,
  MOOD_PRODUCTIVITY,
} from '../src/sim/mood';
import { moodMultiplier, computeProduction } from '../src/sim/economy';
import type { EmployeeMood } from '../src/sim/types';

const ALL: EmployeeMood[] = ['focused', 'relaxed', 'inspired', 'tired', 'frustrated', 'curious', 'proud'];

describe('mood → productivity (modest, never punishing)', () => {
  it('keeps every emotion within ±5% and never zero', () => {
    for (const m of ALL) {
      const v = moodProductivityMultiplier(m);
      expect(v).toBeGreaterThanOrEqual(0.95);
      expect(v).toBeLessThanOrEqual(1.05);
    }
    expect(MOOD_PRODUCTIVITY.curious).toBe(1); // neutral baseline
    expect(moodProductivityMultiplier('inspired')).toBeGreaterThan(1);
    expect(moodProductivityMultiplier('frustrated')).toBeLessThan(1);
  });

  it('derives sensible moods from morale/friendship/focus', () => {
    const s = createInitialState(0);
    s.employees.marlow.hired = true;
    s.resources.morale = 20;
    expect(employeeMood(s, 'marlow')).toBe('frustrated');
    s.resources.morale = 90;
    s.employees.marlow.friendship = 90;
    expect(employeeMood(s, 'marlow')).toBe('proud');
    s.focus.active = true;
    expect(employeeMood(s, 'marlow')).toBe('focused');
  });

  it('team mood multiplier is 1 with nobody working and reflects the mix otherwise', () => {
    const s = createInitialState(0);
    expect(teamMoodMultiplier(s, () => 1)).toBe(1); // no hired employees
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 3;
    s.resources.morale = 95;
    s.employees.marlow.friendship = 95;
    expect(moodMultiplier(s)).toBeGreaterThan(1); // proud team → small boost
    s.resources.morale = 15;
    expect(moodMultiplier(s)).toBeLessThan(1); // frustrated team → small dip
  });

  it('a happy workforce out-produces a neutral one at the SAME morale', () => {
    // Hold morale in the mid band (>=45, <85) so morale's own multiplier is
    // identical for both cases and ONLY the mood differs: friendship 90 → proud,
    // friendship 0 → curious (neutral).
    const s = createInitialState(0);
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 5;
    s.resources.morale = 75;
    s.employees.marlow.friendship = 90; // proud (morale 75 + friendship 90)
    expect(employeeMood(s, 'marlow')).toBe('proud');
    const proud = computeProduction(s, false).nutsPerSecond;
    s.employees.marlow.friendship = 0; // curious (neutral) at the same morale
    expect(employeeMood(s, 'marlow')).toBe('curious');
    const neutral = computeProduction(s, false).nutsPerSecond;
    expect(proud).toBeGreaterThan(neutral);
  });
});
