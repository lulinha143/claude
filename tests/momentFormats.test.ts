import { describe, it, expect } from 'vitest';
import { momentFormat, momentRef, MOMENT_FORMATS } from '../src/ui/momentFormats';
import { GAME_EVENTS } from '../src/content/events';
import en from '../src/i18n/locales/en.json';
import ptBR from '../src/i18n/locales/pt-BR.json';

// A moment card's whole job is to feel like a collectible artefact. Two properties
// carry that, and neither is obvious from reading the renderer:
//
//   STABILITY — a souvenir that redesigns itself between visits is not a souvenir.
//   SPREAD    — if the format table exists but the assignment funnels every real
//               event into two of them, the collection is still one design with a
//               couple of variants, which is the exact complaint this replaced.
//
// The spread test uses the REAL event catalogue rather than invented ids, because
// the distribution that matters is the one players actually see.

const lookup = (dict: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);

describe('moment card document formats', () => {
  it('is stable for a given moment', () => {
    const card = { eventId: 'printer-demands', rarity: 'uncommon' as const, employeeId: null };
    const first = momentFormat(card).format;
    for (let i = 0; i < 25; i += 1) {
      expect(momentFormat(card).format).toBe(first);
    }
    // And the reference code with it, since it is printed on the document.
    const withDate = { eventId: 'printer-demands', createdAt: 1_760_000_000_000 };
    expect(momentRef(withDate)).toBe(momentRef(withDate));
    expect(momentRef(withDate)).toMatch(/^NI-[0-9A-F]{4}\/\d{2}$/);
  });

  it('gives the rarest moments the restricted-file treatment', () => {
    const legendary = momentFormat({
      eventId: 'anything',
      rarity: 'legendary',
      employeeId: null,
    });
    expect(legendary.format).toBe('confidential');
    expect(legendary.stampKey).toBe('moment.stamp.confidential');
  });

  it('files a moment about a named employee as a personnel note', () => {
    expect(momentFormat({ eventId: 'x', rarity: 'common', employeeId: 'pip' }).format).toBe(
      'personnel',
    );
  });

  // THE SPREAD GUARD. With the real catalogue, the neutral rotation must actually
  // rotate — a hash that happens to bucket every event into one format would leave
  // the collection looking templated again while every unit test above still passed.
  it('spreads the real event catalogue across the neutral formats', () => {
    const counts = new Map<string, number>();
    for (const def of GAME_EVENTS) {
      const spec = momentFormat({ eventId: def.id, rarity: def.rarity, employeeId: null });
      counts.set(spec.format, (counts.get(spec.format) ?? 0) + 1);
    }
    // Every non-employee, non-legendary format must be reachable from real content.
    for (const format of ['memo', 'incident', 'observation', 'notice']) {
      expect(counts.get(format) ?? 0, `no real event produces a ${format}`).toBeGreaterThan(0);
    }
    // And none of them may dominate: a rotation where one format takes most of the
    // catalogue is not a rotation.
    const neutral = [...counts.entries()].filter(([f]) => f !== 'confidential');
    const total = neutral.reduce((sum, [, n]) => sum + n, 0);
    for (const [format, n] of neutral) {
      expect(n / total, `${format} dominates the catalogue`).toBeLessThan(0.55);
    }
  });

  it('translates every label it asks for, in both shipped locales', () => {
    for (const spec of MOMENT_FORMATS) {
      for (const key of [spec.headingKey, spec.refLabelKey, spec.stampKey].filter(
        Boolean,
      ) as string[]) {
        expect(typeof lookup(en, key), `en missing ${key}`).toBe('string');
        expect(typeof lookup(ptBR, key), `pt-BR missing ${key}`).toBe('string');
      }
    }
    expect(typeof lookup(en, 'moment.from')).toBe('string');
    expect(typeof lookup(ptBR, 'moment.from')).toBe('string');
  });
});
