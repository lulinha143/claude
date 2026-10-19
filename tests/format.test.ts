import { describe, it, expect } from 'vitest';
import { formatNumber, formatDuration, formatClock } from '../src/sim/format';

describe('number formatting', () => {
  it('shows small numbers plainly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('uses compact suffixes for large numbers', () => {
    expect(formatNumber(1000)).toMatch(/1(\.0+)?K/);
    expect(formatNumber(1_500_000)).toMatch(/1\.5M/);
    expect(formatNumber(2_000_000_000)).toMatch(/2B/);
  });

  it('handles infinity and NaN gracefully, in characters the fonts actually have', () => {
    // The bundled fonts are Latin subsets. This used to return the infinity sign,
    // which has no glyph and rendered as a tofu box, so an enormous number looked
    // like a rendering fault. The important property is that whatever comes out is
    // printable with the shipped fonts, so assert that rather than a specific token.
    expect(formatNumber(Infinity)).toBe('Inf');
    expect(formatNumber(-Infinity)).toBe('-Inf');
    expect(formatNumber(Number.NaN)).toBe('0');
    for (const value of [Infinity, -Infinity, Number.NaN]) {
      const out = formatNumber(value);
      expect(out.length).toBeGreaterThan(0);
      // Nothing above Latin-1: the same rule tests/glyphSafety.test.ts enforces on source.
      for (const ch of out) {
        expect(ch.codePointAt(0)!, `${out} contains a non-Latin-1 character`).toBeLessThan(0x100);
      }
    }
  });

  it('formats durations', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('formats a clock mm:ss', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
  });
});
