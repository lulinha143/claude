// Bundles the Electron main process and preload script from TypeScript to
// CommonJS. Electron loads `.cjs` files directly; the renderer bundle is built
// separately by Vite. Using esbuild keeps this fast and dependency-light.
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

const outdir = 'dist-electron';
rmSync(outdir, { recursive: true, force: true });

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  // Electron and Node built-ins must stay external.
  external: ['electron'],
  logLevel: 'info',
};

import { existsSync } from 'node:fs';

// main + preload are always built. The diagnostic entrypoints (isolated minimal
// + staged bisection) are built too when present, so they can be launched
// independently for Windows startup debugging.
const entries = [
  ['electron/main.ts', `${outdir}/main.cjs`],
  ['electron/preload.ts', `${outdir}/preload.cjs`],
  ['electron/minimal-main.ts', `${outdir}/minimal-main.cjs`],
  ['electron/diagnostic-main.ts', `${outdir}/diagnostic-main.cjs`],
];

for (const [entry, outfile] of entries) {
  if (!existsSync(entry)) continue;
  await build({ ...common, entryPoints: [entry], outfile });
}

console.info('Electron entrypoints bundled to', outdir);
