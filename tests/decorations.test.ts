import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import {
  isDecorationOwned,
  isDecorationHidden,
  ownedDecorationsInRoom,
  visibleDecorationsInRoom,
  roomComfort,
} from '../src/sim/decorations';
import { DECORATIONS_BY_ID } from '../src/content/decorations';

describe('interactive decorations', () => {
  it('an owned decoration is visible in its room', () => {
    const s = createInitialState(0);
    s.collections.secrets.push('deco:potted-fern');
    expect(isDecorationOwned(s, 'potted-fern')).toBe(true);
    const room = DECORATIONS_BY_ID['potted-fern'].room;
    expect(visibleDecorationsInRoom(s, room).map((d) => d.id)).toContain('potted-fern');
  });

  it('hiding keeps ownership but removes it from the visible set', () => {
    const s = createInitialState(0);
    const engine = new GameEngine(s, { deterministic: true });
    engine.state.collections.secrets.push('deco:desk-lamp');
    const room = DECORATIONS_BY_ID['desk-lamp'].room;
    engine.toggleDecoration('desk-lamp'); // hide
    expect(isDecorationHidden(engine.state, 'desk-lamp')).toBe(true);
    expect(isDecorationOwned(engine.state, 'desk-lamp')).toBe(true);
    expect(visibleDecorationsInRoom(engine.state, room).map((d) => d.id)).not.toContain('desk-lamp');
    // still owned = still listed in owned set
    expect(ownedDecorationsInRoom(engine.state, room).map((d) => d.id)).toContain('desk-lamp');
    engine.toggleDecoration('desk-lamp'); // show again
    expect(isDecorationHidden(engine.state, 'desk-lamp')).toBe(false);
  });

  it('room comfort sums the morale bonuses of visible decorations', () => {
    const s = createInitialState(0);
    s.collections.secrets.push('deco:potted-fern', 'deco:desk-lamp');
    const room = DECORATIONS_BY_ID['potted-fern'].room; // both are founder-desk
    const expected = DECORATIONS_BY_ID['potted-fern'].moraleBonus + DECORATIONS_BY_ID['desk-lamp'].moraleBonus;
    expect(roomComfort(s, room)).toBe(expected);
  });
});
