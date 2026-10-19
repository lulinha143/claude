// Verifies the Steam-ready Windows build folder before you upload it.
// Run via `npm run verify:steam`. Exits non-zero if a problem is found so it can
// gate a release. Safe to run even if the folder doesn't exist yet (it explains
// what to do).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join('release', 'steam', 'windows');
const problems = [];
const warnings = [];

if (!existsSync(OUT)) {
  console.error(
    `[verify-steam] ${OUT} does not exist. Run "npm run build:steam" first (on Windows/CI).`,
  );
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(OUT);
const rel = files.map((f) => f.slice(OUT.length + 1).replace(/\\/g, '/'));

// 1. main executable present
if (!rel.some((f) => f.toLowerCase().endsWith('.exe'))) {
  problems.push('No .exe found — the launch executable is missing.');
}
// 2. renderer assets present (packaged app.asar or dist)
if (!rel.some((f) => f.includes('resources/app.asar') || f.includes('dist/index.html'))) {
  warnings.push('Could not find app.asar or dist/index.html — verify the renderer is packaged.');
}
// 3. no source/dev files leaked
const LEAKS = [/\.ts$/, /\.tsx$/, /(^|\/)src\//, /(^|\/)node_modules\//, /\.map$/, /(^|\/)\.git/];
for (const f of rel) {
  if (LEAKS.some((re) => re.test(f)) && !f.includes('app.asar')) {
    warnings.push(`Possible source/dev file in build: ${f}`);
  }
}
// 4. no secrets or saves
const SECRETS = [
  'steam_appid.txt',
  '.env',
  'save.json',
  'window-settings.json',
  '.pem',
  '.p12',
  '.pfx',
];
for (const f of rel) {
  if (SECRETS.some((s) => f.toLowerCase().endsWith(s))) problems.push(`Must not ship: ${f}`);
}
// 5. license docs present
if (!rel.some((f) => f.toUpperCase().includes('LICENSE'))) {
  warnings.push('LICENSE not found in the build folder.');
}
// 6. flag unusually large files (>150MB) that may be accidental
for (const f of files) {
  const mb = statSync(f).size / (1024 * 1024);
  if (mb > 150) warnings.push(`Large file (${mb.toFixed(0)} MB): ${f.slice(OUT.length + 1)}`);
}

console.info(`[verify-steam] scanned ${files.length} files in ${OUT}`);
for (const w of warnings) console.warn('  ⚠ ' + w);
for (const p of problems) console.error('  ✗ ' + p);

if (problems.length > 0) {
  console.error(`\n[verify-steam] FAILED with ${problems.length} problem(s).`);
  process.exit(1);
}
console.info(`\n[verify-steam] OK (${warnings.length} warning(s)). Ready to upload via SteamPipe.`);
