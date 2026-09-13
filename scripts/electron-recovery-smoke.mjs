// Verifies the failure path: when the renderer can't load (forced via
// WMNO_FORCE_RENDERER_FAIL), the packaged app must show a visible recovery
// window with a readable error page, stay open, and NOT crash with an
// unhandled "Object has been destroyed" rejection.
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const exe = process.env.PKG_EXE;
const userData = process.env.PKG_USERDATA;
if (!exe || !fs.existsSync(exe)) {
  console.error(`RECOVERY SMOKE FAIL: PKG_EXE not found: ${exe}`);
  process.exit(1);
}
// Checked here rather than left to blow up further down: without it the run died on
// `path.join(undefined, 'startup.log')` with a bare ERR_INVALID_ARG_TYPE, which reads
// like a broken script rather than a missing argument.
if (!userData) {
  console.error(
    'RECOVERY SMOKE FAIL: PKG_USERDATA must be set to an isolated user-data dir, ' +
      'so the startup log can be inspected without touching a real profile.',
  );
  process.exit(1);
}
function fail(msg) {
  console.error('RECOVERY SMOKE FAIL:', msg);
  process.exit(1);
}

const app = await electron.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userData}`],
  env: { ...process.env, WMNO_SMOKE: '1', WMNO_FORCE_RENDERER_FAIL: '1' },
});

try {
  const page = await app.firstWindow({ timeout: 25000 });
  await page.waitForLoadState('domcontentloaded');
  // The recovery page is a data: URL with the error heading.
  await page.waitForFunction(() => document.body && /couldn.t open its window/i.test(document.body.innerText), {
    timeout: 15000,
  });
  const visible = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return !!w && !w.isDestroyed() && w.isVisible();
  });
  if (!visible) fail('recovery window is not visible');

  // Still alive a moment later (did not quit).
  await page.waitForTimeout(600);
  const alive = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length > 0);
  if (!alive) fail('app quit after renderer failure instead of showing recovery');

  const logPath = path.join(userData, 'startup.log');
  const logText = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : '';
  if (/Object has been destroyed/.test(logText)) fail(`log contains "Object has been destroyed":\n${logText}`);
  if (/unhandledRejection/.test(logText)) fail(`log contains an unhandledRejection:\n${logText}`);

  console.log('RECOVERY SMOKE OK: renderer failure showed a visible recovery page with no crash.');
} finally {
  await app.close();
}
