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
