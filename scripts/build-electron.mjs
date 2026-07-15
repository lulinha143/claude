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

await build({
  ...common,
  entryPoints: { main: 'electron/main.ts' },
  outfile: `${outdir}/main.cjs`,
});

await build({
  ...common,
  entryPoints: { preload: 'electron/preload.ts' },
  outfile: `${outdir}/preload.cjs`,
});

console.info('Electron main + preload bundled to', outdir);
