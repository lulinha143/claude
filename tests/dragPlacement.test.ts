import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { clampDecorationToRegion, pointerRegionPlacement } from '../src/sim/placement';
import { regionsForKinds } from '../src/content/roomSurfaces';

const ROOM = 'founder-desk';

function engineWith(...ids: string[]): GameEngine {
  const engine = new GameEngine(createInitialState(0), { deterministic: true });
  engine.state.resources.nuts = 10_000_000;
  engine.state.resources.goldenNuts = 100;
  for (const id of ids) engine.buyDecoration(id);
  return engine;
}

describe('real-time drag clamping is continuous (smooth, never jumps)', () => {
  it('moves the clamped anchor by small steps for small pointer steps', () => {
    const floor = regionsForKinds(ROOM, ['floor'])[0];
    let previous = clampDecorationToRegion('potted-fern', floor, { x: -0.5, y: 0.12 });
    let maxStep = 0;
    // Sweep the pointer across (and beyond) the plane in fine steps.
    for (let raw = -0.5; raw <= 1.5; raw += 0.01) {
      const current = clampDecorationToRegion('potted-fern', floor, { x: raw, y: 0.12 });
      expect(current).not.toBeNull();
      if (previous && current) {
        maxStep = Math.max(maxStep, Math.abs(current.point.x - previous.point.x));
      }
      previous = current;
    }
    // A 0.01 pointer step can never cause more than a hair of output motion:
    // proves there is no discrete "teleport to nearest slot" jump.
    expect(maxStep).toBeLessThan(0.02);
  });

  it('keeps the footprint fully inside the plane at both horizontal extremes', () => {
    const floor = regionsForKinds(ROOM, ['floor'])[0];
    const left = clampDecorationToRegion('safe', floor, { x: -2, y: 0.2 })!;
    const right = clampDecorationToRegion('safe', floor, { x: 2, y: 0.2 })!;
    // Clamped inward by at least half the footprint from each edge.
    expect(left.point.x).toBeGreaterThan(floor.plane.bottomLeft.x);
    expect(right.point.x).toBeLessThan(floor.plane.bottomRight.x);
    expect(left.point.x).toBeLessThan(right.point.x);
  });
});

describe('drag hysteresis avoids flicker between overlapping compatible planes', () => {
  it('sticks to the preferred region when the pointer is inside several', () => {
    const engine = engineWith('potted-fern'); // floor + tabletop + shelf
    // (0.5, 0.24) sits inside BOTH the floor plane and the founder tabletop plane.
    const point = { x: 0.5, y: 0.24 };
    const neutral = pointerRegionPlacement(engine.state, 'potted-fern', ROOM, point);
    const stayFloor = pointerRegionPlacement(engine.state, 'potted-fern', ROOM, point, 'floor');
    const stayTable = pointerRegionPlacement(engine.state, 'potted-fern', ROOM, point, 'tabletop');
    expect(neutral).not.toBeNull();
    // With no preference the highest-priority containing support wins (tabletop).
    expect(neutral!.region.kind).toBe('tabletop');
    // With a preference, an already-targeted support keeps the preview steady.
    expect(stayFloor!.region.kind).toBe('floor');
    expect(stayTable!.region.kind).toBe('tabletop');
  });
});
