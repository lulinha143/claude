import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { pointerRegionPlacement } from '../src/sim/placement';
import { decorationInstance, repairDecorationInstances } from '../src/sim/decorations';
import { projectSurfaceType } from '../src/sim/surfaces';
import { migrate } from '../src/save/migrations';
import { SAVE_VERSION } from '../src/sim/config';

// The unified placement model must guarantee: the preview a player sees during
// a drag is EXACTLY what gets saved, for each of the three surfaces; items never
// wander off their one compatible surface; and old saves stored on an
// impossible surface are repaired onto the right one.

const ROOM = 'founder-desk';

function engineWith(...ids: string[]): GameEngine {
  const engine = new GameEngine(createInitialState(0), { deterministic: true });
  engine.state.resources.nuts = 10_000_000;
  engine.state.resources.goldenNuts = 100;
  for (const id of ids) engine.buyDecoration(id);
  return engine;
}

describe('unified region placement: preview matches saved', () => {
  // potted-fern + desk-lamp = floor, motivational-poster = wall, chandelier = ceiling.
  const cases: Array<{ id: string; kind: string; point: { x: number; y: number } }> = [
    { id: 'potted-fern', kind: 'floor', point: { x: 0.4, y: 0.12 } },
    { id: 'desk-lamp', kind: 'floor', point: { x: 0.6, y: 0.1 } },
    { id: 'motivational-poster', kind: 'wall', point: { x: 0.4, y: 0.6 } },
    { id: 'chandelier', kind: 'ceiling', point: { x: 0.5, y: 0.9 } },
  ];

  for (const { id, kind, point } of cases) {
    it(`commits the exact previewed ${kind} placement for ${id}`, () => {
      const engine = engineWith(id);
      const preview = pointerRegionPlacement(engine.state, id, ROOM, point);
      expect(preview, id).not.toBeNull();
      expect(preview!.region.kind, id).toBe(kind);
      expect(preview!.ok, id).toBe(true);

      expect(
        engine.moveDecorationToRoom(
          id,
          ROOM,
          preview!.point.x,
          preview!.point.y,
          preview!.depth,
          preview!.region.kind,
        ),
      ).toBe(true);

      const instance = decorationInstance(engine.state, id)!;
      expect(instance.roomId).toBe(ROOM);
      expect(instance.regionKind).toBe(kind);
      expect(instance.normalizedX).toBeCloseTo(preview!.point.x, 6);
      expect(instance.normalizedY).toBeCloseTo(preview!.point.y, 6);
      expect(instance.depth).toBe(preview!.depth);
      expect(engine.state.placements[id]).toEqual({
        surface: projectSurfaceType(preview!.region.surfaceType),
        x: preview!.point.x,
        y: preview!.point.y,
      });
    });
  }
});

describe('items stay on their one compatible surface while dragging', () => {
  it('keeps a wall item on the wall even when the pointer is over the floor', () => {
    const engine = engineWith('motivational-poster');
    const preview = pointerRegionPlacement(engine.state, 'motivational-poster', ROOM, {
      x: 0.5,
      y: 0.02,
    });
    expect(preview).not.toBeNull();
    expect(preview!.region.kind).toBe('wall');
    expect(preview!.point.y).toBeGreaterThan(0.4);
    expect(preview!.ok).toBe(false);
  });

  it('keeps a floor item on the floor even when the pointer is at the ceiling', () => {
    const engine = engineWith('potted-fern');
    const preview = pointerRegionPlacement(engine.state, 'potted-fern', ROOM, { x: 0.5, y: 0.96 });
    expect(preview).not.toBeNull();
    expect(preview!.region.kind).toBe('floor');
    expect(preview!.point.y).toBeLessThan(0.4);
  });

  it('rejects the commit for an out-of-surface drop without moving the piece', () => {
    const engine = engineWith('motivational-poster');
    const instance = decorationInstance(engine.state, 'motivational-poster')!;
    const before = { x: instance.normalizedX, y: instance.normalizedY, room: instance.roomId };
    expect(engine.moveDecorationToRoom('motivational-poster', ROOM, 0.5, 0.02, 1, 'wall')).toBe(
      false,
    );
    const after = decorationInstance(engine.state, 'motivational-poster')!;
    expect({ x: after.normalizedX, y: after.normalizedY, room: after.roomId }).toEqual(before);
  });

  it('does not let floor items block a wall placement (surfaces are independent)', () => {
    const engine = engineWith('potted-fern', 'motivational-poster');
    engine.moveDecorationToRoom('potted-fern', ROOM, 0.4, 0.12, 3, 'floor');
    const wall = pointerRegionPlacement(engine.state, 'motivational-poster', ROOM, {
      x: 0.4,
      y: 0.6,
    });
    expect(wall?.region.kind).toBe('wall');
    expect(wall?.ok).toBe(true);
  });
});

describe('repairs saves with decorations stored on the wrong surface', () => {
  it('relocates a wall decoration that was persisted on the floor band', () => {
    const engine = engineWith('motivational-poster');
    const instance = decorationInstance(engine.state, 'motivational-poster')!;
    instance.regionKind = undefined;
    instance.surfaceType = 'floor';
    instance.normalizedX = 0.5;
    instance.normalizedY = 0.05;
    engine.state.placements['motivational-poster'] = { surface: 'floor', x: 0.5, y: 0.05 };

    repairDecorationInstances(engine.state);

    const fixed = decorationInstance(engine.state, 'motivational-poster')!;
    expect(fixed.regionKind).toBe('wall');
    expect(fixed.surfaceType).toBe('wall');
    expect(fixed.normalizedY).toBeGreaterThan(0.35);
    expect(engine.state.placements['motivational-poster']?.surface).toBe('wall');
  });

  it('relocates a ceiling decoration that was persisted on the floor', () => {
    const engine = engineWith('chandelier');
    const instance = decorationInstance(engine.state, 'chandelier')!;
    instance.regionKind = undefined;
    instance.surfaceType = 'floor';
    instance.normalizedX = 0.5;
    instance.normalizedY = 0.06;
    engine.state.placements['chandelier'] = { surface: 'floor', x: 0.5, y: 0.06 };

    repairDecorationInstances(engine.state);

    const fixed = decorationInstance(engine.state, 'chandelier')!;
    expect(fixed.regionKind).toBe('ceiling');
    expect(fixed.surfaceType).toBe('ceiling');
    expect(fixed.normalizedY).toBeGreaterThan(0.8);
  });

  it('leaves a correctly placed decoration exactly where it is', () => {
    const engine = engineWith('potted-fern');
    const instance = decorationInstance(engine.state, 'potted-fern')!;
    const snapshot = { x: instance.normalizedX, y: instance.normalizedY, room: instance.roomId };
    repairDecorationInstances(engine.state);
    const after = decorationInstance(engine.state, 'potted-fern')!;
    expect({ x: after.normalizedX, y: after.normalizedY, room: after.roomId }).toEqual(snapshot);
  });
});

describe('v7 -> v8 migration stamps an explicit region kind', () => {
  it('derives regionKind from the catalogue default when absent', () => {
    const migrated = migrate({
      version: 7,
      collections: { secrets: ['deco:chandelier', 'deco:desk-lamp'] },
      decorationInstances: [
        {
          instanceId: 'deco-chandelier-1',
          decorationId: 'chandelier',
          roomId: 'vault',
          surfaceType: 'ceiling',
          normalizedX: 0.5,
          normalizedY: 0.9,
          depth: 6,
        },
        {
          instanceId: 'deco-desk-lamp-1',
          decorationId: 'desk-lamp',
          roomId: null,
          surfaceType: 'floor',
          normalizedX: 0.5,
          normalizedY: 0.06,
          depth: 2,
        },
      ],
    }) as {
      version: number;
      decorationInstances: Array<{ decorationId: string; regionKind?: string }>;
    };

    // `migrate` always runs the chain to the head, so assert against the current
    // SAVE_VERSION rather than a literal that goes stale on every bump.
    expect(migrated.version).toBe(SAVE_VERSION);
    const byId = Object.fromEntries(
      migrated.decorationInstances.map((instance) => [instance.decorationId, instance.regionKind]),
    );
    expect(byId['chandelier']).toBe('ceiling');
    expect(byId['desk-lamp']).toBe('floor');
  });

  it('preserves an already-present regionKind', () => {
    const migrated = migrate({
      version: 7,
      collections: { secrets: ['deco:potted-fern'] },
      decorationInstances: [
        {
          instanceId: 'deco-potted-fern-1',
          decorationId: 'potted-fern',
          roomId: ROOM,
          surfaceType: 'ceiling',
          regionKind: 'ceiling',
          normalizedX: 0.5,
          normalizedY: 0.9,
          depth: 6,
        },
      ],
    }) as { decorationInstances: Array<{ regionKind?: string }> };
    expect(migrated.decorationInstances[0].regionKind).toBe('ceiling');
  });
});
