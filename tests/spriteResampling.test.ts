import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CHARACTER_ART } from '../src/art/characterAssets';
import { CHARACTER_PRESENCE_SCALE, presenceSize } from '../src/content/characterScale';

/**
 * How much the browser has to enlarge each character's artwork to fill its box.
 *
 * 1.0 is pixel-exact and therefore as sharp as a bitmap can be. The cast is
 * currently at ~1.16 because the assets are encoded at the pre-presence
 * `officeHeight` while they are drawn at `presenceSize(officeHeight)` — the
 * presence multiplier arrived after the encode heights were set. That is a real
 * sharpness defect and the reason characters read soft; it is written up in
 * docs/CHARACTER_SPRITE_SHARPNESS.md along with why fixing it properly is its own
 * change (it needs the measurement pipeline and Pip's protected asset to move
 * together).
 *
 * These tests exist so the situation is pinned: it cannot get WORSE unnoticed, and
 * when the assets are re-encoded at their true display size the bound here should
 * be tightened to 1.0 rather than relaxed.
 */

/** Height out of a PNG's IHDR, no image decode. */
function pngHeight(path: string): number {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8).toString('binary')).toBe('\x89PNG\r\n\x1a\n');
  return buf.readUInt32BE(20);
}

const PUBLIC = 'public/';

const rows = CHARACTER_ART.map((entry) => {
  const files = entry.variants[entry.activeVersion] ?? entry.variants.original!;
  const encoded1x = pngHeight(PUBLIC + files.src1x!);
  const encoded2x = pngHeight(PUBLIC + files.src);
  const cssHeight = presenceSize(files.officeHeight);
  return {
    employee: entry.employee,
    encoded1x,
    encoded2x,
    cssHeight,
    dpr1: cssHeight / encoded1x,
    dpr2: (cssHeight * 2) / encoded2x,
  };
});

// The measured state today. Tighten toward 1.0; never loosen.
const CURRENT_WORST = 1.27;

describe('character sprite resampling', () => {
  it('covers every registered character', () => {
    expect(rows.length).toBe(CHARACTER_ART.length);
    expect(rows.length).toBeGreaterThanOrEqual(22);
  });

  it('never DOWNSCALES so far that detail is thrown away, nor upscales past the known bound', () => {
    for (const r of rows) {
      expect(r.dpr1, `${r.employee} DPR1`).toBeLessThanOrEqual(CURRENT_WORST);
      expect(r.dpr2, `${r.employee} DPR2`).toBeLessThanOrEqual(CURRENT_WORST);
      // A ratio far below 1 would mean we ship far more pixels than we draw.
      expect(r.dpr1, `${r.employee} DPR1`).toBeGreaterThan(0.5);
    }
  });

  it('keeps @2x at twice @1x, so the density labels in srcSet stay truthful', () => {
    for (const r of rows) {
      expect(Math.abs(r.encoded2x - r.encoded1x * 2), `${r.employee}`).toBeLessThanOrEqual(2);
    }
  });

  it('attributes the upscale to the presence multiplier, not to per-animal drift', () => {
    // Every animal's DPR1 ratio should be explained by cssHeight/encodedHeight, and
    // the encode height is officeHeight, so the ratio should sit at or below the
    // presence factor. If an animal exceeded it, something animal-specific broke.
    for (const r of rows) {
      expect(r.dpr1, `${r.employee} exceeds the presence factor`).toBeLessThanOrEqual(
        CHARACTER_PRESENCE_SCALE + 0.07,
      );
    }
  });
});
