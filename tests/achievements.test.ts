import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { evaluateAchievements } from '../src/sim/achievements';
import { ACHIEVEMENTS } from '../src/content/achievements';

describe('achievements', () => {
  it('ships at least 40 achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(40);
  });

  it('unlocks on first click and pays golden nuts', () => {
    const s = createInitialState(0);
    s.stats.totalClicks = 1;
    const before = s.resources.goldenNuts;
    const unlocked = evaluateAchievements(s, 1000);
    expect(unlocked).toContain('first-day');
    expect(s.achievements['first-day']).toBe(1000);
    expect(s.resources.goldenNuts).toBeGreaterThan(before);
  });

  it('does not unlock the same achievement twice', () => {
    const s = createInitialState(0);
    s.stats.totalClicks = 1;
    evaluateAchievements(s, 1);
    const golden = s.resources.goldenNuts;
    const again = evaluateAchievements(s, 2);
    expect(again).not.toContain('first-day');
    expect(s.resources.goldenNuts).toBe(golden);
  });

  it('unlocks the exact 69,420 nuts achievement only at that value', () => {
    const s = createInitialState(0);
    s.resources.nuts = 69419;
    expect(evaluateAchievements(s, 1)).not.toContain('nice');
    s.resources.nuts = 69420;
    expect(evaluateAchievements(s, 2)).toContain('nice');
  });

  it('flag-based achievements unlock when the flag is present', () => {
    const s = createInitialState(0);
    s.employees.rizzo.hired = true;
    expect(evaluateAchievements(s, 1)).toContain('raccoon-accounting');
  });
});
