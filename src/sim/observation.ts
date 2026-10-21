// The observation report: what happened in the office, read from what the game
// already records. Nothing here is stored, and nothing is worked out from two
// timestamps happening to agree.
//
//  - Decisions come from the company's event history (`state.eventHistory`), the
//    one record of every call made, which says who made it (`by`) and where
//    (`roomId`). Chain steps of one card are one row (the content says which step a
//    choice leads to). Conversations are the Album's, not the office's.
//  - What nobody decided comes from the office diary (`happenings.diary`): rare
//    incidents that passed without anyone looking, and the team's small moments.
//    The diary also marks an incident starting, being opened and being handled;
//    those are the same incidents the history records as decisions (or that are
//    still waiting), so they are never rows of their own: each incident is told
//    once, by what became of it.
//  - What is happening right now comes from the incidents waiting in the rooms.
//
// Secrecy: an incident nobody saw is never named (its row carries no event id at
// all); nothing reports rewards, secrets or what a choice set in motion. Both
// sources are bounded (the history keeps 50 decisions, the diary 40 entries) and
// both start over with a restructure, so the report does too.

import type { DecidedBy, EventHistoryEntry, GameState } from './types';
import type { EventChoice, GameEventDef } from '../content/types';
import { GAME_EVENTS_BY_ID } from '../content/events';
import { WORLD_MOMENTS_BY_ID } from '../content/happenings';
import { ROOMS_BY_ID } from '../content/rooms';
import { isRoomIdUnlocked } from './rooms';

/** The most rows the report shows (the newest). */
export const OBSERVATION_LIMIT = 40;

interface RowBase {
  /** Stable and unique within a report. */
  key: string;
  at: number;
  /** Where it happened, as recorded (null when the record does not say). */
  roomId: string | null;
  /** The room to go to from the row: the recorded room, while it is open. */
  target: string | null;
}

export type ObservationRow =
  | (RowBase & {
      kind: 'decision';
      eventId: string;
      /** The choices taken, in order: more than one when a card had steps. */
      choiceIds: string[];
      /** Null in saves from before it was recorded: told without saying who. */
      by: DecidedBy | null;
    })
  /** A rare incident that passed with nobody looking: never named. */
  | (RowBase & { kind: 'passed' })
  | (RowBase & { kind: 'moment'; momentId: string });

/** Something happening in a room right now, waiting for the player. */
export interface WaitingRow {
  kind: 'waiting';
  key: string;
  at: number;
  eventId: string;
  roomId: string;
  employeeId: string | null;
  target: string | null;
}

export interface ObservationReport {
  /** Happening now, the newest first. */
  waiting: WaitingRow[];
  /** What happened, the newest first, at most OBSERVATION_LIMIT. */
  rows: ObservationRow[];
}

/**
 * Who took a recorded decision. A conversation is always the player's (only the
 * player holds them); otherwise the record says, or (older saves) does not.
 */
export function decisionBy(entry: EventHistoryEntry): DecidedBy | null {
  if (entry.eventId.startsWith('talk:')) return 'player';
  return entry.by === 'player' || entry.by === 'team' ? entry.by : null;
}

/** A room id the game knows, or null. */
function knownRoom(roomId: string | undefined): string | null {
  return roomId && ROOMS_BY_ID[roomId] ? roomId : null;
}

function targetOf(state: GameState, roomId: string | null): string | null {
  return roomId && isRoomIdUnlocked(state, roomId) ? roomId : null;
}

/** A choice in one of the card's steps (null: the card's first page). */
function choiceIn(def: GameEventDef, step: string | null, choiceId: string): EventChoice | null {
  const choices = step === null ? def.choices : (def.steps?.[step]?.choices ?? []);
  return choices.find((choice) => choice.id === choiceId) ?? null;
}

/** Where a choice is first found: the first page, else the first step that has it. */
function locateChoice(
  def: GameEventDef,
  choiceId: string,
): { step: string | null; choice: EventChoice } | null {
  const first = choiceIn(def, null, choiceId);
  if (first) return { step: null, choice: first };
  for (const step of Object.keys(def.steps ?? {})) {
    const choice = choiceIn(def, step, choiceId);
    if (choice) return { step, choice };
  }
  return null;
}

type DecisionRow = Extract<ObservationRow, { kind: 'decision' }>;

/**
 * The decisions, oldest first, with each card's steps joined into one row: a
 * record continues the row before it only when it is the same card, decided by the
 * same hand in the same room, and its choice belongs to the very step the
 * previous choice led to. That is the content's own structure, so two separate
 * occurrences of one event are never merged.
 */
function decisionRows(state: GameState): DecisionRow[] {
  const rows: DecisionRow[] = [];
  let open: { row: DecisionRow; next: string | null } | null = null;
  for (const entry of state.eventHistory ?? []) {
    if (entry.eventId.startsWith('talk:')) continue;
    const def = GAME_EVENTS_BY_ID[entry.eventId];
    // An event the game no longer has: nothing true can be said about it.
    if (!def || !Number.isFinite(entry.at)) {
      open = null;
      continue;
    }
    const by = decisionBy(entry);
    const roomId = knownRoom(entry.roomId);
    if (
      open &&
      open.next !== null &&
      open.row.eventId === def.id &&
      open.row.by === by &&
      open.row.roomId === roomId
    ) {
      const step = open.next;
      const choice = choiceIn(def, step, entry.choiceId);
      if (choice) {
        open.row.choiceIds.push(entry.choiceId);
        open.row.at = entry.at;
        open.next = choice.next && def.steps?.[choice.next] ? choice.next : null;
        continue;
      }
    }
    const located = locateChoice(def, entry.choiceId);
    const row: DecisionRow = {
      kind: 'decision',
      key: `d:${entry.at}:${def.id}:${entry.choiceId}`,
      at: entry.at,
      roomId,
      target: targetOf(state, roomId),
      eventId: def.id,
      choiceIds: [entry.choiceId],
      by,
    };
    rows.push(row);
    const next = located?.choice.next;
    open = { row, next: next && def.steps?.[next] ? next : null };
  }
  return rows;
}

/** What the office diary adds: rare incidents nobody saw, and small moments. */
function diaryRows(state: GameState): ObservationRow[] {
  const rows: ObservationRow[] = [];
  for (const entry of state.happenings?.diary ?? []) {
    if (!Number.isFinite(entry.at)) continue;
    const roomId = knownRoom(entry.roomId);
    if (entry.kind === 'faded') {
      const def = entry.eventId ? GAME_EVENTS_BY_ID[entry.eventId] : undefined;
      // Only the rare pass unseen (ordinary ones are handled by the team, and
      // recorded as its decision); a record of something unknown says nothing.
      if (!def || (def.rarity !== 'rare' && def.rarity !== 'legendary')) continue;
      rows.push({
        kind: 'passed',
        key: `p:${entry.at}:${roomId ?? ''}`,
        at: entry.at,
        roomId,
        target: targetOf(state, roomId),
      });
    } else if (entry.kind === 'moment') {
      if (!entry.momentId || !WORLD_MOMENTS_BY_ID[entry.momentId]) continue;
      rows.push({
        kind: 'moment',
        key: `m:${entry.at}:${entry.momentId}`,
        at: entry.at,
        roomId,
        target: targetOf(state, roomId),
        momentId: entry.momentId,
      });
    }
  }
  return rows;
}

/** The incidents waiting in the rooms right now, the newest first. */
function waitingRows(state: GameState): WaitingRow[] {
  return (state.happenings?.incidents ?? [])
    .filter((incident) => GAME_EVENTS_BY_ID[incident.eventId] && ROOMS_BY_ID[incident.roomId])
    .map((incident) => ({
      kind: 'waiting' as const,
      key: `w:${incident.id}`,
      at: incident.at,
      eventId: incident.eventId,
      roomId: incident.roomId,
      employeeId:
        incident.employeeId && state.employees[incident.employeeId]?.hired
          ? incident.employeeId
          : null,
      target: targetOf(state, incident.roomId),
    }))
    .sort((a, b) => b.at - a.at);
}

/** The report, read from the save as it is now. */
export function observationReport(state: GameState): ObservationReport {
  // Newest first; at the same moment, the later record first (stable either way).
  const rows = [...decisionRows(state), ...diaryRows(state)]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.at - a.row.at || b.index - a.index)
    .slice(0, OBSERVATION_LIMIT)
    .map((item) => item.row);
  return { waiting: waitingRows(state), rows };
}

/** Whether the report has anything to show (the welcome back links to it then). */
export function hasObservations(state: GameState): boolean {
  const report = observationReport(state);
  return report.rows.length > 0 || report.waiting.length > 0;
}

/** A local calendar day, `YYYY-MM-DD`. */
export function dayKey(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface ObservationDay {
  key: string;
  /** How to name the day: today, yesterday, or by its date (null). */
  when: 'today' | 'yesterday' | null;
  /** A moment in that day, for formatting its date. */
  at: number;
  rows: ObservationRow[];
}

/** The rows by calendar day, keeping their order (newest first). */
export function groupByDay(rows: readonly ObservationRow[], now: number): ObservationDay[] {
  const today = dayKey(now);
  const n = new Date(now);
  const yesterday = dayKey(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1).getTime());
  const days: ObservationDay[] = [];
  for (const row of rows) {
    const key = dayKey(row.at);
    const last = days[days.length - 1];
    if (last && last.key === key) {
      last.rows.push(row);
      continue;
    }
    days.push({
      key,
      when: key === today ? 'today' : key === yesterday ? 'yesterday' : null,
      at: row.at,
      rows: [row],
    });
  }
  return days;
}
