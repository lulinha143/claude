import type { GameState } from './types';
import { ACHIEVEMENTS } from '../content/achievements';
import type { AchievementDef } from '../content/types';
import { UPGRADES_BY_ID } from '../content/upgrades';
import { computeProduction } from './economy';
import { countUnlockedRooms } from './rooms';

// Build the set of boolean "flags" an achievement can test against. Kept in one
// place so flag-based achievements stay declarative.
export function computeFlags(state: GameState): Set<string> {
  const flags = new Set<string>();
  for (const [id, rt] of Object.entries(state.employees)) {
    if (rt.hired) flags.add(`employee:${id}`);
  }
  if ((state.upgrades['coffee-8'] ?? 0) >= (UPGRADES_BY_ID['coffee-8']?.maxLevel ?? 99))
    flags.add('coffee:max');
  if ((state.upgrades['room-basement'] ?? 0) > 0) flags.add('room:basement');
  if (state.resources.reputation >= 200) flags.add('room:rooftop');
  if (state.resources.reputation >= 100) flags.add('reputation:100');
  if (state.stats.cratesCollected >= 100) flags.add('crates:100');
  if (state.stats.playTimeSeconds >= 3600) flags.add('playtime:3600');
  if (state.collections.outfits.length >= 6) flags.add('outfits:6');
  for (const s of state.collections.secrets) flags.add(`secret:${s}`);
  // What the player has noticed around the office (sim/roomPlay.ts).
  const noticed = Object.keys(state.flags).filter((id) => id.startsWith('oddity.'));
  if (noticed.filter((id) => !id.startsWith('oddity.room.')).length >= 10) {
    flags.add('curiosities:10');
  }
  if (noticed.some((id) => id.startsWith('oddity.room.'))) flags.add('roomFile:1');
  return flags;
}

function conditionMet(def: AchievementDef, state: GameState): boolean {
  const c = def.condition;
  switch (c.kind) {
    case 'totalNuts':
      return state.stats.totalNutsEarned >= c.value;
    case 'nutsPerSecond':
      return computeProduction(state, false).nutsPerSecond >= c.value;
    case 'clicks':
      return state.stats.totalClicks >= c.value;
    case 'employeesHired':
      return Object.values(state.employees).filter((e) => e.hired).length >= c.value;
    case 'prestiges':
      return state.prestige.count >= c.value;
    case 'exactNuts':
      return Math.floor(state.resources.nuts) === c.value;
    case 'morale':
      return state.resources.morale >= c.value;
    case 'eventsSeen':
      return state.stats.eventsSeen >= c.value;
    case 'microgames':
      return state.stats.microgamesPlayed >= c.value;
    case 'focusSessions':
      return state.focus.completedSessions >= c.value;
    case 'collectionNuts':
      return state.collections.nuts.length >= c.value;
    case 'roomsUnlocked':
      return countUnlockedRooms(state) >= c.value;
    case 'flag':
      return computeFlags(state).has(c.flag);
  }
}

/**
 * Mutates state to unlock any newly-satisfied achievements and pays out their
 * golden-nut rewards. Returns the ids unlocked in this pass.
 */
export function evaluateAchievements(state: GameState, now: number): string[] {
  const unlocked: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if ((state.achievements[def.id] ?? 0) > 0) continue;
    if (conditionMet(def, state)) {
      state.achievements[def.id] = now;
      state.resources.goldenNuts += def.goldenReward;
      unlocked.push(def.id);
    }
  }
  return unlocked;
}
