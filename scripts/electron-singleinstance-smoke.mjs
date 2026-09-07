// Proves the single-instance startup fix on the REAL packaged binary:
//  1. instance #1 wins the lock and renders the game;
//  2. instance #2 (same userData) is DENIED the lock and exits WITHOUT ever
//     creating a window / running startup (no "app ready", no "BrowserWindow
//     created" after the denial);
//  3. instance #1 stays alive (only one window), then closes cleanly.
import { _electron as electron } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exe = process.env.PKG_EXE;
if (!exe || !fs.existsSync(exe)) {
  console.error(`SINGLE-INSTANCE SMOKE FAIL: PKG_EXE not found: ${exe}`);
  process.exit(1);
}
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'wmno-si-'));
const fail = (m) => {
  console.error('SINGLE-INSTANCE SMOKE FAIL:', m);
  process.exit(1);
};

const args1 = ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userData}`];
const app = await electron.launch({ executablePath: exe, args: args1, env: { ...process.env, WMNO_SMOKE: '1' } });

try {
  const page = await app.firstWindow({ timeout: 25000 });
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.office, .opening, .modal').first().waitFor({ timeout: 25000 });

  // Launch a SECOND instance sharing the same userData -> must be denied.
  const second = spawn(exe, args1, { env: { ...process.env, WMNO_SMOKE: '1' } });
  let out = '';
  second.stdout.on('data', (d) => (out += d.toString()));
  second.stderr.on('data', (d) => (out += d.toString()));
  const exitCode = await new Promise((resolve) => {
    const t = setTimeout(() => {
      second.kill();
      resolve('timeout');
    }, 12000);
    second.on('exit', (code) => {
      clearTimeout(t);
      resolve(code);
    });
  });

  if (exitCode === 'timeout') fail('second instance did NOT exit (it hung / opened a window)');

  // The denial must appear, and startup must NOT have run in the second process.
  const deniedLine = /requestSingleInstanceLock -> false/.test(out);
  const skipped = /skipping whenReady/.test(out);
  // "app ready" and "BrowserWindow created" are logged only inside startup.
  const startedUp = /app ready\./.test(out) || /BrowserWindow created/.test(out);
  if (!deniedLine) fail(`second instance did not log a denied lock. Output:\n${out}`);
  if (!skipped) fail(`second instance did not skip whenReady. Output:\n${out}`);
  if (startedUp) fail(`second instance RAN STARTUP (created a window). Output:\n${out}`);

  // Instance #1 still has exactly one window alive.
  const windows = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  if (windows < 1) fail('first instance lost its window');

  console.log('SINGLE-INSTANCE SMOKE OK: 2nd instance denied + exited without startup; 1st still alive.');
  console.log('--- second instance output (tail) ---');
  console.log(out.split('\n').filter(Boolean).slice(-6).join('\n'));
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
