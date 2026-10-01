import { describe, it, expect } from 'vitest';
import {
  DECORATION_DEPTH_CEILING,
  SCENE_DEPTH,
  characterDepth,
  decorationBand,
  decorationDefaultDepth,
  decorationDepth,
  decorationLayerAdjustable,
  decorationRenderZ,
  defaultDecorationLayer,
  stationDepth,
  type DecorationDepthKind,
} from '../src/sim/depth';
import { ROOM_SURFACES } from '../src/content/roomSurfaces';
import { decorationDepthKind, decorationZ } from '../src/sim/surfaces';
import { characterSlots } from '../src/content/roomLayout';
import { ROOMS } from '../src/content/rooms';
import { DECORATIONS } from '../src/content/decorations';

const DECORATION_KINDS: DecorationDepthKind[] = ['rug', 'wall', 'floor', 'ceiling'];

describe('scene depth: which side of the team each piece is on', () => {
  const allCharacters = ROOMS.flatMap((room) =>
    Array.from({ length: 4 }, (_, n) =>
      characterSlots(n + 1, room.id).map((slot) => characterDepth(slot.bottom)),
    ).flat(),
  );
  const frontMost = Math.max(...allCharacters, SCENE_DEPTH.characterFocus);
  const backMost = Math.min(...allCharacters);

  it('puts wall art and rugs behind every employee, floor and ceiling pieces in front', () => {
    expect(defaultDecorationLayer('wall')).toBe('back');
    expect(defaultDecorationLayer('rug')).toBe('back');
    expect(defaultDecorationLayer('floor')).toBe('front');
    expect(defaultDecorationLayer('ceiling')).toBe('front');
    for (let n = 0; n <= 20; n++) {
      const stored = (kind: DecorationDepthKind) => decorationDepth(kind, n / 20);
      expect(decorationRenderZ('wall', stored('wall'))).toBeLessThan(backMost);
      expect(decorationRenderZ('rug', stored('rug'))).toBeLessThan(backMost);
      expect(decorationRenderZ('floor', stored('floor'))).toBeGreaterThan(frontMost);
      expect(decorationRenderZ('ceiling', stored('ceiling'))).toBeGreaterThan(frontMost);
    }
  });

  it('lets the player swap wall and floor pieces, never rugs or ceiling pieces', () => {
    expect(decorationLayerAdjustable('wall')).toBe(true);
    expect(decorationLayerAdjustable('floor')).toBe(true);
    expect(decorationLayerAdjustable('rug')).toBe(false);
    expect(decorationLayerAdjustable('ceiling')).toBe(false);
    expect(decorationRenderZ('wall', undefined, 'front')).toBeGreaterThan(frontMost);
    expect(decorationRenderZ('floor', undefined, 'back')).toBeLessThan(backMost);
    expect(decorationRenderZ('rug', undefined, 'front')).toBeLessThan(backMost);
    expect(decorationRenderZ('ceiling', undefined, 'back')).toBeGreaterThan(frontMost);
  });

  it('keeps every catalogue piece on its natural side by default', () => {
    for (const def of DECORATIONS) {
      const z = decorationZ(def.id, def.placementSurface);
      const kind = decorationDepthKind(def.id, def.placementSurface);
      if (defaultDecorationLayer(kind) === 'back') expect(z, def.id).toBeLessThan(backMost);
      else expect(z, def.id).toBeGreaterThan(frontMost);
    }
  });

  it('reads old saved depths (the previous all-in-front scale) as nearness only', () => {
    // A wall poster saved at the old wall band still hangs behind the team.
    expect(decorationRenderZ('wall', 186)).toBeLessThan(backMost);
    // A floor piece keeps its order on the floor: nearer stays in front of further.
    expect(decorationRenderZ('floor', 215)).toBeGreaterThan(decorationRenderZ('floor', 192));
    // Out-of-band or missing values fall back to the default spot.
    expect(decorationRenderZ('floor', 0)).toBe(decorationRenderZ('floor', undefined));
  });

  it('keeps stations above furniture and stickers above everything in a room', () => {
    expect(stationDepth(0)).toBeGreaterThan(SCENE_DEPTH.ceiling.max);
    expect(SCENE_DEPTH.sticker).toBeGreaterThan(stationDepth(1));
    expect(SCENE_DEPTH.sticker).toBeGreaterThan(DECORATION_DEPTH_CEILING);
  });

  it('keeps room surface regions on the stored depth scale', () => {
    for (const regions of Object.values(ROOM_SURFACES))
      for (const region of regions) {
        expect(region.depth.min).toBeGreaterThanOrEqual(decorationBand(region.kind).min);
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

  it('gives every decoration kind a default depth inside its band', () => {
    for (const kind of DECORATION_KINDS) {
      const band = decorationBand(kind);
      const z = decorationDefaultDepth(kind);
      expect(z).toBeGreaterThanOrEqual(band.min);
      expect(z).toBeLessThanOrEqual(band.max);
    }
  });
});
