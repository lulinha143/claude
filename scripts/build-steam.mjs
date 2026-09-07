// Assembles a clean, Steam-ready Windows content folder from the electron-builder
// unpacked output. Run via `npm run build:steam` (which first builds the web +
// electron bundles and produces release/win-unpacked via electron-builder).
//
// It copies release/win-unpacked -> release/steam/windows and strips anything
// that must not ship (source files, dev tooling, saves, secrets). It does NOT
// add steam_appid.txt — that belongs in local SDK testing, not the public build.
import { cpSync, existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join('release', 'win-unpacked');
const OUT = join('release', 'steam', 'windows');

if (!existsSync(SRC)) {
  console.error(
    `\n[build-steam] Missing ${SRC}.\n` +
      'Run the packaging step first, e.g.:\n' +
      '  npm run build:desktop && npx electron-builder --win dir\n' +
      'This must run on Windows (or CI) with electron-builder able to produce a Windows build.\n',
  );
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true });

// Defensive cleanup: never ship these in a public depot.
const FORBIDDEN = ['steam_appid.txt', '.env', '.env.local', 'saves', 'save.json'];
for (const f of FORBIDDEN) {
  const p = join(OUT, f);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

// Copy the license docs alongside the build.
for (const lic of ['LICENSE', 'PRIVACY.md']) {
  if (existsSync(lic)) cpSync(lic, join(OUT, lic));
}

const version = JSON.parse(readFileSync('package.json', 'utf-8')).version;
writeFileSync(
  join(OUT, 'BUILD_INFO.txt'),
  [
    'ZooWorkers — Steam Windows content',
    `version: ${version}`,
    `assembled: ${new Date().toISOString()}`,
    '',
    'Upload the CONTENTS of this folder as your Windows depot via SteamPipe.',
    'The launch executable is "ZooWorkers.exe".',
    'Do NOT commit this folder or any Steam credentials to source control.',
  ].join('\n'),
);

console.info(`[build-steam] Steam-ready Windows content assembled at ${OUT}`);
