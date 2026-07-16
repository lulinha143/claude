import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { roomAffinity, affinityMultiplier, affinityPercent } from '../src/sim/affinity';
import { computeProduction } from '../src/sim/economy';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import { ROOMS } from '../src/content/rooms';
import type { GameState } from '../src/sim/types';
import { isRoomIdUnlocked } from '../src/sim/rooms';

function unlockAllRooms(s: GameState) {
  s.resources.reputation = 1e9;
  for (const r of ROOMS) if (r.unlock.upgradeId) s.upgrades[r.unlock.upgradeId] = 1;
}

describe('room specialization / affinity', () => {
  it('an employee favours their home department, dislikes clashing rooms', () => {
    const home = EMPLOYEES_BY_ID.mina.room; // 'research'
    expect(roomAffinity('mina', home)).toBe('favorite');
    expect(affinityMultiplier('mina', home)).toBeCloseTo(1.25, 5);
    expect(affinityPercent('mina', home)).toBe(25);
    // research clashes with construction
    expect(roomAffinity('mina', 'construction')).toBe('disliked');
    expect(affinityPercent('mina', 'construction')).toBe(-15);
    // a neutral room
    expect(roomAffinity('mina', 'marketing')).toBe('acceptable');
    expect(affinityPercent('mina', 'marketing')).toBe(0);
  });

  it('production reflects the room specialization multiplier', () => {
    const favorite = createInitialState(0);
    unlockAllRooms(favorite);
    favorite.employees.mina.hired = true;
    favorite.employees.mina.level = 5;
    favorite.employees.mina.room = 'research'; // favourite (+25%)

    const disliked = createInitialState(0);
    unlockAllRooms(disliked);
    disliked.employees.mina.hired = true;
    disliked.employees.mina.level = 5;
    disliked.employees.mina.room = 'construction'; // disliked (-15%)

    const favEngine = new GameEngine(favorite, { deterministic: true });
    const disEngine = new GameEngine(disliked, { deterministic: true });
    // sanity: the rooms actually resolved as intended
    expect(isRoomIdUnlocked(favEngine.state, 'research')).toBe(true);
    expect(isRoomIdUnlocked(disEngine.state, 'construction')).toBe(true);
    const favNps = computeProduction(favEngine.state, false).nutsPerSecond;
    const disNps = computeProduction(disEngine.state, false).nutsPerSecond;
    expect(favNps).toBeGreaterThan(disNps);
  });

  it('unknown employees and neutral rooms are safe (multiplier 1)', () => {
    expect(affinityMultiplier('does-not-exist', 'research')).toBe(1);
    expect(affinityMultiplier('pip', 'lab')).toBe(1); // founder has no dislikes
  });
});
