import { describe, it, expect } from 'vitest';
import { characterSlots, anchorsForRoom } from '../src/content/roomLayout';

function avg(ns: number[]): number {
  return ns.reduce((s, n) => s + n, 0) / ns.length;
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
    const smallGap = small[1] - small[0];
    const largeGap = large[1] - large[0];
    expect(largeGap).toBeLessThan(smallGap);
  });
});

describe('curated per-room slot styles', () => {
  const ROOMS = ['founder-desk', 'sorting', 'lab', 'morale', 'meeting', 'marketing', 'vault'];
  it('keeps every style on-screen and correctly counted', () => {
    for (const room of ROOMS) {
      for (const n of [1, 2, 3, 4, 6]) {
        const slots = characterSlots(n, room);
        expect(slots).toHaveLength(n);
        expect(Math.min(...slots.map((s) => s.x))).toBeGreaterThanOrEqual(0.08);
        expect(Math.max(...slots.map((s) => s.x))).toBeLessThanOrEqual(0.92);
      }
    }
  });
  it("puts the Founder's Desk focal character front-and-centre", () => {
    expect(characterSlots(3, 'founder-desk')[0]).toEqual({ x: 0.5, bottom: 0 });
  });
  it('arranges labs as two facing columns', () => {
    const xs = characterSlots(4, 'lab').map((s) => s.x);
    expect(new Set(xs).size).toBe(2); // exactly two columns
  });
  it('differs from the generic cluster for a styled room', () => {
    expect(characterSlots(4, 'lab')).not.toEqual(characterSlots(4));
  });
});

describe('decoration anchors', () => {
  it('gives the founder desk a curated set that avoids the crate corner', () => {
    const anchors = anchorsForRoom('founder-desk');
    expect(anchors.length).toBeGreaterThanOrEqual(5);
    // no anchor sits in the front-right corner where the crate lives
    expect(anchors.every((a) => !(a.x > 0.85 && a.y < 10))).toBe(true);
  });

  it('falls back to the shared template for other rooms', () => {
    expect(anchorsForRoom('sorting').length).toBeGreaterThanOrEqual(6);
    expect(anchorsForRoom('lab').length).toBeGreaterThanOrEqual(6);
  });
});
