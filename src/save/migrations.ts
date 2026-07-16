import { SAVE_VERSION } from '../sim/config';
import { defaultPlacement } from '../sim/surfaces';

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

const MIGRATIONS: Record<number, Migration> = {
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
  4: v4ToV5,
  5: v5ToV6,
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
