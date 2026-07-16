import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import {
  isDecorationOwned,
  isDecorationPlaced,
  placedPlacement,
  placedDecorationsInRoom,
  inventoryDecorationsInRoom,
  roomComfort,
  repairDecorations,
} from '../src/sim/decorations';
import { decorationSurface, SURFACE_BANDS } from '../src/sim/surfaces';
import { DECORATIONS_BY_ID } from '../src/content/decorations';

const ROOM = 'founder-desk';

describe('decoration surfaces + free placement', () => {
  it('derives surfaces from the decoration (floor vs wall vs ceiling)', () => {
    expect(decorationSurface('potted-fern')).toBe('floor');
    expect(decorationSurface('desk-lamp')).toBe('floor');
    expect(decorationSurface('motivational-poster')).toBe('wall');
    expect(decorationSurface('window-view')).toBe('wall');
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
});
