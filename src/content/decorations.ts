import type { DecorationDef } from './types';
import { ROOMS } from './rooms';
import { compatibleRegionsForProfile } from './roomSurfaces';
import { decorationSurface, regionKindForSurface } from '../sim/surfaces';

const ORDINARY_ROOMS = ROOMS.map((room) => room.id);

// Every decoration belongs to exactly ONE placement surface — floor, wall, or
// ceiling — derived from the item's authoritative surface classification. There
// are no sub-surfaces (no tabletops, shelves or feature spots): the entire
// floor, the entire wall and the entire ceiling of every room are valid, and a
// piece can only ever be placed on the single surface it was designed for
// (rugs on the floor, paintings on the wall, chandeliers on the ceiling).
function deco(
  id: string,
  room: string,
  morale: number,
  resource: 'nuts' | 'goldenNuts',
  amount: number,
): DecorationDef {
  const surface = decorationSurface(id);
  const kind = regionKindForSurface(surface);
  return {
    id,
    nameKey: `deco.${id}.name`,
    cost: { resource, amount },
    moraleBonus: morale,
    room,
    compatibleRooms: [...ORDINARY_ROOMS],
    compatibleSurfaces: [surface],
    defaultRegionKind: kind,
    compatibleRegionKinds: [kind],
    compatibleRegionSurfaces: [surface],
    compatibleSpecialTags: undefined,
    isStructural: false,
  };
}

export const DECORATIONS: DecorationDef[] = [
  // Founder's Desk
  deco('potted-fern', 'founder-desk', 1, 'nuts', 100),
  deco('desk-lamp', 'founder-desk', 1, 'nuts', 150),
  deco('motivational-poster', 'founder-desk', 2, 'nuts', 300),
  deco('tiny-rug', 'founder-desk', 1, 'nuts', 200),
  deco('window-view', 'founder-desk', 3, 'goldenNuts', 2),
  // Sorting
  deco('sorting-bins', 'sorting', 2, 'nuts', 500),
  deco('conveyor-plushie', 'sorting', 2, 'nuts', 800),
  deco('label-maker', 'sorting', 1, 'nuts', 400),
  // Coffee & Morale
  deco('beanbag-chairs', 'morale', 3, 'nuts', 1200),
  deco('snack-bar', 'morale', 4, 'nuts', 2000),
  deco('aquarium', 'morale', 5, 'goldenNuts', 3),
  deco('mood-lighting', 'morale', 3, 'nuts', 1500),
  // Procurement / Finance
  deco('filing-cabinet', 'procurement', 1, 'nuts', 600),
  deco('safe', 'procurement', 2, 'nuts', 2500),
  deco('security-cam', 'procurement', 2, 'nuts', 1800),
  // Construction
  deco('wooden-arch', 'construction', 3, 'nuts', 3000),
  deco('blueprint-wall', 'construction', 2, 'nuts', 2200),
  deco('sawdust-pile', 'construction', 1, 'nuts', 900),
  // Lab
  deco('bubbling-beakers', 'lab', 3, 'nuts', 4000),
  deco('hologram', 'lab', 4, 'goldenNuts', 3),
  deco('lab-plants', 'lab', 2, 'nuts', 2600),
  // Marketing
  deco('billboard', 'marketing', 4, 'nuts', 5000),
  deco('neon-sign', 'marketing', 3, 'nuts', 3500),
  deco('trophy-shelf', 'marketing', 3, 'nuts', 3000),
  // Vault
  deco('gold-carpet', 'vault', 5, 'goldenNuts', 4),
  deco('nut-statue', 'vault', 6, 'goldenNuts', 5),
  deco('chandelier', 'vault', 5, 'goldenNuts', 4),
  // Meeting
  deco('meeting-plant', 'meeting', 2, 'nuts', 2400),
  deco('projector', 'meeting', 3, 'nuts', 4200),
  // Nap
  deco('hammock', 'nap', 4, 'nuts', 3800),
  deco('star-ceiling', 'nap', 5, 'goldenNuts', 3),
  // Rooftop
  deco('rooftop-garden-bed', 'rooftop', 6, 'goldenNuts', 4),
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
