import { DAILY_TEMPLATES } from '../content/dailyChallenges';
import { createRng, hashStringToSeed } from './rng';
import type { DailyChallengeProgress, DailyState } from './types';

// Deterministic, offline, server-free daily challenges. The set of challenges
// for a given local date is derived purely from that date string, so it is
// identical on every machine and reproducible in tests. We tolerate timezone
// shifts by keying on local date; large negative clock jumps are handled by
// the save layer.

export function localDateString(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateDailyChallenges(dateStr: string): DailyChallengeProgress[] {
  const rng = createRng(hashStringToSeed(dateStr));
  // pick 3 distinct templates for the day
  const pool = [...DAILY_TEMPLATES];
  const chosen: typeof DAILY_TEMPLATES = [];
  while (chosen.length < 3 && pool.length > 0) {
    const i = rng.int(0, pool.length);
    chosen.push(pool.splice(i, 1)[0]);
  }
  return chosen.map((t) => {
    // scale goal by a small deterministic factor for variety
    const factor = 0.75 + rng.next() * 0.75;
    return {
      id: t.id,
      goal: Math.max(1, Math.round(t.baseGoal * factor)),
      progress: 0,
      claimed: false,
    };
  });
}

export function ensureDailyForDate(current: DailyState | undefined, now: number): DailyState {
  const date = localDateString(now);
  if (current && current.date === date) return current;
  return { date, challenges: generateDailyChallenges(date) };
}
