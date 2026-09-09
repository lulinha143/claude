// Runtime availability of the final character artwork.
//
// `EMPLOYEE_SPRITES` registers an animal's animated APNG, but a registered file
// can still fail to load — it may not be present in a given build or checkout, or
// the decode can fail. Before this module a failure left a broken-image glyph
// standing at the workstation, with the character's mood bubble floating above
// nothing, because the renderer had no idea the art had not arrived.
//
// The existing architecture already has the right answer for an animal with no
// final art: fall back to the code-drawn `Critter` SVG. This module simply lets a
// FAILED sprite take that same path. Once an asset is known bad, the sprite lookup
// reports it as unavailable and every consumer transparently renders the
// hand-drawn silhouette instead.
//
// Deliberately module-level (not React state): availability is a property of the
// asset, not of one component, so every place that animal appears agrees, and a
// second failure never re-renders anything.

import { useSyncExternalStore } from 'react';

/** Sprite `src` paths known to have failed to load this session. */
const unavailable = new Set<string>();
const listeners = new Set<() => void>();
/** Bumped on each new failure so `useSyncExternalStore` sees a changed snapshot. */
let revision = 0;

/** Record that a sprite asset failed to load. Idempotent. */
export function markSpriteUnavailable(src: string): void {
  if (unavailable.has(src)) return;
  unavailable.add(src);
  revision += 1;
  listeners.forEach((l) => l());
}

/** Whether a sprite asset is known to have failed. */
export function isSpriteUnavailable(src: string): boolean {
  return unavailable.has(src);
}

function getRevision(): number {
  return revision;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Subscribe to sprite-availability changes. Returns a revision number, so a
 * component re-renders (and re-runs its `employeeSprite` lookup) when any asset
 * is newly discovered to be missing.
 */
export function useSpriteAvailabilityRevision(): number {
  return useSyncExternalStore(subscribe, getRevision, getRevision);
}

/** Test seam: forget every recorded failure. */
export function resetSpriteAvailability(): void {
  unavailable.clear();
  revision += 1;
  listeners.forEach((l) => l());
}
