import { describe, it, expect } from 'vitest';
import {
  DECORATION_DEPTH_CEILING,
  SCENE_DEPTH,
  characterDepth,
  decorationBand,
  decorationDefaultDepth,
  decorationDepth,
  stationDepth,
  type DecorationDepthKind,
} from '../src/sim/depth';
import { ROOM_SURFACES } from '../src/content/roomSurfaces';
import { surfaceZ } from '../src/sim/surfaces';
import { characterSlots } from '../src/content/roomLayout';
import { ROOMS } from '../src/content/rooms';
import { DECORATIONS } from '../src/content/decorations';

const DECORATION_KINDS: DecorationDepthKind[] = ['rug', 'wall', 'floor', 'ceiling'];

// The whole point of the depth module: characters are the foreground actors and
// must never be hidden behind scenery. These tests pin the structural guarantee
// so a future band or room cannot quietly reintroduce the bug.
describe('scene depth: characters always paint in front of decorations', () => {
  it('puts every decoration band strictly below the character band', () => {
    for (const kind of DECORATION_KINDS) {
      const band = decorationBand(kind);
      expect(band.max).toBeLessThan(SCENE_DEPTH.character.min);
    }
    expect(DECORATION_DEPTH_CEILING).toBeLessThan(SCENE_DEPTH.character.min);
  });

  it('keeps click stations above scenery but still behind characters', () => {
    for (const kind of DECORATION_KINDS) {
      expect(decorationBand(kind).max).toBeLessThanOrEqual(SCENE_DEPTH.station.min);
    }
    expect(stationDepth(0)).toBeGreaterThanOrEqual(SCENE_DEPTH.station.min);
    expect(stationDepth(1)).toBeLessThan(SCENE_DEPTH.character.min);
  });

  it('never lets a decoration depth reach a character depth, at any nearness', () => {
    for (const kind of DECORATION_KINDS) {
      for (let i = 0; i <= 20; i += 1) {
        const z = decorationDepth(kind, i / 20);
        expect(z).toBeLessThan(SCENE_DEPTH.character.min);
        expect(z).toBeGreaterThanOrEqual(decorationBand(kind).min);
        expect(z).toBeLessThanOrEqual(decorationBand(kind).max);
      }
    }
  });

  it('keeps every catalogue decoration below every character slot, in every room', () => {
    const lowestCharacter = Math.min(
      ...ROOMS.flatMap((room) =>
        // 1..6 occupants covers the per-room soft cap.
        Array.from({ length: 6 }, (_, n) =>
          characterSlots(n + 1, room.id).map((slot) => characterDepth(slot.bottom)),
        ).flat(),
      ),
    );
    const highestDecoration = Math.max(
      ...DECORATIONS.map((def) =>
        surfaceZ(
          def.id,
          def.placementSurface === 'wall'
            ? 'wall'
            : def.placementSurface === 'ceiling'
              ? 'ceiling'
              : 'floor',
        ),
      ),
    );
    expect(highestDecoration).toBeLessThan(lowestCharacter);
  });

  it('keeps every room placement region inside the decoration bands', () => {
    for (const [roomId, regions] of Object.entries(ROOM_SURFACES)) {
      for (const region of regions) {
        const band = decorationBand(region.kind);
        expect(region.depth.min, `${roomId}:${region.kind} min`).toBeGreaterThanOrEqual(band.min);
        expect(region.depth.max, `${roomId}:${region.kind} max`).toBeLessThanOrEqual(band.max);
        expect(region.depth.max, `${roomId}:${region.kind} vs characters`).toBeLessThan(
          SCENE_DEPTH.character.min,
        );
      }
    }
  });
});

describe('scene depth: ordering within the bands', () => {
  it('layers rugs under wall art under floor props under hanging pieces', () => {
    expect(decorationBand('rug').max).toBeLessThan(decorationBand('wall').min);
    expect(decorationBand('wall').max).toBeLessThan(decorationBand('floor').min);
    expect(decorationBand('floor').max).toBeLessThan(decorationBand('ceiling').min);
  });

  it('paints a nearer floor prop over a further one', () => {
    const near = decorationDepth('floor', 1);
    const far = decorationDepth('floor', 0);
    expect(near).toBeGreaterThan(far);
  });

  it('paints a nearer character over one standing further back', () => {
    // `bottom` is pixels UP from the floor line, so a larger value is further back.
    expect(characterDepth(0)).toBeGreaterThan(characterDepth(30));
    expect(characterDepth(10)).toBeGreaterThan(characterDepth(20));
  });

  it('clamps character depth into its own band', () => {
    expect(characterDepth(0)).toBeLessThanOrEqual(SCENE_DEPTH.character.max);
    expect(characterDepth(100_000)).toBeGreaterThanOrEqual(SCENE_DEPTH.character.min);
  });

  it('keeps a focused character above every other character', () => {
    for (let bottom = 0; bottom <= 200; bottom += 5) {
      expect(SCENE_DEPTH.characterFocus).toBeGreaterThan(characterDepth(bottom));
    }
  });

  it('lifts the piece being arranged above everything else', () => {
    expect(SCENE_DEPTH.arranging).toBeGreaterThan(SCENE_DEPTH.characterFocus);
  });

  it('gives every decoration kind a default depth inside its band', () => {
    for (const kind of DECORATION_KINDS) {
      const band = decorationBand(kind);
      const z = decorationDefaultDepth(kind);
      expect(z).toBeGreaterThanOrEqual(band.min);
      expect(z).toBeLessThanOrEqual(band.max);
    }
  });
});
