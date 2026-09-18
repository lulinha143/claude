// Launches the REAL packaged executable (not `electron dist-electron/main.cjs`)
// so it runs with app.isPackaged=true and loads the renderer from
// app.asar.unpacked — the exact packaged path that failed on Windows. Verifies
// the game actually renders, the process stays up, the startup log records
// STARTUP SUCCESS (dom-ready + did-finish-load + shown), and that neither
// ERR_FAILED nor "Object has been destroyed" appears.
//
// PKG_EXE (path to the packaged binary) and PKG_USERDATA (isolated userData dir)
// are provided by the caller.
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const exe = process.env.PKG_EXE;
const userData = process.env.PKG_USERDATA;
if (!exe || !fs.existsSync(exe)) {
  console.error(`PACKAGED SMOKE FAIL: PKG_EXE not found: ${exe}`);
  process.exit(1);
}

function fail(msg) {
  console.error('PACKAGED SMOKE FAIL:', msg);
  process.exit(1);
}

const app = await electron.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userData}`],
  env: { ...process.env, WMNO_SMOKE: '1' },
});

try {
  const page = await app.firstWindow({ timeout: 25000 });
  await page.waitForLoadState('domcontentloaded');

  // isPackaged must be true (proves we're running the packaged app, not dev).
  const isPackaged = await app.evaluate(({ app: a }) => a.isPackaged);
  if (!isPackaged) fail('app.isPackaged is false — not the packaged build');

  // The real game UI must render (not the recovery/error page).
  const url = page.url();
  if (url.startsWith('data:')) fail(`renderer fell back to the error page: ${url.slice(0, 60)}`);
  await page.locator('.office, .opening, .modal').first().waitFor({ timeout: 25000 });

  // Process still alive after render.
  await page.waitForTimeout(500);
  const alive = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length > 0);
  if (!alive) fail('no BrowserWindow left alive after load');

  // Inspect the packaged startup log for the success marker + forbidden errors.
  const logPath = path.join(userData, 'startup.log');
  const logText = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : '';
  if (!/STARTUP SUCCESS/.test(logText))
    fail(`startup.log missing STARTUP SUCCESS marker. Log:\n${logText}`);
  if (/ERR_FAILED/.test(logText)) fail(`startup.log contains ERR_FAILED:\n${logText}`);
  if (/Object has been destroyed/.test(logText))
    fail(`startup.log contains "Object has been destroyed":\n${logText}`);
  if (!/did-finish-load/.test(logText)) fail('startup.log missing did-finish-load');

  console.log(
    'PACKAGED SMOKE OK: packaged app rendered the game (isPackaged=true, from app.asar.unpacked).',
  );
  console.log('--- startup.log tail ---');
  console.log(logText.split('\n').slice(-10).join('\n'));
} finally {
  await app.close();
}
