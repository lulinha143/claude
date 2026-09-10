import { describe, it, expect, beforeEach } from 'vitest';
import { employeeSprite, hasEmployeeSprite, EMPLOYEE_SPRITES } from '../src/art/employeeSprites';
import {
  isSpriteUnavailable,
  markSpriteUnavailable,
  resetSpriteAvailability,
} from '../src/art/spriteAvailability';

describe('sprite availability fallback', () => {
  beforeEach(() => {
    resetSpriteAvailability();
  });

  it('returns a registered sprite while its artwork is fine', () => {
    expect(employeeSprite('pip')).toBeDefined();
  });

  it('falls back to the drawn critter once the artwork fails to load', () => {
    const config = EMPLOYEE_SPRITES.pip;
    markSpriteUnavailable(config.src);
    // The animal is still REGISTERED, but the renderer must now choose the SVG.
    expect(hasEmployeeSprite('pip')).toBe(true);
    expect(employeeSprite('pip')).toBeUndefined();
  });

  it('only affects the animal whose asset failed', () => {
    markSpriteUnavailable(EMPLOYEE_SPRITES.pip.src);
    expect(employeeSprite('pip')).toBeUndefined();
    expect(employeeSprite('bea')).toBeDefined();
  });

  it('is idempotent', () => {
    const src = EMPLOYEE_SPRITES.bea.src;
    markSpriteUnavailable(src);
    markSpriteUnavailable(src);
    expect(isSpriteUnavailable(src)).toBe(true);
  });

  it('reports unknown employees as having no sprite', () => {
    expect(employeeSprite('not-an-animal')).toBeUndefined();
    expect(hasEmployeeSprite('not-an-animal')).toBe(false);
  });

  it('can be reset', () => {
    markSpriteUnavailable(EMPLOYEE_SPRITES.pip.src);
    resetSpriteAvailability();
    expect(employeeSprite('pip')).toBeDefined();
  });
});
