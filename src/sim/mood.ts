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
