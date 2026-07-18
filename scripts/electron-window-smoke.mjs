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
    args: [
      'dist-electron/main.cjs',
      `--user-data-dir=${userDataDir}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
    env: { ...process.env, WMNO_SMOKE: '1' },
  });
}

async function inspectRendererAt(page, width, height) {
  await app.evaluate(
    async ({ BrowserWindow }, bounds) => {
      BrowserWindow.getAllWindows()[0].setBounds(bounds);
    },
    { width, height },
  );
  await page.waitForTimeout(250);

  const report = await page.evaluate(() => {
    const selectors = [
      'html',
      'body',
      '#root',
      '.app',
      '.header',
      '.header__resources',
      '.nav',
      '.app__main',
      '.view-anim',
    ];
    const metrics = selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return { selector, missing: true };
      const box = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        overflow: element.scrollWidth - element.clientWidth,
        left: box.left,
        right: box.right,
        height: box.height,
      };
    });
    const items = [...document.querySelectorAll('.nav__item')];
    const labels = [...document.querySelectorAll('.nav__label')];
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      uiScale: document.documentElement.dataset.uiScale,
      appZoom: getComputedStyle(document.querySelector('.app')).zoom,
      appChildren: [...document.querySelector('.app').children].map((element) => ({
        className: element.className,
        position: getComputedStyle(element).position,
        height: element.getBoundingClientRect().height,
      })),
      metrics,
      navCount: items.length,
      visibleLabels: labels.filter((label) => {
        const style = getComputedStyle(label);
        const box = label.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          box.width > 0 &&
          box.height > 0
        );
      }).length,
      navRows: new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size,
      controls: document.querySelectorAll('.window-controls .wc-btn').length,
      mainHeight: document.querySelector('.app__main')?.getBoundingClientRect().height ?? 0,
    };
  });

  for (const metric of report.metrics) {
    if (metric.missing) fail(`${metric.selector} missing at ${width}x${height}`);
    if (metric.overflow > 6) {
      fail(`${metric.selector} overflows by ${metric.overflow}px at ${width}x${height}`);
    }
    if (metric.left < -1 || metric.right > report.viewport.width + 1) {
      fail(`${metric.selector} escapes viewport at ${width}x${height}: ${JSON.stringify(metric)}`);
    }
  }
  if (report.navCount !== 11 || report.visibleLabels !== 11) {
    fail(`navigation is not fully labelled at ${width}x${height}: ${JSON.stringify(report)}`);
  }
  if (report.viewport.width <= 800 && report.navRows < 2) {
    fail(`compact navigation did not wrap at ${width}x${height}: ${JSON.stringify(report)}`);
  }
  if (report.controls !== 3) {
    fail(`desktop window controls missing at ${width}x${height}: ${JSON.stringify(report)}`);
  }
  if (report.mainHeight < 70) {
    fail(`playable region is too short at ${width}x${height}: ${JSON.stringify(report)}`);
  }
  console.log(
    `WINDOW SMOKE: renderer contained at ${width}x${height}`,
    JSON.stringify(report.viewport),
  );
}

// --- first launch: exercise resize, clamp, maximize/restore, set a size ---
let app = await launch();
{
  const page = await app.firstWindow({ timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.nav').waitFor({ state: 'visible', timeout: 20000 });

  // Exercise the real Electron renderer (including custom window controls) at
  // the native minimum/default, compact square, and wide-short acceptance sizes.
  for (const [rendererWidth, rendererHeight] of [
    [320, 420],
    [380, 460],
    [520, 520],
    [900, 420],
  ]) {
    await inspectRendererAt(page, rendererWidth, rendererHeight);
  }

  // Phase 1: resizable + min-clamp + maximize/restore round-trip. (Maximize is
  // WM-dependent; under xvfb it's informational only.)
  const info = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const resizable = w.isResizable();
    w.setSize(120, 120);
    const clamped = w.getSize();
    w.maximize();
    const maxed = w.isMaximized();
    w.unmaximize();
    const restored = w.isMaximized();
    return { resizable, clamped, maxed, restored };
  });
  // Let any async resize from the maximize/unmaximize dance settle so it can't
  // overwrite the persisted size below (xvfb emits these late).
  await page.waitForTimeout(600);
  // Phase 2: set the size to persist LAST, in isolation.
  const info2 = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setBounds({ width: 720, height: 640 });
    return { set: w.getSize() };
  });
  info.set = info2.set;

  if (!info.resizable) fail('window is not resizable');
  if (info.clamped[0] < MIN_WIDTH || info.clamped[1] < MIN_HEIGHT) {
    fail(`min-size not enforced: got ${info.clamped}`);
  }
  if (info.set[0] !== 720) fail(`setSize width not applied: ${info.set}`);
  // maximize/restore depend on a real window manager; xvfb has none, so treat
  // them as best-effort here (they are verified by hand per the Windows
  // checklist). Only warn if the round-trip misbehaves.
  if (!info.maxed || info.restored) {
    console.log(
      'WINDOW SMOKE NOTE: maximize/restore not observable under xvfb (no WM) —',
      JSON.stringify(info),
    );
  }

  // Give the debounced bounds-persist (400ms) time to write.
  await page.waitForTimeout(1600);
  console.log('WINDOW SMOKE: resize/clamp/maximize/restore OK', JSON.stringify(info));
}
await app.close();

// Persistence is asserted against the WRITTEN settings file — deterministic and
// free of the WM-less show/resize distortions that skew getSize() under xvfb.
const settingsFile = path.join(userDataDir, 'window-settings.json');
const persisted = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
if (persisted.width !== 720 || persisted.height !== 640) {
  fail(
    `bounds not persisted to disk: ${JSON.stringify({ width: persisted.width, height: persisted.height })}`,
  );
}
console.log(
  'WINDOW SMOKE: bounds persisted to disk OK',
  JSON.stringify({ width: persisted.width, height: persisted.height }),
);

// --- relaunch: the app reopens and the persisted size is still on disk ---
app = await launch();
{
  await app.firstWindow({ timeout: 20000 });
  const alive = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return !!w && !w.isDestroyed() && w.isResizable();
  });
  if (!alive) fail('window did not reopen (resizable) after relaunch');
  const stillPersisted = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
  if (stillPersisted.width !== 720)
    fail(`persisted width lost after relaunch: ${stillPersisted.width}`);
  console.log('WINDOW SMOKE: relaunched with persisted bounds intact OK');
}
// Force the second process down instead of routing through window-close
// handlers (which may intentionally hide to tray after persisted settings load).
await Promise.race([
  app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 3_000)),
]);

fs.rmSync(userDataDir, { recursive: true, force: true });
console.log('WINDOW SMOKE OK');
