import type { GameState } from './types';
import type { UpgradeDef } from '../content/types';
import { UPGRADES_BY_ID } from '../content/upgrades';

/**
 * Purchased-upgrade totals, by effect kind.
 *
 * This lives in its own module rather than in `economy.ts` because the systems
 * that need it include `companyModifiers`, and `economy` already imports
 * `companyModifiers` — putting it there would close an import cycle. Nothing here
 * depends on anything but the upgrade catalogue and the save, so it is safe for
 * every layer to read.
 */
export type UpgradeEffectKind = UpgradeDef['effect']['kind'];

/**
 * Total contribution of every purchased upgrade with the given effect kind.
 *
 * The behavioural upgrade kinds — sharper crits, longer combos, richer decisions,
 * denser rooms — all read through here and are ADDED to the room network's own
 * contribution at the same call sites, so an upgrade and a department stack rather
 * than one shadowing the other.
 */
export function upgradeBonus(state: GameState, kind: UpgradeEffectKind): number {
  let total = 0;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (!def || level <= 0) continue;
    if (def.effect.kind === kind && 'perLevel' in def.effect) {
      total += def.effect.perLevel * level;
    }
  }
  return total;
}
