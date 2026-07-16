import type { GameState } from './types';
import type { Rng } from './rng';
import { resolveEmployeeRoom } from './rooms';
import { placedDecorationsInRoom } from './decorations';
import { characterSlots } from '../content/roomLayout';

// "Office life": occasionally a hired employee wanders over to a decoration
// placed near their spot and interacts with it (react bubble + the object
// wiggles + the critter leans toward it). Pure + deterministic so it can be
// unit-tested; the UI owns the timers, animation and audio.
//
// A reservation set (owned by the UI) prevents two employees from targeting the
// same object at once, and prevents re-picking an object that's mid-interaction.

export interface OfficeInteraction {
  employeeId: string;
  decorationId: string;
  roomId: string;
  /** normalized x (0..1) of the object, so the UI can lean the critter over. */
  targetX: number;
}

const PROXIMITY = 0.32; // how close (normalized floor width) an object must be

/**
 * Choose an available (employee → nearby decoration) interaction, or null if
 * none is currently possible. `reserved` holds decoration ids already in use.
 */
export function pickOfficeInteraction(
  state: GameState,
  reserved: ReadonlySet<string>,
  rng: Rng,
): OfficeInteraction | null {
  const hired = Object.entries(state.employees).filter(([, e]) => e.hired);
  if (hired.length === 0) return null;

  const start = rng.int(0, hired.length);
  for (let k = 0; k < hired.length; k += 1) {
    const [id] = hired[(start + k) % hired.length];
    const roomId = resolveEmployeeRoom(state, id);
    if (!roomId) continue;

    const occ = Object.entries(state.employees).filter(
      ([eid, rt]) => rt.hired && resolveEmployeeRoom(state, eid) === roomId,
    );
    const idx = occ.findIndex(([eid]) => eid === id);
    const sx = characterSlots(occ.length, roomId)[idx]?.x ?? 0.5;

    let best: { id: string; x: number } | null = null;
    let bestDx = PROXIMITY;
    for (const p of placedDecorationsInRoom(state, roomId)) {
      if (reserved.has(p.def.id)) continue;
      // only floor-level props are "walk-up-to-able"; wall/ceiling items aren't
      if (p.placement.surface !== 'floor') continue;
      const dx = Math.abs(p.placement.x - sx);
      if (dx < bestDx) {
        bestDx = dx;
        best = { id: p.def.id, x: p.placement.x };
      }
    }
    if (best) return { employeeId: id, decorationId: best.id, roomId, targetX: best.x };
  }
  return null;
}
