import { describe, it, expect } from 'vitest';
import { characterSlots } from '../src/content/roomLayout';

function avg(ns: number[]): number {
  return ns.reduce((s, n) => s + n, 0) / ns.length;
}

// Smallest horizontal gap between any two occupants (sorted by x). Used to
// assert the hard "no overlap" rule.
function minGap(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < sorted.length; i += 1) min = Math.min(min, sorted[i] - sorted[i - 1]);
  return min;
}

describe('character slots', () => {
  it('returns nothing for an empty room', () => {
    expect(characterSlots(0)).toEqual([]);
  });

  it('centers a single occupant', () => {
    expect(characterSlots(1)).toEqual([{ x: 0.5, bottom: 0 }]);
  });

  it('clusters occupants around the centre', () => {
    for (const n of [2, 3, 4, 5, 6, 8, 12]) {
      const slots = characterSlots(n);
      expect(slots).toHaveLength(n);
      const xs = slots.map((s) => s.x);
      // grouped: the whole cluster is symmetric-ish around the middle
      expect(avg(xs)).toBeGreaterThan(0.4);
      expect(avg(xs)).toBeLessThan(0.6);
      // stays on-screen with margins
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.08);
      expect(Math.max(...xs)).toBeLessThanOrEqual(0.92);
    }
  });

  it('packs a large crowd tighter than a small one', () => {
    const small = characterSlots(3).map((s) => s.x);
    const large = characterSlots(8).map((s) => s.x);
    expect(minGap(large)).toBeLessThan(minGap(small));
  });
});

describe('curated per-room slot styles', () => {
  const ROOMS = ['founder-desk', 'sorting', 'lab', 'morale', 'meeting', 'marketing', 'vault'];

  it('keeps every style on-screen and correctly counted', () => {
    for (const room of ROOMS) {
      for (const n of [1, 2, 3, 4, 5, 6]) {
        const slots = characterSlots(n, room);
        expect(slots).toHaveLength(n);
        expect(Math.min(...slots.map((s) => s.x))).toBeGreaterThanOrEqual(0.08);
        expect(Math.max(...slots.map((s) => s.x))).toBeLessThanOrEqual(0.92);
      }
    }
  });

  // The hard rule the redesign is about: teammates must never overlap. With the
  // character glyph roughly 0.06–0.07 of the room width, a horizontal gap of
  // >= 0.12 guarantees clear breathing room at every count up to the soft cap.
  it('never overlaps teammates, in any room at any count up to the cap', () => {
    for (const room of [...ROOMS, undefined]) {
      for (let n = 2; n <= 6; n += 1) {
        const xs = characterSlots(n, room).map((s) => s.x);
        expect(minGap(xs)).toBeGreaterThanOrEqual(0.12);
      }
    }
  });

  it("puts the Founder's Desk focal character front-and-centre", () => {
    expect(characterSlots(3, 'founder-desk')[0]).toEqual({ x: 0.5, bottom: 0 });
  });

  it('gives labs a distinct depth rhythm from the generic cluster', () => {
    const lab = characterSlots(4, 'lab');
    const generic = characterSlots(4);
    // same guaranteed-spread positions, but a different (facing-desk) depth feel
    expect(lab.map((s) => s.bottom)).not.toEqual(generic.map((s) => s.bottom));
  });
});
