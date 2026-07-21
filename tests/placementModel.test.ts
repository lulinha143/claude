import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { pointerRegionPlacement } from '../src/sim/placement';
import { decorationInstance, repairDecorationInstances } from '../src/sim/decorations';
import { projectSurfaceType } from '../src/sim/surfaces';
import { migrate } from '../src/save/migrations';

// The unified placement model must guarantee: the preview a player sees during
// a drag is EXACTLY what gets saved, for every category; items never wander off
// their compatible support; and old saves stored on an impossible surface are
// repaired onto a valid one.

const ROOM = 'founder-desk';

function engineWith(...ids: string[]): GameEngine {
  const engine = new GameEngine(createInitialState(0), { deterministic: true });
  engine.state.resources.nuts = 10_000_000;
  engine.state.resources.goldenNuts = 100;
  for (const id of ids) engine.buyDecoration(id);
  return engine;
}

describe('unified region placement: preview matches saved', () => {
  // desk-lamp = tabletop, conveyor-plushie = shelf, motivational-poster = wall,
  // chandelier = ceiling-rail, potted-fern = floor.
  const cases: Array<{ id: string; kind: string; point: { x: number; y: number } }> = [
    { id: 'potted-fern', kind: 'floor', point: { x: 0.4, y: 0.12 } },
    { id: 'motivational-poster', kind: 'wall', point: { x: 0.4, y: 0.6 } },
    { id: 'chandelier', kind: 'ceiling-rail', point: { x: 0.5, y: 0.9 } },
    { id: 'desk-lamp', kind: 'tabletop', point: { x: 0.5, y: 0.24 } },
    { id: 'conveyor-plushie', kind: 'shelf', point: { x: 0.22, y: 0.6 } },
  ];

  for (const { id, kind, point } of cases) {
    it(`commits the exact previewed ${kind} placement for ${id}`, () => {
      const engine = engineWith(id);
      const preview = pointerRegionPlacement(engine.state, id, ROOM, point);
      expect(preview, id).not.toBeNull();
      expect(preview!.region.kind, id).toBe(kind);
      expect(preview!.ok, id).toBe(true);

      // Commit through the same region kind the preview resolved.
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
      // The rendered projection mirrors the authoritative point exactly.
      expect(engine.state.placements[id]).toEqual({
        surface: projectSurfaceType(preview!.region.surfaceType),
        x: preview!.point.x,
        y: preview!.point.y,
      });
    });
  }
});

describe('items stay on their compatible support while dragging', () => {
  it('keeps a wall item on the wall even when the pointer is over the floor', () => {
    const engine = engineWith('motivational-poster');
    const preview = pointerRegionPlacement(engine.state, 'motivational-poster', ROOM, {
      x: 0.5,
      y: 0.02,
    });
    expect(preview).not.toBeNull();
    expect(preview!.region.kind).toBe('wall');
    // Clamped up onto the wall plane; a drop here is invalid and rolls back.
    expect(preview!.point.y).toBeGreaterThan(0.35);
    expect(preview!.ok).toBe(false);
  });

  it('keeps a floor item on the floor even when the pointer is at the ceiling', () => {
    const engine = engineWith('potted-fern');
    const preview = pointerRegionPlacement(engine.state, 'potted-fern', ROOM, { x: 0.5, y: 0.96 });
    expect(preview).not.toBeNull();
    expect(preview!.region.kind).toBe('floor');
    expect(preview!.point.y).toBeLessThan(0.4);
  });

  it('rejects the commit for an out-of-support drop without moving the piece', () => {
    const engine = engineWith('motivational-poster');
    const instance = decorationInstance(engine.state, 'motivational-poster')!;
    const before = { x: instance.normalizedX, y: instance.normalizedY, room: instance.roomId };
    // Force a wall commit at a floor point → invalid → engine refuses.
    expect(engine.moveDecorationToRoom('motivational-poster', ROOM, 0.5, 0.02, 1, 'wall')).toBe(
      false,
    );
    const after = decorationInstance(engine.state, 'motivational-poster')!;
    expect({ x: after.normalizedX, y: after.normalizedY, room: after.roomId }).toEqual(before);
  });
});

describe('repairs saves with decorations stored on the wrong surface', () => {
  it('relocates a wall decoration that was persisted on the floor band', () => {
    const engine = engineWith('motivational-poster');
    const instance = decorationInstance(engine.state, 'motivational-poster')!;
    // Simulate a legacy/broken save: a wall poster stored low on the floor.
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
    }) as { version: number; decorationInstances: Array<{ decorationId: string; regionKind?: string }> };

    expect(migrated.version).toBe(8);
    const byId = Object.fromEntries(
      migrated.decorationInstances.map((instance) => [instance.decorationId, instance.regionKind]),
    );
    expect(byId['chandelier']).toBe('ceiling-rail');
    expect(byId['desk-lamp']).toBe('tabletop');
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
          surfaceType: 'floor',
          regionKind: 'shelf',
          normalizedX: 0.5,
          normalizedY: 0.6,
          depth: 2,
        },
      ],
    }) as { decorationInstances: Array<{ regionKind?: string }> };
    expect(migrated.decorationInstances[0].regionKind).toBe('shelf');
  });
});
