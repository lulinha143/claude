import type { DecorationDef } from './types';
import { ROOMS } from './rooms';
import { decorationSurface } from '../sim/surfaces';

const ORDINARY_ROOMS = ROOMS.map((room) => room.id);

// 30 cosmetic decorations. Each grants a small morale bonus and belongs to a
// room. Purchased with nuts (common) or golden nuts (premium).
function deco(
  id: string,
  room: string,
  morale: number,
  resource: 'nuts' | 'goldenNuts',
  amount: number,
): DecorationDef {
  return {
    id,
    nameKey: `deco.${id}.name`,
    cost: { resource, amount },
    moraleBonus: morale,
    room,
    compatibleRooms: [...ORDINARY_ROOMS],
    compatibleSurfaces: [decorationSurface(id)],
    isStructural: false,
  };
}

export const DECORATIONS: DecorationDef[] = [
  deco('potted-fern', 'founder-desk', 1, 'nuts', 100),
  deco('desk-lamp', 'founder-desk', 1, 'nuts', 150),
  deco('motivational-poster', 'founder-desk', 2, 'nuts', 300),
  deco('tiny-rug', 'founder-desk', 1, 'nuts', 200),
  deco('window-view', 'founder-desk', 3, 'goldenNuts', 2),
  deco('sorting-bins', 'sorting', 2, 'nuts', 500),
  deco('conveyor-plushie', 'sorting', 2, 'nuts', 800),
  deco('label-maker', 'sorting', 1, 'nuts', 400),
  deco('beanbag-chairs', 'morale', 3, 'nuts', 1200),
  deco('snack-bar', 'morale', 4, 'nuts', 2000),
  deco('aquarium', 'morale', 5, 'goldenNuts', 3),
  deco('mood-lighting', 'morale', 3, 'nuts', 1500),
  deco('filing-cabinet', 'procurement', 1, 'nuts', 600),
  deco('safe', 'procurement', 2, 'nuts', 2500),
  deco('security-cam', 'procurement', 2, 'nuts', 1800),
  deco('wooden-arch', 'construction', 3, 'nuts', 3000),
  deco('blueprint-wall', 'construction', 2, 'nuts', 2200),
  deco('sawdust-pile', 'construction', 1, 'nuts', 900),
  deco('bubbling-beakers', 'lab', 3, 'nuts', 4000),
  deco('hologram', 'lab', 4, 'goldenNuts', 3),
  deco('lab-plants', 'lab', 2, 'nuts', 2600),
  deco('billboard', 'marketing', 4, 'nuts', 5000),
  deco('neon-sign', 'marketing', 3, 'nuts', 3500),
  deco('trophy-shelf', 'marketing', 3, 'nuts', 3000),
  deco('gold-carpet', 'vault', 5, 'goldenNuts', 4),
  deco('nut-statue', 'vault', 6, 'goldenNuts', 5),
  deco('chandelier', 'vault', 5, 'goldenNuts', 4),
  deco('meeting-plant', 'meeting', 2, 'nuts', 2400),
  deco('projector', 'meeting', 3, 'nuts', 4200),
  deco('hammock', 'nap', 4, 'nuts', 3800),
  deco('star-ceiling', 'nap', 5, 'goldenNuts', 3),
  deco('rooftop-garden-bed', 'rooftop', 6, 'goldenNuts', 4),
];

export const DECORATIONS_BY_ID: Record<string, DecorationDef> = Object.fromEntries(
  DECORATIONS.map((d) => [d.id, d]),
);
