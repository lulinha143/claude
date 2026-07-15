import { createRng, hashStringToSeed, type Rng } from './rng';

// Pure, deterministic logic for the micro-games. The React components own
// timing/DOM; this module owns the rules so they can be unit-tested and are
// reproducible from a seed (used by tests and the dev deterministic mode).

export type MicroMode = 'shellSort' | 'coffeeRescue' | 'inventory' | 'bugSquash';

// --- Conveyor Sort --------------------------------------------------------
// Items ride a conveyor: a good nut, a rare golden nut, or a broken shell. The
// player sorts each into the correct labelled bin. Categories are distinguished
// by icon + label + pattern, never colour alone (colourblind-safe).
export type ShellKind = 'goodNut' | 'goldenNut' | 'brokenShell';
export type ShellBin = 'good' | 'golden' | 'shell';

export interface ShellItem {
  id: number;
  kind: ShellKind;
}

export function shellSequence(seedStr: string, count: number): ShellItem[] {
  const rng = createRng(hashStringToSeed(`shell:${seedStr}`));
  const out: ShellItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const roll = rng.next();
    // ~12% golden, ~48% good, ~40% broken shell
    const kind: ShellKind = roll < 0.12 ? 'goldenNut' : roll < 0.6 ? 'goodNut' : 'brokenShell';
    out.push({ id: i, kind });
  }
  return out;
}

export function shellBinFor(kind: ShellKind): ShellBin {
  if (kind === 'goldenNut') return 'golden';
  if (kind === 'brokenShell') return 'shell';
  return 'good';
}

/**
 * Score for a placement: correct scales with the current combo; a golden nut is
 * worth more. Wrong placements score nothing (gentle, never negative).
 */
export function shellScoreDelta(correct: boolean, combo: number, kind: ShellKind = 'goodNut'): number {
  if (!correct) return 0;
  const base = kind === 'goldenNut' ? 5 : 2;
  return base + Math.floor(combo / 3);
}

// --- Coffee Rescue --------------------------------------------------------
// Drops fall; the mug catches them. Difficulty ramps gently with elapsed time,
// and consecutive catches build a combo multiplier.
export function coffeeFallDuration(elapsedSeconds: number): number {
  // seconds for a drop to fall top->bottom; starts slow, floors at 1.6s
  return Math.max(1.6, 3.2 - elapsedSeconds * 0.05);
}

export function coffeeSpawnInterval(elapsedSeconds: number): number {
  return Math.max(700, 1300 - elapsedSeconds * 20); // ms between drops
}

/** Combo multiplier tier from the current catch streak (1x → 3x). */
export function coffeeComboMultiplier(streak: number): number {
  if (streak >= 12) return 3;
  if (streak >= 6) return 2;
  return 1;
}

/** Points for a single catch given the current (already-incremented) streak. */
export function coffeeCatchScore(streak: number): number {
  return 2 * coffeeComboMultiplier(streak);
}

// --- Raccoon Inventory Check ----------------------------------------------
// A shelf of items is shown, then one is swapped; the player identifies which
// slot changed. Rounds get bigger as the player succeeds. Deterministic seed.
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

/** Shelf size grows every two cleared rounds: 5,5,6,6,7,7… capped at the pool. */
export function inventorySize(round: number): number {
  return Math.min(INVENTORY_ITEMS.length, 5 + Math.floor(Math.max(0, round) / 2));
}

export interface InventoryRound {
  items: InventoryItem[];
  changedIndex: number;
  before: InventoryItem;
  after: InventoryItem;
}

export function inventoryRound(seedStr: string, size = 5): InventoryRound {
  const rng: Rng = createRng(hashStringToSeed(`inv:${seedStr}`));
  const capped = Math.min(size, INVENTORY_ITEMS.length);
  const pool = [...INVENTORY_ITEMS];
  // draw `size` distinct items
  const items: InventoryItem[] = [];
  while (items.length < capped && pool.length > 0) {
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

/** Score for a correct find, rewarding longer memory streaks. */
export function inventoryScoreDelta(streak: number): number {
  return 3 + Math.min(6, streak);
}

// --- Bug Squash -----------------------------------------------------------
// A reaction/precision "whack-a-mole": office pests pop out of a 3x3 grid of
// burrows for a shrinking window; tap them before they duck back. Speed and
// difficulty ramp with elapsed time; consecutive squashes build a combo.
export const BUG_HOLES = 9;

export function bugLifetime(elapsedSeconds: number): number {
  return Math.max(650, 1500 - elapsedSeconds * 26); // ms a pest stays up
}

export function bugSpawnInterval(elapsedSeconds: number): number {
  return Math.max(380, 900 - elapsedSeconds * 18); // ms between pests
}

export function bugScore(streak: number): number {
  return 2 + Math.min(6, Math.floor(streak / 2));
}

// --- shared -------------------------------------------------------------
export function microGrade(score: number): 'poor' | 'ok' | 'great' | 'perfect' {
  if (score >= 30) return 'perfect';
  if (score >= 18) return 'great';
  if (score >= 8) return 'ok';
  return 'poor';
}
