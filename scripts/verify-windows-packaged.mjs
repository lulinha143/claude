// End-to-end packaged startup verification, intended to be run ON WINDOWS:
//   npm run verify:windows:packaged
//
//   1. builds the unpacked Windows app  (build:windows:folder)
//   2. verifies the unpacked renderer files exist
//   3. launches the real ZooWorkers.exe
//   4. waits for the STARTUP SUCCESS marker (dom-ready + did-finish-load + shown)
//   5. confirms the process stays alive and the game rendered
//   6. FAILS on ERR_FAILED or "Object has been destroyed"
//
// On non-Windows it falls back to the linux-unpacked build so the same checks
// can run in CI. "BrowserWindow created" is NOT treated as success.
import { _electron as electron } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

// npm lives on PATH (no spaces); it needs the shell on Windows only to resolve
// the .cmd shim.
function runNpm(args) {
  console.log(`\n> npm ${args.join(' ')}`);
  const r = spawnSync(npm, args, { stdio: 'inherit', shell: isWin });
  return r.status ?? 1;
}

// process.execPath can contain spaces (e.g. C:\Program Files\nodejs\node.exe).
// NEVER run it through a shell — spawnSync with shell:false passes it as argv[0]
// verbatim, so the space can't break the command.
function runNode(scriptPath) {
  console.log(`\n> node ${scriptPath}`);
  const r = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit', shell: false });
  return r.status ?? 1;
}

// 1. Build the packaged app.
if (isWin) {
  // build:windows:folder completes fully on Windows (no wine needed).
  runNpm(['run', 'build:windows:folder']);
} else {
  // Linux fallback: build the desktop bundle + an unpacked linux dir.
  runNpm(['run', 'build:desktop']);
  runNpm(['exec', '--', 'electron-builder', '--linux', 'dir']);
}

// 2. Verify the unpacked renderer files.
if (runNode('scripts/verify-packaged-renderer.mjs') !== 0) {
  console.error('verify:windows:packaged FAILED at renderer file verification.');
  process.exit(1);
}

// 3–6. Launch the real packaged exe and confirm it renders.
const exe = isWin
  ? path.join('release', 'win-unpacked', 'ZooWorkers.exe')
  : path.join('release', 'linux-unpacked', 'zooworkers');
if (!fs.existsSync(exe)) {
  console.error(`verify:windows:packaged FAILED: packaged executable not found: ${exe}`);
  process.exit(1);
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'wmno-verify-'));
const fail = (m) => {
  console.error('verify:windows:packaged FAILED:', m);
  process.exit(1);
};

const app = await electron.launch({
  executablePath: path.resolve(exe),
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userData}`],
  env: { ...process.env, WMNO_SMOKE: '1' },
});
try {
  const page = await app.firstWindow({ timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
  if (page.url().startsWith('data:')) fail('renderer fell back to the error page');
  await page.locator('.office, .opening, .modal').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  const alive = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length > 0);
  if (!alive) fail('process did not stay alive after load');

  const logText = (() => {
    try {
      return fs.readFileSync(path.join(userData, 'startup.log'), 'utf-8');
    } catch {
      return '';
    }
  })();
  if (/ERR_FAILED/.test(logText)) fail('startup.log contains ERR_FAILED');
  if (/Object has been destroyed/.test(logText)) fail('startup.log contains "Object has been destroyed"');
  if (!/did-finish-load/.test(logText)) fail('startup.log missing did-finish-load');
  if (!/STARTUP SUCCESS/.test(logText)) fail('startup.log missing STARTUP SUCCESS');

  console.log(`\nverify:windows:packaged OK — ${path.resolve(exe)} launched and rendered the game.`);
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
