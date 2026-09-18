import { SAVE_VERSION } from '../sim/config';
import {
  defaultPlacement,
  decorationSurface,
  projectSurfaceType,
  surfaceZ,
  type DecorationSurface,
} from '../sim/surfaces';
import type { DecorationSurfaceType } from '../sim/types';
import { DECORATIONS_BY_ID } from '../content/decorations';

// Ordered migrations that transform a raw save object from an older version up
// to the current SAVE_VERSION. Each migration takes the previous raw object and
// returns the next-version raw object. Keep them pure and defensive.

type RawSave = Record<string, unknown>;
type Migration = (raw: RawSave) => RawSave;

// v1 -> v2: introduced `collections.secrets` and `focus.completedSessions`.
const v1ToV2: Migration = (raw) => {
  const collections = (raw.collections as RawSave) ?? {};
  if (!Array.isArray(collections.secrets)) collections.secrets = [];
  const focus = (raw.focus as RawSave) ?? {};
  if (typeof focus.completedSessions !== 'number') focus.completedSessions = 0;
  return { ...raw, collections, focus, version: 2 };
};

// v2 -> v3: introduced `eventCooldowns`, `pendingChain`, and `prestige.skills`.
const v2ToV3: Migration = (raw) => {
  const prestige = (raw.prestige as RawSave) ?? { count: 0, branch: null };
  if (typeof prestige.skills !== 'object' || prestige.skills === null) prestige.skills = {};
  return {
    ...raw,
    prestige,
    eventCooldowns: (raw.eventCooldowns as RawSave) ?? {},
    pendingChain: raw.pendingChain ?? null,
    version: 3,
  };
};

// v3 -> v4: employee room assignment (`room`) + event history/timeline.
const v3ToV4: Migration = (raw) => {
  const employees = (raw.employees as Record<string, RawSave>) ?? {};
  for (const rt of Object.values(employees)) {
    if (rt && typeof rt === 'object' && !('room' in rt)) rt.room = null;
  }
  return {
    ...raw,
    employees,
    eventHistory: Array.isArray(raw.eventHistory) ? raw.eventHistory : [],
    version: 4,
  };
};

// v4 -> v5: per-employee event-driven emotions (`employee.emotion`).
const v4ToV5: Migration = (raw) => {
  const employees = (raw.employees as Record<string, RawSave>) ?? {};
  for (const rt of Object.values(employees)) {
    if (rt && typeof rt === 'object' && !('emotion' in rt)) rt.emotion = null;
  }
  return { ...raw, employees, version: 5 };
};

// v5 -> v6: decoration placements changed from a single anchor id (string) to a
// positioned object { surface, x, y } (controlled free placement). Old placed
// decorations are preserved and given a safe, spread-out fallback position on
// their correct surface; unplaced (inventory) decorations are untouched.
const v5ToV6: Migration = (raw) => {
  const old = (raw.placements as Record<string, unknown>) ?? {};
  const next: Record<string, { surface: string; x: number; y: number }> = {};
  let i = 0;
  for (const [id, val] of Object.entries(old)) {
    if (val && typeof val === 'object' && 'surface' in (val as object)) {
      next[id] = val as { surface: string; x: number; y: number };
      continue;
    }
    // legacy string anchor (or anything else) -> default placement for the id
    next[id] = defaultPlacement(id, i);
    i += 1;
  }
  return { ...raw, placements: next, version: 6 };
};

const isRawSave = (value: unknown): value is RawSave =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// v6 -> v7: introduce stable decoration instances while preserving the v6
// placement map as a compatibility projection. Every owned decoration gets one
// deterministic instance; stowed items retain the same instance with roomId null.
const v6ToV7: Migration = (raw) => {
  const placements = isRawSave(raw.placements) ? raw.placements : {};
  const collections = isRawSave(raw.collections) ? raw.collections : {};
  const secrets = Array.isArray(collections.secrets) ? collections.secrets : [];
  const interactionStates = isRawSave(raw.decorationInteractionStates)
    ? raw.decorationInteractionStates
    : {};
  const clamp = (value: unknown, fallback: number) => {
    const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    // Some pre-v6 development saves used percentages rather than normalized values.
    return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
  };
  const validSurface = (value: unknown, decorationId: string): DecorationSurface =>
    value === 'floor' || value === 'wall' || value === 'ceiling'
      ? value
      : decorationSurface(decorationId);

  // Preserve valid partial development instances and fill only what is absent.
  // Runtime repair performs the deeper invariant audit after schema parsing.
  const decorationInstances = Array.isArray(raw.decorationInstances)
    ? raw.decorationInstances
        .filter(
          (instance): instance is RawSave =>
            isRawSave(instance) &&
            typeof instance.instanceId === 'string' &&
            typeof instance.decorationId === 'string',
        )
        .map((instance) => ({ ...instance }))
    : [];
  const represented = new Set(
    decorationInstances.map((instance) => instance.decorationId as string),
  );
  const usedIds = new Set(decorationInstances.map((instance) => instance.instanceId as string));

  const ownedIds = secrets
    .filter((secret): secret is string => typeof secret === 'string' && secret.startsWith('deco:'))
    .map((secret) => secret.slice(5))
    .filter((id, index, ids) => Boolean(DECORATIONS_BY_ID[id]) && ids.indexOf(id) === index);

  for (const decorationId of ownedIds) {
    if (represented.has(decorationId)) continue;
    const def = DECORATIONS_BY_ID[decorationId];
    const rawPlacement = placements[decorationId];
    const placement = isRawSave(rawPlacement) ? rawPlacement : null;
    const fallback = defaultPlacement(decorationId);
    const surface = validSurface(placement?.surface, decorationId);
    let instanceId = `deco-${decorationId}-1`;
    let suffix = 2;
    while (usedIds.has(instanceId)) {
      instanceId = `deco-${decorationId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(instanceId);
    decorationInstances.push({
      instanceId,
      decorationId,
      roomId: placement ? def.room : null,
      surfaceType: surface,
      normalizedX: clamp(placement?.x, fallback.x),
      normalizedY: clamp(placement?.y, fallback.y),
      depth: surfaceZ(decorationId, surface),
      flipped: false,
      rotation: 0,
      interactionState: isRawSave(interactionStates[decorationId])
        ? interactionStates[decorationId]
        : {},
    });
  }
  return { ...raw, decorationInstances, version: 7 };
};

// v7 -> v8: the room-region model became the single source of truth for
// decoration placement. Stamp each stable instance with an explicit semantic
// `regionKind` so preview, rendering, and persistence agree. Coordinates and
// surfaces stay untouched here; the runtime instance repair (which knows the
// per-room region geometry) relocates any decoration saved on an impossible
// surface when the save is loaded.
const v7ToV8: Migration = (raw) => {
  const instances = Array.isArray(raw.decorationInstances) ? raw.decorationInstances : [];
  for (const instance of instances) {
    if (!isRawSave(instance)) continue;
    if (typeof instance.regionKind === 'string') continue;
    const def = DECORATIONS_BY_ID[instance.decorationId as string];
    if (def) instance.regionKind = def.defaultRegionKind;
  }
  return { ...raw, decorationInstances: instances, version: 8 };
};

// v8 -> v9: click stations (`clicker`), and the scene depth rebanding.
//
// Two things happen here:
//  1. The active-play record is seeded. An existing company has been collecting
//     from the founder's crate all along, so its crate count carries over as that
//     station's tap total instead of resetting the player's history to zero.
//  2. Decoration depths are re-derived. Depth used to be a hand-picked 0..7
//     value; it now comes from the shared bands in `sim/depth.ts`, which reserve
//     everything at or above 60 for characters. Old values are all below that, so
//     nothing was ever rendered wrongly, but re-deriving restores the intended
//     front-to-back ordering *among* props instead of leaving them bunched up.
const v8ToV9: Migration = (raw) => {
  const stats = isRawSave(raw.stats) ? raw.stats : {};
  const crates = typeof stats.cratesCollected === 'number' ? stats.cratesCollected : 0;
  const clicker = isRawSave(raw.clicker)
    ? raw.clicker
    : {
        stationTaps: crates > 0 ? { 'nut-crate': crates } : {},
        criticalTaps: 0,
        goldenTaps: 0,
        bestStreak: 0,
      };

  const instances = Array.isArray(raw.decorationInstances) ? raw.decorationInstances : [];
  for (const instance of instances) {
    if (!isRawSave(instance)) continue;
    const decorationId = instance.decorationId;
    if (typeof decorationId !== 'string') continue;
    const surface = typeof instance.surfaceType === 'string' ? instance.surfaceType : 'floor';
    instance.depth = surfaceZ(decorationId, projectSurfaceType(surface as DecorationSurfaceType));
  }

  return { ...raw, clicker, decorationInstances: instances, version: 9 };
};

// v9 -> v10: consequence memory (`flags`) and deferred consequences
// (`scheduled`). Both start empty: an existing company has no recorded decisions
// to remember and owes nothing yet, so there is nothing to derive. The schema
// would backfill these anyway; the migration is here to make the intent explicit.
const v9ToV10: Migration = (raw) => ({
  ...raw,
  flags: isRawSave(raw.flags) ? raw.flags : {},
  scheduled: Array.isArray(raw.scheduled) ? raw.scheduled : [],
  version: 10,
});

// v10 -> v11: per-employee conversation memory (`employee.talks`), for the
// full-screen interaction mode. An existing company has had no conversations, so every
// employee starts at "never talked" — which correctly means every once-only topic is
// still available to a returning player rather than silently spent.
const v10ToV11: Migration = (raw) => {
  const employees = (raw.employees as Record<string, RawSave>) ?? {};
  for (const rt of Object.values(employees)) {
    if (rt && typeof rt === 'object' && !('talks' in rt)) {
      rt.talks = { count: 0, lastAt: 0, seen: {} };
    }
  }
  return { ...raw, employees, version: 11 };
};

const v11ToV12: Migration = (raw) => ({
  ...raw,
  eventInProgress: raw.eventInProgress ?? null,
  boosts: Array.isArray(raw.boosts) ? raw.boosts : [],
  microgames: isRawSave(raw.microgames) ? raw.microgames : {},
  version: 12,
});

const MIGRATIONS: Record<number, Migration> = {
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
  4: v4ToV5,
  5: v5ToV6,
  6: v6ToV7,
  7: v7ToV8,
  8: v8ToV9,
  9: v9ToV10,
  10: v10ToV11,
  11: v11ToV12,
};

export function migrate(raw: RawSave): RawSave {
  let current = raw;
  let version = typeof current.version === 'number' ? (current.version as number) : 1;
  let guard = 0;
  while (version < SAVE_VERSION && guard < 50) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      // No path for this version: stamp it and let the schema fill defaults.
      current = { ...current, version: SAVE_VERSION };
      break;
    }
    current = migration(current);
    version = current.version as number;
    guard += 1;
  }
  return current;
}
