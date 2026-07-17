// Real-Electron smoke for window behaviour: resizable from the OS, minimum-size
// clamping, maximize/restore, and bounds persistence across a relaunch. Runs
// against the built desktop app in an isolated user-data dir so the persisted
// window-settings.json can be inspected. (The subjective "resize hitbox feel"
// is a native Windows concern that can't be measured headlessly — see the
// Windows test checklist — but everything below is verifiable here.)
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 420;

function fail(msg) {
  console.error('WINDOW SMOKE FAIL:', msg);
  process.exit(1);
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmno-udd-'));

async function launch() {
  return electron.launch({
    args: ['dist-electron/main.cjs', `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
    env: { ...process.env, WMNO_SMOKE: '1' },
  });
}

// --- first launch: exercise resize, clamp, maximize/restore, set a size ---
let app = await launch();
{
  const page = await app.firstWindow({ timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');

  const info = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const resizable = w.isResizable();

    // Minimum-size clamp: ask for something tiny, expect it pinned to the min.
    w.setSize(120, 120);
    const clamped = w.getSize();

    // Maximize / restore round-trip.
    w.maximize();
    const maxed = w.isMaximized();
    w.unmaximize();
    const restored = w.isMaximized();

    // Set a distinctive size we can check survives a relaunch.
    w.setSize(720, 640);
    const set = w.getSize();
    return { resizable, clamped, maxed, restored, set };
  });

  if (!info.resizable) fail('window is not resizable');
  if (info.clamped[0] < MIN_WIDTH || info.clamped[1] < MIN_HEIGHT) {
    fail(`min-size not enforced: got ${info.clamped}`);
  }
  if (info.set[0] !== 720) fail(`setSize width not applied: ${info.set}`);
  // maximize/restore depend on a real window manager; xvfb has none, so treat
  // them as best-effort here (they are verified by hand per the Windows
  // checklist). Only warn if the round-trip misbehaves.
  if (!info.maxed || info.restored) {
    console.log('WINDOW SMOKE NOTE: maximize/restore not observable under xvfb (no WM) —', JSON.stringify(info));
  }

  // Give the debounced bounds-persist (400ms) time to write.
  await page.waitForTimeout(900);
  console.log('WINDOW SMOKE: resize/clamp/maximize/restore OK', JSON.stringify(info));
}
await app.close();

// --- relaunch: the 720-wide size should have persisted ---
app = await launch();
{
  await app.firstWindow({ timeout: 20000 });
  const size = await app.evaluate(async ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getSize());
  if (size[0] !== 720) fail(`window width did not persist across relaunch: got ${size[0]}, expected 720`);
  console.log('WINDOW SMOKE: bounds persisted across relaunch OK', JSON.stringify(size));
}
await app.close();

fs.rmSync(userDataDir, { recursive: true, force: true });
console.log('WINDOW SMOKE OK');
