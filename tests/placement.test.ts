import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import {
  clampDecorationToRegion,
  decorationFootprintFitsRegion,
  evaluatePlacement,
  evaluateRegionPlacement,
  footprint,
} from '../src/sim/placement';
import { regionsForKinds } from '../src/content/roomSurfaces';
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

  it('allows decorations to share the exact same support point', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    ownAll(engine);
    const lamp = placedPlacement(engine.state, 'desk-lamp')!;
    const check = evaluatePlacement(engine.state, 'potted-fern', lamp.x, lamp.y);
    expect(check.ok).toBe(true);
  });

  it('allows severe overlap for dense authored arrangements', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    ownAll(engine);
    engine.moveDecoration('desk-lamp', 0.5, 0.06);
    expect(evaluatePlacement(engine.state, 'potted-fern', 0.56, 0.06).ok).toBe(true);
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

  it('allows a large floor object to share a teammate\u2019s spot (the character paints in front)', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    // Put two teammates in the morale room (which owns the large 'aquarium').
    engine.state.resources.reputation = 100; // unlock the morale room
    const ids = Object.keys(engine.state.employees).slice(0, 2);
    for (const id of ids) {
      engine.state.employees[id].hired = true;
      engine.state.employees[id].room = 'morale';
    }
    const slots = characterSlots(2, 'morale');
    // Dropping right on a teammate's slot used to be rejected to stop a prop
    // hiding their face. Stacking order now guarantees the character draws in
    // front (see sim/depth.ts), so dense arrangements around a teammate are
    // legal and the invisible exclusion zone is gone.
    const onTeammate = evaluatePlacement(engine.state, 'aquarium', slots[0].x, 0.06);
    expect(onTeammate.ok).toBe(true);
    expect(onTeammate.reasonKey).toBeUndefined();
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

  it('validates the destination room while permitting prop overlap there', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.state.resources.reputation = 10;
    engine.buyDecoration('potted-fern');
    engine.buyDecoration('desk-lamp');
    engine.moveDecorationToRoom('desk-lamp', 'morale', 0.5, 0.06);
    const check = evaluatePlacement(engine.state, 'potted-fern', 0.5, 0.06, 'morale');
    expect(check.ok).toBe(true);
  });

  it('gives every large decoration a bigger footprint than a small one', () => {
    expect(footprint('safe').w).toBeGreaterThan(footprint('desk-lamp').w);
    expect(footprint('billboard').w).toBeGreaterThan(footprint('motivational-poster').w);
  });
});

describe('semantic floor and rug placement previews', () => {
  it('keeps the complete floor footprint inside the perspective polygon', () => {
    const floor = regionsForKinds('founder-desk', ['floor'])[0];
    const constrained = clampDecorationToRegion('potted-fern', floor, { x: -1, y: 2 });
    expect(constrained).not.toBeNull();
    expect(decorationFootprintFitsRegion('potted-fern', floor, constrained!.point)).toBe(true);
  });

  it('constrains the complete rug footprint and keeps it flat beneath standing props', () => {
    const state = createInitialState(0);
    const engine = new GameEngine(state, { deterministic: true });
    engine.buyDecoration('tiny-rug');
    // Rugs live on the floor surface but render flat, under everything (depth 0).
    const floor = regionsForKinds('founder-desk', ['floor'])[0];
    const preview = evaluateRegionPlacement(state, 'tiny-rug', 'founder-desk', floor, {
      x: 0.5,
      y: 0.14,
    });
    expect(preview).not.toBeNull();
    expect(preview!.ok).toBe(true);
    expect(preview!.depth).toBe(0);
    expect(decorationFootprintFitsRegion('tiny-rug', floor, preview!.point)).toBe(true);
  });

  it('returns a constrained but invalid preview at an outside pointer for exact rollback', () => {
    const state = createInitialState(0);
    const engine = new GameEngine(state, { deterministic: true });
    engine.buyDecoration('potted-fern');
    const floor = regionsForKinds('founder-desk', ['floor'])[0];
    const preview = evaluateRegionPlacement(state, 'potted-fern', 'founder-desk', floor, {
      x: 1.4,
      y: 0.8,
    });
    expect(preview).not.toBeNull();
    expect(preview!.ok).toBe(false);
    expect(preview!.reasonKey).toBe('decorate.reject.moveInside');
    expect(decorationFootprintFitsRegion('potted-fern', floor, preview!.point)).toBe(true);
  });

  it('previews dense overlap without mutating the committed arrangement', () => {
    const state = createInitialState(0);
    const engine = new GameEngine(state, { deterministic: true });
    ownAll(engine);
    const before = structuredClone(state.placements);
    const lamp = placedPlacement(state, 'desk-lamp')!;
    const floor = regionsForKinds('founder-desk', ['floor'])[0];
    const preview = evaluateRegionPlacement(state, 'potted-fern', 'founder-desk', floor, {
      x: lamp.x,
      y: lamp.y,
    });
    expect(preview?.ok).toBe(true);
    expect(state.placements).toEqual(before);
  });

  it('derives natural front-to-back depth from floor position', () => {
    const state = createInitialState(0);
    const engine = new GameEngine(state, { deterministic: true });
    engine.buyDecoration('potted-fern');
    const floor = regionsForKinds('founder-desk', ['floor'])[0];
    const back = evaluateRegionPlacement(state, 'potted-fern', 'founder-desk', floor, {
      x: 0.5,
      y: 0.3,
    });
    const front = evaluateRegionPlacement(state, 'potted-fern', 'founder-desk', floor, {
      x: 0.5,
      y: 0.08,
    });
    expect(back).not.toBeNull();
    expect(front).not.toBeNull();
    expect(front!.depth).toBeGreaterThanOrEqual(back!.depth);
  });

  it('preserves semantic standing depth when a save is loaded again', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.state.resources.nuts = 10_000;
    expect(engine.buyDecoration('potted-fern')).toBe(true);
    expect(engine.moveDecorationToRoom('potted-fern', 'founder-desk', 0.72, 0.08, 5)).toBe(true);

    const loaded = new GameEngine(structuredClone(engine.state), { deterministic: true });
    expect(
      loaded.state.decorationInstances.find((instance) => instance.decorationId === 'potted-fern')
        ?.depth,
    ).toBe(5);
  });

  it('allows multiple rugs on the floor and never lets them block other props', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.state.resources.nuts = 100_000;
    engine.state.resources.goldenNuts = 100;
    expect(engine.buyDecoration('tiny-rug')).toBe(true);
    expect(engine.buyDecoration('gold-carpet')).toBe(true);
    // Two rugs can coexist on the floor (flat underlays pass through collision).
    expect(engine.moveDecorationToRoom('tiny-rug', 'founder-desk', 0.35, 0.12, 0, 'floor')).toBe(
      true,
    );
    expect(engine.moveDecorationToRoom('gold-carpet', 'founder-desk', 0.6, 0.12, 0, 'floor')).toBe(
      true,
    );
    // A standing prop drops fine on top of a rug.
    expect(engine.buyDecoration('potted-fern')).toBe(true);
    const check = evaluatePlacement(engine.state, 'potted-fern', 0.35, 0.12, 'founder-desk');
    expect(check.ok).toBe(true);
  });

  it('resets a room to tidy, valid defaults for every placed item', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.state.resources.nuts = 100_000;
    engine.state.resources.goldenNuts = 100;
    for (const id of ['potted-fern', 'desk-lamp', 'motivational-poster']) {
      expect(engine.buyDecoration(id)).toBe(true);
      expect(engine.placeDecorationInRoom(id, 'founder-desk')).toBe(true);
    }
    expect(engine.resetRoomDecorations('founder-desk')).toBe(true);
    for (const id of ['potted-fern', 'desk-lamp', 'motivational-poster']) {
      const instance = engine.state.decorationInstances.find((i) => i.decorationId === id)!;
      expect(instance.roomId).toBe('founder-desk');
    }
  });
});
