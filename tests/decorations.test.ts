import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import {
  isDecorationOwned,
  isDecorationPlaced,
  decorationRoom,
  placedPlacement,
  placedDecorationsInRoom,
  inventoryDecorationsInRoom,
  roomComfort,
  repairDecorations,
  repairDecorationInstances,
  auditDecorationState,
} from '../src/sim/decorations';
import { decorationSurface, SURFACE_BANDS } from '../src/sim/surfaces';
import { DECORATIONS, DECORATIONS_BY_ID, auditDecorationCatalog } from '../src/content/decorations';
import { ROOMS } from '../src/content/rooms';

const ROOM = 'founder-desk';

describe('decoration surfaces + free placement', () => {
  it('reads the canonical surface declared by each decoration', () => {
    expect(decorationSurface('potted-fern')).toBe('floor');
    expect(decorationSurface('desk-lamp')).toBe('floor');
    expect(decorationSurface('motivational-poster')).toBe('wall');
    expect(decorationSurface('window-view')).toBe('wall');
    expect(decorationSurface('billboard')).toBe('floor');
    expect(decorationSurface('star-ceiling')).toBe('ceiling');
    expect(decorationSurface('chandelier')).toBe('ceiling');
  });

  it('auto-places a decoration on its surface when bought', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    expect(engine.buyDecoration('potted-fern')).toBe(true);
    expect(isDecorationOwned(engine.state, 'potted-fern')).toBe(true);
    const p = placedPlacement(engine.state, 'potted-fern')!;
    expect(p).toBeTruthy();
    expect(p.surface).toBe('floor');
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(1);
  });

  it('lets the player choose a free position, clamped to the surface band', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('motivational-poster'); // a WALL decoration
    // try to drop it on the floor (y≈0.02): it must snap up into the wall band
    expect(engine.moveDecoration('motivational-poster', 0.7, 0.02)).toBe(true);
    const p = placedPlacement(engine.state, 'motivational-poster')!;
    expect(p.surface).toBe('wall');
    expect(p.x).toBeCloseTo(0.7, 5);
    expect(p.y).toBeGreaterThanOrEqual(SURFACE_BANDS.wall.min);
    expect(p.y).toBeLessThanOrEqual(SURFACE_BANDS.wall.max);
  });

  it('a floor decoration cannot be pushed onto the wall/ceiling', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    engine.moveDecoration('potted-fern', 0.5, 0.95); // aim for the ceiling
    const p = placedPlacement(engine.state, 'potted-fern')!;
    expect(p.surface).toBe('floor');
    expect(p.y).toBeLessThanOrEqual(SURFACE_BANDS.floor.max);
  });

  it('places, moves and removes reliably; positions persist', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('desk-lamp');
    expect(engine.removeDecoration('desk-lamp')).toBe(true);
    expect(isDecorationPlaced(engine.state, 'desk-lamp')).toBe(false);
    expect(inventoryDecorationsInRoom(engine.state, ROOM).map((d) => d.id)).toContain('desk-lamp');

    expect(engine.moveDecoration('desk-lamp', 0.3, 0.1)).toBe(true);
    const p = placedPlacement(engine.state, 'desk-lamp')!;
    expect(p.x).toBeCloseTo(0.3, 5);
  });

  it('room comfort counts only placed decorations', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    engine.buyDecoration('desk-lamp');
    const expected =
      DECORATIONS_BY_ID['potted-fern'].moraleBonus + DECORATIONS_BY_ID['desk-lamp'].moraleBonus;
    expect(roomComfort(engine.state, ROOM)).toBe(expected);
    engine.removeDecoration('desk-lamp');
    expect(roomComfort(engine.state, ROOM)).toBe(DECORATIONS_BY_ID['potted-fern'].moraleBonus);
  });

  it('reset re-places every owned decoration in the room', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    engine.buyDecoration('desk-lamp');
    engine.removeDecoration('potted-fern');
    engine.removeDecoration('desk-lamp');
    expect(placedDecorationsInRoom(engine.state, ROOM).length).toBe(0);
    expect(engine.resetRoomDecorations(ROOM)).toBe(true);
    expect(placedDecorationsInRoom(engine.state, ROOM).length).toBe(2);
    expect(engine.state.decorationInstances.every((instance) => instance.roomId === ROOM)).toBe(true);
  });

  it('supports undo and redo of placement changes', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    const before = { ...placedPlacement(engine.state, 'potted-fern')! };
    engine.moveDecoration('potted-fern', 0.8, 0.2);
    expect(placedPlacement(engine.state, 'potted-fern')!.x).toBeCloseTo(0.8, 5);
    expect(engine.undoDecoration()).toBe(true);
    expect(placedPlacement(engine.state, 'potted-fern')!.x).toBeCloseTo(before.x, 5);
    expect(engine.redoDecoration()).toBe(true);
    expect(placedPlacement(engine.state, 'potted-fern')!.x).toBeCloseTo(0.8, 5);
  });

  it('moves across unlocked rooms with stable identity and room-aware undo/redo', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.state.resources.reputation = 10; // unlock Morale Corner
    engine.buyDecoration('potted-fern');
    const instanceId = engine.state.decorationInstances[0].instanceId;

    expect(engine.moveDecorationToRoom('potted-fern', 'morale', 0.72, 0.08)).toBe(true);
    expect(decorationRoom(engine.state, 'potted-fern')).toBe('morale');
    expect(placedDecorationsInRoom(engine.state, ROOM)).toHaveLength(0);
    expect(placedDecorationsInRoom(engine.state, 'morale').map((item) => item.def.id)).toContain('potted-fern');
    expect(roomComfort(engine.state, ROOM)).toBe(0);
    expect(roomComfort(engine.state, 'morale')).toBe(DECORATIONS_BY_ID['potted-fern'].moraleBonus);
    expect(engine.state.decorationInstances[0].instanceId).toBe(instanceId);

    expect(engine.undoDecoration()).toBe(true);
    expect(decorationRoom(engine.state, 'potted-fern')).toBe(ROOM);
    expect(engine.redoDecoration()).toBe(true);
    expect(decorationRoom(engine.state, 'potted-fern')).toBe('morale');
    expect(engine.state.decorationInstances[0].instanceId).toBe(instanceId);
  });

  it('rejects locked or incompatible room moves without changing arrangement', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    const before = structuredClone(engine.state.decorationInstances[0]);
    const beforePlacement = structuredClone(engine.state.placements['potted-fern']);
    expect(engine.moveDecorationToRoom('potted-fern', 'lab', 0.5, 0.1)).toBe(false);
    expect(engine.moveDecorationToRoom('potted-fern', 'not-a-room', 0.5, 0.1)).toBe(false);
    expect(decorationRoom(engine.state, 'potted-fern')).toBe(ROOM);
    expect(engine.state.decorationInstances[0]).toEqual(before);
    expect(engine.state.placements['potted-fern']).toEqual(beforePlacement);
  });

  it('moves every ordinary decoration to every compatible room without losing metadata', () => {
    for (const def of DECORATIONS.filter((item) => !item.isStructural)) {
      const state = createInitialState(0);
      state.resources.reputation = Number.MAX_SAFE_INTEGER;
      for (const room of ROOMS) {
        if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
      }
      const engine = new GameEngine(state, { deterministic: true });
      expect(engine.buyDecoration(def.id), def.id).toBe(true);
      const instance = engine.state.decorationInstances.find((item) => item.decorationId === def.id)!;
      instance.interactionState = { visits: 3, active: true };
      instance.variantId = 'test-variant';
      const stableId = instance.instanceId;

      for (const roomId of def.compatibleRooms) {
        const position =
          def.defaultRegionKind === 'floor'
            ? { x: 0.73, y: 0.12 }
            : def.defaultRegionKind === 'wall'
              ? { x: 0.73, y: 0.6 }
              : { x: 0.73, y: 0.9 };
        expect(
          engine.moveDecorationToRoom(def.id, roomId, position.x, position.y),
          `${def.id} -> ${roomId}`,
        ).toBe(true);
        expect(instance).toMatchObject({
          instanceId: stableId,
          roomId,
          surfaceType: decorationSurface(def.id),
          interactionState: { visits: 3, active: true },
          variantId: 'test-variant',
        });
      }
    }
  });

  it('audits ordinary decorations for unexplained hard-coded room locks', () => {
    expect(auditDecorationCatalog()).toEqual([]);
    const allRooms = new Set(ROOMS.map((room) => room.id));
    for (const def of DECORATIONS.filter((item) => !item.isStructural)) {
      expect(new Set(def.compatibleRooms), def.id).toEqual(allRooms);
    }
  });

  it('preserves interaction state through room transfer, undo, storage, and re-placement', () => {
    const state = createInitialState(0);
    state.resources.reputation = 10;
    const engine = new GameEngine(state, { deterministic: true });
    engine.buyDecoration('potted-fern');
    const instance = engine.state.decorationInstances[0];
    instance.interactionState = { watered: true, reactions: 4 };

    engine.moveDecorationToRoom('potted-fern', 'morale', 0.7, 0.08);
    expect(instance.interactionState).toEqual({ watered: true, reactions: 4 });
    engine.undoDecoration();
    expect(instance.interactionState).toEqual({ watered: true, reactions: 4 });
    engine.redoDecoration();
    expect(decorationRoom(engine.state, 'potted-fern')).toBe('morale');
    engine.removeDecoration('potted-fern');
    expect(instance.roomId).toBeNull();
    expect(instance.interactionState).toEqual({ watered: true, reactions: 4 });
    engine.placeDecorationInRoom('potted-fern', 'morale');
    expect(instance.roomId).toBe('morale');
    expect(instance.interactionState).toEqual({ watered: true, reactions: 4 });
  });

  it('keeps a stable instance id while moving to inventory and placing again', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    const originalId = engine.state.decorationInstances[0].instanceId;
    engine.moveDecoration('potted-fern', 0.8, 0.2);
    expect(engine.state.decorationInstances[0]).toMatchObject({
      instanceId: originalId,
      roomId: ROOM,
      normalizedX: 0.8,
    });
    engine.removeDecoration('potted-fern');
    expect(engine.state.decorationInstances[0].roomId).toBeNull();
    engine.placeDecoration('potted-fern');
    expect(engine.state.decorationInstances[0].instanceId).toBe(originalId);
    expect(engine.state.decorationInstances[0].roomId).toBe(ROOM);
  });

  it('marks every existing decoration ordinary and cross-room compatible', () => {
    for (const def of DECORATIONS) {
      expect(def.isStructural, def.id).toBe(false);
      expect(def.compatibleRooms.length, def.id).toBeGreaterThan(1);
      expect(def.compatibleRooms, def.id).toContain(def.room);
      expect(def.compatibleSurfaces.length, def.id).toBeGreaterThan(0);
    }
  });

  it('persists arrangement changes immediately (survives a quick reload)', () => {
    // A deliberate arrangement must be saved right away, exactly like an
    // employee room move — otherwise a quick reload before the periodic
    // autosave loses the new positions. Each mutation must fire the save hook.
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    let saves = 0;
    engine.onSave(() => {
      saves += 1;
    });
    engine.moveDecoration('potted-fern', 0.8, 0.2);
    expect(saves).toBe(1);
    engine.removeDecoration('potted-fern');
    expect(saves).toBe(2);
    engine.placeDecoration('potted-fern');
    expect(saves).toBe(3);
    engine.undoDecoration();
    expect(saves).toBe(4);
    engine.redoDecoration();
    expect(saves).toBe(5);
    engine.resetRoomDecorations(ROOM);
    expect(saves).toBe(6);
  });
});

describe('decoration migration + repair', () => {
  it('auto-places legacy owned decorations but respects the old hidden flag', () => {
    const s = createInitialState(0);
    s.placements = {};
    s.collections.secrets.push('deco:potted-fern', 'deco:desk-lamp', 'decohide:desk-lamp');
    repairDecorations(s);
    expect(isDecorationPlaced(s, 'potted-fern')).toBe(true);
    expect(isDecorationPlaced(s, 'desk-lamp')).toBe(false); // stays in storage
    expect(s.collections.secrets.includes('decohide:desk-lamp')).toBe(false); // legacy flag cleared
  });

  it('drops placements for decorations the player does not own', () => {
    const s = createInitialState(0);
    s.placements = { 'potted-fern': { surface: 'floor', x: 0.5, y: 0.06 } }; // not owned
    repairDecorations(s);
    expect(s.placements['potted-fern']).toBeUndefined();
  });

  it('repairs out-of-bounds / wrong-surface coordinates in-place', () => {
    const s = createInitialState(0);
    s.collections.secrets.push('deco:motivational-poster');
    // a wall decoration wrongly stored on the floor, off the right edge
    s.placements = { 'motivational-poster': { surface: 'floor', x: 5, y: 0.01 } };
    repairDecorations(s);
    const p = s.placements['motivational-poster'];
    expect(p.surface).toBe('wall');
    expect(p.x).toBeLessThanOrEqual(0.96);
    expect(p.y).toBeGreaterThanOrEqual(SURFACE_BANDS.wall.min);
  });

  it('audits and deterministically repairs ownership, identity, and projection conflicts', () => {
    const s = createInitialState(0);
    s.collections.secrets.push('deco:potted-fern', 'deco:potted-fern');
    s.placements['potted-fern'] = { surface: 'floor', x: 0.5, y: 0.06 };
    s.decorationInstances = [
      {
        instanceId: 'duplicate-id',
        decorationId: 'potted-fern',
        roomId: 'not-a-room',
        surfaceType: 'wall',
        normalizedX: 4,
        normalizedY: -2,
        depth: Number.NaN,
      },
      {
        instanceId: 'duplicate-id',
        decorationId: 'potted-fern',
        roomId: ROOM,
        surfaceType: 'floor',
        normalizedX: 0.4,
        normalizedY: 0.1,
        depth: 2,
      },
    ];

    const before = new Set(auditDecorationState(s).map((issue) => issue.code));
    for (const code of [
      'duplicate-ownership',
      'duplicate-instance-id',
      'duplicate-decoration-instance',
      'invalid-instance-room',
      'incompatible-instance-surface',
      'invalid-instance-coordinates',
      'invalid-instance-depth',
    ] as const) {
      expect(before).toContain(code);
    }

    expect(repairDecorationInstances(s)).toContain('potted-fern');
    expect(s.collections.secrets.filter((item) => item === 'deco:potted-fern')).toHaveLength(1);
    expect(s.decorationInstances).toHaveLength(1);
    expect(s.decorationInstances[0]).toMatchObject({
      instanceId: 'duplicate-id',
      decorationId: 'potted-fern',
      roomId: null,
      surfaceType: 'floor',
      normalizedX: 0.96,
      normalizedY: SURFACE_BANDS.floor.min,
    });
    expect(s.placements['potted-fern']).toBeUndefined();
    expect(auditDecorationState(s)).toEqual([]);
  });

  it('recovers ownership from a valid orphan instance instead of deleting the purchase', () => {
    const s = createInitialState(0);
    s.decorationInstances = [
      {
        instanceId: 'deco-desk-lamp-1',
        decorationId: 'desk-lamp',
        roomId: null,
        surfaceType: 'floor',
        normalizedX: 0.5,
        normalizedY: 0.06,
        depth: 2,
      },
    ];
    expect(auditDecorationState(s).map((issue) => issue.code)).toContain('unowned-instance');
    repairDecorationInstances(s);
    expect(isDecorationOwned(s, 'desk-lamp')).toBe(true);
    expect(s.decorationInstances[0].instanceId).toBe('deco-desk-lamp-1');
    expect(auditDecorationState(s)).toEqual([]);
  });
});
