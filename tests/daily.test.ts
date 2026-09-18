import { describe, it, expect } from 'vitest';
import {
  generateDailyChallenges,
  ensureDailyForDate,
  localDateString,
} from '../src/sim/dailyChallenges';

describe('daily challenges (deterministic, offline)', () => {
  it('is identical for the same date', () => {
    const a = generateDailyChallenges('2026-07-14');
    const b = generateDailyChallenges('2026-07-14');
    expect(a).toEqual(b);
  });

  it('differs across dates', () => {
    const a = generateDailyChallenges('2026-07-14');
    const b = generateDailyChallenges('2026-07-15');
    // at least one field differs (ids or goals)
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('always produces exactly 3 challenges', () => {
    expect(generateDailyChallenges('2026-01-01')).toHaveLength(3);
    expect(generateDailyChallenges('2030-12-31')).toHaveLength(3);
  });

  it('regenerates when the local date changes', () => {
    const day1 = ensureDailyForDate(undefined, new Date('2026-07-14T10:00:00').getTime());
    const same = ensureDailyForDate(day1, new Date('2026-07-14T22:00:00').getTime());
    expect(same).toBe(day1); // unchanged reference
    const day2 = ensureDailyForDate(day1, new Date('2026-07-15T01:00:00').getTime());
    expect(day2).not.toBe(day1);
    expect(day2.date).not.toBe(day1.date);
  });

  it('local date string is stable format', () => {
    const s = localDateString(new Date('2026-07-04T12:00:00').getTime());
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
