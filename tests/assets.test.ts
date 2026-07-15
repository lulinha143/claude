import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('public', 'backgrounds', 'office');

describe('Office background assets', () => {
  it('ships the optimized MP4 loop', () => {
    const p = join(DIR, 'office-main-loop.mp4');
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).size).toBeGreaterThan(10000);
  });

  it('ships a static poster (used for reduced motion + fallback)', () => {
    const p = join(DIR, 'office-main-poster.jpg');
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).size).toBeGreaterThan(2000);
  });

  it('preserves the canonical source GIF', () => {
    expect(existsSync(join(DIR, 'office-main-source.gif'))).toBe(true);
  });
});
