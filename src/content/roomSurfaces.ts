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

type PlaneSpec = readonly [
  left: number,
  right: number,
  bottom: number,
  top: number,
  topInset?: number,
];

interface SpecialRegionSpec {
  name: string;
  plane: PlaneSpec;
  surfaceType?: DecorationSurfaceType;
  anchorMode?: PlacementAnchorMode;
  tags: readonly string[];
}

interface RoomSurfaceLayout {
  table: PlaneSpec;
  shelf: PlaneSpec;
  special: SpecialRegionSpec;
}

export interface RegionCompatibilityProfile {
  defaultRegionKind?: PlacementRegionKind;
  compatibleRegionKinds: readonly PlacementRegionKind[];
  compatibleRegionSurfaces: readonly DecorationSurfaceType[];
  compatibleSpecialTags?: readonly string[];
}

/**
 * Room-specific support geometry. Broad architectural planes are shared, while
 * table, shelf, and special supports are deliberately authored per room so
 * future art can move without changing persisted decoration coordinates.
 */
const ROOM_LAYOUTS: Record<string, RoomSurfaceLayout> = {
  'founder-desk': {
    table: [0.3, 0.72, 0.19, 0.29, 0.04],
    shelf: [0.08, 0.38, 0.55, 0.65],
    special: {
      name: 'founder-desk',
      plane: [0.38, 0.68, 0.08, 0.2, 0.03],
      tags: ['desk', 'workstation'],
    },
  },
  sorting: {
    table: [0.27, 0.74, 0.18, 0.28, 0.05],
    shelf: [0.62, 0.9, 0.54, 0.64],
    special: {
      name: 'conveyor',
      plane: [0.2, 0.82, 0.06, 0.17, 0.07],
      tags: ['conveyor', 'sorting'],
    },
  },
  morale: {
    table: [0.36, 0.78, 0.2, 0.3, 0.05],
    shelf: [0.08, 0.36, 0.56, 0.66],
    special: {
      name: 'coffee-counter',
      plane: [0.08, 0.34, 0.18, 0.3, 0.02],
      surfaceType: 'table',
      tags: ['coffee', 'counter'],
    },
  },
  procurement: {
    table: [0.28, 0.66, 0.18, 0.28, 0.04],
    shelf: [0.61, 0.91, 0.53, 0.64],
    special: {
      name: 'filing-zone',
      plane: [0.08, 0.28, 0.04, 0.22, 0.02],
      tags: ['filing', 'storage'],
    },
  },
  construction: {
    table: [0.34, 0.77, 0.18, 0.29, 0.05],
    shelf: [0.07, 0.35, 0.54, 0.64],
    special: {
      name: 'workbench',
      plane: [0.26, 0.78, 0.18, 0.3, 0.06],
      surfaceType: 'table',
      tags: ['tools', 'workbench'],
    },
  },
  lab: {
    table: [0.27, 0.75, 0.2, 0.31, 0.05],
    shelf: [0.62, 0.91, 0.55, 0.66],
    special: {
      name: 'experiment-bench',
      plane: [0.24, 0.78, 0.2, 0.32, 0.06],
      surfaceType: 'table',
      tags: ['science', 'experiment'],
    },
  },
  marketing: {
    table: [0.3, 0.71, 0.18, 0.28, 0.04],
    shelf: [0.08, 0.41, 0.54, 0.64],
    special: {
      name: 'campaign-display',
      plane: [0.56, 0.88, 0.46, 0.72],
      surfaceType: 'wall',
      anchorMode: 'center',
      tags: ['campaign', 'display'],
    },
  },
  vault: {
    table: [0.34, 0.73, 0.18, 0.28, 0.04],
    shelf: [0.62, 0.91, 0.54, 0.64],
    special: { name: 'vault-dais', plane: [0.33, 0.69, 0.05, 0.2, 0.04], tags: ['secure', 'dais'] },
  },
  research: {
    table: [0.28, 0.74, 0.2, 0.31, 0.05],
    shelf: [0.07, 0.36, 0.55, 0.66],
    special: {
      name: 'prototype-bench',
      plane: [0.24, 0.78, 0.2, 0.32, 0.06],
      surfaceType: 'table',
      tags: ['prototype', 'research'],
    },
  },
  meeting: {
    table: [0.22, 0.8, 0.18, 0.31, 0.07],
    shelf: [0.63, 0.91, 0.54, 0.64],
    special: {
      name: 'conference-table',
      plane: [0.2, 0.82, 0.16, 0.32, 0.08],
      surfaceType: 'table',
      tags: ['conference', 'group'],
    },
  },
  nap: {
    table: [0.36, 0.7, 0.18, 0.27, 0.03],
    shelf: [0.08, 0.36, 0.54, 0.64],
    special: {
      name: 'hammock-bay',
      plane: [0.2, 0.8, 0.13, 0.34, 0.08],
      tags: ['hammock', 'rest'],
    },
  },
  basement: {
    table: [0.3, 0.73, 0.18, 0.28, 0.04],
    shelf: [0.62, 0.92, 0.54, 0.64],
    special: {
      name: 'pipe-bay',
      plane: [0.07, 0.28, 0.45, 0.76],
      surfaceType: 'wall',
      anchorMode: 'center',
      tags: ['pipes', 'utility'],
    },
  },
  rooftop: {
    table: [0.28, 0.75, 0.18, 0.29, 0.05],
    shelf: [0.08, 0.36, 0.53, 0.63],
    special: {
      name: 'garden-bed',
      plane: [0.18, 0.84, 0.04, 0.2, 0.08],
      tags: ['garden', 'outdoor'],
    },
  },
};

const WINDOW_EXCLUSION: NormalizedPlacementPlane = placementPlane(0.69, 0.91, 0.56, 0.82);
const FLOOR_FIXTURE_EXCLUSION: NormalizedPlacementPlane = placementPlane(
  0.03,
  0.23,
  0.02,
  0.22,
  0.02,
);
const WALL_FIXTURE_EXCLUSION: NormalizedPlacementPlane = placementPlane(0.04, 0.28, 0.5, 0.76);
const FLOOR_BUILT_INS = new Set<RoomBuiltInKind>(['counter', 'cabinet', 'lab', 'plant']);

function makeRegion(
  roomId: string,
  kind: PlacementRegionKind,
  slot: string,
  plane: NormalizedPlacementPlane,
  options: {
    surfaceType?: DecorationSurfaceType;
    anchorMode: PlacementAnchorMode;
    depth: PlacementRegion['depth'];
    priority: number;
    capacity?: number;
    tags: readonly string[];
    exclusions?: PlacementRegion['exclusions'];
  },
): PlacementRegion {
  return {
    id: `${roomId}:${kind}:${slot}`,
    roomId,
    kind,
    surfaceType: options.surfaceType ?? REGION_KIND_SURFACE[kind],
    plane,
    anchorMode: options.anchorMode,
    depth: options.depth,
    priority: options.priority,
    capacity: options.capacity,
    tags: options.tags,
    exclusions: options.exclusions ?? [],
  };
}

function buildRoomRegions(roomId: string, layout: RoomSurfaceLayout): readonly PlacementRegion[] {
  const builtIn = ROOM_BUILTIN[roomId];
  const floorExclusions = FLOOR_BUILT_INS.has(builtIn)
    ? [{ id: `${roomId}:fixture`, plane: FLOOR_FIXTURE_EXCLUSION }]
    : [];
  const wallExclusions = [
    { id: `${roomId}:window`, plane: WINDOW_EXCLUSION },
    ...(!FLOOR_BUILT_INS.has(builtIn)
      ? [{ id: `${roomId}:fixture`, plane: WALL_FIXTURE_EXCLUSION }]
      : []),
  ];
  const specialPlane = placementPlane(...layout.special.plane);
  const specialSurface = layout.special.surfaceType ?? 'floor';
  const specialDepth: PlacementRegion['depth'] =
    specialSurface === 'wall'
      ? { min: 1, max: 1, default: 1 }
      : specialSurface === 'table'
        ? { min: 3, max: 5, default: 4 }
        : { min: 3, max: 6, default: 4 };

  return [
    makeRegion(roomId, 'floor', 'main', placementPlane(0.04, 0.96, 0.01, 0.35, 0.1), {
      anchorMode: 'base',
      depth: { min: 2, max: 5, default: 3 },
      priority: 10,
      capacity: 8,
      tags: ['grounded', 'perspective'],
      exclusions: floorExclusions,
    }),
    makeRegion(roomId, 'rug-plane', 'main', placementPlane(0.16, 0.84, 0.025, 0.25, 0.12), {
      anchorMode: 'center',
      depth: { min: 0, max: 0, default: 0 },
      priority: 40,
      capacity: 1,
      tags: ['flat', 'underlay', 'perspective'],
    }),
    makeRegion(roomId, 'wall', 'main', placementPlane(0.05, 0.95, 0.4, 0.83), {
      anchorMode: 'center',
      depth: { min: 1, max: 1, default: 1 },
      priority: 20,
      capacity: 6,
      tags: ['vertical', 'backdrop'],
      exclusions: wallExclusions,
    }),
    makeRegion(roomId, 'ceiling-rail', 'main', placementPlane(0.12, 0.88, 0.85, 0.97), {
      anchorMode: 'hanging',
      depth: { min: 6, max: 7, default: 6 },
      priority: 50,
      capacity: 3,
      tags: ['hanging', 'rail'],
    }),
    makeRegion(roomId, 'tabletop', 'main', placementPlane(...layout.table), {
      anchorMode: 'base',
      depth: { min: 3, max: 5, default: 4 },
      priority: 60,
      capacity: 4,
      tags: ['supported', 'table'],
    }),
    makeRegion(roomId, 'shelf', 'main', placementPlane(...layout.shelf), {
      anchorMode: 'base',
      depth: { min: 2, max: 3, default: 2 },
      priority: 65,
      capacity: 3,
      tags: ['supported', 'shelf'],
    }),
    makeRegion(roomId, 'special', layout.special.name, specialPlane, {
      surfaceType: specialSurface,
      anchorMode: layout.special.anchorMode ?? 'base',
      depth: specialDepth,
      priority: 80,
      capacity: 2,
      tags: ['room-specific', ...layout.special.tags],
    }),
  ];
}

export const ROOM_SURFACES: Record<string, readonly PlacementRegion[]> = Object.fromEntries(
  ROOMS.map((room) => [room.id, buildRoomRegions(room.id, ROOM_LAYOUTS[room.id])]),
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
  const specialTags = new Set(profile.compatibleSpecialTags ?? []);
  return regionsForKinds(roomId, profile.compatibleRegionKinds).filter((region) => {
    if (!surfaces.has(region.surfaceType)) return false;
    if (region.kind !== 'special' || specialTags.size === 0) return true;
    return region.tags.some((tag) => specialTags.has(tag));
  });
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
    region.kind === 'rug-plane'
      ? ([[0.5, 0.5]] as const)
      : region.kind === 'ceiling-rail'
        ? ([
            [0.22, 0.72],
            [0.5, 0.72],
            [0.78, 0.72],
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
