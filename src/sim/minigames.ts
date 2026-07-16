import { createRng, hashStringToSeed } from './rng';

// Pure, deterministic logic for the micro-games. The React components own
// timing/DOM; this module owns the rules so they can be unit-tested and are
// reproducible from a seed (used by tests and the dev deterministic mode).

export type MicroMode = 'shellSort' | 'coffeeRescue' | 'procurement' | 'bugSquash';

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

// --- Procurement Conveyor -------------------------------------------------
// Packages ride the intake conveyor and the player physically drags each one to
// the correct department chute. Departments are told apart by ICON + SHAPE +
// LABEL (never colour alone) for colourblind accessibility. Some packages arrive
// on their side and must be rotated upright before they fit; fragile/priority
// parcels reward careful, accurate handling. Fully deterministic from a seed so
// the rules are unit-testable and reproducible in the dev deterministic mode.
export type ProcurementDept = 'harvest' | 'roasting' | 'logistics' | 'research';
export const PROCUREMENT_DEPTS: ProcurementDept[] = ['harvest', 'roasting', 'logistics', 'research'];

export interface ProcurementPackage {
  id: number;
  /** the department this parcel is addressed to (shown as an icon on the box). */
  dept: ProcurementDept;
  /** tubes/flats arrive rotated; they must be turned upright to fit the chute. */
  sideways: boolean;
  /** fragile parcels are worth a small bonus for careful, correct handling. */
  fragile: boolean;
}

export function procurementSequence(seedStr: string, count: number): ProcurementPackage[] {
  const rng = createRng(hashStringToSeed(`proc:${seedStr}`));
  const out: ProcurementPackage[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      id: i,
      dept: PROCUREMENT_DEPTS[rng.int(0, PROCUREMENT_DEPTS.length)],
      sideways: rng.next() < 0.32,
      fragile: rng.next() < 0.22,
    });
  }
  return out;
}

export type ProcurementResult = 'correct' | 'wrongDept' | 'notUpright';

/**
 * Resolve dropping a package onto a department chute. A parcel only clears when
 * it is sent to the right department AND (if it arrived sideways) has already
 * been rotated upright — otherwise it simply "doesn't fit" and can be retried,
 * so the player is never soft-locked and mistakes are gentle.
 */
export function procurementResolve(
  pkg: ProcurementPackage,
  dept: ProcurementDept,
  upright: boolean,
): ProcurementResult {
  if (pkg.sideways && !upright) return 'notUpright';
  return pkg.dept === dept ? 'correct' : 'wrongDept';
}

/**
 * Gentle scoring: only a correct placement scores, scaling with the current
 * combo; fragile and rotated parcels add a small bonus for the extra care and
 * skill. Wrong placements score nothing (never negative).
 */
export function procurementScoreDelta(
  result: ProcurementResult,
  combo: number,
  pkg: ProcurementPackage,
): number {
  if (result !== 'correct') return 0;
  let base = 2;
  if (pkg.fragile) base += 2;
  if (pkg.sideways) base += 1;
  return base + Math.floor(Math.max(0, combo) / 3);
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
