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

  it('handles infinity gracefully', () => {
    expect(formatNumber(Infinity)).toBe('∞');
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
