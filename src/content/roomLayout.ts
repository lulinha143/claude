// Curated spatial layout for each office room. Two concerns live here:
//
//   1. Character slots — where hired employees stand. Instead of spreading
//      critters evenly across the whole floor (the old `18 + idx*26%` which
//      left them far apart and looked random), we cluster them near the centre
//      so a room reads as a little group working together. See characterSlots.
//
//   2. Decoration anchors — a small set of fixed, hand-placed spots a
//      decoration can occupy (two lower corners + a back "shelf" wall). The
//      player places/moves decorations between these anchors, so placement is
//      predictable and never overlaps the working critters.
//
// Coordinates are normalized to the floor stage:
//   x: 0..1 across the width (0 = far left, 1 = far right)
//   y: pixels UP from the floor line (0 = standing on the floor)
//   scale: optional size multiplier for the prop glyph

export interface DecorAnchor {
  id: string;
  x: number;
  y: number;
  scale: number;
  /** 'back' = behind the critters (walls/shelves); 'front' = framing foreground. */
  layer: 'back' | 'front';
}

export interface CharacterSlot {
  /** normalized 0..1 horizontal position (feeds `left: x%`). */
  x: number;
  /** pixels up from the floor line, for a gentle huddle depth. */
  bottom: number;
}

// Default composition used by most rooms. Decorations are now large furniture
// pieces spread across the whole room: tall wall pieces at the back, mid-wall
// shelf pieces, and big framing pieces in the two front corners (which sit in
// FRONT of the critters for real depth). Auto-placement fills them in this
// order, so a freshly-bought piece lands somewhere sensible.
const TEMPLATE_ANCHORS: DecorAnchor[] = [
  { id: 'wall-l', x: 0.12, y: 52, scale: 1.25, layer: 'back' },
  { id: 'wall-r', x: 0.88, y: 52, scale: 1.25, layer: 'back' },
  { id: 'floor-l', x: 0.08, y: 0, scale: 1.5, layer: 'front' },
  { id: 'floor-r', x: 0.92, y: 0, scale: 1.5, layer: 'front' },
  { id: 'wall-cl', x: 0.33, y: 62, scale: 1.0, layer: 'back' },
  { id: 'wall-cr', x: 0.67, y: 62, scale: 1.0, layer: 'back' },
];

// Per-room overrides. The Founder's Desk keeps its front-right corner clear for
// the collectible crate, so its big pieces hug the left corner and the wall.
const ROOM_ANCHORS: Record<string, DecorAnchor[]> = {
  'founder-desk': [
    { id: 'wall-l', x: 0.12, y: 54, scale: 1.2, layer: 'back' },
    { id: 'wall-cl', x: 0.34, y: 64, scale: 0.95, layer: 'back' },
    { id: 'wall-c', x: 0.52, y: 66, scale: 0.9, layer: 'back' },
    { id: 'wall-cr', x: 0.72, y: 56, scale: 1.0, layer: 'back' },
    { id: 'floor-l', x: 0.08, y: 0, scale: 1.5, layer: 'front' },
  ],
};

/** All decoration anchors available in a room (curated override or template). */
export function anchorsForRoom(roomId: string): DecorAnchor[] {
  return ROOM_ANCHORS[roomId] ?? TEMPLATE_ANCHORS;
}

export function anchorById(roomId: string, anchorId: string): DecorAnchor | undefined {
  return anchorsForRoom(roomId).find((a) => a.id === anchorId);
}

// Each room type gets a distinct composition style so a lab doesn't arrange
// itself like the nap chamber. Styles are generated per employee count (a
// curated feel without hand-placing every count for every room), always kept
// centred and within [0.08, 0.92] so nobody drifts off-screen.
type SlotStyle = 'founder' | 'pairs' | 'social' | 'row' | 'cluster';

const ROOM_STYLE: Record<string, SlotStyle> = {
  'founder-desk': 'founder',
  sorting: 'pairs',
  lab: 'pairs',
  research: 'pairs',
  construction: 'pairs',
  procurement: 'pairs',
  morale: 'social',
  meeting: 'social',
  nap: 'social',
  rooftop: 'social',
  marketing: 'row',
  vault: 'row',
  basement: 'row',
};

const clampX = (x: number) => Math.max(0.08, Math.min(0.92, x));

/**
 * Positions for `count` hired employees. When a `roomId` is given, a curated
 * per-room composition style is used (founder focal point, facing pairs, social
 * huddle, or a tidy row); otherwise a centred cluster. All styles keep the group
 * readable and coworkers close together.
 */
export function characterSlots(count: number, roomId?: string): CharacterSlot[] {
  if (count <= 0) return [];
  const style: SlotStyle = (roomId && ROOM_STYLE[roomId]) || 'cluster';
  switch (style) {
    case 'founder':
      return founderSlots(count);
    case 'pairs':
      return pairSlots(count);
    case 'social':
      return socialSlots(count);
    case 'row':
      return rowSlots(count);
    default:
      return clusterSlots(count);
  }
}

function clusterSlots(count: number): CharacterSlot[] {
  if (count === 1) return [{ x: 0.5, bottom: 0 }];
  const spacing = count <= 3 ? 0.14 : count <= 5 ? 0.115 : count <= 7 ? 0.092 : Math.max(0.05, 0.74 / (count - 1));
  const total = (count - 1) * spacing;
  const start = Math.max(0.09, 0.5 - total / 2);
  return Array.from({ length: count }, (_, i) => ({
    x: clampX(start + i * spacing),
    bottom: i % 2 === 1 ? 7 : 0,
  }));
}

// Founder's Desk: occupant 0 is the focal character front-centre; any others
// flank symmetrically a little further back.
function founderSlots(count: number): CharacterSlot[] {
  const slots: CharacterSlot[] = [{ x: 0.5, bottom: 0 }];
  for (let i = 1; i < count; i += 1) {
    const rank = Math.ceil(i / 2);
    const dir = i % 2 === 1 ? -1 : 1;
    slots.push({ x: clampX(0.5 + dir * (0.16 + (rank - 1) * 0.14)), bottom: 12 });
  }
  return slots;
}

// Facing pairs (labs, workshops): two centred columns, each new pair stepping
// up in depth so they read as desks facing each other.
function pairSlots(count: number): CharacterSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    const rowIdx = Math.floor(i / 2);
    return { x: clampX(left ? 0.38 : 0.62), bottom: Math.min(34, rowIdx * 10) };
  });
}

// Social huddle (coffee, meeting, nap, rooftop): tight cluster with lively depth
// variance so it reads as a group hanging out together.
function socialSlots(count: number): CharacterSlot[] {
  if (count === 1) return [{ x: 0.5, bottom: 4 }];
  const spacing = count <= 4 ? 0.1 : Math.max(0.055, 0.62 / (count - 1));
  const total = (count - 1) * spacing;
  const start = 0.5 - total / 2;
  const depth = [0, 10, 4, 12, 2, 8];
  return Array.from({ length: count }, (_, i) => ({
    x: clampX(start + i * spacing),
    bottom: depth[i % depth.length],
  }));
}

// Tidy even row (marketing, vault, basement): balanced line across the centre.
function rowSlots(count: number): CharacterSlot[] {
  if (count === 1) return [{ x: 0.5, bottom: 0 }];
  const spacing = Math.min(0.15, 0.72 / (count - 1));
  const total = (count - 1) * spacing;
  const start = 0.5 - total / 2;
  return Array.from({ length: count }, (_, i) => ({ x: clampX(start + i * spacing), bottom: 0 }));
}
