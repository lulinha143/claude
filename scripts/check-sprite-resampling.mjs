#!/usr/bin/env node
/**
 * Report how much the browser has to resample each character sprite.
 *
 * A ratio of 1.000 means the artwork is drawn at exactly the resolution it was
 * encoded at -- the sharpest a bitmap can be. Above 1 means it is being enlarged,
 * so the renderer is inventing pixels and the character reads soft.
 *
 * The whole cast used to be upscaled ~1.16x (worst 1.26x): the assets were encoded
 * at the pre-presence `officeHeight` but drawn at `presenceSize(officeHeight)`.
 * `scripts/reencode-cast-display-size.py` re-encoded every @1x asset at its true
 * display size, so DPR1 is now exactly 1.000x for everybody.
 *
 * DPR2 is still above 1 and that is a genuine asset limit rather than a bug: a
 * DPR-2 display wants `2 x cssHeight` pixels, the @2x build only carries
 * `2 x officeHeight`, and closing that gap would mean upscaling artwork. The
 * masters that could supply the real pixels are not in the repository, and Pip's
 * must not be re-imported at all (her shipped build is the hand-repaired one).
 * The `density` column is what the renderer actually declares in srcSet.
 *
 * Usage: node scripts/check-sprite-resampling.mjs [--json]
 */
import { PNG_IHDR_HEIGHT, readRegistry } from './lib/sprite-geometry.mjs';

const PRESENCE = 1.2; // CHARACTER_PRESENCE_SCALE

const rows = readRegistry().map((entry) => {
  const h1 = PNG_IHDR_HEIGHT(`public/employees/${entry.asset}-1x.png`);
  const h2 = PNG_IHDR_HEIGHT(`public/employees/${entry.asset}.png`);
  const css = Math.round(entry.officeHeight * PRESENCE);
  return {
    employee: entry.employee,
    asset: entry.asset,
    encoded1x: h1,
    encoded2x: h2,
    cssHeight: css,
    // The density the renderer declares for the @2x candidate in srcSet.
    density: +(h2 / h1).toFixed(3),
    dpr1: +(css / h1).toFixed(4),
    dpr2: +((css * 2) / h2).toFixed(4),
  };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(
    '\n' +
      'character'.padEnd(11) +
      '@1x'.padStart(6) +
      '@2x'.padStart(6) +
      'CSS'.padStart(6) +
      'density'.padStart(9) +
      'DPR1'.padStart(9) +
      'DPR2'.padStart(9),
  );
  for (const r of rows) {
    console.log(
      r.employee.padEnd(11) +
        String(r.encoded1x).padStart(6) +
        String(r.encoded2x).padStart(6) +
        String(r.cssHeight).padStart(6) +
        `${r.density.toFixed(3)}x`.padStart(9) +
        `${r.dpr1.toFixed(3)}x`.padStart(9) +
        `${r.dpr2.toFixed(3)}x`.padStart(9),
    );
  }
  const mean = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const worst1 = Math.max(...rows.map((r) => r.dpr1));
  console.log(
    `\nDPR1 mean ${mean('dpr1').toFixed(3)}x, worst ${worst1.toFixed(3)}x` +
      `   |   DPR2 mean ${mean('dpr2').toFixed(3)}x, worst ${Math.max(
        ...rows.map((r) => r.dpr2),
      ).toFixed(3)}x`,
  );
  console.log('1.000x is pixel-exact; above 1 means the artwork is being enlarged.');
  if (worst1 <= 1) {
    console.log('DPR1 is pixel-exact for the whole cast.');
  }
}
