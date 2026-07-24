// Build-time check: the Office background asset must ship in at least one valid
// format. Run via `npm run verify:assets`. Fails (exit 1) if the primary loop
// and poster are missing so a broken background can't reach a release.
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('public', 'backgrounds', 'office');
const required = [
  { file: 'office-main-loop.mp4', minBytes: 10000, role: 'primary optimized loop' },
  { file: 'office-main-poster.jpg', minBytes: 2000, role: 'static poster / reduced-motion fallback' },
];
const optional = [{ file: 'office-main-source.gif', role: 'canonical source + last-resort fallback' }];

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
    console.error(`  ✗ ${file} is not an animated PNG (missing acTL chunk) — it must stay animated`);
    ok = false;
  } else {
    console.info(`  ✓ ${file} (${(statSync(p).size / 1024).toFixed(0)} KB, animated) — ${name}`);
  }
  const pp = join(EMP, poster);
  if (!existsSync(pp)) {
    console.error(`  ✗ MISSING ${poster} — ${name} reduced-motion poster`);
    ok = false;
  } else {
    console.info(`  ✓ ${poster} (${(statSync(pp).size / 1024).toFixed(0)} KB) — ${name} reduced-motion poster`);
  }
}

if (!ok) {
  console.error('\n[verify-assets] FAILED: required game assets are missing or invalid.');
  process.exit(1);
}
console.info('\n[verify-assets] OK: office background + employee sprite assets present.');
