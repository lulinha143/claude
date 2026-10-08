import type { GameState } from './types';

// The company's timeline is written on the computer's own clock (epoch ms): a
// boost ends, a brew is ready, an incident lingers, a cooldown lapses, a pod
// refines, a teammate last talked — each at a moment on that clock. Two things
// have to move those moments together instead of one at a time:
//
//  - The clock was turned back (by hand, a dead battery, a restored VM). The time
//    in between is not paid, and it must not stretch or age anything either: the
//    whole timeline moves back with the clock, so every timer keeps exactly what
//    it had left. (A 30-second boost used to last the hour the clock went back;
//    a minigame reward and a cup of coffee were refused for that hour.)
//  - A filed company resumes (an import): it picks up as it was filed, not as if
//    the days since had passed with nobody being paid for them.
//
// Separately, things waiting to be noticed — an incident, a curiosity — hold while
// nobody can see the office (closed, asleep, minimized), so they are there when
// the player is back instead of being decided or fading offscreen.

function shiftRecord(record: Record<string, number> | undefined, delta: number, keepZero = false) {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    if (!Number.isFinite(value)) continue;
    // 0 means "never" / "locked" in these records: it is not a moment.
    if (keepZero && value <= 0) continue;
    record[key] = value + delta;
  }
}

const shift = (value: number | undefined, delta: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value + delta : value;

/** Move every moment in the company's timeline by `deltaMs` (negative: back with the clock). */
export function shiftTimeline(state: GameState, deltaMs: number): void {
  if (!Number.isFinite(deltaMs) || deltaMs === 0) return;
  const d = deltaMs;
  state.createdAt = shift(state.createdAt, d) ?? state.createdAt;
  state.lastSaved = shift(state.lastSaved, d) ?? state.lastSaved;

  for (const rt of Object.values(state.employees ?? {})) {
    if (!rt) continue;
    if (rt.emotion && typeof rt.emotion.until === 'number') rt.emotion.until += d;
    if (rt.talks) {
      if (rt.talks.lastAt > 0) rt.talks.lastAt += d;
      shiftRecord(rt.talks.seen, d);
    }
  }
  for (const boost of state.boosts ?? []) boost.endsAt += d;
  if (state.focus && state.focus.endsAt > 0) state.focus.endsAt += d;
  for (const moment of state.collections?.moments ?? []) moment.createdAt += d;
  shiftRecord(state.clicker?.premiumAt, d);
  for (const find of state.finds ?? []) find.createdAt += d;

  for (const play of Object.values(state.office?.rooms ?? {})) {
    if (!play) continue;
    play.startedAt = shift(play.startedAt, d);
    play.readyAt = shift(play.readyAt, d);
    play.jamAt = shift(play.jamAt, d);
    play.blipAt = shift(play.blipAt, d);
    play.blipUntil = shift(play.blipUntil, d);
    play.parcelAt = shift(play.parcelAt, d);
  }
  for (const oddity of state.office?.oddities ?? []) oddity.at += d;

  const happenings = state.happenings;
  if (happenings) {
    for (const incident of happenings.incidents) {
      incident.at += d;
      incident.until += d;
    }
    for (const remark of happenings.remarks) remark.at += d;
    for (const entry of happenings.diary) entry.at += d;
  }
  for (const item of state.scheduled ?? []) item.at += d;
  for (const entry of state.eventHistory ?? []) entry.at += d;
  shiftRecord(state.eventCooldowns, d, true);
  shiftRecord(state.achievements, d, true);
  // Every flag is the moment it was set (some are cooldowns: the coffee, a pet).
  shiftRecord(state.flags, d);
  for (const record of Object.values(state.microgames ?? {})) {
    if (record && record.lastRewardAt > 0) record.lastRewardAt += d;
  }
}

/**
 * Nobody could see the office for `ms`: what is waiting to be noticed keeps its
 * place. An incident keeps the time it had left (the team does not decide it, a
 * rare one does not fade), and a curiosity stays where it turned up.
 */
export function holdWaiting(state: GameState, ms: number): void {
  if (!(ms > 0) || !Number.isFinite(ms)) return;
  for (const incident of state.happenings?.incidents ?? []) incident.until += ms;
  for (const oddity of state.office?.oddities ?? []) oddity.at += ms;
}
