import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import {
  collectionShelf,
  nutTurnsUpIn,
  specialOutfits,
  type ShelfEntry,
} from '../src/sim/collections';
import { curiosityBoardRooms, curiosityProgress } from '../src/sim/roomPlay';
import { fileOddities } from '../src/content/roomPlay';
import { isRoomIdUnlocked } from '../src/sim/rooms';
import { decorationEnsembles } from '../src/sim/decorationEnsembles';
import { keepsakeFor } from '../src/sim/bonds';
import { availableFacilityDiscoveries } from '../src/sim/facilityDiscoveries';
import { MICRO_CALIBRATION, isMicroMastered } from '../src/sim/minigames';
import { performPrestige } from '../src/sim/prestige';
import { gameStateSchema } from '../src/save/schema';
import { ROOMS } from '../src/content/rooms';
import { NUTS } from '../src/content/nuts';
import { DECORATION_ENSEMBLES } from '../src/content/decorationEnsembles';
import { keepsakeFlag } from '../src/content/employeeKeepsakes';
import type { GameState } from '../src/sim/types';

/*
 * Chapter 10: the Collections cabinet is read from where each thing is earned, so a
 * count cannot disagree with the office, nothing counts twice, and nothing hidden is
 * named before it is found.
 */

const NOW = 1_700_000_000_000;
const entry = (state: GameState, id: ShelfEntry['id']) =>
  collectionShelf(state, NOW).find((item) => item.id === id)!;

function place(state: GameState, setId: string) {
  const set = DECORATION_ENSEMBLES.find((item) => item.id === setId)!;
  set.items.forEach((id, index) => {
    state.collections.secrets.push(`deco:${id}`);
    state.decorationInstances.push({
      instanceId: `deco-${id}-1`,
      decorationId: id,
      roomId: set.roomId,
      surfaceType: 'floor',
      normalizedX: 0.2 + index * 0.25,
      normalizedY: 0.1,
      depth: 200,
      flipped: false,
      rotation: 0,
      interactionState: {},
    });
  });
  return set;
}

describe('collection counts come from the records that earn them', () => {
  it('counts each nut once, and only the nuts the encyclopedia has', () => {
    const s = createInitialState(NOW);
    s.collections.nuts.push('intern-acorn', 'intern-acorn', 'not-a-nut');
    expect(entry(s, 'nuts')).toMatchObject({ have: 1, total: NUTS.length });
  });

  it('names where a missing nut can turn up only once its curiosity really can', () => {
    const s = createInitialState(NOW);
    // The founder's acorn comes out of Pip's story: until then, no hint at all.
    expect(nutTurnsUpIn(s, 'founder-acorn', NOW)).toBeNull();
    s.flags['pip.arc.1'] = NOW;
    expect(nutTurnsUpIn(s, 'founder-acorn', NOW)).toBe('founder-desk');
    expect(entry(s, 'nuts').next).toMatchObject({ key: 'nutsWhere', roomId: 'founder-desk' });
    s.collections.nuts.push('founder-acorn');
    expect(nutTurnsUpIn(s, 'founder-acorn', NOW)).toBeNull();
  });

  it("names the encyclopedia's next milestone with what it really pays", () => {
    const s = createInitialState(NOW);
    expect(entry(s, 'nuts').reward).toMatchObject({
      key: 'nutsMilestone',
      params: { value: 1, golden: 1 },
    });
    s.achievements['golden-opportunity'] = NOW;
    expect(entry(s, 'nuts').reward?.params).toMatchObject({ value: 10 });
  });

  it('counts curiosities in the rooms the board shows, and keeps what was noticed', () => {
    const s = createInitialState(NOW);
    for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
    s.resources.reputation = 5_000;
    s.flags['oddity.first-acorn'] = NOW;
    const open = ROOMS.filter((room) => isRoomIdUnlocked(s, room.id));
    const sum = open.reduce((total, room) => total + curiosityProgress(s, room.id).total, 0);
    expect(entry(s, 'curiosities')).toMatchObject({ have: 1, total: sum });

    // A restructure closes rooms: their curiosities wait behind the doors, the noticed one stays.
    s.stats.totalNutsEarned = 2_000_000;
    const after = performPrestige(s, 'industrial', NOW);
    const shelf = entry(after, 'curiosities');
    expect(shelf.have).toBe(1);
    expect(shelf.total).toBeLessThan(sum);
  });

  it('keeps what was noticed in a room a restructure closes, and points only at open rooms', () => {
    const s = createInitialState(NOW);
    for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
    s.resources.reputation = 5_000;
    const lab = fileOddities('lab');
    s.flags[`oddity.${lab[0].id}`] = NOW;
    s.flags[`oddity.${lab[1].id}`] = NOW;
    expect(entry(s, 'curiosities').have).toBe(2);

    s.stats.totalNutsEarned = 2_000_000;
    const after = performPrestige(s, 'industrial', NOW);
    expect(isRoomIdUnlocked(after, 'lab')).toBe(false);
    // The lab is closed until it reopens, and its two stay on the board and in the count.
    expect(curiosityBoardRooms(after).find((item) => item.room.id === 'lab')).toMatchObject({
      open: false,
    });
    const shelf = entry(after, 'curiosities');
    expect(shelf.have).toBe(2);
    const open = curiosityBoardRooms(after).filter((item) => item.open);
    const openTotal = open.reduce(
      (sum, item) => sum + curiosityProgress(after, item.room.id).total,
      0,
    );
    expect(shelf.total).toBe(openTotal + lab.length);
    // Nothing can be finished in a closed room: the next word is about an open one.
    if (shelf.next?.roomId) expect(isRoomIdUnlocked(after, shelf.next.roomId)).toBe(true);
    // Rooms never looked into stay behind their doors.
    expect(curiosityBoardRooms(after).some((item) => item.room.id === 'archive')).toBe(false);
  });

  it('counts a set complete only while its pieces stand in its room, as the bonus does', () => {
    const s = createInitialState(NOW);
    s.resources.reputation = 5_000;
    for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
    const set = place(s, 'repair-set');
    expect(entry(s, 'sets').have).toBe(1);
    expect(decorationEnsembles(s).find((item) => item.definition.id === set.id)?.active).toBe(true);

    // Restructured, the workshop closes: the set stops counting, its pieces stay put,
    // and the shelf never points at a set in a room that is closed.
    s.stats.totalNutsEarned = 2_000_000;
    const after = performPrestige(s, 'industrial', NOW);
    expect(entry(after, 'sets').have).toBe(0);
    expect(after.decorationInstances.filter((item) => item.roomId === set.roomId)).toHaveLength(3);
    const next = entry(after, 'sets').next;
    if (next?.roomId) expect(isRoomIdUnlocked(after, next.roomId)).toBe(true);
    // Reopened, it counts again.
    for (const room of ROOMS) if (room.unlock.upgradeId) after.upgrades[room.unlock.upgradeId] = 1;
    after.resources.reputation = 5_000;
    expect(entry(after, 'sets').have).toBe(1);
  });

  it('counts a keepsake once the player knows it, and names no unknown one', () => {
    const s = createInitialState(NOW);
    s.employees.otto = { ...s.employees.otto, hired: true, level: 1, friendship: 30 };
    expect(entry(s, 'keepsakes').have).toBe(0);
    // Pip (the founder starts at friendship 20) can be asked; the shelf names only him.
    expect(entry(s, 'keepsakes').next).toMatchObject({ key: 'keepsakeAsk' });
    expect(Object.keys(entry(s, 'keepsakes').next!)).not.toContain('itemKey');
    s.flags[keepsakeFlag('otto', 'cared')] = NOW;
    expect(keepsakeFor(s, 'otto')).not.toBeNull();
    expect(entry(s, 'keepsakes').have).toBe(1);
  });

  it('reads a mastery the way the Activities screen does, and so do the discoveries', () => {
    const s = createInitialState(NOW);
    s.resources.reputation = 5_000;
    // A record from before the mastery flag existed, above today's line.
    s.microgames.cableUntangle = {
      best: MICRO_CALIBRATION.cableUntangle.mastery,
      plays: 3,
      lastRewardAt: 0,
    };
    expect(isMicroMastered(s, 'cableUntangle')).toBe(true);
    expect(entry(s, 'masteries').have).toBe(1);
    expect(availableFacilityDiscoveries(s).map((item) => item.id)).toContain('security');
  });

  it('collects the outfits bought with a price, never the free ones', () => {
    const s = createInitialState(NOW);
    const special = specialOutfits();
    expect(special.every((item) => item.outfit.cost.amount > 0)).toBe(true);
    expect(entry(s, 'outfits')).toMatchObject({ have: 0, total: special.length });
    s.collections.outfits.push('pip-ceo', 'pip-ceo');
    expect(entry(s, 'outfits').have).toBe(1);
    // The next one named is for someone on the team, at its real price.
    expect(entry(s, 'outfits').next).toMatchObject({ key: 'outfitNext', employeeId: 'pip' });
  });

  it('keeps the size of the Moment Card archive to itself', () => {
    const s = createInitialState(NOW);
    expect(entry(s, 'moments')).toMatchObject({
      have: 0,
      total: null,
      next: { key: 'momentsFirst' },
    });
  });

  it('reads the same after a restructure and a reload', () => {
    const s = createInitialState(NOW);
    s.stats.totalNutsEarned = 2_000_000;
    s.collections.nuts.push('intern-acorn');
    s.collections.outfits.push('pip-ceo');
    s.flags[keepsakeFlag('pip', 'cared')] = NOW;
    s.flags['microgame.coffeeRescue.mastered'] = NOW;
    s.collections.moments.push({
      id: 'card-1',
      eventId: 'annex-broadcast',
      employeeId: null,
      caption: 'x',
      rarity: 'rare',
      createdAt: NOW,
    });
    const after = performPrestige(s, 'industrial', NOW);
    const loaded = gameStateSchema.parse(JSON.parse(JSON.stringify(after))) as unknown as GameState;
    for (const id of ['nuts', 'keepsakes', 'masteries', 'outfits', 'moments'] as const) {
      expect(entry(loaded, id).have).toBe(entry(s, id).have);
    }
  });
});

describe('a damaged list loses the damaged entry, not the collection', () => {
  it('keeps the valid nuts, outfits, secrets and moments of a partly malformed save', () => {
    const s = createInitialState(NOW) as unknown as Record<string, unknown>;
    const raw = JSON.parse(JSON.stringify(s));
    raw.collections.nuts = ['intern-acorn', 42, null, 'intern-acorn', 'founder-acorn'];
    raw.collections.outfits = ['pip-classic', { broken: true }, 'pip-ceo'];
    raw.collections.secrets = ['anomaly.silence', '', 7, 'deco:potted-fern'];
    raw.collections.moments = [
      {
        id: 'a',
        eventId: 'annex-broadcast',
        employeeId: null,
        caption: 'x',
        rarity: 'rare',
        createdAt: 1,
      },
      { id: 'b', eventId: 'broken' },
      {
        id: 'a',
        eventId: 'annex-broadcast',
        employeeId: null,
        caption: 'x',
        rarity: 'rare',
        createdAt: 1,
      },
    ];
    const loaded = gameStateSchema.parse(raw) as unknown as GameState;
    expect(loaded.collections.nuts).toEqual(['intern-acorn', 'founder-acorn']);
    expect(loaded.collections.outfits).toEqual(['pip-classic', 'pip-ceo']);
    expect(loaded.collections.secrets).toEqual(['anomaly.silence', 'deco:potted-fern']);
    expect(loaded.collections.moments.map((card) => card.id)).toEqual(['a']);
  });
});
