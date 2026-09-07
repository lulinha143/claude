// Build-time check: the Office background asset must ship in at least one valid
// format. Run via `npm run verify:assets`. Fails (exit 1) if the primary loop
// and poster are missing so a broken background can't reach a release.
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync as zlibInflate } from 'node:zlib';

const DIR = join('public', 'backgrounds', 'office');
const required = [
  { file: 'office-main-loop.mp4', minBytes: 10000, role: 'primary optimized loop' },
  {
    file: 'office-main-poster.jpg',
    minBytes: 2000,
    role: 'static poster / reduced-motion fallback',
  },
];
const optional = [
  { file: 'office-main-source.gif', role: 'canonical source + last-resort fallback' },
];

let ok = true;
for (const { file, minBytes, role } of required) {
  const p = join(DIR, file);
  if (!existsSync(p)) {
    console.error(`  ✗ MISSING ${file} (${role})`);
    ok = false;
  } else if (statSync(p).size < minBytes) {
    console.error(`  ✗ ${file} is suspiciously small (${statSync(p).size} bytes)`);
    ok = false;
  } else {
    console.info(`  ✓ ${file} (${(statSync(p).size / 1024).toFixed(0)} KB) — ${role}`);
  }
}
for (const { file, role } of optional) {
  const p = join(DIR, file);
  console.info(existsSync(p) ? `  ✓ ${file} — ${role}` : `  … ${file} absent (${role}, optional)`);
}

// --- final animated employee sprites (APNG workstations) -------------------
// Each registered animal ships an animated APNG plus a static poster fallback.
// The animated file must be a real APNG (contain the `acTL` chunk) so it can
// never regress into a flattened, static PNG.
const EMP = join('public', 'employees');
const sprites = [
  { file: 'bea.png', poster: 'bea-poster.png', minBytes: 100000, name: 'Bea (Beaver)' },
  { file: 'pip.png', poster: 'pip-poster.png', minBytes: 100000, name: 'Pip (Squirrel)' },
  { file: 'pip-1x.png', poster: 'pip-poster.png', minBytes: 100000, name: 'Pip (Squirrel) @1x' },
];
for (const { file, poster, minBytes, name } of sprites) {
  const p = join(EMP, file);
  if (!existsSync(p)) {
    console.error(`  ✗ MISSING ${file} — ${name} animated sprite`);
    ok = false;
  } else if (statSync(p).size < minBytes) {
    console.error(`  ✗ ${file} is suspiciously small (${statSync(p).size} bytes)`);
    ok = false;
  } else if (!readFileSync(p).includes(Buffer.from('acTL'))) {
    console.error(
      `  ✗ ${file} is not an animated PNG (missing acTL chunk) — it must stay animated`,
    );
    ok = false;
  } else {
    console.info(`  ✓ ${file} (${(statSync(p).size / 1024).toFixed(0)} KB, animated) — ${name}`);
  }
  const pp = join(EMP, poster);
  if (!existsSync(pp)) {
    console.error(`  ✗ MISSING ${poster} — ${name} reduced-motion poster`);
    ok = false;
  } else {
    console.info(
      `  ✓ ${poster} (${(statSync(pp).size / 1024).toFixed(0)} KB) — ${name} reduced-motion poster`,
    );
  }
}

// --- character APNG temporal stability (halo flicker guard) ----------------
// Pip's soft baked-in halo appeared to "shimmer" in the game. The cause was not
// compositing, DPR or GPU scaling: 8 of her 242 source frames had their
// SEMI-TRANSPARENT alpha collapsed to about half, so once per second the halo
// deflated for a single frame and snapped back. Because that defect lives in the
// artwork, no renderer-side change could ever fix it — and because it only
// affects a few frames it is invisible to a spot check.
//
// This guard decodes every frame's alpha channel and fails if any frame's halo
// opacity sits far below its neighbours', so a flickering character can never
// reach a release again. It is generic: it runs on every registered animal, so
// the same defect in future artwork is caught on arrival.
//
// Repair with: python scripts/repair-character-apng.py --in <file>
function decodeApngAlpha(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let paletteFrames = 0;
  const groups = []; // one entry per animation frame: array of compressed buffers
  let current = null;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'fcTL') {
      const fw = data.readUInt32BE(4);
      const fh = data.readUInt32BE(8);
      const fx = data.readUInt32BE(12);
      const fy = data.readUInt32BE(16);
      if (fw !== w || fh !== h || fx !== 0 || fy !== 0) paletteFrames++; // not full-frame
      current = [];
      groups.push(current);
    } else if (type === 'IDAT') {
      if (current) current.push(data);
    } else if (type === 'fdAT') {
      if (current) current.push(data.subarray(4));
    } else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (colorType !== 6 || bitDepth !== 8 || interlace !== 0) {
    return { unsupported: `colorType=${colorType} bitDepth=${bitDepth} interlace=${interlace}` };
  }
  if (paletteFrames) return { unsupported: `${paletteFrames} frame(s) are not full-canvas` };

  const stride = w * 4;
  const alphas = [];
  const cur = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  for (const g of groups) {
    if (!g.length) continue;
    const raw = zlibInflate(Buffer.concat(g));
    const a = new Uint8Array(w * h);
    prev.fill(0);
    let rp = 0;
    for (let y = 0; y < h; y++) {
      const ft = raw[rp++];
      raw.copy(cur, 0, rp, rp + stride);
      rp += stride;
      for (let x = 0; x < stride; x++) {
        const left = x >= 4 ? cur[x - 4] : 0;
        const up = prev[x];
        const ul = x >= 4 ? prev[x - 4] : 0;
        let v = cur[x];
        if (ft === 1) v += left;
        else if (ft === 2) v += up;
        else if (ft === 3) v += (left + up) >> 1;
        else if (ft === 4) {
          const pa = Math.abs(up - ul);
          const pb = Math.abs(left - ul);
          const pc = Math.abs(left + up - 2 * ul);
          v += pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
        }
        cur[x] = v & 0xff;
      }
      for (let x = 0; x < w; x++) a[y * w + x] = cur[x * 4 + 3];
      cur.copy(prev);
    }
    alphas.push(a);
  }
  return { w, h, alphas };
}

function findAlphaDropouts(alphas, w, h, threshold = 3.0, window = 9) {
  // Define the halo band from a frame of median opacity, so a damaged frame
  // cannot skew the region being measured.
  const meanOver = (a, mask) => {
    let s = 0;
    let n = 0;
    for (let i = 0; i < a.length; i++)
      if (mask[i]) {
        s += a[i];
        n++;
      }
    return n ? s / n : 0;
  };
  const provisional = new Uint8Array(w * h);
  for (let i = 0; i < provisional.length; i++)
    provisional[i] = alphas[0][i] >= 1 && alphas[0][i] <= 191 ? 1 : 0;
  const order = alphas.map((a, i) => [meanOver(a, provisional), i]).sort((x, y) => x[0] - y[0]);
  const ref = order[Math.floor(order.length / 2)][1];
  const band = new Uint8Array(w * h);
  for (let i = 0; i < band.length; i++)
    band[i] = alphas[ref][i] >= 1 && alphas[ref][i] <= 191 ? 1 : 0;

  const series = alphas.map((a) => meanOver(a, band));
  const median = (arr) => {
    const s = [...arr].sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const bad = [];
  for (let i = 0; i < series.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(series.length, i + window + 1);
    const nb = [];
    for (let j = lo; j < hi; j++) if (j !== i) nb.push(series[j]);
    if (series[i] < median(nb) - threshold) bad.push(i);
  }
  return { bad, series, ref, median: median(series) };
}

for (const { file, name } of sprites) {
  const p = join(EMP, file);
  if (!existsSync(p)) continue; // already reported above
  let res;
  try {
    res = decodeApngAlpha(readFileSync(p));
  } catch (err) {
    console.error(`  ✗ ${file} — could not decode for stability check: ${err.message}`);
    ok = false;
    continue;
  }
  if (res.unsupported) {
    console.info(`  … ${file} — stability check skipped (${res.unsupported})`);
    continue;
  }
  const { bad, series, median } = findAlphaDropouts(res.alphas, res.w, res.h);
  if (bad.length) {
    const detail = bad
      .slice(0, 12)
      .map((i) => `${i} (${(100 * (1 - series[i] / median)).toFixed(0)}% low)`)
      .join(', ');
    console.error(
      `  ✗ ${file} — ${bad.length}/${res.alphas.length} frame(s) have a collapsed ` +
        `semi-transparent alpha: ${detail}`,
    );
    console.error(
      `      this makes the soft halo FLICKER in game. Repair with:\n` +
        `      python scripts/repair-character-apng.py --in ${p}`,
    );
    ok = false;
  } else {
    const spread = Math.max(...series) - Math.min(...series);
    console.info(
      `  ✓ ${file} — halo temporally stable across ${res.alphas.length} frames ` +
        `(halo alpha ${median.toFixed(1)}, peak-to-peak ${spread.toFixed(1)}/255) — ${name}`,
    );
  }
}

if (!ok) {
  console.error('\n[verify-assets] FAILED: required game assets are missing or invalid.');
  process.exit(1);
}
console.info('\n[verify-assets] OK: office background + employee sprite assets present.');
