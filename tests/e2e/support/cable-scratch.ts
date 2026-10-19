/**
 * Where a test may park cable plugs while it solves a desk.
 *
 * Solving a board by dragging needs a two-pass approach: scatter every plug onto a
 * scratch area first so each pick-up unambiguously grabs its own plug, then place each
 * plug onto its solution slot. That only works if the scratch area is clear of the
 * solution slots — otherwise a plug that has already been placed can sit on top of the
 * next plug the test tries to pick up, which fails intermittently rather than
 * outright.
 *
 * This used to be a hardcoded pair of rows (y 0.42 / 0.58) justified by "the convex
 * ellipse layouts occupy only the board perimeter, so the centre is always free". That
 * stopped being true when desks gained wiring shapes: a wheel puts a hub slot dead
 * centre, and a bi-loop puts two inset ellipses in the middle band. So the rows are
 * computed from the actual slots of the desk under test.
 *
 * Lives in one place because two specs need it and a silently-wrong copy would show up
 * as flakiness rather than as a failure.
 */
export interface CableSlot {
  x: number;
  y: number;
}

/** The two most slot-free horizontal rows, kept far enough apart to not interfere. */
export function cableScratchRows(slots: readonly CableSlot[]): [number, number] {
  const rows: number[] = [];
  for (let y = 0.14; y <= 0.861; y += 0.02) rows.push(Math.round(y * 100) / 100);
  const clearance = (y: number) => Math.min(...slots.map((slot) => Math.abs(slot.y - y)));
  // A fine grid matters: on a wheel the usable gap is narrow and sits in a different
  // place on every ellipse profile.
  const ranked = [...rows].sort((a, b) => clearance(b) - clearance(a));
  const first = ranked[0];
  const second = ranked.find((y) => Math.abs(y - first) >= 0.12) ?? (first > 0.5 ? 0.14 : 0.86);
  return [Math.min(first, second), Math.max(first, second)];
}

/** Scratch position for plug `id`, spread across two rows. */
export function cableScratchPoint(
  id: number,
  total: number,
  rows: readonly [number, number],
): CableSlot {
  const columns = Math.ceil(total / 2);
  return {
    x: 0.28 + (0.44 * (id % columns)) / Math.max(1, columns - 1),
    y: id < columns ? rows[0] : rows[1],
  };
}
