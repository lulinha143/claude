import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { computeOffline, applyOffline } from '../src/sim/offline';
import { offlineCapHours } from '../src/sim/economy';
import { BALANCE } from '../src/sim/config';

describe('offline progression', () => {
  it('awards nuts for elapsed time under the cap', () => {
    const s = createInitialState(0);
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 5;
    s.lastSaved = 0;
    const now = 60 * 60 * 1000; // 1h
    const r = computeOffline(s, now);
    expect(r.ignored).toBe(false);
    expect(r.nutsEarned).toBeGreaterThan(0);
    expect(r.cappedSeconds).toBeCloseTo(3600, 0);
  });

  it('caps offline time at the offline cap', () => {
    const s = createInitialState(0);
    s.lastSaved = 0;
    const cap = offlineCapHours(s);
    const now = (cap + 5) * 3600 * 1000;
    const r = computeOffline(s, now);
    expect(r.wasCapped).toBe(true);
    expect(r.cappedSeconds).toBeCloseTo(cap * 3600, 0);
  });

  it('ignores negative elapsed time (clock moved backwards)', () => {
    const s = createInitialState(0);
    s.lastSaved = 1_000_000;
    const r = computeOffline(s, 500_000);
    expect(r.ignored).toBe(true);
    expect(r.nutsEarned).toBe(0);
  });

  it('ignores absurdly large / corrupted timestamps', () => {
    const s = createInitialState(0);
    s.lastSaved = 0;
    const r = computeOffline(s, 1e18);
    expect(r.ignored).toBe(true);
  });

  it('applyOffline mutates state only when valid', () => {
    const s = createInitialState(0);
    s.employees.marlow.hired = true;
    s.employees.marlow.level = 3;
    s.lastSaved = 0;
    const r = computeOffline(s, 3600 * 1000);
    const before = s.resources.nuts;
    applyOffline(s, r);
    expect(s.resources.nuts).toBeGreaterThan(before);
  });

  it('offline efficiency is applied', () => {
    const s = createInitialState(0);
    s.lastSaved = 0;
    const r = computeOffline(s, 3600 * 1000);
    expect(r.nutsEarned).toBeCloseTo(r.ratePerSecond * r.cappedSeconds * BALANCE.offline.efficiency, 3);
  });
});
