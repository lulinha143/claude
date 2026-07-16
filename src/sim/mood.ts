import type { EmployeeMood, GameState } from './types';

// Lightweight, derived employee mood — NOT persisted, purely for personality and
// small flavour. It reads company morale, the employee's friendship, and whether
// production is flowing, then picks a mood deterministically. No micromanagement:
// mood only tints dialogue and shows a small face indicator.
export function employeeMood(state: GameState, id: string): EmployeeMood {
  const rt = state.employees[id];
  const morale = state.resources.morale;
  const friendship = rt?.friendship ?? 0;
  const focus = state.focus.active;

  if (focus) return 'focused';
  if (morale < 30) return 'frustrated';
  if (morale < 45) return 'tired';
  if (friendship >= 70 && morale >= 70) return 'proud';
  if (morale >= 85) return 'inspired';
  if (friendship >= 40) return 'relaxed';
  return 'curious';
}

// Emotions gently colour how well someone works. Effects are deliberately SMALL
// (within ±5%) so mood is a warm character/strategy layer, never a punishing
// micromanagement system (brief §16/§18). A positive mood is a nudge up, a
// low mood a nudge down; "curious" is the neutral baseline.
export const MOOD_PRODUCTIVITY: Record<EmployeeMood, number> = {
  inspired: 1.05,
  focused: 1.05,
  proud: 1.04,
  relaxed: 1.02,
  curious: 1.0,
  tired: 0.97,
  frustrated: 0.95,
};

export function moodProductivityMultiplier(mood: EmployeeMood): number {
  return MOOD_PRODUCTIVITY[mood] ?? 1;
}

/**
 * The team's overall mood effect on production: the production-weighted average
 * of each hired employee's mood multiplier, so a happy workforce produces a
 * little more and a struggling one a little less. Returns 1 when nobody is
 * working (so it never divides by zero). Pure + unit-tested.
 */
export function teamMoodMultiplier(state: GameState, employeeWeight: (id: string) => number): number {
  let weighted = 0;
  let total = 0;
  for (const [id, rt] of Object.entries(state.employees)) {
    if (!rt || !rt.hired || rt.level <= 0) continue;
    const w = Math.max(0, employeeWeight(id));
    if (w <= 0) continue;
    weighted += w * moodProductivityMultiplier(employeeMood(state, id));
    total += w;
  }
  return total > 0 ? weighted / total : 1;
}

/** A short emoji-free glyph character used as a tiny mood indicator dot colour. */
export const MOOD_TONE: Record<EmployeeMood, string> = {
  focused: '#6fa8dc',
  relaxed: '#5a9a68',
  inspired: '#e0a43b',
  tired: '#9a8f80',
  frustrated: '#c65b3c',
  curious: '#b98ad0',
  proud: '#ffd54a',
};
