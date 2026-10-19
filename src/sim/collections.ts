// What the player has collected, read from the records each collection already
// keeps. Nothing here is stored: every count is derived from the authoritative
// ownership, discovery or achievement data, so a collection can never disagree with
// the place it is earned in (an item counted twice, or shown as missing while it is
// on someone's desk).
//
// Secrecy follows the rest of the game. A collection whose size is itself the
// secret (Moment Cards, secret files) has no total; anything not yet found is
// described by where it can turn up now, never by its name, solution or reward.

import type { GameState } from './types';
import { NUTS } from '../content/nuts';
import { ODDITIES, ROOM_PLAY, fileOddities } from '../content/roomPlay';
import { ROOMS } from '../content/rooms';
import { EMPLOYEES } from '../content/employees';
import { ACHIEVEMENTS } from '../content/achievements';
import { keepsakeTopicId } from '../content/employeeKeepsakes';
import { decorationEnsembles } from './decorationEnsembles';
import { isRoomIdUnlocked } from './rooms';
import { curiosityProgress, oddityAvailable } from './roomPlay';
import { keepsakeFor } from './bonds';
import { eligibleTopics } from './talks';
import { isDecorationOwned } from './decorations';
import {
  MICRO_CALIBRATION,
  MICRO_MODES,
  MICRO_SOUVENIRS,
  isMicroMastered,
  type MicroMode,
} from './minigames';

export type ShelfId =
  'nuts' | 'curiosities' | 'sets' | 'keepsakes' | 'masteries' | 'outfits' | 'moments';

/** A line the shelf says, as a key under `collections.next.` with what it names. */
export interface ShelfLine {
  key: string;
  params?: Record<string, number>;
  roomId?: string;
  employeeId?: string;
  setId?: string;
  mode?: MicroMode;
  outfitId?: string;
  souvenirId?: string;
}

export interface ShelfEntry {
  id: ShelfId;
  have: number;
  /** Null where the size of the collection is part of the secret. */
  total: number | null;
  /** A second count the drawer carries (the secret files beside the curiosities). */
  extra?: number;
  /** What can be done for it now, or why it waits. */
  next: ShelfLine | null;
  /** What completing it (or its next milestone) really pays, when it pays anything. */
  reward: ShelfLine | null;
}

/** Friendship at which a teammate will talk about their keepsake. */
const KEEPSAKE_FRIENDSHIP = 20;

/** The room where this nut can turn up right now, or null (found, or not yet possible). */
export function nutTurnsUpIn(state: GameState, nutId: string, now: number): string | null {
  if (state.collections.nuts.includes(nutId)) return null;
  const def = ODDITIES.find((oddity) => oddity.nutId === nutId);
  return def && oddityAvailable(state, def, now) ? def.roomId : null;
}

function nutsEntry(state: GameState, now: number): ShelfEntry {
  const ids = new Set(NUTS.map((nut) => nut.id));
  const have = new Set(state.collections.nuts.filter((id) => ids.has(id))).size;
  const where = NUTS.map((nut) => nutTurnsUpIn(state, nut.id, now)).find(Boolean) ?? null;
  // The encyclopedia's milestones are achievements; the next one not yet earned.
  const milestone = ACHIEVEMENTS.flatMap((item) =>
    item.condition.kind === 'collectionNuts' &&
    !item.hidden &&
    !((state.achievements[item.id] ?? 0) > 0)
      ? [{ value: item.condition.value, golden: item.goldenReward }]
      : [],
  ).sort((a, b) => a.value - b.value)[0];
  return {
    id: 'nuts',
    have,
    total: NUTS.length,
    next:
      have >= NUTS.length
        ? { key: 'complete' }
        : where
          ? { key: 'nutsWhere', roomId: where }
          : { key: 'nutsLater' },
    reward: milestone
      ? {
          key: 'nutsMilestone',
          params: { value: milestone.value, golden: milestone.golden },
        }
      : null,
  };
}

function curiositiesEntry(state: GameState): ShelfEntry {
  const open = ROOMS.filter((room) => isRoomIdUnlocked(state, room.id));
  let have = 0;
  let total = 0;
  let closest: { roomId: string; left: number } | null = null;
  for (const room of open) {
    const progress = curiosityProgress(state, room.id);
    have += progress.noticed;
    total += progress.total;
    const left = progress.total - progress.noticed;
    if (left > 0 && (!closest || left < closest.left)) closest = { roomId: room.id, left };
  }
  const waiting = (state.office?.oddities ?? []).find((item) =>
    isRoomIdUnlocked(state, item.roomId),
  );
  const closedHoldMore = ROOMS.some(
    (room) => !isRoomIdUnlocked(state, room.id) && fileOddities(room.id).length > 0,
  );
  const secrets = new Set(state.collections.secrets.filter((id) => !id.startsWith('deco:'))).size;
  return {
    id: 'curiosities',
    have,
    total,
    extra: secrets,
    next: waiting
      ? { key: 'curiosityWaiting', roomId: waiting.roomId }
      : closest
        ? { key: 'curiosityRoom', roomId: closest.roomId, params: { left: closest.left } }
        : closedHoldMore
          ? { key: 'curiosityMoreRooms' }
          : { key: 'complete' },
    reward: closest
      ? { key: 'roomFileReward', params: { golden: ROOM_PLAY.roomCompleteGolden } }
      : null,
  };
}

function setsEntry(state: GameState): ShelfEntry {
  const sets = decorationEnsembles(state);
  const have = sets.filter((set) => set.active).length;
  const candidate = sets
    .filter((set) => !set.active && isRoomIdUnlocked(state, set.definition.roomId))
    .sort(
      (a, b) =>
        a.definition.items.length - a.placed.length - (b.definition.items.length - b.placed.length),
    )[0];
  return {
    id: 'sets',
    have,
    total: sets.length,
    next:
      have >= sets.length
        ? { key: 'complete' }
        : candidate
          ? {
              key: 'setMissing',
              setId: candidate.definition.id,
              roomId: candidate.definition.roomId,
              params: { missing: candidate.definition.items.length - candidate.placed.length },
            }
          : { key: 'setsMoreRooms' },
    reward: candidate ? { key: 'setReward', setId: candidate.definition.id } : null,
  };
}

function keepsakesEntry(state: GameState, now: number): ShelfEntry {
  const have = EMPLOYEES.filter((def) => keepsakeFor(state, def.id) !== null).length;
  const hired = EMPLOYEES.filter(
    (def) => state.employees[def.id]?.hired && keepsakeFor(state, def.id) === null,
  );
  const ready = hired.find((def) =>
    eligibleTopics(state, def.id, now).some((topic) => topic.id === keepsakeTopicId(def.id)),
  );
  const nearest = hired
    .filter((def) => (state.employees[def.id]?.friendship ?? 0) < KEEPSAKE_FRIENDSHIP)
    .sort((a, b) => state.employees[b.id].friendship - state.employees[a.id].friendship)[0];
  return {
    id: 'keepsakes',
    have,
    total: EMPLOYEES.length,
    next:
      have >= EMPLOYEES.length
        ? { key: 'complete' }
        : ready
          ? { key: 'keepsakeAsk', employeeId: ready.id }
          : nearest
            ? {
                key: 'keepsakeTrust',
                employeeId: nearest.id,
                params: {
                  need: Math.max(
                    1,
                    Math.ceil(KEEPSAKE_FRIENDSHIP - state.employees[nearest.id].friendship),
                  ),
                },
              }
            : { key: 'keepsakeTeam' },
    reward: null,
  };
}

function masteriesEntry(state: GameState): ShelfEntry {
  const open = MICRO_MODES.filter((mode) => !isMicroMastered(state, mode));
  const nearest = open
    .map((mode) => ({
      mode,
      best: state.microgames[mode]?.best ?? 0,
      line: MICRO_CALIBRATION[mode].mastery,
    }))
    .sort((a, b) => b.best / b.line - a.best / a.line)[0];
  return {
    id: 'masteries',
    have: MICRO_MODES.length - open.length,
    total: MICRO_MODES.length,
    next: nearest
      ? {
          key: nearest.best > 0 ? 'masteryBest' : 'masteryFirst',
          mode: nearest.mode,
          params: { best: Math.floor(nearest.best), line: nearest.line },
        }
      : { key: 'complete' },
    // What mastering pays (engine.rewardMicrogame): a golden nut, the game's card
    // and its souvenir, unless that piece was already bought.
    reward: nearest
      ? isDecorationOwned(state, MICRO_SOUVENIRS[nearest.mode])
        ? { key: 'masteryRewardOwned', mode: nearest.mode, params: { golden: 1 } }
        : {
            key: 'masteryReward',
            mode: nearest.mode,
            souvenirId: MICRO_SOUVENIRS[nearest.mode],
            params: { golden: 1 },
          }
      : null,
  };
}

/** Outfits bought with a price: the free ones are each teammate's own clothes. */
export function specialOutfits() {
  return EMPLOYEES.flatMap((def) =>
    def.outfits
      .filter((outfit) => outfit.cost.amount > 0)
      .map((outfit) => ({ employeeId: def.id, outfit })),
  );
}

function outfitsEntry(state: GameState): ShelfEntry {
  const special = specialOutfits();
  const owned = new Set(state.collections.outfits);
  const have = special.filter((item) => owned.has(item.outfit.id)).length;
  const cheapest = special
    .filter((item) => !owned.has(item.outfit.id) && state.employees[item.employeeId]?.hired)
    .sort((a, b) => a.outfit.cost.amount - b.outfit.cost.amount)[0];
  return {
    id: 'outfits',
    have,
    total: special.length,
    next:
      have >= special.length
        ? { key: 'complete' }
        : cheapest
          ? {
              key: 'outfitNext',
              employeeId: cheapest.employeeId,
              outfitId: cheapest.outfit.id,
              params: { cost: cheapest.outfit.cost.amount },
            }
          : { key: 'outfitTeam' },
    reward: null,
  };
}

function momentsEntry(state: GameState): ShelfEntry {
  return {
    id: 'moments',
    have: new Set(state.collections.moments.map((card) => card.id)).size,
    total: null,
    next: state.collections.moments.length ? null : { key: 'momentsFirst' },
    reward: null,
  };
}

/** Every collection, in the order the Archive shelves them. */
export function collectionShelf(state: GameState, now: number): ShelfEntry[] {
  return [
    nutsEntry(state, now),
    curiositiesEntry(state),
    setsEntry(state),
    keepsakesEntry(state, now),
    masteriesEntry(state),
    outfitsEntry(state),
    momentsEntry(state),
  ];
}
