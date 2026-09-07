import { describe, expect, it } from 'vitest';
import { DECORATIONS, auditDecorationCatalog } from '../src/content/decorations';
import {
  ALL_ROOM_SURFACES,
  ROOM_BUILTIN,
  ROOM_SURFACES,
  clampToRoomRegion,
  compatibleRegionsForProfile,
  defaultCompatiblePlacement,
  defaultRegionPlacement,
  placementRegionById,
  regionAtPoint,
  regionsForKinds,
  regionsForRoom,
} from '../src/content/roomSurfaces';
import { ROOMS } from '../src/content/rooms';
import {
  REGION_KIND_SURFACE,
  clampPointToRegion,
  isNormalizedPlane,
  pointOnRegion,
  projectPointToRegion,
  regionContainsPoint,
  type PlacementRegionKind,
} from '../src/sim/placementRegions';
import { decorationSurface, isRug } from '../src/sim/surfaces';

// The placement model exposes exactly three surfaces — floor, wall, ceiling —
// and each spans its entire extent in every room.
const KINDS: PlacementRegionKind[] = ['floor', 'wall', 'ceiling'];

describe('full-surface placement regions', () => {
  it('defines exactly floor/wall/ceiling once for every room', () => {
    expect(Object.keys(ROOM_SURFACES).sort()).toEqual(ROOMS.map((room) => room.id).sort());
    expect(new Set(ALL_ROOM_SURFACES.map((region) => region.id)).size).toBe(
      ALL_ROOM_SURFACES.length,
    );

    for (const room of ROOMS) {
      const regions = regionsForRoom(room.id);
      expect(regions, room.id).toHaveLength(KINDS.length);
      expect(new Set(regions.map((region) => region.kind)), `${room.id} placement kinds`).toEqual(
        new Set(KINDS),
      );
      expect(ROOM_BUILTIN[room.id], `${room.id} built-in`).toBeTruthy();
    }
  });

  it('keeps every authored plane, depth and capacity finite and normalized', () => {
    for (const region of ALL_ROOM_SURFACES) {
      expect(isNormalizedPlane(region.plane), region.id).toBe(true);
      expect(region.surfaceType, region.id).toBe(REGION_KIND_SURFACE[region.kind]);
      expect(Number.isFinite(region.depth.min), region.id).toBe(true);
      expect(Number.isFinite(region.depth.max), region.id).toBe(true);
      expect(region.depth.min, region.id).toBeLessThanOrEqual(region.depth.default);
      expect(region.depth.default, region.id).toBeLessThanOrEqual(region.depth.max);
      expect(region.capacity ?? 1, region.id).toBeGreaterThan(0);
      expect(region.tags.length, region.id).toBeGreaterThan(0);
      // No sub-surface exclusions: the whole surface is usable.
      expect(region.exclusions.length, region.id).toBe(0);
    }
  });

  it('round-trips region-local coordinates through every perspective plane', () => {
    for (const region of ALL_ROOM_SURFACES) {
      const point = pointOnRegion(region, 0.27, 0.73);
      const projected = projectPointToRegion(region, point);
      expect(projected.u, `${region.id} u`).toBeCloseTo(0.27, 8);
      expect(projected.v, `${region.id} v`).toBeCloseTo(0.73, 8);
      expect(projected.inside, region.id).toBe(true);
    }
  });

  it('clamps outside stage points to the nearest point on the chosen region', () => {
    const floor = regionsForKinds('founder-desk', ['floor'])[0];
    const clamped = clampPointToRegion(floor, { x: -4, y: 8 });
    expect(clamped.u).toBe(0);
    expect(clamped.v).toBe(1);
    expect(projectPointToRegion(floor, clamped.point).inside).toBe(true);
    expect(clampToRoomRegion(floor.id, { x: -4, y: 8 })?.point).toEqual(clamped.point);

    // A point below the wall band clamps up onto the wall.
    const wall = regionsForKinds('founder-desk', ['wall'])[0];
    const belowWall = clampToRoomRegion(wall.id, { x: 0.5, y: 0.1 });
    expect(belowWall).not.toBeNull();
    expect(regionContainsPoint(wall, belowWall!.point)).toBe(true);
    expect(clampToRoomRegion('missing-region', { x: 0.5, y: 0.5 })).toBeNull();
  });

  it('selects the surface under the pointer and only that surface', () => {
    const floor = regionsForKinds('meeting', ['floor'])[0];
    const floorPoint = pointOnRegion(floor, 0.5, 0.5);
    expect(regionAtPoint('meeting', floorPoint, ['floor'])?.id).toBe(floor.id);
    // A floor point is not inside the wall band.
    const wall = regionsForKinds('meeting', ['wall'])[0];
    expect(regionContainsPoint(wall, floorPoint)).toBe(false);

    const wallPoint = pointOnRegion(wall, 0.5, 0.5);
    expect(regionAtPoint('meeting', wallPoint, ['wall'])?.id).toBe(wall.id);
    expect(regionContainsPoint(floor, wallPoint)).toBe(false);
  });

  it('returns exclusion-safe unique defaults up to every region capacity', () => {
    for (const room of ROOMS) {
      for (const kind of KINDS) {
        const region = regionsForKinds(room.id, [kind])[0];
        const capacity = region.capacity ?? 1;
        const placements = Array.from({ length: capacity }, (_, index) =>
          defaultRegionPlacement(room.id, kind, index),
        );
        expect(placements.every(Boolean), `${room.id}:${kind} defaults`).toBe(true);
        expect(defaultRegionPlacement(room.id, kind, 2)).toEqual(
          defaultRegionPlacement(room.id, kind, 2),
        );
        expect(
          new Set(placements.map((placement) => `${placement!.u}:${placement!.v}`)).size,
          `${room.id}:${kind} unique slots`,
        ).toBe(capacity);
        for (const placement of placements) {
          expect(placement!.region.id).toMatch(new RegExp(`^${room.id}:${kind}:`));
          expect(placementRegionById(placement!.region.id)).toBe(placement!.region);
          expect(regionContainsPoint(placement!.region, placement!.point)).toBe(true);
        }
      }
    }
    expect(defaultRegionPlacement('not-a-room', 'floor')).toBeNull();
  });
});

describe('decoration surface metadata', () => {
  it('keeps the audited 23 floor / 6 wall / 3 ceiling split', () => {
    const counts = { floor: 0, wall: 0, ceiling: 0 };
    for (const decoration of DECORATIONS) counts[decorationSurface(decoration.id)] += 1;
    expect(counts).toEqual({ floor: 23, wall: 6, ceiling: 3 });
    expect(DECORATIONS.filter((decoration) => isRug(decoration.id))).toHaveLength(2);
  });

  it('assigns every asset to exactly one of the three surfaces', () => {
    const defaults = new Set(DECORATIONS.map((decoration) => decoration.defaultRegionKind));
    expect(defaults).toEqual(new Set(KINDS));

    for (const decoration of DECORATIONS) {
      // Exactly one valid surface — no multi-surface props.
      expect(decoration.compatibleRegionKinds, decoration.id).toEqual([decoration.defaultRegionKind]);
      expect(decoration.placementSurface, decoration.id).toBe(decorationSurface(decoration.id));
      expect(decoration.compatibleSurfaces, decoration.id).toEqual([
        decoration.placementSurface,
      ]);
      expect(decoration.compatibleRegionSurfaces, decoration.id).toEqual([
        REGION_KIND_SURFACE[decoration.defaultRegionKind],
      ]);
      for (const roomId of decoration.compatibleRooms) {
        expect(
          compatibleRegionsForProfile(roomId, decoration).length,
          `${decoration.id} in ${roomId}`,
        ).toBe(1);
      }
    }
  });

  it('classifies representative floor, rug, wall and ceiling assets', () => {
    const expected: Record<string, PlacementRegionKind> = {
      'potted-fern': 'floor',
      'tiny-rug': 'floor',
      'motivational-poster': 'wall',
      chandelier: 'ceiling',
      'desk-lamp': 'floor',
      'conveyor-plushie': 'floor',
      hammock: 'floor',
      hologram: 'ceiling',
      'star-ceiling': 'ceiling',
      projector: 'floor',
      billboard: 'floor',
    };
    for (const [id, kind] of Object.entries(expected)) {
      expect(DECORATIONS.find((decoration) => decoration.id === id)?.defaultRegionKind, id).toBe(kind);
    }
  });

  it('places every asset on its single surface in any compatible room', () => {
    const cases: Array<{ id: string; kind: PlacementRegionKind }> = [
      { id: 'hammock', kind: 'floor' },
      { id: 'rooftop-garden-bed', kind: 'floor' },
      { id: 'chandelier', kind: 'ceiling' },
      { id: 'motivational-poster', kind: 'wall' },
    ];
    for (const { id, kind } of cases) {
      const def = DECORATIONS.find((decoration) => decoration.id === id)!;
      expect(defaultCompatiblePlacement('nap', def)?.region.kind, id).toBe(kind);
      expect(defaultCompatiblePlacement('marketing', def)?.region.kind, id).toBe(kind);
    }
  });

  it('passes the complete catalogue portability and region audit', () => {
    expect(auditDecorationCatalog()).toEqual([]);
  });
});
