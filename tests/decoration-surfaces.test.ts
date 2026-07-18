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

const KINDS: PlacementRegionKind[] = [
  'floor',
  'rug-plane',
  'wall',
  'ceiling-rail',
  'tabletop',
  'shelf',
  'special',
];

describe('room-specific normalized placement regions', () => {
  it('defines every semantic support once for every room', () => {
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

  it('keeps every authored plane, exclusion, depth, and capacity finite and normalized', () => {
    for (const region of ALL_ROOM_SURFACES) {
      expect(isNormalizedPlane(region.plane), region.id).toBe(true);
      expect(region.surfaceType, region.id).toBe(
        region.kind === 'special' ? region.surfaceType : REGION_KIND_SURFACE[region.kind],
      );
      expect(Number.isFinite(region.depth.min), region.id).toBe(true);
      expect(Number.isFinite(region.depth.max), region.id).toBe(true);
      expect(region.depth.min, region.id).toBeLessThanOrEqual(region.depth.default);
      expect(region.depth.default, region.id).toBeLessThanOrEqual(region.depth.max);
      expect(region.capacity ?? 1, region.id).toBeGreaterThan(0);
      expect(region.tags.length, region.id).toBeGreaterThan(0);
      for (const exclusion of region.exclusions) {
        expect(isNormalizedPlane(exclusion.plane), exclusion.id).toBe(true);
      }
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

    const wall = regionsForKinds('founder-desk', ['wall'])[0];
    const windowSafe = clampToRoomRegion(wall.id, { x: 0.8, y: 0.69 });
    expect(windowSafe).not.toBeNull();
    expect(windowSafe!.point).not.toEqual({ x: 0.8, y: 0.69 });
    expect(regionContainsPoint(wall, windowSafe!.point)).toBe(true);
    expect(clampToRoomRegion('missing-region', { x: 0.5, y: 0.5 })).toBeNull();
  });

  it('selects the highest-priority compatible support under the pointer', () => {
    const table = regionsForKinds('meeting', ['tabletop'])[0];
    const point = pointOnRegion(table, 0.5, 0.5);
    expect(regionAtPoint('meeting', point, ['tabletop'])?.id).toBe(table.id);
    expect(regionAtPoint('meeting', point, ['wall'])?.kind).not.toBe('tabletop');

    const wall = regionsForKinds('founder-desk', ['wall'])[0];
    expect(regionContainsPoint(wall, { x: 0.8, y: 0.69 })).toBe(false);
    expect(regionAtPoint('founder-desk', { x: 0.8, y: 0.69 }, ['wall'])).toBeNull();
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

describe('decoration semantic support metadata', () => {
  it('retains the legacy 19 floor, 10 wall, and 3 ceiling projection split', () => {
    const counts = { floor: 0, wall: 0, ceiling: 0 };
    for (const decoration of DECORATIONS) counts[decorationSurface(decoration.id)] += 1;
    expect(counts).toEqual({ floor: 19, wall: 10, ceiling: 3 });
    expect(DECORATIONS.filter((decoration) => isRug(decoration.id))).toHaveLength(2);
  });

  it('explicitly assigns current assets across all seven semantic region categories', () => {
    const defaults = new Set(DECORATIONS.map((decoration) => decoration.defaultRegionKind));
    expect(defaults).toEqual(new Set(KINDS));

    for (const decoration of DECORATIONS) {
      expect(decoration.compatibleRegionKinds, decoration.id).toContain(
        decoration.defaultRegionKind,
      );
      for (const roomId of decoration.compatibleRooms) {
        expect(
          compatibleRegionsForProfile(roomId, decoration).length,
          `${decoration.id} in ${roomId}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('classifies representative floor, rug, wall, hanging, tabletop, shelf, and special assets', () => {
    const expected: Record<string, PlacementRegionKind> = {
      'potted-fern': 'floor',
      'tiny-rug': 'rug-plane',
      'motivational-poster': 'wall',
      chandelier: 'ceiling-rail',
      'desk-lamp': 'tabletop',
      'conveyor-plushie': 'shelf',
      hammock: 'special',
    };
    for (const [id, kind] of Object.entries(expected)) {
      expect(DECORATIONS.find((decoration) => decoration.id === id)?.defaultRegionKind).toBe(kind);
    }
  });

  it('constrains special supports by physical surface and room tags with a portable fallback', () => {
    const hammock = DECORATIONS.find((decoration) => decoration.id === 'hammock')!;
    expect(defaultCompatiblePlacement('nap', hammock)?.region.kind).toBe('special');
    expect(defaultCompatiblePlacement('marketing', hammock)?.region.kind).toBe('floor');

    const garden = DECORATIONS.find((decoration) => decoration.id === 'rooftop-garden-bed')!;
    expect(defaultCompatiblePlacement('rooftop', garden)?.region.kind).toBe('special');
    expect(defaultCompatiblePlacement('lab', garden)?.region.kind).toBe('floor');
  });

  it('keeps every legacy projection surface represented in semantic compatibility', () => {
    for (const decoration of DECORATIONS) {
      expect(decoration.compatibleRegionSurfaces, decoration.id).toContain(
        decorationSurface(decoration.id),
      );
    }
  });

  it('passes the complete catalogue portability and region audit', () => {
    expect(auditDecorationCatalog()).toEqual([]);
  });
});
