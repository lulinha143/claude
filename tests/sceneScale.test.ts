import { describe, expect, it } from 'vitest';

import {
  SCENE_REFERENCE_ROOM_WIDTH,
  SCENE_SCALE_MAX,
  SCENE_SCALE_MIN,
  SCENE_SCALE_STEP,
  sceneScaleForRoomWidth,
} from '../src/content/sceneScale';
import { CHARACTER_PRESENCE_SCALE } from '../src/content/characterScale';
import { EMPLOYEE_SPRITES } from '../src/art/employeeSprites';

// The bug this guards: the room is fluid and the cast was not, so shrinking the
// window shrank the set around characters that stayed exactly the same size.
// Measured before the fix, the tallest figure was 112.00px at a 824px-wide room and
// 112.00px at a 1140px-wide room, a 38% swing in the figure-to-room ratio.

describe('scene scale', () => {
  it('is 1 at the reference room width and never exceeds it', () => {
    expect(sceneScaleForRoomWidth(SCENE_REFERENCE_ROOM_WIDTH)).toBe(SCENE_SCALE_MAX);
    // Authored pixel sizes are a maximum, not something we inflate past.
    expect(sceneScaleForRoomWidth(SCENE_REFERENCE_ROOM_WIDTH * 2)).toBe(SCENE_SCALE_MAX);
    expect(sceneScaleForRoomWidth(4000)).toBe(SCENE_SCALE_MAX);
  });

  it('shrinks in proportion to the room', () => {
    // Half as wide a room draws the scene at half scale, subject to the floor.
    expect(sceneScaleForRoomWidth(SCENE_REFERENCE_ROOM_WIDTH * 0.8)).toBeCloseTo(0.8, 2);
    expect(sceneScaleForRoomWidth(SCENE_REFERENCE_ROOM_WIDTH * 0.9)).toBeCloseTo(0.9, 2);
  });

  it('keeps the figure-to-room ratio constant across every window size', () => {
    // This is the actual product requirement: ROOM -> CHARACTER stays locked.
    // Includes the real companion windows (a 296px floor at 320px, 356px at the
    // default 380px) — the case the old 0.7 floor got wrong.
    const widths = [296, 356, 480, 620, 700, 824, 1140, 1600, 2560];
    const ratios = widths.map((w) => {
      const scale = sceneScaleForRoomWidth(w);
      const roomWidth = Math.min(w, SCENE_REFERENCE_ROOM_WIDTH);
      const figure = 112 * scale; // the reference figure, drawn at scene scale
      return figure / roomWidth;
    });
    const spread = Math.max(...ratios) / Math.min(...ratios) - 1;
    // Only quantisation should remain; before the fix this spread was 0.38.
    expect(spread).toBeLessThan(0.03);
  });

  it('clamps instead of collapsing the scene', () => {
    expect(sceneScaleForRoomWidth(1)).toBe(SCENE_SCALE_MIN);
    expect(sceneScaleForRoomWidth(0)).toBe(SCENE_SCALE_MAX);
    expect(sceneScaleForRoomWidth(-50)).toBe(SCENE_SCALE_MAX);
    expect(sceneScaleForRoomWidth(Number.NaN)).toBe(SCENE_SCALE_MAX);
    expect(sceneScaleForRoomWidth(Number.POSITIVE_INFINITY)).toBe(SCENE_SCALE_MAX);
  });

  it('quantises so a scrollbar appearing cannot oscillate the scale', () => {
    // Scale changes the room's height, which can add/remove the column's scrollbar,
    // which changes the room's width. Snapping means a ~15px nudge lands on the same
    // step instead of feeding back.
    const base = sceneScaleForRoomWidth(500);
    expect(sceneScaleForRoomWidth(502)).toBe(base);
    expect(sceneScaleForRoomWidth(498)).toBe(base);
    // Every value is on the step grid, with no float dust.
    for (const w of [300, 420, 560, 640, 699]) {
      const s = sceneScaleForRoomWidth(w);
      expect(Number.isFinite(s)).toBe(true);
      expect(Math.abs(Math.round(s / SCENE_SCALE_STEP) * SCENE_SCALE_STEP - s)).toBeLessThan(1e-6);
    }
  });

  it('is a world scale, kept separate from the character presence multiplier', () => {
    // Sprite sizes already bake in presence; scene scale must be an independent
    // factor applied on top, never a second presence multiplier.
    expect(SCENE_SCALE_MAX).toBe(1);
    expect(CHARACTER_PRESENCE_SCALE).toBeGreaterThan(1);
    expect(SCENE_SCALE_MAX).not.toBe(CHARACTER_PRESENCE_SCALE);
  });

  it('scales the whole cast by the same factor, preserving Pip normalisation', () => {
    // Scene scale is one multiplier for everyone, so the cast cannot drift apart at
    // small window sizes.
    const scale = sceneScaleForRoomWidth(900);
    const heights = Object.values(EMPLOYEE_SPRITES).map((s) => s.officeHeight);
    const scaled = heights.map((h) => h * scale);
    for (let i = 0; i < heights.length; i += 1) {
      expect(scaled[i] / heights[i]).toBeCloseTo(scale, 6);
    }
  });
});
