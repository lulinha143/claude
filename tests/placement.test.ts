import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { evaluatePlacement, footprint } from '../src/sim/placement';
import { placedPlacement } from '../src/sim/decorations';
import { characterSlots } from '../src/content/roomLayout';

// founder-desk owns: potted-fern (floor), desk-lamp (floor), tiny-rug (rug),
// motivational-poster (wall), window-view (wall, large).
function ownAll(engine: GameEngine) {
  for (const id of ['potted-fern', 'desk-lamp', 'motivational-poster', 'window-view', 'tiny-rug']) {
    engine.buyDecoration(id);
  }
}

describe('decoration composition rules', () => {
  it('accepts a clear, well-spaced floor spot', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    ownAll(engine);
    // Move fern to a lonely corner of the floor.
    expect(evaluatePlacement(engine.state, 'potted-fern', 0.2, 0.06).ok).toBe(true);
  });

  it('rejects dropping one object exactly on top of another', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    ownAll(engine);
    const lamp = placedPlacement(engine.state, 'desk-lamp')!;
    const check = evaluatePlacement(engine.state, 'potted-fern', lamp.x, lamp.y);
    expect(check.ok).toBe(false);
    expect(check.reasonKey).toBe('decorate.reject.stacked');
  });

  it('rejects a severe overlap with a same-surface neighbour', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    ownAll(engine);
    engine.moveDecoration('desk-lamp', 0.5, 0.06);
    // Overlap the lamp heavily but from a clearly different centre (not stacked).
    const check = evaluatePlacement(engine.state, 'potted-fern', 0.56, 0.06);
    expect(check.ok).toBe(false);
    expect(check.reasonKey).toBe('decorate.reject.occupied');
  });

  it('allows a small, natural overlap between neighbours', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    ownAll(engine);
    engine.moveDecoration('desk-lamp', 0.5, 0.06);
    // Sit the fern a comfortable distance to the side — barely touching.
    expect(evaluatePlacement(engine.state, 'potted-fern', 0.64, 0.06).ok).toBe(true);
  });

  it('keeps wall and floor objects from blocking each other', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    ownAll(engine);
    engine.moveDecoration('motivational-poster', 0.5, 0.62);
    // A floor object directly below the poster is fine (different surface band).
    expect(evaluatePlacement(engine.state, 'potted-fern', 0.5, 0.06).ok).toBe(true);
  });

  it('rejects a large floor object dropped on top of a teammate', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    // Put two teammates in the morale room (which owns the large 'aquarium').
    engine.state.resources.reputation = 100; // unlock the morale room
    const ids = Object.keys(engine.state.employees).slice(0, 2);
    for (const id of ids) {
      engine.state.employees[id].hired = true;
      engine.state.employees[id].room = 'morale';
    }
    const slots = characterSlots(2, 'morale');
    // Right on a teammate's slot → covered.
    const onTeammate = evaluatePlacement(engine.state, 'aquarium', slots[0].x, 0.06);
    expect(onTeammate.ok).toBe(false);
    expect(onTeammate.reasonKey).toBe('decorate.reject.coversTeammate');
  });

  it('allows a large floor object in a clear part of an occupied room', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.state.resources.reputation = 100; // unlock the morale room
    const ids = Object.keys(engine.state.employees).slice(0, 2);
    for (const id of ids) {
      engine.state.employees[id].hired = true;
      engine.state.employees[id].room = 'morale';
    }
    // Far corner, away from both centred teammates.
    expect(evaluatePlacement(engine.state, 'aquarium', 0.14, 0.06).ok).toBe(true);
  });

  it('gives every large decoration a bigger footprint than a small one', () => {
    expect(footprint('safe').w).toBeGreaterThan(footprint('desk-lamp').w);
    expect(footprint('billboard').w).toBeGreaterThan(footprint('motivational-poster').w);
  });
});
