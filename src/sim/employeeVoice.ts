// What a teammate says when you click them, chosen from what is actually
// happening to them.
//
// Clicking an employee used to always play a line from their own personal
// category, which meant they said the same charming things whether the company was
// thriving or collapsing. They now read the room first: someone standing in a
// department they dislike complains about it, someone in their element says so, and
// everybody notices when morale is on the floor or unusually high.
//
// That turns the click from flavour into INFORMATION. A player who clicks around
// the office learns where people are unhappy and which assignments are working —
// the same facts the Department Network reports, in the voice of the animal
// affected by them. It also means their personality is doing mechanical work,
// because the thing they comment on is the thing that is changing their output.
//
// Deliberately a small priority ladder rather than a weighted mood engine: a
// player has to be able to notice the pattern within a few clicks for it to read
// as character instead of randomness.

import type { GameState } from './types';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { DIALOGUE_COUNTS } from '../content/dialogue';
import { roomAffinity } from './affinity';
import { resolveEmployeeRoom } from './rooms';
import { BALANCE } from './config';

/** Morale at or below which everyone has an opinion about it. */
const GRIM = 32;
/** Morale at or above which the company is suspiciously pleasant. */
const THRIVING = 86;

/**
 * Categories this module may choose, in priority order. Company-wide mood beats
 * personal circumstance, because when morale collapses that IS the story.
 */
export type VoiceCategory =
  'lowMorale' | 'highMorale' | 'roomGrumble' | 'roomPride' | 'interaction' | 'idle';

export interface VoiceChoice {
  category: string;
  /** why this line was chosen, for tooltips and tests. */
  reason: 'lowMorale' | 'highMorale' | 'roomGrumble' | 'roomPride' | 'personal' | 'idle';
}

/** A category is only usable if the locale actually has lines for it. */
function has(category: string): boolean {
  return (DIALOGUE_COUNTS[category] ?? 0) > 0;
}

/**
 * Choose what `employeeId` should talk about right now.
 *
 * Falls back through the ladder until it finds a category with authored lines, so
 * adding a category to the registry switches it on and removing one degrades
 * safely rather than producing a missing key.
 */
export function chooseVoice(state: GameState, employeeId: string): VoiceChoice {
  const def = EMPLOYEES_BY_ID[employeeId];
  const morale = state.resources.morale;
  const cap = BALANCE.morale.baseCap;

  // 1. The company is struggling, and that outranks everything personal.
  if (morale <= GRIM && has('lowMorale')) {
    return { category: 'lowMorale', reason: 'lowMorale' };
  }

  // 2. The company is doing unusually well, which is its own kind of unsettling.
  if (morale >= Math.min(THRIVING, cap) && has('highMorale')) {
    return { category: 'highMorale', reason: 'highMorale' };
  }

  // 3. Where they are standing. This is the assignment feedback loop: the same
  //    affinity that changes their output is the thing they comment on.
  if (def) {
    const room = resolveEmployeeRoom(state, employeeId);
    const affinity = roomAffinity(employeeId, room);
    if (affinity === 'disliked' && has('roomGrumble')) {
      return { category: 'roomGrumble', reason: 'roomGrumble' };
    }
    if (affinity === 'favorite' && has('roomPride')) {
      return { category: 'roomPride', reason: 'roomPride' };
    }
  }

  // 4. Their own voice — the default, and still the most common outcome.
  if (def && has(def.dialogueCategory)) {
    return { category: def.dialogueCategory, reason: 'personal' };
  }

  return { category: 'idle', reason: 'idle' };
}
