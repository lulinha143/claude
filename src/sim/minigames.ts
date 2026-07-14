import { createRng, hashStringToSeed, type Rng } from './rng';

// Pure, deterministic logic for the three micro-games. The React components own
// timing/DOM; this module owns the rules so they can be unit-tested and are
// reproducible from a seed (used by tests and the dev deterministic mode).

export type MicroMode = 'shellSort' | 'coffeeRescue' | 'inventory';

// --- Shell Sort -----------------------------------------------------------
// Items are either a good nut or a broken shell; the player sorts each into the
// correct labelled bin. Categories are distinguished by icon + label + pattern,
// never colour alone.
export type ShellKind = 'goodNut' | 'brokenShell';

export interface ShellItem {
  id: number;
  kind: ShellKind;
}

export function shellSequence(seedStr: string, count: number): ShellItem[] {
  const rng = createRng(hashStringToSeed(`shell:${seedStr}`));
  const out: ShellItem[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ id: i, kind: rng.chance(0.55) ? 'goodNut' : 'brokenShell' });
  }
  return out;
}

export function shellBinFor(kind: ShellKind): 'good' | 'shell' {
  return kind === 'goodNut' ? 'good' : 'shell';
}

/** score for a placement: correct scales with combo, wrong is gently neutral. */
export function shellScoreDelta(correct: boolean, combo: number): number {
  if (!correct) return 0;
  return 2 + Math.floor(combo / 3);
}

// --- Coffee Rescue --------------------------------------------------------
// Drops fall; the mug catches them. Difficulty ramps gently with elapsed time.
export function coffeeFallDuration(elapsedSeconds: number): number {
  // seconds for a drop to fall top->bottom; starts slow, floors at 1.6s
  return Math.max(1.6, 3.2 - elapsedSeconds * 0.05);
}

export function coffeeSpawnInterval(elapsedSeconds: number): number {
  return Math.max(700, 1300 - elapsedSeconds * 20); // ms between drops
}

// --- Raccoon Inventory Check ----------------------------------------------
// A shelf of items is shown, then one is swapped; the player identifies which
// slot changed. Fully deterministic from a seed.
export const INVENTORY_ITEMS = [
  'stapler',
  'mug',
  'clip',
  'nut',
  'floppy',
  'plant',
  'lamp',
  'phone',
  'key',
  'battery',
] as const;
export type InventoryItem = (typeof INVENTORY_ITEMS)[number];

export interface InventoryRound {
  items: InventoryItem[];
  changedIndex: number;
  before: InventoryItem;
  after: InventoryItem;
}

export function inventoryRound(seedStr: string, size = 5): InventoryRound {
  const rng: Rng = createRng(hashStringToSeed(`inv:${seedStr}`));
  const pool = [...INVENTORY_ITEMS];
  // draw `size` distinct items
  const items: InventoryItem[] = [];
  while (items.length < size && pool.length > 0) {
    items.push(pool.splice(rng.int(0, pool.length), 1)[0]);
  }
  const changedIndex = rng.int(0, items.length);
  const before = items[changedIndex];
  // pick a replacement not already on the shelf and different from `before`
  const candidates = INVENTORY_ITEMS.filter((it) => !items.includes(it));
  const after = candidates.length > 0 ? candidates[rng.int(0, candidates.length)] : before;
  const changedItems = items.slice();
  changedItems[changedIndex] = after;
  return { items: changedItems, changedIndex, before, after };
}

// --- shared -------------------------------------------------------------
export function microGrade(score: number): 'poor' | 'ok' | 'great' | 'perfect' {
  if (score >= 30) return 'perfect';
  if (score >= 18) return 'great';
  if (score >= 8) return 'ok';
  return 'poor';
}
