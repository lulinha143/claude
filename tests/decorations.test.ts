import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import {
  isDecorationOwned,
  isDecorationPlaced,
  placedAnchorId,
  placedDecorationsInRoom,
  inventoryDecorationsInRoom,
  roomComfort,
  repairDecorations,
} from '../src/sim/decorations';
import { anchorsForRoom } from '../src/content/roomLayout';
import { DECORATIONS_BY_ID } from '../src/content/decorations';

const ROOM = 'founder-desk';

describe('decoration placement model', () => {
  it('auto-places a decoration into a free anchor when bought', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    expect(engine.buyDecoration('potted-fern')).toBe(true);
    expect(isDecorationOwned(engine.state, 'potted-fern')).toBe(true);
    expect(isDecorationPlaced(engine.state, 'potted-fern')).toBe(true);
  });

  it('places, moves, and removes reliably', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    const anchors = anchorsForRoom(ROOM);
    engine.buyDecoration('desk-lamp');

    expect(engine.removeDecoration('desk-lamp')).toBe(true);
    expect(isDecorationPlaced(engine.state, 'desk-lamp')).toBe(false);
    expect(inventoryDecorationsInRoom(engine.state, ROOM).map((d) => d.id)).toContain('desk-lamp');

    const target = anchors[3].id;
    expect(engine.placeDecoration('desk-lamp', target)).toBe(true);
    expect(placedAnchorId(engine.state, 'desk-lamp')).toBe(target);

    const other = anchors[4].id;
    expect(engine.moveDecoration('desk-lamp', other)).toBe(true);
    expect(placedAnchorId(engine.state, 'desk-lamp')).toBe(other);
  });

  it('moving onto an occupied anchor bumps the occupant to storage', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    engine.buyDecoration('desk-lamp');
    const fernAnchor = placedAnchorId(engine.state, 'potted-fern')!;
    expect(engine.placeDecoration('desk-lamp', fernAnchor)).toBe(true);
    expect(placedAnchorId(engine.state, 'desk-lamp')).toBe(fernAnchor);
    expect(isDecorationPlaced(engine.state, 'potted-fern')).toBe(false);
  });

  it('room comfort counts only placed decorations', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    engine.buyDecoration('desk-lamp');
    const expected = DECORATIONS_BY_ID['potted-fern'].moraleBonus + DECORATIONS_BY_ID['desk-lamp'].moraleBonus;
    expect(roomComfort(engine.state, ROOM)).toBe(expected);
    engine.removeDecoration('desk-lamp');
    expect(roomComfort(engine.state, ROOM)).toBe(DECORATIONS_BY_ID['potted-fern'].moraleBonus);
  });

  it('reset places every owned decoration back into the room', () => {
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
    expect(engine.canUndoDecoration()).toBe(false);
    engine.removeDecoration('potted-fern');
    expect(isDecorationPlaced(engine.state, 'potted-fern')).toBe(false);
    expect(engine.undoDecoration()).toBe(true);
    expect(isDecorationPlaced(engine.state, 'potted-fern')).toBe(true);
    expect(engine.redoDecoration()).toBe(true);
    expect(isDecorationPlaced(engine.state, 'potted-fern')).toBe(false);
  });
});

describe('decoration migration + repair', () => {
  it('auto-places legacy owned decorations but respects the old hidden flag', () => {
    const s = createInitialState(0);
    s.collections.secrets.push('deco:potted-fern', 'deco:desk-lamp', 'decohide:desk-lamp');
    repairDecorations(s);
    expect(isDecorationPlaced(s, 'potted-fern')).toBe(true);
    expect(isDecorationPlaced(s, 'desk-lamp')).toBe(false); // stays in storage
    expect(s.collections.secrets.includes('decohide:desk-lamp')).toBe(false); // legacy flag cleared
  });

  it('resolves anchor collisions by moving the extra decoration', () => {
    const s = createInitialState(0);
    s.collections.secrets.push('deco:potted-fern', 'deco:desk-lamp');
    const anchor = anchorsForRoom(ROOM)[0].id;
    s.placements['potted-fern'] = anchor;
    s.placements['desk-lamp'] = anchor; // collision
    repairDecorations(s);
    expect(placedAnchorId(s, 'potted-fern')).toBe(anchor);
    expect(placedAnchorId(s, 'desk-lamp')).not.toBe(anchor);
    expect(isDecorationPlaced(s, 'desk-lamp')).toBe(true);
  });

  it('drops placements for decorations the player does not own', () => {
    const s = createInitialState(0);
    s.placements['potted-fern'] = anchorsForRoom(ROOM)[0].id; // not owned
    repairDecorations(s);
    expect(s.placements['potted-fern']).toBeUndefined();
  });
});
