import type { DecorationDef } from './types';
import { ROOMS } from './rooms';
import { compatibleRegionsForProfile } from './roomSurfaces';
import { decorationSurface } from '../sim/surfaces';
import { REGION_KIND_SURFACE, type PlacementRegionKind } from '../sim/placementRegions';

const ORDINARY_ROOMS = ROOMS.map((room) => room.id);

// Cosmetic props remain portable across ordinary rooms. Their semantic support
// metadata is explicit; the regex-derived surface is retained only for legacy
// save projection until the renderer consumes room regions directly.
function deco(
  id: string,
  room: string,
  morale: number,
  resource: 'nuts' | 'goldenNuts',
  amount: number,
  defaultRegionKind: PlacementRegionKind,
  compatibleRegionKinds: PlacementRegionKind[] = [defaultRegionKind],
  compatibleSpecialTags?: string[],
): DecorationDef {
  return {
    id,
    nameKey: `deco.${id}.name`,
    cost: { resource, amount },
    moraleBonus: morale,
    room,
    compatibleRooms: [...ORDINARY_ROOMS],
    compatibleSurfaces: [decorationSurface(id)],
    defaultRegionKind,
    compatibleRegionKinds,
    compatibleRegionSurfaces: [
      ...new Set(compatibleRegionKinds.map((kind) => REGION_KIND_SURFACE[kind])),
    ],
    compatibleSpecialTags,
    isStructural: false,
  };
}

export const DECORATIONS: DecorationDef[] = [
  deco('potted-fern', 'founder-desk', 1, 'nuts', 100, 'floor', ['floor', 'tabletop', 'shelf']),
  deco('desk-lamp', 'founder-desk', 1, 'nuts', 150, 'tabletop', ['tabletop', 'shelf', 'floor']),
  deco('motivational-poster', 'founder-desk', 2, 'nuts', 300, 'wall'),
  deco('tiny-rug', 'founder-desk', 1, 'nuts', 200, 'rug-plane'),
  deco('window-view', 'founder-desk', 3, 'goldenNuts', 2, 'wall'),
  deco('sorting-bins', 'sorting', 2, 'nuts', 500, 'floor', ['floor', 'shelf']),
  deco('conveyor-plushie', 'sorting', 2, 'nuts', 800, 'shelf', ['shelf', 'tabletop', 'floor']),
  deco('label-maker', 'sorting', 1, 'nuts', 400, 'tabletop', ['tabletop', 'shelf', 'floor']),
  deco('beanbag-chairs', 'morale', 3, 'nuts', 1200, 'floor'),
  deco('snack-bar', 'morale', 4, 'nuts', 2000, 'floor'),
  deco('aquarium', 'morale', 5, 'goldenNuts', 3, 'tabletop', ['tabletop', 'floor']),
  deco('mood-lighting', 'morale', 3, 'nuts', 1500, 'wall'),
  deco('filing-cabinet', 'procurement', 1, 'nuts', 600, 'floor'),
  deco('safe', 'procurement', 2, 'nuts', 2500, 'floor'),
  deco('security-cam', 'procurement', 2, 'nuts', 1800, 'wall'),
  deco('wooden-arch', 'construction', 3, 'nuts', 3000, 'wall'),
  deco('blueprint-wall', 'construction', 2, 'nuts', 2200, 'wall'),
  deco('sawdust-pile', 'construction', 1, 'nuts', 900, 'floor'),
  deco('bubbling-beakers', 'lab', 3, 'nuts', 4000, 'tabletop', ['tabletop', 'shelf', 'floor']),
  deco('hologram', 'lab', 4, 'goldenNuts', 3, 'ceiling-rail'),
  deco('lab-plants', 'lab', 2, 'nuts', 2600, 'floor', ['floor', 'tabletop', 'shelf']),
  deco('billboard', 'marketing', 4, 'nuts', 5000, 'wall'),
  deco('neon-sign', 'marketing', 3, 'nuts', 3500, 'wall'),
  deco('trophy-shelf', 'marketing', 3, 'nuts', 3000, 'wall'),
  deco('gold-carpet', 'vault', 5, 'goldenNuts', 4, 'rug-plane'),
  deco('nut-statue', 'vault', 6, 'goldenNuts', 5, 'floor', ['floor', 'tabletop']),
  deco('chandelier', 'vault', 5, 'goldenNuts', 4, 'ceiling-rail'),
  deco('meeting-plant', 'meeting', 2, 'nuts', 2400, 'floor', ['floor', 'tabletop']),
  deco('projector', 'meeting', 3, 'nuts', 4200, 'tabletop', ['tabletop', 'shelf', 'wall']),
  deco('hammock', 'nap', 4, 'nuts', 3800, 'special', ['special', 'floor'], ['hammock', 'rest']),
  deco('star-ceiling', 'nap', 5, 'goldenNuts', 3, 'ceiling-rail'),
  deco(
    'rooftop-garden-bed',
    'rooftop',
    6,
    'goldenNuts',
    4,
    'special',
    ['special', 'floor'],
    ['garden', 'outdoor'],
  ),
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
    | 'missing-room-region';
  roomId?: string;
}

/** Static content audit: ordinary props must be portable and placeable everywhere promised. */
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
  }
  return issues;
}
