// Reproduces the real Windows failure condition on Linux: an install path that
// contains a space and parentheses (the user's ".../claude-... (1)/..." folder).
// The old loadFile produced a malformed file URL for such paths and failed with
// ERR_FAILED (-2); the pathToFileURL fix must load the renderer regardless.
// It builds its own copy of dist/ + dist-electron/ + package.json inside a
// spaced/parenthesized temp dir (node_modules symlinked), then launches from
// there. Requires `npm run build:desktop` to have produced dist/ + dist-electron/.
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wmno-spaced-'));
// A path segment with a space AND parentheses, mirroring the user's "... (1)".
const dir = path.join(base, 'game build (1)', 'claude app');
fs.mkdirSync(dir, { recursive: true });
fs.cpSync(path.join(root, 'dist'), path.join(dir, 'dist'), { recursive: true });
fs.cpSync(path.join(root, 'dist-electron'), path.join(dir, 'dist-electron'), { recursive: true });
fs.copyFileSync(path.join(root, 'package.json'), path.join(dir, 'package.json'));
try {
  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(dir, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
} catch {
  /* symlink may already exist */
}

const app = await electron.launch({
  args: [
    'dist-electron/main.cjs',
    `--user-data-dir=${path.join(base, 'isolated-profile')}`,
    '--no-sandbox',
    '--disable-gpu',
  ],
  cwd: dir,
  env: { ...process.env, WMNO_SMOKE: '1' },
});

try {
  const page = await app.firstWindow({ timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  if (url.startsWith('data:')) {
    console.error(
      'SPACED-PATH FAIL: renderer fell back to the data: error page —',
      url.slice(0, 60),
    );
    process.exit(1);
  }
  // The real game UI must render (not an error page).
  await page.locator('.office, .opening, .modal').first().waitFor({ timeout: 20000 });
  console.log(
    'SPACED-PATH OK: renderer loaded from a spaced/parenthesized path. url starts',
    url.slice(0, 56),
  );
} finally {
  await app.close();
  fs.rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
