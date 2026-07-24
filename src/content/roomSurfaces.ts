import { ROOMS } from './rooms';
import type { DecorationSurfaceType } from '../sim/types';
import {
  REGION_KIND_SURFACE,
  clampPointToValidRegion,
  placementPlane,
  pointOnRegion,
  regionArea,
  regionContainsPoint,
  type NormalizedPlacementPlane,
  type NormalizedPoint,
  type PlacementAnchorMode,
  type PlacementRegion,
  type PlacementRegionKind,
} from '../sim/placementRegions';

export type RoomBuiltInKind =
  'shelf' | 'counter' | 'cabinet' | 'lab' | 'board' | 'toolwall' | 'pipes' | 'plant';

export const ROOM_BUILTIN: Record<string, RoomBuiltInKind> = {
  'founder-desk': 'shelf',
  sorting: 'cabinet',
  morale: 'counter',
  procurement: 'cabinet',
  construction: 'toolwall',
  lab: 'lab',
  marketing: 'board',
  vault: 'cabinet',
  research: 'lab',
  meeting: 'board',
  nap: 'plant',
  basement: 'pipes',
  rooftop: 'plant',
};

export interface RegionCompatibilityProfile {
  defaultRegionKind?: PlacementRegionKind;
  compatibleRegionKinds: readonly PlacementRegionKind[];
  compatibleRegionSurfaces: readonly DecorationSurfaceType[];
  compatibleSpecialTags?: readonly string[];
}

// Full-surface placement planes shared by every room. Each of the three
// surfaces spans its ENTIRE extent, so the player may place a compatible piece
// anywhere on the floor, anywhere on the wall, or anywhere on the ceiling.
// Coordinates use the office stage system (x left→right, y floor-line→ceiling)
// and line up with the SURFACE_BANDS the renderer/CSS already use.
function makeRegion(
  roomId: string,
  kind: PlacementRegionKind,
  plane: NormalizedPlacementPlane,
  options: {
    anchorMode: PlacementAnchorMode;
    depth: PlacementRegion['depth'];
    priority: number;
    capacity: number;
    tags: readonly string[];
  },
): PlacementRegion {
  return {
    id: `${roomId}:${kind}:main`,
    roomId,
    kind,
    surfaceType: REGION_KIND_SURFACE[kind],
    plane,
    anchorMode: options.anchorMode,
    depth: options.depth,
    priority: options.priority,
    capacity: options.capacity,
    tags: options.tags,
    exclusions: [],
  };
}

function buildRoomRegions(roomId: string): readonly PlacementRegion[] {
  return [
    // The entire walkable floor.
    makeRegion(roomId, 'floor', placementPlane(0.04, 0.96, 0.01, 0.35, 0.1), {
      anchorMode: 'base',
      depth: { min: 2, max: 5, default: 3 },
      priority: 10,
      capacity: 12,
      tags: ['grounded', 'perspective'],
    }),
    // The entire wall.
    makeRegion(roomId, 'wall', placementPlane(0.05, 0.95, 0.44, 0.82), {
      anchorMode: 'center',
      depth: { min: 1, max: 1, default: 1 },
      priority: 20,
      capacity: 10,
      tags: ['vertical', 'backdrop'],
    }),
    // The entire ceiling.
    makeRegion(roomId, 'ceiling', placementPlane(0.06, 0.94, 0.85, 0.98), {
      anchorMode: 'hanging',
      depth: { min: 6, max: 7, default: 6 },
      priority: 50,
      capacity: 6,
      tags: ['hanging', 'overhead'],
    }),
  ];
}

export const ROOM_SURFACES: Record<string, readonly PlacementRegion[]> = Object.fromEntries(
  ROOMS.map((room) => [room.id, buildRoomRegions(room.id)]),
);

export const ALL_ROOM_SURFACES: readonly PlacementRegion[] = Object.values(ROOM_SURFACES).flat();

export function regionsForRoom(roomId: string): readonly PlacementRegion[] {
  return ROOM_SURFACES[roomId] ?? [];
}

export function regionsForKinds(
  roomId: string,
  kinds: readonly PlacementRegionKind[],
): readonly PlacementRegion[] {
  const allowed = new Set(kinds);
  return regionsForRoom(roomId).filter((region) => allowed.has(region.kind));
}

export function compatibleRegionsForProfile(
  roomId: string,
  profile: RegionCompatibilityProfile,
): readonly PlacementRegion[] {
  const surfaces = new Set(profile.compatibleRegionSurfaces);
  return regionsForKinds(roomId, profile.compatibleRegionKinds).filter((region) =>
    surfaces.has(region.surfaceType),
  );
}

export function placementRegionById(regionId: string): PlacementRegion | null {
  return ALL_ROOM_SURFACES.find((region) => region.id === regionId) ?? null;
}

/** Highest-priority compatible support under a normalized room-stage point. */
export function regionAtPoint(
  roomId: string,
  point: NormalizedPoint,
  kinds?: readonly PlacementRegionKind[],
): PlacementRegion | null {
  const candidates = kinds ? regionsForKinds(roomId, kinds) : regionsForRoom(roomId);
  return (
    candidates
      .filter((region) => regionContainsPoint(region, point))
      .sort(
        (left, right) => right.priority - left.priority || regionArea(left) - regionArea(right),
      )[0] ?? null
  );
}

const DEFAULT_REGION_SLOTS: readonly (readonly [u: number, v: number])[] = [
  [0.18, 0.18],
  [0.39, 0.18],
  [0.61, 0.18],
  [0.82, 0.18],
  [0.18, 0.52],
  [0.39, 0.52],
  [0.61, 0.52],
  [0.82, 0.52],
  [0.18, 0.82],
  [0.39, 0.82],
  [0.61, 0.82],
  [0.82, 0.82],
];

function safeDefaultSlots(region: PlacementRegion): readonly {
  point: NormalizedPoint;
  u: number;
  v: number;
}[] {
  const slots =
    region.kind === 'ceiling'
      ? ([
          [0.16, 0.72],
          [0.38, 0.72],
          [0.6, 0.72],
          [0.82, 0.72],
          [0.3, 0.4],
          [0.7, 0.4],
        ] as const)
      : DEFAULT_REGION_SLOTS;
  return slots
    .map(([u, v]) => ({ point: pointOnRegion(region, u, v), u, v }))
    .filter(({ point }) => regionContainsPoint(region, point));
}

export function defaultRegionPlacement(
  roomId: string,
  kind: PlacementRegionKind,
  index = 0,
): { region: PlacementRegion; point: NormalizedPoint; u: number; v: number } | null {
  const regions = regionsForKinds(roomId, [kind]);
  const candidates = regions.flatMap((region) =>
    safeDefaultSlots(region).map((slot) => ({ region, ...slot })),
  );
  return candidates.length > 0 ? candidates[index % candidates.length] : null;
}

export function defaultCompatiblePlacement(
  roomId: string,
  profile: RegionCompatibilityProfile,
  index = 0,
): { region: PlacementRegion; point: NormalizedPoint; u: number; v: number } | null {
  const compatible = compatibleRegionsForProfile(roomId, profile);
  const preferred = profile.defaultRegionKind
    ? compatible.filter((region) => region.kind === profile.defaultRegionKind)
    : [];
  const ordered = preferred.length > 0 ? preferred : compatible;
  const candidates = ordered.flatMap((region) =>
    safeDefaultSlots(region).map((slot) => ({ region, ...slot })),
  );
  return candidates.length > 0 ? candidates[index % candidates.length] : null;
}

export function clampToRoomRegion(regionId: string, point: NormalizedPoint) {
  const region = placementRegionById(regionId);
  if (!region) return null;
  const clamped = clampPointToValidRegion(region, point);
  return clamped ? { region, ...clamped } : null;
}
