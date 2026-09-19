import { describe, expect, it } from 'vitest';
import { EMPLOYEES } from '../src/content/employees';
import { GIFT_PREFERENCES } from '../src/content/employeeGifts';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { SaveManager } from '../src/save/saveManager';
import { performPrestige } from '../src/sim/prestige';

describe('personal gifts and quiet visits', () => {
  it.each(EMPLOYEES)(
    '$id remembers their own preferred gift without duplicating keepsakes',
    (employee) => {
      let now = 1000;
      const state = createInitialState(now);
      state.employees[employee.id].hired = true;
      state.resources.nuts = 10000;
      state.resources.goldenNuts = 10;
      const engine = new GameEngine(state, { deterministic: true, now: () => now });
      const preference = GIFT_PREFERENCES[employee.id];
      expect(preference).toBeDefined();
      expect(engine.openTalk(employee.id, 'gift')).toBe(true);
      const before = state.employees[employee.id].friendship;
      expect(engine.chooseTalkOption(preference)).toBe(true);
      expect(engine.activeTalk?.lastReplyKey).toBe(`gifts.reactions.${employee.id}`);
      expect(state.employees[employee.id].friendship).toBeGreaterThan(before);
      expect(state.collections.moments.filter((card) => card.eventId === 'talk:gift')).toHaveLength(
        1,
      );
      engine.closeTalk();
      expect(engine.openTalk(employee.id, 'gift')).toBe(false);
      expect(engine.openTalk(employee.id, undefined, true)).toBe(true);
      expect(engine.activeTalk?.profileOnly).toBe(true);
      const snapshot = JSON.stringify(state);
      expect(engine.chooseTalkOption(preference)).toBe(false);
      expect(JSON.stringify(state)).toBe(snapshot);
      engine.closeTalk();
      now += 121000;
      expect(engine.openTalk(employee.id, 'gift')).toBe(true);
      expect(engine.chooseTalkOption(preference)).toBe(true);
      expect(state.collections.moments.filter((card) => card.eventId === 'talk:gift')).toHaveLength(
        1,
      );
      const saves = new SaveManager({
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      });
      expect(saves.importSave(JSON.stringify(state)).ok).toBe(true);
      state.stats.totalNutsEarned = 1e9;
      const next = performPrestige(state, 'industrial', now);
      expect(next.flags[`favorite.${employee.id}.giftMemory`]).toBe(1000);
    },
  );
});
