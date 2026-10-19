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
import { readFileSync } from 'node:fs';
import { ROOM_SURFACES } from '../src/content/roomSurfaces';
import { decorationDepthKind, decorationZ } from '../src/sim/surfaces';
import { STAGE_HEIGHT_PX, characterSlots, standingDepthPx } from '../src/content/roomLayout';
import { CHARACTER_PRESENCE_SCALE } from '../src/content/characterScale';
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

  it('puts wall art, rugs and hanging pieces behind every employee; floor furniture with them', () => {
    expect(defaultDecorationLayer('wall')).toBe('back');
    expect(defaultDecorationLayer('rug')).toBe('back');
    expect(defaultDecorationLayer('ceiling')).toBe('back');
    expect(defaultDecorationLayer('floor')).toBe('front');
    for (let n = 0; n <= 20; n++) {
      const stored = (kind: DecorationDepthKind) => decorationDepth(kind, n / 20);
      expect(decorationRenderZ('wall', stored('wall'))).toBeLessThan(backMost);
      expect(decorationRenderZ('rug', stored('rug'))).toBeLessThan(backMost);
      expect(decorationRenderZ('ceiling', stored('ceiling'))).toBeLessThan(backMost);
      // Standing on the floor, it sorts in the same band as the team.
      const standing = decorationRenderZ('floor', stored('floor'), undefined, n * 2);
      expect(standing).toBeGreaterThanOrEqual(SCENE_DEPTH.character.min);
      expect(standing).toBeLessThanOrEqual(SCENE_DEPTH.character.max);
    }
  });

  it('lets the player swap wall and floor pieces, never rugs or ceiling pieces', () => {
    expect(decorationLayerAdjustable('wall')).toBe(true);
    expect(decorationLayerAdjustable('floor')).toBe(true);
    expect(decorationLayerAdjustable('rug')).toBe(false);
    expect(decorationLayerAdjustable('ceiling')).toBe(false);
    expect(decorationRenderZ('wall', undefined, 'front')).toBeGreaterThan(frontMost);
    expect(decorationRenderZ('floor', undefined, 'back')).toBeLessThan(backMost);
    // Sent back, a floor piece stays behind everyone wherever it stands.
    for (const px of [0, 12, 40]) {
      expect(decorationRenderZ('floor', undefined, 'back', px)).toBeLessThan(backMost);
    }
    expect(decorationRenderZ('rug', undefined, 'front')).toBeLessThan(backMost);
    expect(decorationRenderZ('ceiling', undefined, 'front')).toBeLessThan(backMost);
  });

  it('keeps every catalogue piece on its natural side by default', () => {
    for (const def of DECORATIONS) {
      const kind = decorationDepthKind(def.id, def.placementSurface);
      if (defaultDecorationLayer(kind) === 'back') {
        expect(decorationZ(def.id, def.placementSurface), def.id).toBeLessThan(backMost);
        continue;
      }
      // A floor piece anywhere on the floor stands among the team.
      for (const y of [0.01, 0.15, 0.3]) {
        const z = decorationZ(def.id, def.placementSurface, undefined, undefined, y);
        expect(z, def.id).toBe(characterDepth(standingDepthPx(y)));
      }
    }
  });

  it('stands floor furniture in front of whoever is behind it and behind whoever is in front', () => {
    for (const room of ROOMS) {
      for (const slot of characterSlots(4, room.id)) {
        const teammate = characterDepth(slot.bottom);
        // A piece whose base is 6px nearer than their feet is in front of them...
        const nearer = decorationZ(
          'potted-fern',
          'floor',
          undefined,
          undefined,
          Math.max(0, slot.bottom - 6) / STAGE_HEIGHT_PX,
        );
        if (slot.bottom >= 6) expect(nearer, room.id).toBeGreaterThan(teammate);
        // ...and one 6px further back is behind them.
        const further = decorationZ(
          'potted-fern',
          'floor',
          undefined,
          undefined,
          (slot.bottom + 6) / STAGE_HEIGHT_PX,
        );
        expect(further, room.id).toBeLessThan(teammate);
      }
    }
  });

  it('lets a teammate win a tie with a piece standing exactly where they stand', () => {
    // Equal z-index: the team is drawn after the furniture, so the teammate shows.
    expect(decorationZ('billboard', 'floor', undefined, undefined, 0)).toBe(characterDepth(0));
    expect(decorationZ('billboard', 'floor', undefined, undefined, 24 / STAGE_HEIGHT_PX)).toBe(
      characterDepth(24),
    );
  });

  it('keeps the stage height in step with the stage drawn by the stylesheet', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const rule =
      /\.floor__stage \{[^}]*height: calc\((\d+)px \* var\(--asset-scale\) \* var\(--character-presence\)\)/.exec(
        css,
      );
    expect(rule?.[1]).toBeDefined();
    expect(Number(rule![1]) * CHARACTER_PRESENCE_SCALE).toBeCloseTo(STAGE_HEIGHT_PX, 6);
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
