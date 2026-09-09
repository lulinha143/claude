// The company's live modifier stack: what every unlocked room, the teammates
// standing in it, and the company's standing all add up to.
//
// This is the single place the synergy network is interpreted. Rooms declare their
// effects as data in `content/roomProfiles.ts`; this module resolves them against
// the actual state of the building — which rooms are unlocked, who is assigned
// where, how the company feels — and produces one flat set of levers that the
// economy, the click layer, the morale drift and the event roll all read.
//
// Everything is pure and framework-free so the whole network is unit-testable.
//
// Resolution rules, in order:
//   1. A room contributes nothing unless it is unlocked.
//   2. `fixed` effects apply on unlock. The room itself does them.
//   3. Every other effect scales with STAFFING (assigned / ROOM_FULL_STAFF),
//      so an empty room is inert and assignment is a real decision.
//   4. `requiresRoom` effects additionally need that partner room unlocked AND
//      staffed. These are the chain links.
//   5. `moralePivot` effects scale with how far morale sits above the pivot, so a
//      room can convert company mood into something else.
//   6. Specialists in a room amplify that room's own staffed effects.
//   7. The reputation tier's perk is added last, as a flat company-wide bonus.
//
// Tradeoffs use exactly the same machinery with negative values, so a penalty
// scales down as a room empties out just as a bonus does.

import type { GameState } from './types';
import {
  ROOM_FULL_STAFF,
  ROOM_PROFILES,
  SPECIALIST_BONUS,
  type RoomEffect,
  type RoomEffectKind,
  type RoomProfile,
} from '../content/roomProfiles';
import { reputationTier } from '../content/reputationTiers';
import { employeesInRoom, isRoomIdUnlocked } from './rooms';
import { BALANCE } from './config';

/** Every company-wide lever, resolved. */
export interface CompanyModifiers {
  /** fractional change to nut production (0.2 = +20%). */
  production: number;
  /** fractional change to the value of a manual tap. */
  clickPower: number;
  /** additive shift to the morale the company settles at. */
  moraleTarget: number;
  /** fractional change to how fast morale moves toward its target. */
  moraleRegen: number;
  /** additive reputation per second. */
  reputationRate: number;
  /** additive golden-nut chance on a tap. */
  goldenChance: number;
  /** additive critical-tap chance. */
  critChance: number;
  /** fractional change to the combo window. */
  comboWindow: number;
  /** additive purchase discount. */
  costReduction: number;
  /** additive weighting toward rarer events. */
  eventLuck: number;
  /** additive share of production banked automatically. */
  automation: number;
}

const ZERO: CompanyModifiers = {
  production: 0,
  clickPower: 0,
  moraleTarget: 0,
  moraleRegen: 0,
  reputationRate: 0,
  goldenChance: 0,
  critChance: 0,
  comboWindow: 0,
  costReduction: 0,
  eventLuck: 0,
  automation: 0,
};

export function emptyModifiers(): CompanyModifiers {
  return { ...ZERO };
}

/** One room's resolved contribution, for the Company screen's synergy list. */
export interface RoomContribution {
  roomId: string;
  unlocked: boolean;
  staffed: number;
  /** 0..1 share of full staffing. */
  staffing: number;
  /** specialists currently working here. */
  specialists: string[];
  /** resolved effects (positive intent) and tradeoffs (negative intent). */
  effects: ResolvedEffect[];
  tradeoffs: ResolvedEffect[];
  /** effects that are authored but currently inert, with the reason. */
  dormant: DormantEffect[];
}

export interface ResolvedEffect {
  kind: RoomEffectKind;
  /** the value actually being applied right now. */
  value: number;
}

export interface DormantEffect {
  kind: RoomEffectKind;
  /** the value it WOULD contribute at full strength. */
  potential: number;
  reason: 'unstaffed' | 'missing-room' | 'low-morale';
  /** the partner room needed, when `reason` is 'missing-room'. */
  requiresRoom?: string;
}

/** How fully a room is staffed, 0..1. */
export function roomStaffing(state: GameState, roomId: string): number {
  const assigned = employeesInRoom(state, roomId).length;
  return Math.min(1, assigned / ROOM_FULL_STAFF);
}

/** A room counts as "running" for chain purposes once anyone works in it. */
export function roomIsRunning(state: GameState, roomId: string): boolean {
  return isRoomIdUnlocked(state, roomId) && employeesInRoom(state, roomId).length > 0;
}

/** Specialists from a profile who are actually in that room right now. */
function activeSpecialists(state: GameState, profile: RoomProfile): string[] {
  if (!profile.specialists?.length) return [];
  const occupants = employeesInRoom(state, profile.roomId);
  return profile.specialists.filter((id) => occupants.includes(id));
}

/**
 * The multiplier applied to a room's staffed effects: staffing share, amplified
 * by any specialists standing in it.
 */
function staffedScale(staffing: number, specialists: number): number {
  return staffing * (1 + specialists * SPECIALIST_BONUS);
}

/**
 * How strongly a morale-gated effect fires: 0 at or below the pivot, 1 at the
 * morale cap. Uses the balance cap rather than the upgraded cap so the curve does
 * not shift under the player as they buy morale upgrades.
 */
function moraleScale(morale: number, pivot: number): number {
  const ceiling = BALANCE.morale.baseCap;
  if (ceiling <= pivot) return morale >= pivot ? 1 : 0;
  return Math.max(0, Math.min(1, (morale - pivot) / (ceiling - pivot)));
}

/**
 * Resolve one effect to the value it currently contributes, or report why it is
 * dormant. Returns `null` for an effect that is simply switched off.
 */
function resolveEffect(
  state: GameState,
  effect: RoomEffect,
  scale: number,
): { value: number } | { dormant: DormantEffect } | null {
  // Structural: the room does this by existing.
  if (effect.fixed) return { value: effect.value };

  if (effect.requiresRoom && !roomIsRunning(state, effect.requiresRoom)) {
    return {
      dormant: {
        kind: effect.kind,
        potential: effect.value,
        reason: 'missing-room',
        requiresRoom: effect.requiresRoom,
      },
    };
  }

  if (scale <= 0) {
    return { dormant: { kind: effect.kind, potential: effect.value, reason: 'unstaffed' } };
  }

  let value = effect.value * scale;

  if (effect.moralePivot !== undefined) {
    const gate = moraleScale(state.resources.morale, effect.moralePivot);
    if (gate <= 0) {
      return { dormant: { kind: effect.kind, potential: effect.value, reason: 'low-morale' } };
    }
    value *= gate;
  }

  return { value };
}

/** Per-room resolution, shared by the aggregate and the explain-UI. */
export function roomContributions(state: GameState): RoomContribution[] {
  return ROOM_PROFILES.map((profile) => {
    const unlocked = isRoomIdUnlocked(state, profile.roomId);
    const staffed = unlocked ? employeesInRoom(state, profile.roomId).length : 0;
    const staffing = unlocked ? roomStaffing(state, profile.roomId) : 0;
    const specialists = unlocked ? activeSpecialists(state, profile) : [];
    const scale = staffedScale(staffing, specialists.length);

    const effects: ResolvedEffect[] = [];
    const tradeoffs: ResolvedEffect[] = [];
    const dormant: DormantEffect[] = [];

    if (unlocked) {
      for (const [list, out] of [
        [profile.effects, effects],
        [profile.tradeoffs, tradeoffs],
      ] as const) {
        for (const effect of list) {
          const resolved = resolveEffect(state, effect, scale);
          if (!resolved) continue;
          if ('dormant' in resolved) dormant.push(resolved.dormant);
          else if (resolved.value !== 0) out.push({ kind: effect.kind, value: resolved.value });
        }
      }
    }

    return {
      roomId: profile.roomId,
      unlocked,
      staffed,
      staffing,
      specialists,
      effects,
      dormant,
      tradeoffs,
    };
  });
}

/**
 * The company's full modifier stack.
 *
 * Called from the production path, so it is kept allocation-light: one pass over
 * the room profiles, no intermediate arrays.
 */
export function aggregateCompanyModifiers(state: GameState): CompanyModifiers {
  const mods = emptyModifiers();

  for (const profile of ROOM_PROFILES) {
    if (!isRoomIdUnlocked(state, profile.roomId)) continue;
    const staffing = roomStaffing(state, profile.roomId);
    const specialists = activeSpecialists(state, profile).length;
    const scale = staffedScale(staffing, specialists);

    for (const effect of profile.effects) {
      const resolved = resolveEffect(state, effect, scale);
      if (resolved && 'value' in resolved) mods[effect.kind] += resolved.value;
    }
    for (const effect of profile.tradeoffs) {
      const resolved = resolveEffect(state, effect, scale);
      if (resolved && 'value' in resolved) mods[effect.kind] += resolved.value;
    }
  }

  // Standing in the world pays its own small, permanent dividend.
  const perk = reputationTier(state.resources.reputation).perk;
  if (perk) {
    mods.automation += perk.automation ?? 0;
    mods.costReduction += perk.costReduction ?? 0;
    mods.eventLuck += perk.eventLuck ?? 0;
    mods.goldenChance += perk.goldenChance ?? 0;
  }

  // Guard rails so no combination can invert a system. Production and click power
  // may be reduced but never zeroed or negated; the rest are clamped to sane
  // ranges so a very unbalanced building is a bad company, not a broken one.
  mods.production = Math.max(-0.75, mods.production);
  mods.clickPower = Math.max(-0.75, mods.clickPower);
  mods.moraleRegen = Math.max(-0.75, mods.moraleRegen);
  mods.comboWindow = Math.max(-0.5, mods.comboWindow);
  mods.costReduction = Math.max(0, Math.min(0.75, mods.costReduction));
  mods.goldenChance = Math.max(0, mods.goldenChance);
  mods.critChance = Math.max(0, mods.critChance);
  mods.eventLuck = Math.max(0, mods.eventLuck);
  mods.automation = Math.max(0, Math.min(1, mods.automation));

  return mods;
}

/** Rooms that are unlocked but contributing nothing because nobody works there. */
export function idleRooms(state: GameState): string[] {
  return ROOM_PROFILES.filter(
    (p) => isRoomIdUnlocked(state, p.roomId) && employeesInRoom(state, p.roomId).length === 0,
  ).map((p) => p.roomId);
}
