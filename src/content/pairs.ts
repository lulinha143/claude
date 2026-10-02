// Who gets on with whom. A handful of real relationships rather than a matrix of
// numbers: when both teammates work in the same room, the pair colours how they
// feel (friends cheer each other up, rivals push each other, awkward pairs fidget)
// and they now and then trade a line in the office. The pairs that start in
// different rooms only meet if you seat them together, which is the point.

export type PairKind = 'friends' | 'rivals' | 'awkward' | 'mentor';

export interface PairDef {
  id: string;
  /** for a mentor pair, `a` looks out for `b`. */
  a: string;
  b: string;
  kind: PairKind;
  /** how many authored exchanges (`pair.<id>.<n>.a` / `.b`). */
  exchanges: number;
}

export const PAIRS: readonly PairDef[] = [
  { id: 'night-shift', a: 'moss', b: 'echo', kind: 'friends', exchanges: 2 },
  { id: 'sourcing', a: 'rizzo', b: 'perry', kind: 'rivals', exchanges: 2 },
  { id: 'receipts', a: 'otto', b: 'rizzo', kind: 'awkward', exchanges: 2 },
  { id: 'build-fix', a: 'bea', b: 'bia', kind: 'friends', exchanges: 2 },
  { id: 'bugs', a: 'nixie', b: 'quincy', kind: 'rivals', exchanges: 2 },
  { id: 'brand', a: 'corvus', b: 'rosa', kind: 'rivals', exchanges: 2 },
  { id: 'pitch', a: 'fenn', b: 'corvus', kind: 'friends', exchanges: 2 },
  { id: 'timetable', a: 'junie', b: 'pingo', kind: 'friends', exchanges: 2 },
  { id: 'nap-club', a: 'marlow', b: 'dorm', kind: 'friends', exchanges: 2 },
  { id: 'minutes', a: 'hazel', b: 'nino', kind: 'awkward', exchanges: 2 },
  { id: 'mysteries', a: 'mina', b: 'canela', kind: 'friends', exchanges: 2 },
  { id: 'calm', a: 'marlow', b: 'pip', kind: 'mentor', exchanges: 2 },
];

export const PAIRS_BY_ID: Record<string, PairDef> = Object.fromEntries(
  PAIRS.map((pair) => [pair.id, pair]),
);

/** Every pair a teammate belongs to. */
export function pairsFor(employeeId: string): PairDef[] {
  return PAIRS.filter((pair) => pair.a === employeeId || pair.b === employeeId);
}

/** The other half of a pair. */
export function partnerIn(pair: PairDef, employeeId: string): string {
  return pair.a === employeeId ? pair.b : pair.a;
}
