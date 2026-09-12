import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CHARACTER_ART } from '../src/art/characterAssets';
import { presenceSize } from '../src/content/characterScale';

/**
 * How much the browser has to resample each character's artwork to fill its box.
 *
 * 1.0 is pixel-exact and therefore as sharp as a bitmap can be. The cast used to sit
 * at ~1.16 (worst 1.26) because the assets were encoded at the pre-presence
 * `officeHeight` while being drawn at `presenceSize(officeHeight)` — the presence
 * multiplier arrived after the encode heights were set, so the file labelled 1x was
 * really a 0.83x asset for the box it was drawn into. Every character was enlarged,
 * which is why they read soft.
 *
 * `scripts/reencode-cast-display-size.py` re-encoded every @1x asset at its true
 * display size, so DPR1 is now exactly 1.000x. These tests hold that: DPR1 must stay
 * pixel-exact, and the srcSet densities must stay honest.
 *
 * See docs/CHARACTER_SPRITE_SHARPNESS.md.
 */

/** Dimensions out of a PNG's IHDR, no image decode. */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8).toString('binary')).toBe('\x89PNG\r\n\x1a\n');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const PUBLIC = 'public/';

const rows = CHARACTER_ART.map((entry) => {
  const files = entry.variants[entry.activeVersion] ?? entry.variants.original!;
  const asset1x = pngSize(PUBLIC + files.src1x!);
  const asset2x = pngSize(PUBLIC + files.src);
  const cssHeight = presenceSize(files.officeHeight);
  return {
    employee: entry.employee,
    files,
    asset1x,
    asset2x,
    cssHeight,
    dpr1: cssHeight / asset1x.height,
    dpr2: (cssHeight * 2) / asset2x.height,
    declaredDensity: files.srcHeight / files.frameHeight,
  };
});

/**
 * The @2x build still cannot satisfy a DPR-2 display: it carries `2 x officeHeight`
 * pixels while DPR 2 wants `2 x cssHeight`, i.e. 2.4 x officeHeight. Closing that gap
 * means upscaling artwork, and the masters that could supply real pixels are not in
 * the repository (Pip's must not be re-imported at all — her shipped build is the
 * hand-repaired one). So this bound documents an ASSET limit, not a layout bug.
 */
const DPR2_KNOWN_BOUND = 1.27;

describe('character sprite resampling', () => {
  it('covers every registered character', () => {
    expect(rows.length).toBe(CHARACTER_ART.length);
    expect(rows.length).toBeGreaterThanOrEqual(22);
  });

  // THE sharpness contract. This is what the display-size re-encode bought, and the
  // reason it must never silently regress: at DPR 1 — most Windows desktops, and the
  // packaged app on them — nothing is resampled at all.
  it('draws every character pixel-exact at DPR 1', () => {
    for (const r of rows) {
      expect(r.dpr1, `${r.employee} DPR1`).toBe(1);
    }
  });

  it('encodes the @1x asset at exactly the rendered height', () => {
    for (const r of rows) {
      expect(r.asset1x.height, `${r.employee} @1x height`).toBe(r.cssHeight);
      // The registry's aspect-ratio source must agree with the file it describes.
      expect(r.files.frameHeight, `${r.employee} frameHeight`).toBe(r.asset1x.height);
      expect(r.files.frameWidth, `${r.employee} frameWidth`).toBe(r.asset1x.width);
    }
  });

  it('declares the @2x asset at its real size, so srcSet densities are truthful', () => {
    for (const r of rows) {
      expect(r.files.srcHeight, `${r.employee} srcHeight`).toBe(r.asset2x.height);
      expect(r.files.srcWidth, `${r.employee} srcWidth`).toBe(r.asset2x.width);
      // It is emphatically NOT 2x any more, and claiming so is what would mislead
      // the browser's candidate selection.
      expect(r.declaredDensity, `${r.employee} density`).toBeGreaterThan(1.4);
      expect(r.declaredDensity, `${r.employee} density`).toBeLessThan(2);
    }
  });

  it('never ships a candidate less dense than the box it fills', () => {
    for (const r of rows) {
      // A ratio below 1 would mean shipping more pixels than are ever drawn; above 1
      // at DPR1 would mean inventing them. Exactly 1 is the target.
      expect(r.dpr1, `${r.employee} DPR1`).toBeGreaterThan(0.99);
      expect(r.dpr2, `${r.employee} DPR2`).toBeLessThanOrEqual(DPR2_KNOWN_BOUND);
      expect(r.dpr2, `${r.employee} DPR2`).toBeGreaterThan(1);
    }
  });

  // The roster card draws the same sprite larger than the office does, so the @1x
  // asset would have to be ENLARGED there — which is why portraits were the softest
  // art in the game. EmployeeSprite serves the denser build outright above the encoded
  // size, so what must hold is that the denser build actually covers the card.
  it('covers the larger roster-card render with the denser build', () => {
    for (const r of rows) {
      const cardHeight = presenceSize(r.files.cardHeight);
      expect(cardHeight, `${r.employee} card is larger than office`).toBeGreaterThan(
        r.files.frameHeight,
      );
      // The @2x build must be at least card-sized, or the card is an upscale again.
      expect(r.files.srcHeight, `${r.employee} @2x covers the card`).toBeGreaterThanOrEqual(
        cardHeight,
      );
    }
  });

  it('keeps the @1x aspect ratio faithful to the @2x artwork it came from', () => {
    for (const r of rows) {
      const source = r.asset2x.width / r.asset2x.height;
      const shipped = r.asset1x.width / r.asset1x.height;
      // Rounding to whole pixels at ~115px tall is sub-pixel; a real squash is not.
      expect(Math.abs(source - shipped) / source, `${r.employee} aspect drift`).toBeLessThan(0.01);
    }
  });
});
