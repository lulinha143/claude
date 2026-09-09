// Curated spatial layout for each office room.
//
// Character slots decide WHERE hired employees stand. The one hard rule is
// readability: no two teammates may overlap, at any employee count, in any
// room. We guarantee this by spreading everyone horizontally with a real gap
// (which widens the group as the room fills) and then layering a per-room
// depth rhythm on top for personality — facing desks, a social huddle, a tidy
// row, or a founder focal point — without ever letting bodies collide.
//
// Coordinates are normalized to the floor stage:
//   x: 0..1 across the width (0 = far left, 1 = far right)
//   bottom: pixels UP from the floor line (0 = standing on the floor), used for
//           gentle depth so the group reads as 3D rather than a flat line.

import { CHARACTER_PRESENCE_SCALE } from './characterScale';

export interface CharacterSlot {
  /** normalized 0..1 horizontal position (feeds `left: x%`). */
  x: number;
  /** pixels up from the floor line, for a gentle huddle depth. */
  bottom: number;
}

const MIN_X = 0.08;
const MAX_X = 0.92;
const clampX = (x: number) => Math.max(MIN_X, Math.min(MAX_X, x));

// Characters render at CHARACTER_PRESENCE_SCALE (see art/employeeSprites.ts), so
// both the horizontal spread and the depth rhythm scale with them: a wider body
// needs a proportionally wider gap to keep the no-overlap promise above, and the
// depth offsets are pixel values that would otherwise shrink relative to the
// taller sprites and flatten each room's silhouette.
const PRESENCE = CHARACTER_PRESENCE_SCALE;

// Each room type gets a distinct depth composition so a lab doesn't arrange
// itself like the nap chamber, while sharing the same non-overlapping spread.
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

// Per-style depth (px up from the floor), cycled across occupants. The values
// are purely cosmetic — horizontal spacing already guarantees no overlap — but
// they give each room a recognisable silhouette.
const depths = (values: number[]): number[] => values.map((v) => Math.round(v * PRESENCE));

const DEPTH_PATTERN: Record<SlotStyle, number[]> = {
  founder: depths([0, 16, 16, 22, 22, 28]), // focal figure forward, others a step back
  pairs: depths([0, 26, 8, 32, 14, 36]), // receding facing desks
  social: depths([0, 12, 4, 16, 6, 10]), // lively hang-out
  row: depths([0, 5, 0, 5, 0, 5]), // near-flat tidy line
  cluster: depths([0, 9, 3, 12, 3, 9]), // gentle zig-zag
};

/**
 * Evenly spread `count` horizontal positions, symmetric around the centre. The
 * group is tight for a few teammates (a cosy huddle) and widens as the room
 * fills, but the minimum gap never drops below what keeps critters readable at
 * the six-per-room soft cap. Always within [MIN_X, MAX_X].
 */
function spreadX(count: number): number[] {
  if (count <= 1) return [0.5];
  // The half-width grows with the presence scale, bounded by the usable stage
  // (MAX_X - 0.5) so the group can never spill off the room.
  const half = Math.min(MAX_X - 0.5, (0.14 + (count - 2) * 0.06) * PRESENCE);
  const left = 0.5 - half;
  const step = (2 * half) / (count - 1);
  return Array.from({ length: count }, (_, i) => clampX(left + i * step));
}

/**
 * Positions for `count` hired employees. A `roomId` selects a curated depth
 * style (founder focal point, facing pairs, social huddle, or a tidy row);
 * otherwise a centred cluster. Every layout is generated per employee count and
 * is guaranteed overlap-free and on-screen.
 */
export function characterSlots(count: number, roomId?: string): CharacterSlot[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0.5, bottom: 0 }];
  const style: SlotStyle = (roomId && ROOM_STYLE[roomId]) || 'cluster';
  const depth = DEPTH_PATTERN[style];
  const xs = spreadX(count);

  if (style === 'founder') {
    // Occupant 0 is the focal character, front-and-centre; the rest fan out
    // symmetrically to the evenly-spread slots on either side, a step back.
    const mid = Math.floor((count - 1) / 2);
    const order: number[] = [mid];
    let l = mid - 1;
    let r = mid + 1;
    let takeRight = true;
    while (l >= 0 || r < count) {
      if (takeRight && r < count) {
        order.push(r);
        r += 1;
      } else if (!takeRight && l >= 0) {
        order.push(l);
        l -= 1;
      } else if (r < count) {
        order.push(r);
        r += 1;
      } else {
        order.push(l);
        l -= 1;
      }
      takeRight = !takeRight;
    }
    const slots: CharacterSlot[] = new Array(count);
    order.forEach((slotIdx, empIdx) => {
      // Keep the evenly-spread x (the middle slot is exactly 0.5 for odd counts,
      // near-centre for even) so the guaranteed gap is never broken.
      slots[empIdx] = {
        x: xs[slotIdx],
        bottom:
          empIdx === 0
            ? 0
            : DEPTH_PATTERN.founder[Math.min(empIdx, DEPTH_PATTERN.founder.length - 1)],
      };
    });
    return slots;
  }

  return xs.map((x, i) => ({ x, bottom: depth[i % depth.length] }));
}
