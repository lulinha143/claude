import type { RoomDef } from './types';

// Eighteen visually distinct rooms/floors. The office scene stacks these vertically
// as they unlock, and several share a floor so the building fills out sideways too.
// `founder-desk` is always present.
export const ROOMS: RoomDef[] = [
  {
    id: 'founder-desk',
    nameKey: 'room.founderDesk.name',
    descriptionKey: 'room.founderDesk.desc',
    floor: 0,
    unlock: {},
  },
  {
    id: 'sorting',
    nameKey: 'room.sorting.name',
    descriptionKey: 'room.sorting.desc',
    floor: 1,
    unlock: { upgradeId: 'room-sorting' },
  },
  {
    id: 'morale',
    nameKey: 'room.morale.name',
    descriptionKey: 'room.morale.desc',
    floor: 1,
    unlock: { reputation: 5 },
  },
  {
    id: 'procurement',
    nameKey: 'room.procurement.name',
    descriptionKey: 'room.procurement.desc',
    floor: 2,
    unlock: { reputation: 15 },
  },
  {
    id: 'construction',
    nameKey: 'room.construction.name',
    descriptionKey: 'room.construction.desc',
    floor: 2,
    unlock: { reputation: 30 },
  },
  {
    id: 'lab',
    nameKey: 'room.lab.name',
    descriptionKey: 'room.lab.desc',
    floor: 3,
    unlock: { upgradeId: 'room-lab' },
  },
  {
    id: 'marketing',
    nameKey: 'room.marketing.name',
    descriptionKey: 'room.marketing.desc',
    floor: 3,
    unlock: { reputation: 50 },
  },
  {
    id: 'vault',
    nameKey: 'room.vault.name',
    descriptionKey: 'room.vault.desc',
    floor: 4,
    unlock: { upgradeId: 'room-vault' },
  },
  {
    id: 'research',
    nameKey: 'room.research.name',
    descriptionKey: 'room.research.desc',
    floor: 4,
    unlock: { reputation: 80 },
  },
  {
    id: 'meeting',
    nameKey: 'room.meeting.name',
    descriptionKey: 'room.meeting.desc',
    floor: 5,
    unlock: { upgradeId: 'room-meeting' },
  },
  {
    id: 'nap',
    nameKey: 'room.nap.name',
    descriptionKey: 'room.nap.desc',
    floor: 5,
    unlock: { reputation: 120 },
  },
  {
    id: 'basement',
    nameKey: 'room.basement.name',
    descriptionKey: 'room.basement.desc',
    floor: -1,
    unlock: { upgradeId: 'room-basement' },
  },
  {
    id: 'rooftop',
    nameKey: 'room.rooftop.name',
    descriptionKey: 'room.rooftop.desc',
    floor: 6,
    unlock: { reputation: 200 },
  },

  // --- Second expansion: the company outgrows a single corridor ---------------
  // Placed on existing floors so the building fills OUT as well as up, and gated
  // so each arrives when the player has a reason to want what it does.
  {
    id: 'cafeteria',
    nameKey: 'room.cafeteria.name',
    descriptionKey: 'room.cafeteria.desc',
    floor: 0,
    unlock: { reputation: 8 },
  },
  {
    id: 'mailroom',
    nameKey: 'room.mailroom.name',
    descriptionKey: 'room.mailroom.desc',
    floor: 1,
    unlock: { upgradeId: 'room-mailroom' },
  },
  {
    id: 'security',
    nameKey: 'room.security.name',
    descriptionKey: 'room.security.desc',
    floor: 2,
    unlock: { reputation: 45 },
  },
  {
    id: 'archive',
    nameKey: 'room.archive.name',
    descriptionKey: 'room.archive.desc',
    floor: 3,
    unlock: { upgradeId: 'room-archive' },
  },
  {
    id: 'incubator',
    nameKey: 'room.incubator.name',
    descriptionKey: 'room.incubator.desc',
    floor: 4,
    unlock: { reputation: 300 },
  },
  {
    id: 'broadcast',
    nameKey: 'room.broadcast.name',
    descriptionKey: 'room.broadcast.desc',
    floor: 2,
    unlock: { reputation: 22 },
  },
  {
    id: 'repair',
    nameKey: 'room.repair.name',
    descriptionKey: 'room.repair.desc',
    floor: 3,
    unlock: { reputation: 65 },
  },
  {
    id: 'conservatory',
    nameKey: 'room.conservatory.name',
    descriptionKey: 'room.conservatory.desc',
    floor: 5,
    unlock: { reputation: 145 },
  },
];

export const ROOMS_BY_ID: Record<string, RoomDef> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
