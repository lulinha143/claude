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

describe('scene depth: furnishings in front of employees', () => {
  it('keeps every surface above even a focused employee', () => {
    for (const kind of DECORATION_KINDS) {
      expect(decorationBand(kind).min).toBeGreaterThan(SCENE_DEPTH.characterFocus);
      for (let n = 0; n <= 20; n++)
        expect(decorationDepth(kind, n / 20)).toBeGreaterThan(SCENE_DEPTH.characterFocus);
    }
    expect(DECORATION_DEPTH_CEILING).toBeGreaterThan(SCENE_DEPTH.characterFocus);
    expect(stationDepth(0)).toBeGreaterThan(SCENE_DEPTH.ceiling.max);
  });
  it('covers every room, occupancy and catalogue surface', () => {
    const highest = Math.max(
      ...ROOMS.flatMap((room) =>
        Array.from({ length: 4 }, (_, n) =>
          characterSlots(n + 1, room.id).map((slot) => characterDepth(slot.bottom)),
        ).flat(),
      ),
    );
    for (const def of DECORATIONS)
      expect(surfaceZ(def.id, def.placementSurface)).toBeGreaterThan(highest);
    for (const regions of Object.values(ROOM_SURFACES))
      for (const region of regions) {
        expect(region.depth.min).toBeGreaterThan(SCENE_DEPTH.characterFocus);
        expect(region.depth.max).toBeLessThanOrEqual(decorationBand(region.kind).max);
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
