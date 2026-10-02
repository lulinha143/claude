// Automatic handling for players who have turned choice popups off.
//
// POLICY (and why this one)
// -------------------------
// Three options were available when the player disables choice events: skip the
// event entirely, defer it to a queue, or resolve it automatically. This module
// implements AUTOMATIC RESOLUTION, because it is the only one that keeps the
// promise the setting makes without quietly removing a whole system:
//
//   - Skipping would delete a pillar of the game. Events drive morale,
//     reputation, moments and several progression paths, so a player who dislikes
//     popups would silently receive a much emptier, slower game.
//   - Deferring just moves the interruption. The queue has to be drained
//     eventually, and an unbounded backlog of stale decisions is worse than the
//     popups were.
//   - Resolving automatically keeps events firing, keeps their consequences real,
//     keeps the history and cooldowns intact, and simply removes the interruption.
//     The player is told what was decided through the ordinary notification feed,
//     so nothing happens behind their back.
//
// The department picks the SENSIBLE option rather than a random or first-listed
// one: each enabled choice is scored by its net effect on the company and the best
// is taken. That makes the setting an accessibility/comfort feature instead of a
// hidden difficulty penalty, and it is deterministic, so it is fully testable.

import type { GameState } from './types';
import type { EventChoice, EventEffect, GameEventDef } from '../content/types';
import { eventChoicesForState } from './eventChoices';

/**
 * Rough worth of one unit of each resource, used only to compare choices against
 * each other. These are relative weights, not economy tuning: morale and
 * reputation are scarce and slow to rebuild, so a point of either outweighs a
 * point of nuts, and golden nuts are the premium currency.
 */
const EFFECT_WEIGHT: Record<EventEffect['type'], number> = {
  nuts: 0.02,
  goldenNuts: 12,
  morale: 3,
  reputation: 4,
  productionBoost: 6,
  friendship: 1.5,
  emotion: 0.5,
  momentCard: 2,
  unlockSecret: 3,
  collectNut: 2,
  // Marks are bookkeeping, not value in themselves.
  setFlag: 0,
  clearFlag: 0,
  // Scored from its CONTENTS below, not from a flat weight.
  schedule: 0,
  find: 1,
};

/**
 * How much a deferred consequence counts toward a choice's score.
 *
 * Less than 1, because a cost paid later really is preferable to the same cost
 * paid now — but well above 0, so the department cannot be tricked by an option
 * that looks free and quietly bills the company afterwards.
 */
const DEFERRED_DISCOUNT = 0.7;

/** Net score for a single effect. Higher is better for the company. */
function scoreEffect(effect: EffectLike): number {
  const weight = EFFECT_WEIGHT[effect.type] ?? 0;
  switch (effect.type) {
    // Value-bearing effects scale with their signed value, so a penalty scores
    // negative and a reward scores positive.
    case 'nuts':
    case 'goldenNuts':
    case 'morale':
    case 'reputation':
    case 'friendship':
      return (effect.value ?? 0) * weight;
    // A temporary multiplier is worth more the longer and stronger it is.
    case 'productionBoost': {
      const multiplier = effect.value ?? 1.5;
      const seconds = effect.durationSeconds ?? 60;
      return (multiplier - 1) * weight * Math.min(3, seconds / 60);
    }
    // Flat, unambiguously good outcomes.
    case 'momentCard':
    case 'unlockSecret':
    case 'collectNut':
      return weight;
    // A mood change is mildly good or bad depending on the emotion.
    case 'emotion':
      return NEGATIVE_EMOTIONS.has(effect.emotion ?? '') ? -weight : weight;
    default:
      return 0;
  }
}

type EffectLike = Pick<EventEffect, 'type' | 'value' | 'durationSeconds' | 'emotion'>;

const NEGATIVE_EMOTIONS = new Set([
  'frustrated',
  'tired',
  'anxious',
  'bored',
  'lonely',
  'overwhelmed',
  'suspicious',
]);

/**
 * Net score for a choice: the sum of what it does to the company, INCLUDING what
 * it has promised to do later. Without the deferred term, "take the money now"
 * options with a delayed penalty would always win.
 */
export function scoreChoice(choice: EventChoice): number {
  let total = 0;
  for (const effect of choice.effects) {
    total += scoreEffect(effect);
    if (effect.type === 'schedule' && effect.scheduled?.length) {
      for (const later of effect.scheduled) {
        total += scoreEffect(later) * DEFERRED_DISCOUNT;
      }
    }
  }
  return total;
}

export interface AutoResolution {
  choice: EventChoice;
  score: number;
}

/**
 * The choice the department takes on the player's behalf.
 *
 * Only enabled choices are considered, so an unaffordable option is never picked.
 * `eventChoicesForState` guarantees at least one enabled path exists, so this
 * returns null only for a step with no choices at all (malformed content).
 * Ties break toward the earlier authored choice, keeping the result stable.
 */
export function chooseAutoResolution(
  state: GameState,
  def: GameEventDef,
  step: string | null,
): AutoResolution | null {
  const { choices } = eventChoicesForState(state, def, step);
  let best: AutoResolution | null = null;
  for (const entry of choices) {
    if (!entry.enabled) continue;
    const score = scoreChoice(entry.choice);
    if (!best || score > best.score) best = { choice: entry.choice, score };
  }
  return best;
}
