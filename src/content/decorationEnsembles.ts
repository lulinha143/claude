import type { RoomEffectKind } from './roomProfiles';

export interface DecorationEnsemble {
  id: string;
  roomId: string;
  items: readonly string[];
  effect: { kind: RoomEffectKind; value: number };
}

// A room's purpose made visible. These are modest, additive benefits for a
// complete arrangement, never a reward for repeatedly buying or moving a piece.
export const DECORATION_ENSEMBLES: readonly DecorationEnsemble[] = [
  {
    id: 'quiet-corner',
    roomId: 'founder-desk',
    items: ['potted-fern', 'desk-lamp', 'tiny-rug'],
    effect: { kind: 'comboWindow', value: 0.1 },
  },
  {
    id: 'proper-break',
    roomId: 'morale',
    items: ['beanbag-chairs', 'snack-bar', 'aquarium'],
    effect: { kind: 'moraleTarget', value: 3 },
  },
  {
    id: 'living-lab',
    roomId: 'lab',
    items: ['bubbling-beakers', 'lab-plants', 'hologram'],
    effect: { kind: 'production', value: 0.04 },
  },
  {
    id: 'paper-trail',
    roomId: 'archive',
    items: ['box-tower', 'card-catalogue', 'index-board'],
    effect: { kind: 'costReduction', value: 0.02 },
  },
  {
    id: 'night-watch',
    roomId: 'security',
    items: ['monitor-stack', 'key-cabinet', 'torch-rack'],
    effect: { kind: 'eventLuck', value: 0.04 },
  },
  {
    id: 'sprout-club',
    roomId: 'incubator',
    items: ['warming-lamp', 'seed-tray', 'glass-dome'],
    effect: { kind: 'moraleRegen', value: 0.08 },
  },
];
