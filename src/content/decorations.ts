import type { DecorationDef } from './types';
import { ROOMS } from './rooms';
import { compatibleRegionsForProfile } from './roomSurfaces';
import type { DecorationSurfaceType } from '../sim/types';
import type { PlacementRegionKind } from '../sim/placementRegions';

const ORDINARY_ROOMS = ROOMS.map((room) => room.id);

// Every decoration declares exactly one canonical support here. No filename
// regex, CSS class, renderer heuristic, or old save value is allowed to
// override this property. Legacy compatibility arrays are derived from it.
function deco(
  id: string,
  placementSurface: DecorationSurfaceType,
  room: string,
  morale: number,
  resource: 'nuts' | 'goldenNuts',
  amount: number,
): DecorationDef {
  const kind = placementSurface as PlacementRegionKind;
  return {
    id,
    nameKey: `deco.${id}.name`,
    cost: { resource, amount },
    moraleBonus: morale,
    room,
    compatibleRooms: [...ORDINARY_ROOMS],
    placementSurface,
    compatibleSurfaces: [placementSurface],
    defaultRegionKind: kind,
    compatibleRegionKinds: [kind],
    compatibleRegionSurfaces: [placementSurface],
    compatibleSpecialTags: undefined,
    isStructural: false,
  };
}

export const DECORATIONS: DecorationDef[] = [
  // Founder's Desk
  deco('potted-fern', 'floor', 'founder-desk', 1, 'nuts', 100),
  deco('desk-lamp', 'floor', 'founder-desk', 1, 'nuts', 150),
  deco('motivational-poster', 'wall', 'founder-desk', 2, 'nuts', 300),
  deco('tiny-rug', 'floor', 'founder-desk', 1, 'nuts', 200),
  deco('window-view', 'wall', 'founder-desk', 3, 'goldenNuts', 2),
  // Sorting
  deco('sorting-bins', 'floor', 'sorting', 2, 'nuts', 500),
  deco('conveyor-plushie', 'floor', 'sorting', 2, 'nuts', 800),
  deco('label-maker', 'floor', 'sorting', 1, 'nuts', 400),
  // Coffee & Morale
  deco('beanbag-chairs', 'floor', 'morale', 3, 'nuts', 1200),
  deco('snack-bar', 'floor', 'morale', 4, 'nuts', 2000),
  deco('aquarium', 'floor', 'morale', 5, 'goldenNuts', 3),
  deco('mood-lighting', 'floor', 'morale', 3, 'nuts', 1500),
  // Procurement / Finance
  deco('filing-cabinet', 'floor', 'procurement', 1, 'nuts', 600),
  deco('safe', 'floor', 'procurement', 2, 'nuts', 2500),
  deco('security-cam', 'wall', 'procurement', 2, 'nuts', 1800),
  // Construction
  deco('wooden-arch', 'floor', 'construction', 3, 'nuts', 3000),
  deco('blueprint-wall', 'wall', 'construction', 2, 'nuts', 2200),
  deco('sawdust-pile', 'floor', 'construction', 1, 'nuts', 900),
  // Lab
  deco('bubbling-beakers', 'floor', 'lab', 3, 'nuts', 4000),
  deco('hologram', 'ceiling', 'lab', 4, 'goldenNuts', 3),
  deco('lab-plants', 'floor', 'lab', 2, 'nuts', 2600),
  // Marketing — billboard is a standing floor sign, never wall-mounted.
  deco('billboard', 'floor', 'marketing', 4, 'nuts', 5000),
  deco('neon-sign', 'wall', 'marketing', 3, 'nuts', 3500),
  deco('trophy-shelf', 'wall', 'marketing', 3, 'nuts', 3000),
  // Vault
  deco('gold-carpet', 'floor', 'vault', 5, 'goldenNuts', 4),
  deco('nut-statue', 'floor', 'vault', 6, 'goldenNuts', 5),
  deco('chandelier', 'ceiling', 'vault', 5, 'goldenNuts', 4),
  // Meeting
  deco('meeting-plant', 'floor', 'meeting', 2, 'nuts', 2400),
  deco('projector', 'floor', 'meeting', 3, 'nuts', 4200),
  // Nap
  deco('hammock', 'floor', 'nap', 4, 'nuts', 3800),
  deco('star-ceiling', 'ceiling', 'nap', 5, 'goldenNuts', 3),
  // Rooftop
  deco('rooftop-garden-bed', 'floor', 'rooftop', 6, 'goldenNuts', 4),

  // --- Second expansion: the five newest departments -----------------------
  // cafeteria
  deco('coffee-urn', 'floor', 'cafeteria', 3, 'nuts', 1400),
  deco('tray-stack', 'floor', 'cafeteria', 2, 'nuts', 700),
  deco('menu-chalkboard', 'wall', 'cafeteria', 2, 'nuts', 900),
  // mailroom
  deco('pigeonholes', 'floor', 'mailroom', 2, 'nuts', 1800),
  deco('parcel-stack', 'floor', 'mailroom', 1, 'nuts', 600),
  deco('postal-scale', 'floor', 'mailroom', 2, 'nuts', 1100),
  // security
  deco('monitor-stack', 'floor', 'security', 3, 'nuts', 2600),
  deco('key-cabinet', 'wall', 'security', 2, 'nuts', 1300),
  deco('torch-rack', 'floor', 'security', 1, 'nuts', 800),
  // archive
  deco('box-tower', 'floor', 'archive', 2, 'nuts', 1500),
  deco('card-catalogue', 'floor', 'archive', 3, 'nuts', 3200),
  deco('index-board', 'wall', 'archive', 2, 'nuts', 1000),
  // incubator
  deco('warming-lamp', 'ceiling', 'incubator', 3, 'nuts', 2200),
  deco('seed-tray', 'floor', 'incubator', 2, 'nuts', 900),
  deco('glass-dome', 'floor', 'incubator', 4, 'goldenNuts', 3),

  // --- Rooms the original catalogue never covered --------------------------
  // research
  deco('specimen-shelf', 'floor', 'research', 2, 'nuts', 2800),
  deco('data-plotter', 'floor', 'research', 3, 'nuts', 3600),
  deco('observation-mirror', 'wall', 'research', 2, 'nuts', 2400),
  // basement
  deco('sump-pump', 'floor', 'basement', 1, 'nuts', 1200),
  deco('pipe-cluster', 'wall', 'basement', 1, 'nuts', 700),
  deco('bare-bulb', 'ceiling', 'basement', 1, 'nuts', 500),
  // rooftop
  deco('weather-vane', 'floor', 'rooftop', 2, 'nuts', 1600),
  deco('planter-row', 'floor', 'rooftop', 3, 'nuts', 2000),
];

export const DECORATIONS_BY_ID: Record<string, DecorationDef> = Object.fromEntries(
  DECORATIONS.map((decoration) => [decoration.id, decoration]),
);

export interface DecorationCatalogIssue {
  decorationId: string;
  code:
    | 'ordinary-room-lock'
    | 'unknown-compatible-room'
    | 'missing-default-room'
    | 'missing-compatible-surface'
    | 'missing-compatible-region-kind'
    | 'missing-default-region-kind'
    | 'contradictory-surface'
    | 'missing-room-region';
  roomId?: string;
}

/** Static content audit: ordinary props must be portable and internally exclusive. */
export function auditDecorationCatalog(): DecorationCatalogIssue[] {
  const roomIds = new Set(ROOMS.map((room) => room.id));
  const issues: DecorationCatalogIssue[] = [];
  for (const def of DECORATIONS) {
    if (!def.compatibleRooms.includes(def.room)) {
      issues.push({ decorationId: def.id, code: 'missing-default-room', roomId: def.room });
    }
    for (const roomId of def.compatibleRooms) {
      if (!roomIds.has(roomId)) {
        issues.push({ decorationId: def.id, code: 'unknown-compatible-room', roomId });
      } else if (compatibleRegionsForProfile(roomId, def).length === 0) {
        issues.push({ decorationId: def.id, code: 'missing-room-region', roomId });
      }
    }
    if (!def.isStructural) {
      for (const roomId of roomIds) {
        if (!def.compatibleRooms.includes(roomId)) {
          issues.push({ decorationId: def.id, code: 'ordinary-room-lock', roomId });
        }
      }
    }
    if (def.compatibleSurfaces.length === 0) {
      issues.push({ decorationId: def.id, code: 'missing-compatible-surface' });
    }
    if (def.compatibleRegionKinds.length === 0) {
      issues.push({ decorationId: def.id, code: 'missing-compatible-region-kind' });
    }
    if (!def.compatibleRegionKinds.includes(def.defaultRegionKind)) {
      issues.push({ decorationId: def.id, code: 'missing-default-region-kind' });
    }
    if (
      def.compatibleSurfaces.length !== 1 ||
      def.compatibleSurfaces[0] !== def.placementSurface ||
      def.compatibleRegionKinds.length !== 1 ||
      def.defaultRegionKind !== def.placementSurface ||
      def.compatibleRegionSurfaces.length !== 1 ||
      def.compatibleRegionSurfaces[0] !== def.placementSurface
    ) {
      issues.push({ decorationId: def.id, code: 'contradictory-surface' });
    }
  }
  return issues;
}
