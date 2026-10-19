import type { MomentCard } from '../sim/types';

// WHAT A MOMENT CARD IS, AS A DOCUMENT.
// ---------------------------------------------------------------------------
// Moments are meant to be collectible souvenirs of things that happened in the
// facility. They were presented as neither: in game they were rows in a list (a
// coloured dot, a title, a date, an export icon), and the only actual "card" was a
// single canvas template — one brown gradient, one rarity-coloured frame, and a
// placeholder acorn — so every souvenir in the collection looked identical apart
// from its text.
//
// This module decides, for a given moment, WHICH KIND OF DOCUMENT it is. It is
// deliberately the only place that decision is made, because the card is drawn
// twice in two different media:
//
//   - as DOM + CSS in the collection grid (cheap, crisp, responsive, and a
//     collection can hold 200 of them so 200 canvases is not an option)
//   - as a canvas in `momentCard.ts` for the exported PNG
//
// Two renderers for two media is fine; two opinions about what the document IS
// would not be. Both read the descriptor below, so an exported card matches the
// one in the collection, and adding a format means touching one table.
//
// Everything here is PURE DATA and returns i18n KEYS rather than text, so it stays
// usable from the canvas renderer (which has no hooks) and from React alike.

/** The authored document formats. Each is a genuinely different artefact. */
export type MomentFormat =
  | 'memo' // internal memorandum, letterhead and TO/FROM/RE
  | 'incident' // incident report, reference number, ruled box
  | 'personnel' // personnel note about a specific employee
  | 'confidential' // a file that should not be in the collection at all
  | 'observation' // behavioural research observation, on grid paper
  | 'notice'; // a notice pinned up for the whole company

export interface MomentFormatSpec {
  format: MomentFormat;
  /** Document header, e.g. "MEMORANDUM". */
  headingKey: string;
  /** Small label above the reference/file line. */
  refLabelKey: string;
  /** Paper tone, as a CSS custom-property value and a canvas fill. */
  paper: string;
  /** Ink for rules, stamps and labels. */
  accent: string;
  /** Rubber stamp across the document, or null when it carries none. */
  stampKey: string | null;
  /** Whether the document is ruled/gridded rather than plain. */
  ruled: 'none' | 'lines' | 'grid';
}

/**
 * Deterministic 32-bit hash of the event id.
 *
 * The format has to be STABLE for a given moment: a souvenir that redesigns itself
 * every time the collection is opened is not a souvenir. Deriving it from the event
 * id (rather than from the card's random id or its index) also means every moment of
 * the same event shares a format, so "the printer thing" always arrives as the same
 * kind of paperwork and the collection builds a visual vocabulary.
 */
function hashEventId(eventId: string): number {
  let h = 2166136261;
  for (let i = 0; i < eventId.length; i += 1) {
    h ^= eventId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PAPER = {
  cream: '#f2e7cf',
  manila: '#e6d3a8',
  grey: '#e4e2da',
  buff: '#efe0c1',
  graph: '#e9efe4',
};

const INK = {
  brown: '#6f5636',
  red: '#a8452f',
  green: '#3f7d4f',
  violet: '#6d5a86',
  slate: '#4f5d68',
};

/** The rotation of plain formats, for events that carry no stronger signal. */
const NEUTRAL_FORMATS: MomentFormat[] = ['memo', 'incident', 'observation', 'notice'];

/**
 * Which document a moment is.
 *
 * The assignment is meaningful rather than merely varied — the rules encode what the
 * artefact IS, so the collection reads as a filing cabinet and not as a shuffled
 * deck of skins:
 *
 *   legendary        a file that should not exist. The rarest thing the player can
 *                    collect gets the most unsettling treatment in the game.
 *   about an employee a personnel note, because that is what a document about a
 *                    named member of staff is.
 *   everything else  the neutral rotation, keyed off the event id so it is stable.
 */
export function momentFormat(
  card: Pick<MomentCard, 'eventId' | 'rarity' | 'employeeId'>,
): MomentFormatSpec {
  if (card.rarity === 'legendary') return SPECS.confidential;
  if (card.eventId === 'file-dated-tomorrow') return SPECS.confidential;
  if (card.eventId === 'annex-broadcast') return SPECS.notice;
  if (card.eventId === 'annex-repair') return SPECS.incident;
  if (card.eventId === 'annex-conservatory') return SPECS.observation;
  if (card.eventId === 'camera-thirteen') return SPECS.observation;
  if (card.eventId.startsWith('microgame:') || card.eventId === 'the-plant-clocked-in')
    return SPECS.notice;
  if (card.employeeId) return SPECS.personnel;
  return SPECS[NEUTRAL_FORMATS[hashEventId(card.eventId) % NEUTRAL_FORMATS.length]];
}

const SPECS: Record<MomentFormat, MomentFormatSpec> = {
  memo: {
    format: 'memo',
    headingKey: 'moment.format.memo',
    refLabelKey: 'moment.field.re',
    paper: PAPER.cream,
    accent: INK.brown,
    stampKey: null,
    ruled: 'none',
  },
  incident: {
    format: 'incident',
    headingKey: 'moment.format.incident',
    refLabelKey: 'moment.field.ref',
    paper: PAPER.buff,
    accent: INK.red,
    stampKey: 'moment.stamp.filed',
    ruled: 'lines',
  },
  personnel: {
    format: 'personnel',
    headingKey: 'moment.format.personnel',
    refLabelKey: 'moment.field.subject',
    paper: PAPER.manila,
    accent: INK.brown,
    stampKey: null,
    ruled: 'none',
  },
  confidential: {
    format: 'confidential',
    headingKey: 'moment.format.confidential',
    refLabelKey: 'moment.field.file',
    paper: PAPER.grey,
    accent: INK.violet,
    stampKey: 'moment.stamp.confidential',
    ruled: 'none',
  },
  observation: {
    format: 'observation',
    headingKey: 'moment.format.observation',
    refLabelKey: 'moment.field.specimen',
    paper: PAPER.graph,
    accent: INK.green,
    stampKey: null,
    ruled: 'grid',
  },
  notice: {
    format: 'notice',
    headingKey: 'moment.format.notice',
    refLabelKey: 'moment.field.posted',
    paper: PAPER.cream,
    accent: INK.slate,
    stampKey: 'moment.stamp.posted',
    ruled: 'none',
  },
};

/**
 * A short, stable reference code for the document, e.g. "NI-4F2A/07".
 *
 * Paperwork has a reference on it; that single detail does more for "this is a real
 * corporate artefact" than any amount of framing. Derived from the same hash so it
 * never changes for a given moment, and formatted rather than random so it reads as
 * a filing code instead of noise.
 */
export function momentRef(card: Pick<MomentCard, 'eventId' | 'createdAt'>): string {
  const h = hashEventId(card.eventId);
  const block = h.toString(16).toUpperCase().slice(0, 4).padStart(4, '0');
  // Day of the month the moment was filed, so the code ties to its own date line.
  const day = new Date(card.createdAt).getDate().toString().padStart(2, '0');
  return `NI-${block}/${day}`;
}

/** Every format, for tests and for the art-direction review harness. */
export const MOMENT_FORMATS: readonly MomentFormatSpec[] = Object.values(SPECS);
