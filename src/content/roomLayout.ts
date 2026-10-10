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
  broadcast: 'row',
  repair: 'pairs',
  conservatory: 'cluster',
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
  // Second expansion.
  cafeteria: 'social',
  mailroom: 'row',
  security: 'pairs',
  archive: 'row',
  incubator: 'pairs',
};

// Per-style depth (px up from the floor), cycled across occupants. Used only for
// crowds above the room capacity, i.e. legacy saves written before the cap.
const depths = (values: number[]): number[] => values.map((v) => Math.round(v * PRESENCE));

const DEPTH_PATTERN: Record<SlotStyle, number[]> = {
  founder: depths([0, 16, 16, 22, 22, 28]), // focal figure forward, others a step back
  pairs: depths([0, 26, 8, 32, 14, 36]), // receding facing desks
  social: depths([0, 12, 4, 16, 6, 10]), // lively hang-out
  row: depths([0, 5, 0, 5, 0, 5]), // near-flat tidy line
  cluster: depths([0, 9, 3, 12, 3, 9]), // gentle zig-zag
};

/* ---------------------------------------------------------------------------
 * Authored formations for one to four occupants.
 *
 * A room holds at most four teammates (ROOM_CAP), so every arrangement a player
 * can actually see is worth composing by hand rather than deriving. Evenly
 * spacing N bodies on a line and varying only their depth made a room of two
 * look like a room of four with people missing; these read as arrangements
 * somebody chose.
 *
 * Index 0 is always the room's focal occupant and always stands at bottom 0 —
 * frontmost, so it paints over the others (see characterDepth in sim/depth.ts).
 *
 * `bottom` values are authored pre-presence and scaled with the cast, because
 * they are pixel depths and would otherwise flatten as the characters grew.
 * ------------------------------------------------------------------------- */
type Formation = readonly (readonly [x: number, bottom: number])[];

const FORMATIONS: Record<SlotStyle, readonly Formation[]> = {
  // The founder holds the front of the room; everyone else arranges around them.
  founder: [
    [[0.5, 0]],
    [
      [0.44, 0],
      [0.68, 16],
    ],
    [
      [0.42, 0],
      [0.22, 13],
      [0.72, 22],
    ],
    [
      [0.4, 0],
      [0.2, 12],
      [0.62, 20],
      [0.84, 29],
    ],
  ],
  // Facing workstations: benches squared off against each other, front and back.
  pairs: [
    [[0.5, 0]],
    [
      [0.32, 0],
      [0.68, 0],
    ],
    [
      [0.24, 0],
      [0.55, 22],
      [0.8, 4],
    ],
    [
      [0.2, 0],
      [0.44, 24],
      [0.64, 0],
      [0.86, 24],
    ],
  ],
  // A hang-out. Nobody is squared up to anybody; the group opens toward the room.
  social: [
    [[0.5, 0]],
    [
      [0.38, 0],
      [0.62, 11],
    ],
    [
      [0.3, 0],
      [0.52, 15],
      [0.74, 5],
    ],
    [
      [0.24, 0],
      [0.44, 17],
      [0.64, 10],
      [0.84, 4],
    ],
  ],
  // A tidy line, barely staggered — records, mail, money: places that queue.
  row: [
    [[0.5, 0]],
    [
      [0.36, 0],
      [0.64, 4],
    ],
    [
      [0.26, 0],
      [0.5, 4],
      [0.74, 0],
    ],
    [
      [0.18, 0],
      [0.39, 5],
      [0.61, 0],
      [0.82, 5],
    ],
  ],
  // Gentle zig-zag huddle for rooms without a stronger idea of themselves.
  cluster: [
    [[0.5, 0]],
    [
      [0.38, 0],
      [0.63, 9],
    ],
    [
      [0.28, 0],
      [0.5, 12],
      [0.73, 3],
    ],
    [
      [0.22, 0],
      [0.43, 13],
      [0.63, 4],
      [0.83, 12],
    ],
  ],
};

/**
 * The floor band, in the same pixel units `CharacterSlot.bottom` uses: the drawn
 * wood plane is 40px tall before the cast scale is applied.
 */
const FLOOR_BAND_PX = Math.round(40 * PRESENCE);

/**
 * How much of its size a character loses standing at the very back of the floor.
 *
 * Depth used to be conveyed by raising a character up the floor band and nothing
 * else, which is geometrically right and reads completely wrong: an identically
 * sized figure sitting higher up looks like it is HOVERING, not standing further
 * away. That is what "the desks float" was — the artwork carries its own desk, so
 * lifting the character lifts a desk into mid-air with it.
 *
 * Shrinking with distance is the missing cue. It is a positional effect applied by
 * the same rule to everybody, so it does not disturb the one-cast-one-scale
 * guarantee: a character at the front of the room is always exactly cast scale.
 */
const DEPTH_SHRINK = 0.12;

/**
 * Perspective multiplier for a character standing `bottom` pixels back.
 * 1 at the floor line, falling to `1 - DEPTH_SHRINK` at the back of the band.
 */
export function depthScale(bottom: number): number {
  const t = Math.max(0, Math.min(1, bottom / FLOOR_BAND_PX));
  return 1 - t * DEPTH_SHRINK;
}

/**
 * Evenly spread `count` horizontal positions, symmetric around the centre.
 *
 * Only reached for crowds ABOVE the room capacity, which today means a save
 * written before the cap existed. It keeps such a room readable (no overlap, all
 * on-screen) until the capacity pass rehomes the overflow.
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
 * Where a desk may stand. A teammate is drawn at their workstation, 0.16-0.22 of
 * the room wide across the cast (half of that either side of the slot), so a slot
 * this far in keeps the widest desk inside its room.
 */
const DESK_MIN_X = 0.11;
const DESK_MAX_X = 0.89;
/** Half a desk, as a share of the room. */
const DESK_HALF = 0.09;
/** Half a room's machine: a station is 70 scene px wide in a 700px room. */
const STATION_HALF = 0.05;
/**
 * How close two neighbours may be brought to make room for the machine, centre to
 * centre: a desk's width and a little air. The formations keep 0.2 or more.
 */
const DESK_MIN_GAP = 0.19;

/**
 * The floor a room's machine leaves for its team: everything on the far side of
 * it, far enough that a desk ends where the machine begins.
 */
function teamFloor(stationX: number): readonly [from: number, to: number] {
  return stationX < 0.5
    ? [stationX + STATION_HALF + DESK_HALF, DESK_MAX_X]
    : [DESK_MIN_X, stationX - STATION_HALF - DESK_HALF];
}

/**
 * Keep the formation off the room's machine. The formations are authored for an
 * empty floor and reach x 0.18-0.86 in a full room, which is where the machines
 * stand (x 0.12-0.2 and 0.78-0.87): the outer teammate sat behind the machine and
 * its routine badge landed on their face.
 *
 * A group that already clears the machine is left exactly as authored. Otherwise
 * it SLIDES toward the far wall, keeping every gap, which is all a room of one to
 * three needs. A full room has no such slack (four desks and a machine are four
 * fifths of the floor), so its gaps close evenly toward DESK_MIN_GAP, only as far
 * as the machine needs and never tighter: desks colliding is worse than a desk's
 * corner behind the machine, which is then as small as the room allows. Order and
 * depth, which carry each formation's character, are untouched.
 */
function clearOfStation(xs: number[], stationX: number | undefined): number[] {
  if (stationX === undefined || xs.length === 0) return xs;
  const nearLeft = stationX < 0.5;
  const [from, to] = teamFloor(stationX);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  if (lo >= from && hi <= to) return xs;
  if (hi - lo <= to - from) {
    const shift = nearLeft ? from - lo : to - hi;
    return xs.map((x) => x + shift);
  }
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const gaps = order.slice(1).map((at, k) => xs[at] - xs[order[k]]);
  const floors = gaps.map((gap) => Math.min(gap, DESK_MIN_GAP));
  const slack = gaps.reduce((sum, gap, k) => sum + gap - floors[k], 0);
  const least = floors.reduce((sum, gap) => sum + gap, 0);
  const t = slack > 0 ? Math.max(0, Math.min(1, (to - from - least) / slack)) : 0;
  const placed = [...xs];
  // Built out from the far wall, so a room too full to clear the machine leaves
  // the nearest teammate as far from it as it can.
  if (nearLeft) {
    placed[order[order.length - 1]] = to;
    for (let k = gaps.length - 1; k >= 0; k -= 1)
      placed[order[k]] = placed[order[k + 1]] - (floors[k] + (gaps[k] - floors[k]) * t);
  } else {
    placed[order[0]] = from;
    for (let k = 0; k < gaps.length; k += 1)
      placed[order[k + 1]] = placed[order[k]] + floors[k] + (gaps[k] - floors[k]) * t;
  }
  return placed;
}

/**
 * Positions for `count` hired employees in a given room.
 *
 * One to four occupants — every arrangement reachable under the room capacity —
 * uses the hand-authored formation for that room's style, so a room of two is
 * composed as a room of two rather than as a sparse room of four. Anything larger
 * falls back to the generated spread.
 */
export function characterSlots(
  count: number,
  roomId?: string,
  /** where the room's machine stands (0..1), so nobody stands on it. */
  stationX?: number,
): CharacterSlot[] {
  if (count <= 0) return [];
  const style: SlotStyle = (roomId && ROOM_STYLE[roomId]) || 'cluster';

  const formation = FORMATIONS[style][count - 1];
  if (formation) {
    const xs = clearOfStation(
      formation.map(([x]) => x),
      stationX,
    );
    return formation.map(([, bottom], i) => ({
      x: clampX(xs[i]),
      bottom: Math.round(bottom * PRESENCE),
    }));
  }

  // Above the cap: generated, so an over-full legacy room still reads clearly.
  const depth = DEPTH_PATTERN[style];
  return spreadX(count).map((x, i) => ({ x, bottom: depth[i % depth.length] }));
}
