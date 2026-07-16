// Decoration composition rules: keep free-placement from producing visually
// broken arrangements. Everything here is pure and room-local so it can be unit
// tested and reused by the drop handler.
//
// Positions are normalised to the room stage (see surfaces.ts):
//   x = centre across the width (0..1), y = bottom edge up from the floor line.
// A decoration occupies a bounding box `w` wide and `h` tall around that point.

import type { GameState } from './types';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { decorationSurface, isRug } from './surfaces';
import { placedDecorationsInRoom } from './decorations';
import { employeesInRoom } from './rooms';
import { characterSlots } from '../content/roomLayout';

export interface PlacementCheck {
  ok: boolean;
  /** i18n key explaining why a placement was rejected. */
  reasonKey?: string;
}

// Decorations that read as physically large and should demand real space.
const LARGE_DECOS = new Set([
  'safe',
  'aquarium',
  'nut-statue',
  'snack-bar',
  'beanbag-chairs',
  'hammock',
  'wooden-arch',
  'billboard',
  'blueprint-wall',
  'window-view',
  'projector',
  'chandelier',
  'hologram',
  'star-ceiling',
  'rooftop-garden-bed',
  'trophy-shelf',
]);

/** Normalised bounding-box footprint (width, height) for a decoration. */
export function footprint(id: string): { w: number; h: number } {
  if (isRug(id)) return { w: 0.42, h: 0.06 }; // wide + flat, lies under everything
  const surface = decorationSurface(id);
  const large = LARGE_DECOS.has(id);
  if (surface === 'ceiling') return large ? { w: 0.4, h: 0.14 } : { w: 0.16, h: 0.1 };
  if (surface === 'wall') return large ? { w: 0.26, h: 0.2 } : { w: 0.14, h: 0.14 };
  return large ? { w: 0.22, h: 0.24 } : { w: 0.12, h: 0.16 };
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function boxOf(id: string, x: number, y: number): Box {
  const fp = footprint(id);
  return { x0: x - fp.w / 2, x1: x + fp.w / 2, y0: y, y1: y + fp.h };
}

function overlapRatio(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
  const minArea = Math.min(areaA, areaB);
  return minArea > 0 ? inter / minArea : 0;
}

// A small, natural-looking overlap is fine (a plant tucked beside a cabinet);
// beyond this fraction of the smaller object it reads as "stacked/broken".
const MAX_OVERLAP = 0.34;
// Centres closer than this are effectively the same spot.
const STACK_DIST = 0.03;

/**
 * Decide whether placing (or moving) decoration `id` to a final, already-clamped
 * position is a legal, readable composition. Returns a reason key when not.
 */
export function evaluatePlacement(state: GameState, id: string, x: number, y: number): PlacementCheck {
  const def = DECORATIONS_BY_ID[id];
  if (!def) return { ok: false, reasonKey: 'decorate.reject.invalid' };
  const surface = decorationSurface(id);

  // Rugs lie flat on the floor under everything else — they never block.
  if (isRug(id)) return { ok: true };

  const box = boxOf(id, x, y);
  const fp = footprint(id);

  // Must sit fully inside the room (allow a hair of bleed for anti-aliasing).
  if (box.x0 < -0.02 || box.x1 > 1.02) return { ok: false, reasonKey: 'decorate.reject.moveInside' };

  // No severe overlap with another object on the same surface.
  for (const other of placedDecorationsInRoom(state, def.room)) {
    if (other.def.id === id) continue;
    if (other.placement.surface !== surface) continue;
    if (isRug(other.def.id)) continue;
    const dist = Math.hypot(x - other.placement.x, y - other.placement.y);
    if (dist < STACK_DIST) return { ok: false, reasonKey: 'decorate.reject.stacked' };
    if (overlapRatio(box, boxOf(other.def.id, other.placement.x, other.placement.y)) > MAX_OVERLAP) {
      return { ok: false, reasonKey: 'decorate.reject.occupied' };
    }
  }

  // A large floor object must not sit on top of a teammate (covering the face).
  if (surface === 'floor' && (fp.w >= 0.18 || fp.h >= 0.2)) {
    const occupants = employeesInRoom(state, def.room);
    const slots = characterSlots(occupants.length, def.room);
    for (const slot of slots) {
      if (Math.abs(slot.x - x) < fp.w / 2 + 0.03) {
        return { ok: false, reasonKey: 'decorate.reject.coversTeammate' };
      }
    }
  }

  return { ok: true };
}
