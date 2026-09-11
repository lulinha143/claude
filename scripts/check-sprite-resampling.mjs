#!/usr/bin/env node
/**
 * Report how much the browser has to resample each character sprite.
 *
 * A ratio of 1.000 means the artwork is drawn at exactly the resolution it was
 * encoded at -- the sharpest a bitmap can be. Above 1 means it is being enlarged,
 * so the renderer is inventing pixels and the character reads soft. This exists
 * because the whole cast is currently upscaled ~1.16x: the assets are encoded at
 * the pre-presence `officeHeight` but drawn at `presenceSize(officeHeight)`.
 * See docs/CHARACTER_SPRITE_SHARPNESS.md.
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
      'DPR1'.padStart(9) +
      'DPR2'.padStart(9),
  );
  for (const r of rows) {
    console.log(
      r.employee.padEnd(11) +
        String(r.encoded1x).padStart(6) +
        String(r.encoded2x).padStart(6) +
        String(r.cssHeight).padStart(6) +
        `${r.dpr1.toFixed(3)}x`.padStart(9) +
        `${r.dpr2.toFixed(3)}x`.padStart(9),
    );
  }
  const mean = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const worst = Math.max(...rows.map((r) => Math.max(r.dpr1, r.dpr2)));
  console.log(
    `\nmean DPR1 ${mean('dpr1').toFixed(3)}x, mean DPR2 ${mean('dpr2').toFixed(3)}x, worst ${worst.toFixed(3)}x`,
  );
  console.log('1.000x would be pixel-exact; above 1 means the artwork is being enlarged.');
}
