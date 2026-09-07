import { EMPLOYEES_BY_ID } from '../content/employees';

// Room specialization: an employee works best in their home department, fine in
// most rooms, and poorly in a few that clash with their role. This turns "where
// do I put everyone" into a real, readable decision (shown in tooltips before a
// move) without being punishing — effects are modest and always explained.

export type AffinityTier = 'favorite' | 'acceptable' | 'disliked';

export const AFFINITY_MULT: Record<AffinityTier, number> = {
  favorite: 1.25, // +25% in their home department
  acceptable: 1.0, // no change
  disliked: 0.85, // -15% in a clashing room
};

// Home department (an employee's `def.room`) → rooms that clash with their work.
const DISLIKES: Record<string, string[]> = {
  research: ['construction', 'basement'],
  lab: ['construction', 'basement'],
  construction: ['lab', 'research', 'nap', 'meeting'],
  morale: ['basement'],
  marketing: ['basement', 'vault'],
  procurement: ['basement'],
  sorting: ['basement', 'nap'],
  meeting: ['sorting', 'construction'],
};

export function roomAffinity(employeeId: string, roomId: string): AffinityTier {
  const def = EMPLOYEES_BY_ID[employeeId];
  if (!def) return 'acceptable';
  if (roomId === def.room) return 'favorite';
  if ((DISLIKES[def.room] ?? []).includes(roomId)) return 'disliked';
  return 'acceptable';
}

/** Production multiplier for an employee working in a given room. */
export function affinityMultiplier(employeeId: string, roomId: string): number {
  return AFFINITY_MULT[roomAffinity(employeeId, roomId)];
}

/** Signed percentage (e.g. +25, 0, -15) for display. */
export function affinityPercent(employeeId: string, roomId: string): number {
  return Math.round((affinityMultiplier(employeeId, roomId) - 1) * 100);
}
