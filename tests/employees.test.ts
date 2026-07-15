import { describe, it, expect } from 'vitest';
import { EMPLOYEES, EMPLOYEES_BY_ID } from '../src/content/employees';
import { CRITTER_SHAPES } from '../src/art/critterShapes';
import { DIALOGUE_COUNTS } from '../src/content/dialogue';
import { ROOMS_BY_ID } from '../src/content/rooms';
import en from '../src/i18n/locales/en.json';
import ptBR from '../src/i18n/locales/pt-BR.json';

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

describe('employee roster', () => {
  it('has at least 12 fully-defined employees with unique ids', () => {
    expect(EMPLOYEES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(EMPLOYEES.map((e) => e.id)).size).toBe(EMPLOYEES.length);
  });

  it('every employee has art, a valid room, a dialogue category, and outfits', () => {
    for (const def of EMPLOYEES) {
      expect(CRITTER_SHAPES[def.id], `${def.id} missing species`).toBeTruthy();
      expect(ROOMS_BY_ID[def.room], `${def.id} invalid room ${def.room}`).toBeTruthy();
      expect(DIALOGUE_COUNTS[def.dialogueCategory], `${def.id} dialogue`).toBeGreaterThan(0);
      expect(def.outfits.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every employee name/role/story/goal key is translated in EN and PT-BR', () => {
    for (const def of EMPLOYEES) {
      for (const key of [def.nameKey, def.fullNameKey, def.roleKey, def.storyKey, def.goalKey]) {
        expect(get(en, key), `EN missing ${key}`).toBeTruthy();
        expect(get(ptBR, key), `PT-BR missing ${key}`).toBeTruthy();
      }
    }
  });

  it('includes the six new second-wave animals', () => {
    for (const id of ['nixie', 'otto', 'hazel', 'junie', 'moss', 'fenn']) {
      expect(EMPLOYEES_BY_ID[id], `missing ${id}`).toBeTruthy();
    }
  });
});
