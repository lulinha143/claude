// Real-Electron regression for the lost-click bug. It starts live decoration
// pointer capture, sends BrowserWindow blur/focus through the production IPC
// bridge, and proves portals, popups and arrange mode remain clickable.
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmno-focus-'));
const SAVE = {
  version: 3,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: {
    nuts: 5_000_000,
    goldenNuts: 40,
    reputation: 6_000,
    morale: 82,
    permanentKernels: 3,
  },
  employees: { pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.3 } },
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:mini-couch'],
  },
};

const app = await electron.launch({
  args: [
    'dist-electron/main.cjs',
    `--user-data-dir=${userDataDir}`,
    '--no-sandbox',
    '--disable-gpu',
  ],
  env: { ...process.env, WMNO_SMOKE: '1' },
});

async function desktopBlurFocus() {
  await app.evaluate(async ({ BrowserWindow }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const waitFor = (event) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`Electron window did not emit ${event}`)),
          3_000,
        );
        mainWindow.once(event, () => {
          clearTimeout(timeout);
          resolve(undefined);
        });
      });

    // Focus a real second native window instead of manually emitting lifecycle
    // events. This exercises Chromium -> BrowserWindow -> preload IPC -> React.
    const otherWindow = new BrowserWindow({
      width: 160,
      height: 100,
      show: false,
      webPreferences: { sandbox: true },
    });
    await otherWindow.loadURL('data:text/html,<title>Focus peer</title>');
    const blurred = waitFor('blur');
    otherWindow.show();
    otherWindow.focus();
    await blurred;
    if (mainWindow.isFocused()) throw new Error('main Electron window did not lose focus');

    const focused = waitFor('focus');
    otherWindow.destroy();
    mainWindow.show();
    mainWindow.focus();
    await focused;
  });
}

try {
  const page = await app.firstWindow({ timeout: 20_000 });
  await page.waitForLoadState('domcontentloaded');
  // Seed during every document initialization so the first app instance cannot
  // overwrite the fixture while the production page is being reloaded.
  await page.addInitScript((save) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(save));
  }, SAVE);
  await page.reload();
  await page.locator('.office').waitFor({ timeout: 20_000 });

  for (let i = 0; i < 4; i += 1) {
    const button = page.locator('.popup__actions button, .modal button').first();
    if (!(await button.count())) break;
    await button.click().catch(() => {});
    await page.waitForTimeout(120);
  }

  const arrange = page.locator('.office__toolbar .chip-btn').first();
  await arrange.click();
  const trayCard = page.locator('.deco-tray__card').first();
  const trayDecoration = trayCard.locator('.decor');
  await trayDecoration.waitFor({ state: 'visible', timeout: 15_000 });
  const box = await trayDecoration.boundingBox();
  if (!box) throw new Error('inventory decoration has no rendered bounds');

  const pointer = {
    pointerId: 41,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  };
  await trayDecoration.dispatchEvent('pointerdown', pointer);
  await page.evaluate((start) => {
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        ...start,
        clientX: start.clientX + 18,
        clientY: start.clientY - 10,
        bubbles: true,
      }),
    );
  }, pointer);
  await page.locator('.drag-ghost').waitFor({ state: 'visible', timeout: 15_000 });

  await desktopBlurFocus();
  await page.locator('.drag-ghost').waitFor({ state: 'detached' });
  if (await page.locator('.office--dragging').count())
    throw new Error('dragging class survived Electron refocus');
  if (!(await trayCard.isVisible())) throw new Error('cancelled inventory drag changed committed state');
  await page.evaluate((start) => {
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        ...start,
        buttons: 0,
        bubbles: true,
      }),
    );
  }, pointer);
  await page.waitForTimeout(0);
  await arrange.click();
  if (await page.locator('.office--decorating').count())
    throw new Error('arrange toggle is unclickable after refocus');

  // Repeat with no drag while organization mode is active.
  await arrange.click();
  await desktopBlurFocus();
  if (!(await page.locator('.office--decorating').count()))
    throw new Error('organization mode disappeared on refocus');

  // Repeat with the inventory item's localized Move To popup open; its focus
  // trap must recover and its action button must remain clickable.
  if (!(await trayCard.evaluate((element) => element.classList.contains('is-selected')))) {
    // This selection only prepares the popup fixture; real post-refocus clicks
    // are asserted on the arrange and popup action buttons below.
    await trayDecoration.dispatchEvent('click');
  }
  await page.locator('.deco-tray__move').click();
  const popup = page.locator('.move-decoration-popup');
  await popup.waitFor({ state: 'visible' });
  await desktopBlurFocus();
  await page.waitForFunction(
    () => document.querySelector('.move-decoration-popup')?.contains(document.activeElement),
    undefined,
    { timeout: 5_000 },
  );
  const cancel = popup.locator('.popup__actions .mini-btn');
  await cancel.click();
  await popup.waitFor({ state: 'detached' });
  if (await page.locator('.drag-ghost, .popup-backdrop').count()) {
    throw new Error('an invisible interaction overlay survived Electron refocus');
  }
  await arrange.click();

  // Exercise the same lifecycle with a real event popup in the packaged-style
  // Electron renderer. The query flag only reveals existing development tools;
  // event input still travels through the production engine and popup code.
  const devUrl = new URL(page.url());
  devUrl.searchParams.set('dev', '1');
  await page.goto(devUrl.toString());
  await page.locator('.office').waitFor({ timeout: 20_000 });
  await page.locator('.dev-fab').click();
  await page.getByRole('button', { name: /Actions/i }).click();
  const eventPicker = page.locator('.dev-panel select');
  await eventPicker.selectOption('printer-demands');
  const negotiate = page.locator('.event-choice[data-option-id="negotiate"]');
  await negotiate.waitFor({ state: 'visible' });
  if (!(await negotiate.isEnabled())) throw new Error('initial event choice is disabled');
  await negotiate.click();

  const chainedChoice = page.locator(
    '.event-choice[data-event-id="printer-demands"][data-event-step="peace"][data-option-id="ok"]',
  );
  await chainedChoice.waitFor({ state: 'visible' });
  await desktopBlurFocus();
  if (!(await chainedChoice.isEnabled()))
    throw new Error('event choice became disabled after Electron refocus');
  if (!(await chainedChoice.evaluate((element) => element === document.activeElement)))
    throw new Error('event popup focus trap did not recover after Electron refocus');
  await chainedChoice.click();
  const resultAction = page.locator('.consequence-modal .popup__actions button');
  await resultAction.waitFor({ state: 'visible' });
  if (!(await resultAction.isEnabled())) throw new Error('event consequence action is disabled');
  await resultAction.click();
  await page.locator('.popup-backdrop').waitFor({ state: 'detached' });

  console.log(
    'FOCUS SMOKE OK: drag, popup, organization, and event input recovered after Electron blur/focus',
  );
} finally {
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
