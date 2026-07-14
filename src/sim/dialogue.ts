import { DIALOGUE_COUNTS } from '../content/dialogue';
import type { Rng } from './rng';

// Weighted-ish selection with recency avoidance so lines don't obviously
// repeat. State is kept per-category in memory (not persisted); the returned
// value is an index into the locale array `dialogue.<category>`.
const recent: Record<string, number[]> = {};
const RECENT_WINDOW = 4;

export function pickDialogueIndex(category: string, rng: Rng): number {
  const count = DIALOGUE_COUNTS[category] ?? 0;
  if (count <= 0) return -1;
  const used = recent[category] ?? [];
  let index = rng.int(0, count);
  let attempts = 0;
  while (used.includes(index) && attempts < 6 && count > RECENT_WINDOW) {
    index = rng.int(0, count);
    attempts += 1;
  }
  used.push(index);
  while (used.length > Math.min(RECENT_WINDOW, count - 1)) used.shift();
  recent[category] = used;
  return index;
}

export function dialogueKey(category: string, index: number): string {
  return `dialogue.${category}.${index}`;
}
