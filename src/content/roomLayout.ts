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
}

export interface CharacterSlot {
  /** normalized 0..1 horizontal position (feeds `left: x%`). */
  x: number;
  /** pixels up from the floor line, for a gentle huddle depth. */
  bottom: number;
}

// Default anchor set used by most rooms: two back-wall "shelf" rows plus two
// lower corners. Auto-placement fills them in this order.
const TEMPLATE_ANCHORS: DecorAnchor[] = [
  { id: 'wall-l', x: 0.14, y: 40, scale: 0.85 },
  { id: 'wall-r', x: 0.86, y: 40, scale: 0.85 },
  { id: 'wall-cl', x: 0.36, y: 48, scale: 0.72 },
  { id: 'wall-cr', x: 0.64, y: 48, scale: 0.72 },
  { id: 'floor-l', x: 0.06, y: 2, scale: 1 },
  { id: 'floor-r', x: 0.95, y: 2, scale: 1 },
];

// Per-room overrides. The Founder's Desk keeps its front-right corner clear for
// the collectible crate, so its anchors hug the left and the back wall.
const ROOM_ANCHORS: Record<string, DecorAnchor[]> = {
  'founder-desk': [
    { id: 'wall-l', x: 0.12, y: 44, scale: 0.82 },
    { id: 'wall-cl', x: 0.3, y: 50, scale: 0.7 },
    { id: 'wall-c', x: 0.5, y: 52, scale: 0.68 },
    { id: 'wall-cr', x: 0.68, y: 46, scale: 0.72 },
    { id: 'floor-l', x: 0.05, y: 2, scale: 1 },
  ],
};

/** All decoration anchors available in a room (curated override or template). */
export function anchorsForRoom(roomId: string): DecorAnchor[] {
  return ROOM_ANCHORS[roomId] ?? TEMPLATE_ANCHORS;
}

export function anchorById(roomId: string, anchorId: string): DecorAnchor | undefined {
  return anchorsForRoom(roomId).find((a) => a.id === anchorId);
}

/**
 * Positions for `count` hired employees, clustered around the centre of the
 * floor so they look like a group instead of scattered dots. Spacing tightens
 * as the crowd grows; a slight alternating depth keeps overlaps readable.
 */
export function characterSlots(count: number): CharacterSlot[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0.5, bottom: 0 }];

  const spacing = count <= 3 ? 0.14 : count <= 5 ? 0.115 : count <= 7 ? 0.092 : Math.max(0.05, 0.74 / (count - 1));
  const total = (count - 1) * spacing;
  const start = Math.max(0.09, 0.5 - total / 2);

  return Array.from({ length: count }, (_, i) => {
    const x = Math.min(0.91, start + i * spacing);
    // gentle huddle: nudge alternating critters slightly up for depth
    const bottom = i % 2 === 1 ? 7 : 0;
    return { x, bottom };
  });
}
