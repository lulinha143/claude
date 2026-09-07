// TEMPORARY diagnostic (halo-isolation A/B).
//
// The squirrel's soft "halo/glow" is NOT a CSS effect — there is no filter,
// drop-shadow, box-shadow, blend-mode, opacity or pseudo-element on the sprite
// (verified in styles.css / EmployeeSprite.tsx). The halo is painted into the
// APNG frames themselves (~70% of the sprite is semi-transparent, animated via
// its alpha channel). So the only way to run the "remove the blur/halo" test is
// to swap the ART for a version whose alpha is hard (binary) — ZERO
// semi-transparent pixels — while keeping the exact size, position, animation,
// speed, scene and scale.
//
// Press Ctrl+Alt+H in-game to flip the squirrel between the normal (halo) art
// and the halo-stripped art, in place, so the real-GPU shimmer can be compared
// against a single variable. Only sprites that declare `srcNoHalo` (currently
// just Pip) are affected; every other character is untouched.
//
// Remove this module, the `srcNoHalo` field and the Ctrl+Alt+H hook once the
// investigation concludes.
import { useSyncExternalStore } from 'react';

let haloOff = false;
const listeners = new Set<() => void>();

export function toggleHaloTest(): boolean {
  haloOff = !haloOff;
  listeners.forEach((l) => l());
  return haloOff;
}

function isHaloOff(): boolean {
  return haloOff;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Live boolean: is the halo-stripped art currently forced on? */
export function useHaloOff(): boolean {
  return useSyncExternalStore(subscribe, isHaloOff, isHaloOff);
}
