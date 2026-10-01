import type { EmployeeMood, GameState } from './types';
import { ROOM_PROFILES_BY_ID, type RoomTemper } from '../content/roomProfiles';
import { resolveEmployeeRoom } from './rooms';
import { hashStringToSeed } from './rng';

/** Every emotion the game can display, in a stable order (profiles, tests). */
export const EMOTIONS: EmployeeMood[] = [
  'happy',
  'proud',
  'relaxed',
  'focused',
  'inspired',
  'curious',
  'tired',
  'frustrated',
  'worried',
  'angry',
  'embarrassed',
  'overcaffeinated',
  'suspicious',
  'excited',
  'sad',
];

/** How long a conversation keeps someone visibly happy afterwards. */
export const RECENT_TALK_MOOD_MS = 10 * 60_000;

// What a settled teammate tends to feel in each kind of room. Roommates are dealt
// these in turn, so a room of colleagues shows a few different faces rather than
// one company-wide one, and moving someone to another room can change theirs.
const ROOM_MOODS: Record<RoomTemper, readonly EmployeeMood[]> = {
  operational: ['relaxed', 'focused', 'happy'],
  social: ['happy', 'relaxed', 'excited'],
  analytical: ['focused', 'curious', 'inspired'],
  industrial: ['focused', 'tired', 'proud'],
  secure: ['focused', 'suspicious', 'relaxed'],
  irregular: ['curious', 'suspicious', 'excited'],
};

// A thriving company lifts everyone, each in their own way.
const THRIVING_MOODS: readonly EmployeeMood[] = ['inspired', 'excited', 'happy'];

/**
 * One of a room's typical moods for this person. Roommates are dealt the options
 * in turn (in a stable order), so people sharing a room do not all wear the same
 * face; which option a room starts from depends on the room.
 */
function roomPick(
  state: GameState,
  options: readonly EmployeeMood[],
  id: string,
  room: string,
  salt: string,
): EmployeeMood {
  let seat = 0;
  for (const [other, rt] of Object.entries(state.employees)) {
    if (other < id && rt?.hired && resolveEmployeeRoom(state, other) === room) seat += 1;
  }
  const start = hashStringToSeed(`${room}:${salt}`) % options.length;
  return options[(start + seat) % options.length];
}

/**
 * An employee's current emotion. An event-driven emotion (persisted in
 * `rt.emotion`) takes priority while it is still active. Otherwise it is read
 * from that person's own situation — the kind of room they work in, how close
 * they are to the founder, whether you just talked — with company morale as the
 * weather everyone shares. Deterministic: the same state always gives the same
 * face, so nothing flickers on its own. `now` is injectable for tests.
 */
export function employeeMood(state: GameState, id: string, now = Date.now()): EmployeeMood {
  const rt = state.employees[id];
  const override = rt?.emotion;
  if (override && (override.until === null || override.until > now)) return override.id;

  const morale = state.resources.morale;
  const friendship = rt?.friendship ?? 0;
  if (state.focus.active) return 'focused';

  const room = resolveEmployeeRoom(state, id);
  const temper = ROOM_PROFILES_BY_ID[room]?.temper ?? 'operational';
  // Hard times reach everyone, but not in the same way.
  if (morale < 30) return friendship >= 60 ? 'worried' : 'frustrated';
  if (morale < 45) return friendship < 60 && temper === 'industrial' ? 'frustrated' : 'tired';
  // A close friend in a good company is proud of it.
  if (friendship >= 70 && morale >= 70) return 'proud';
  // Someone you just sat down with is still smiling about it.
  const talkedAt = rt?.talks?.lastAt ?? 0;
  if (talkedAt > 0 && now >= talkedAt && now - talkedAt < RECENT_TALK_MOOD_MS) return 'happy';
  // A newcomer (and a founder on day one) is still working the place out.
  if (friendship < 25) return 'curious';
  if (morale >= 85) return roomPick(state, THRIVING_MOODS, id, room, 'thriving');
  return roomPick(state, ROOM_MOODS[temper], id, room, temper);
}

// Emotions gently colour how well someone works. Effects are deliberately SMALL
// (within ±5%) so mood is a warm character/strategy layer, never a punishing
// micromanagement system (brief §16/§18). A positive mood is a nudge up, a
// low mood a nudge down; "curious" is the neutral baseline.
export const MOOD_PRODUCTIVITY: Record<EmployeeMood, number> = {
  excited: 1.05,
  inspired: 1.05,
  focused: 1.05,
  proud: 1.04,
  happy: 1.04,
  overcaffeinated: 1.03, // fast but a bit error-prone (handled in flavour, not maths)
  relaxed: 1.02,
  curious: 1.0,
  suspicious: 0.99,
  tired: 0.97,
  embarrassed: 0.97,
  worried: 0.97,
  sad: 0.96,
  frustrated: 0.95,
  angry: 0.95,
};

/** Whether an emotion reads as positive (for colour/tone in the UI). */
export const MOOD_POSITIVE: Record<EmployeeMood, boolean> = {
  happy: true,
  proud: true,
  relaxed: true,
  focused: true,
  inspired: true,
  curious: true,
  excited: true,
  overcaffeinated: true,
  suspicious: false,
  tired: false,
  frustrated: false,
  worried: false,
  angry: false,
  embarrassed: false,
  sad: false,
};

export function moodProductivityMultiplier(mood: EmployeeMood): number {
  return MOOD_PRODUCTIVITY[mood] ?? 1;
}

/**
 * The team's overall mood effect on production: the production-weighted average
 * of each hired employee's mood multiplier, so a happy workforce produces a
 * little more and a struggling one a little less. Returns 1 when nobody is
 * working (so it never divides by zero). Pure + unit-tested.
 */
export function teamMoodMultiplier(
  state: GameState,
  employeeWeight: (id: string) => number,
): number {
  let weighted = 0;
  let total = 0;
  for (const [id, rt] of Object.entries(state.employees)) {
    if (!rt || !rt.hired || rt.level <= 0) continue;
    const w = Math.max(0, employeeWeight(id));
    if (w <= 0) continue;
    weighted += w * moodProductivityMultiplier(employeeMood(state, id));
    total += w;
  }
  return total > 0 ? weighted / total : 1;
}

/** A short emoji-free glyph character used as a tiny mood indicator dot colour. */
export const MOOD_TONE: Record<EmployeeMood, string> = {
  happy: '#5aa06a',
  proud: '#ffd54a',
  relaxed: '#5a9a68',
  focused: '#6fa8dc',
  inspired: '#e0a43b',
  curious: '#b98ad0',
  excited: '#e8823b',
  overcaffeinated: '#c98a3a',
  suspicious: '#8a7fa8',
  tired: '#9a8f80',
  worried: '#7f93b0',
  sad: '#6b83a0',
  embarrassed: '#d08a86',
  frustrated: '#c65b3c',
  angry: '#b0473a',
};
