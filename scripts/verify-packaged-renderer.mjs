// Verifies the FINAL packaged output (not the source dist/): the renderer and
// its assets must be present, unpacked, next to app.asar so Chromium can load
// them over file:// without reading through the archive. Fails loudly (exit 1)
// with the exact packaged renderer path when anything required is missing.
//
// Works for whichever platform dir electron-builder produced under release/.
import fs from 'node:fs';
import path from 'node:path';

const roots = ['win-unpacked', 'linux-unpacked', 'mac', 'mac-arm64']
  .map((d) => path.join('release', d, 'resources', 'app.asar.unpacked', 'dist'))
  .filter((p) => fs.existsSync(p));

if (roots.length === 0) {
  console.error(
    'VERIFY FAIL: no packaged app.asar.unpacked/dist found under release/. ' +
      'Run the packaging step first (e.g. npm run build:windows:folder).',
  );
  process.exit(1);
}

let ok = true;
for (const dist of roots) {
  console.log(`\nPackaged renderer dir: ${path.resolve(dist)}`);
  const index = path.join(dist, 'index.html');
  const assetsDir = path.join(dist, 'assets');

  const need = (label, cond) => {
    console.log(`  ${cond ? 'OK ' : 'MISSING'}  ${label}`);
    if (!cond) ok = false;
  };

  need('index.html', fs.existsSync(index));

  const assets = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
  need('a JavaScript bundle (assets/*.js)', assets.some((f) => f.endsWith('.js')));
  need('a CSS bundle (assets/*.css)', assets.some((f) => f.endsWith('.css')));
  need('a bundled font (assets/*.woff2)', assets.some((f) => f.endsWith('.woff2')));

  // Background assets (video / poster / gif) — the animated office.
  const bg = path.join(dist, 'backgrounds');
  const bgFiles = fs.existsSync(bg)
    ? fs.readdirSync(bg, { recursive: true }).map(String)
    : [];
  need('animated background asset (backgrounds/**)', bgFiles.some((f) => /\.(mp4|gif|jpg|jpeg|png|webm)$/i.test(f)));

  // index.html must reference its assets RELATIVELY (./assets/...), or file://
  // loading breaks.
  if (fs.existsSync(index)) {
    const html = fs.readFileSync(index, 'utf-8');
    need('index.html uses relative ./assets/ paths', /["']\.\/assets\//.test(html));
    need('index.html has no absolute /assets/ paths', !/["']\/assets\//.test(html));
  }
}

if (!ok) {
  console.error('\nVERIFY FAIL: packaged renderer is incomplete.');
  process.exit(1);
}
console.log('\nVERIFY OK: packaged renderer is complete and unpacked.');
