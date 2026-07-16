// Decoration surface model + controlled free-placement geometry.
//
// A decoration lives on one SURFACE (floor / wall / ceiling). Its position is
// stored as room-local NORMALISED coordinates so it survives window resizing:
//   x: 0..1 across the room width (0 = left, 1 = right)
//   y: 0..1 up the room stage    (0 = floor line, 1 = top of the wall)
// On drop we clamp y into the surface's vertical band, so a floor object can
// never end up on the ceiling and a wall object can never sit on the floor.

export type DecorationSurface = 'floor' | 'wall' | 'ceiling';

export interface DecorationPlacement {
  surface: DecorationSurface;
  x: number;
  y: number;
}

// Vertical bands (normalised y) each surface may occupy on the room stage.
export const SURFACE_BANDS: Record<DecorationSurface, { min: number; max: number; default: number }> = {
  floor: { min: 0.0, max: 0.34, default: 0.06 },
  wall: { min: 0.44, max: 0.82, default: 0.62 },
  ceiling: { min: 0.84, max: 0.99, default: 0.92 },
};

/** The surface a given decoration belongs to, derived from its id. */
export function decorationSurface(id: string): DecorationSurface {
  if (/(chandelier|star-ceiling|hologram|hanging|mobile|ceiling-fan)/.test(id)) return 'ceiling';
  if (
    /(poster|blueprint|billboard|window|neon|sign|projector|security|cam|whiteboard|certificate|clock|calendar|corkboard|shelf|arch|painting|mood-lighting)/.test(
      id,
    )
  ) {
    return 'wall';
  }
  return 'floor';
}

export function isRug(id: string): boolean {
  return /(rug|carpet)/.test(id);
}

/** Clamp a normalised y into the given surface's band. */
export function clampToSurface(surface: DecorationSurface, y: number): number {
  const band = SURFACE_BANDS[surface];
  return Math.max(band.min, Math.min(band.max, y));
}

/** Whether a drop position/surface is valid for a decoration (bounds check). */
export function isValidPlacement(id: string, surface: DecorationSurface, x: number, y: number): boolean {
  if (surface !== decorationSurface(id)) return false;
  if (x < 0.02 || x > 0.98) return false;
  const band = SURFACE_BANDS[surface];
  return y >= band.min - 0.02 && y <= band.max + 0.02;
}

/**
 * A tidy, spread-out default placement for a decoration (used when auto-placing
 * an owned piece, migrating an old save, or when the player clicks "Place"
 * without dragging). `index` spreads multiple same-surface pieces horizontally.
 */
export function defaultPlacement(id: string, index = 0): DecorationPlacement {
  const surface = decorationSurface(id);
  const cols = 5;
  const col = index % cols;
  const x = 0.16 + (col / (cols - 1)) * 0.68; // 0.16 .. 0.84
  const row = Math.floor(index / cols);
  const band = SURFACE_BANDS[surface];
  const y = Math.min(band.max, band.default + row * 0.08);
  return { surface, x: isRug(id) ? 0.5 : x, y: isRug(id) ? 0.02 : y };
}

/** Render depth (z-index) for a placed decoration. */
export function surfaceZ(id: string, surface: DecorationSurface): number {
  if (isRug(id)) return 0; // rugs sit under everything
  if (surface === 'ceiling') return 6; // above characters
  if (surface === 'wall') return 1; // behind characters
  return 2; // floor props: grounded, behind characters (z 3+)
}
