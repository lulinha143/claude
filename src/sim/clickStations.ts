// Click resolution: what a single tap on a station is worth.
//
// Everything here is PURE — it takes the game state plus the transient combo
// tracker and returns numbers. The engine owns the mutation and the RNG roll, so
// this module can be unit-tested exhaustively without a running game.
//
// A tap's value is the product of five understandable things, in this order:
//
//   click power  x  station payout  x  cadence  x  combo  x  synergy
//
// and then, if the roll lands, a critical multiplier on top. The player can see
// each of these in the station tooltip, which is why they are kept separable
// rather than collapsed into one opaque number.

import type { GameState } from './types';
import {
  CLICK_STATIONS_BY_ID,
  type ClickStationCadence,
  type ClickStationDef,
} from '../content/clickStations';
import { clickPower, aggregatePassives } from './economy';
import { aggregateCompanyModifiers } from './companyModifiers';
import { employeesInRoom } from './rooms';
import { BALANCE } from './config';

/** Tuning for the active-play layer. */
export const CLICK = {
  /** A combo survives this long between taps before it lapses. */
  comboWindowMs: 1_700,
  /** `burst` stations keep a combo alive longer, and stack it higher. */
  burstComboWindowMs: 2_400,
  /** Each combo step adds this much, up to the cadence's ceiling. */
  comboStepBonus: 0.05,
  comboCeiling: { steady: 12, charge: 8, burst: 25 } as Record<ClickStationCadence, number>,
  /** `charge` stations want a beat between taps; this is that beat. */
  chargeRecoveryMs: 620,
  /** Tapping a charge station early still pays at least this share. */
  chargeMinShare: 0.35,
  /** Base chance a tap crits, before station/passive/morale bonuses. */
  baseCritChance: 0.04,
  /** A critical tap multiplies its payout by this. */
  critMultiplier: 5,
  /** Chance a nut-paying tap also drops a single golden nut. */
  goldenTapChance: 0.004,
  /** How much a matching teammate in the room improves the station. */
  synergyPerEmployee: 0.35,
  /** Morale adds up to this much crit chance at full morale. */
  moraleCritBonus: 0.05,
} as const;

/** Transient per-station combo tracking. Never persisted — a combo is a moment. */
export interface ComboTracker {
  stationId: string;
  streak: number;
  lastTapAt: number;
}

export interface ClickBreakdownEntry {
  source: 'clickPower' | 'station' | 'cadence' | 'combo' | 'synergy' | 'critical';
  multiplier: number;
}

export interface ClickResolution {
  stationId: string;
  resource: 'nuts' | 'goldenNuts';
  /** final payout in the station's resource. */
  amount: number;
  /** combo streak AFTER this tap. */
  streak: number;
  comboMultiplier: number;
  synergyMultiplier: number;
  cadenceMultiplier: number;
  critical: boolean;
  /** true when this tap also dropped a golden nut (nut stations only). */
  golden: boolean;
  breakdown: ClickBreakdownEntry[];
}

/** The combo window for a station's cadence. */
export function comboWindowMs(cadence: ClickStationCadence): number {
  return cadence === 'burst' ? CLICK.burstComboWindowMs : CLICK.comboWindowMs;
}

/**
 * The streak a tap continues, given the previous tracker. A tap outside the
 * window (or on a different station) starts a fresh streak at 1.
 */
export function nextStreak(
  def: ClickStationDef,
  tracker: ComboTracker | null,
  now: number,
): number {
  if (!tracker || tracker.stationId !== def.id) return 1;
  if (now - tracker.lastTapAt > comboWindowMs(def.cadence)) return 1;
  return tracker.streak + 1;
}

/** Combo multiplier for a streak, capped by the station's cadence ceiling. */
export function comboMultiplier(def: ClickStationDef, streak: number): number {
  const ceiling = CLICK.comboCeiling[def.cadence];
  const steps = Math.max(0, Math.min(ceiling, streak - 1));
  return 1 + steps * CLICK.comboStepBonus;
}

/**
 * Cadence multiplier. `charge` stations reward waiting for the recharge; tapping
 * early still pays (scaled down, never zero) so mashing degrades gracefully
 * instead of feeling broken or rate-limited.
 */
export function cadenceMultiplier(
  def: ClickStationDef,
  tracker: ComboTracker | null,
  now: number,
): number {
  if (def.cadence !== 'charge') return 1;
  if (!tracker || tracker.stationId !== def.id) return 1;
  const elapsed = now - tracker.lastTapAt;
  if (elapsed >= CLICK.chargeRecoveryMs) return 1;
  const t = Math.max(0, elapsed) / CLICK.chargeRecoveryMs;
  return CLICK.chargeMinShare + (1 - CLICK.chargeMinShare) * t;
}

/** Teammates currently assigned to the station's room who suit the equipment. */
export function synergyEmployees(state: GameState, def: ClickStationDef): string[] {
  if (def.synergy.length === 0) return [];
  const occupants = employeesInRoom(state, def.roomId);
  return def.synergy.filter((id) => occupants.includes(id));
}

/** Synergy multiplier from the right animals being in the right room. */
export function synergyMultiplier(state: GameState, def: ClickStationDef): number {
  return 1 + synergyEmployees(state, def).length * CLICK.synergyPerEmployee;
}

/** Total critical chance for a tap on this station. */
export function critChance(state: GameState, def: ClickStationDef): number {
  const passives = aggregatePassives(state);
  const moraleShare =
    Math.max(0, Math.min(1, state.resources.morale / BALANCE.morale.baseCap)) *
    CLICK.moraleCritBonus;
  // Research and the rooftop dish exist partly to make tapping sharper.
  const rooms = aggregateCompanyModifiers(state).critChance;
  const total =
    CLICK.baseCritChance + (def.critBonus ?? 0) + passives.resourceFind * 0.5 + moraleShare + rooms;
  return Math.max(0, Math.min(0.75, total));
}

/**
 * Chance a nut-paying tap also drops a golden nut.
 *
 * The base rate is deliberately tiny: golden nuts are supposed to be an event.
 * The Vault and the basement are the rooms that turn that into a real income, so
 * building for premium currency is a decision the player makes on purpose.
 */
export function goldenTapChance(state: GameState): number {
  const rooms = aggregateCompanyModifiers(state).goldenChance;
  return Math.max(0, Math.min(0.25, CLICK.goldenTapChance + rooms));
}

/** The combo window for a station, widened by rooms that reward long streaks. */
export function stationComboWindowMs(state: GameState, def: ClickStationDef): number {
  const rooms = aggregateCompanyModifiers(state).comboWindow;
  return Math.max(400, comboWindowMs(def.cadence) * (1 + rooms));
}

/**
 * Resolve a tap. `critical` and `golden` are passed in by the caller (which owns
 * the seeded RNG) so this function stays deterministic and testable.
 */
export function resolveClick(
  state: GameState,
  def: ClickStationDef,
  tracker: ComboTracker | null,
  now: number,
  rolls: { critical: boolean; golden: boolean },
): ClickResolution {
  const streak = nextStreak(def, tracker, now);
  const combo = comboMultiplier(def, streak);
  const cadence = cadenceMultiplier(def, tracker, now);
  const synergy = synergyMultiplier(state, def);
  const power = clickPower(state);

  let amount = power * def.payout * cadence * combo * synergy;
  if (rolls.critical) amount *= CLICK.critMultiplier;

  // Golden-nut stations deal in whole-ish small numbers; keep a floor so a tap
  // is never worth literally nothing.
  if (def.resource === 'nuts') amount = Math.max(1, amount);

  const breakdown: ClickBreakdownEntry[] = [
    { source: 'clickPower', multiplier: power },
    { source: 'station', multiplier: def.payout },
    { source: 'cadence', multiplier: cadence },
    { source: 'combo', multiplier: combo },
    { source: 'synergy', multiplier: synergy },
  ];
  if (rolls.critical) breakdown.push({ source: 'critical', multiplier: CLICK.critMultiplier });

  return {
    stationId: def.id,
    resource: def.resource,
    amount,
    streak,
    comboMultiplier: combo,
    synergyMultiplier: synergy,
    cadenceMultiplier: cadence,
    critical: rolls.critical,
    golden: rolls.golden && def.resource === 'nuts',
    breakdown,
  };
}

/** Preview of what the next tap is worth, for tooltips. Never mutates. */
export function previewClickValue(
  state: GameState,
  stationId: string,
  tracker: ComboTracker | null,
  now: number,
): number {
  const def = CLICK_STATIONS_BY_ID[stationId];
  if (!def) return 0;
  return resolveClick(state, def, tracker, now, { critical: false, golden: false }).amount;
}
