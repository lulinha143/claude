import { test, expect, type Page } from '@playwright/test';

// Real rendered-interface interaction tests: these drive the actual DOM with
// mouse/pointer events (NOT engine method calls) and capture drag states for
// inspection. Screenshots land in visual-artifacts/.

const RICH_SAVE = {
  version: 3,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 6000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.2 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.4 },
    rizzo: { hired: true, level: 3, friendship: 45, room: 'founder-desk', x: 0.6 },
    bea: { hired: true, level: 3, friendship: 40, room: 'founder-desk', x: 0.8 },
  },
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:mini-couch'],
  },
};

async function boot(page: Page) {
  // Seed only if absent so the app's own saves survive a reload (this init
  // script re-runs on every navigation, including reload).
  await page.addInitScript((d) => {
    if (!localStorage.getItem('wmno.save.v1'))
      localStorage.setItem('wmno.save.v1', JSON.stringify(d));
  }, RICH_SAVE);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn').first();
    if (await ok.count()) await ok.click().catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function center(page: Page, sel: string) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

test('employee drag-and-drop moves a teammate between rooms and persists', async ({ page }) => {
  await boot(page);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const founder = '.floor[data-room="founder-desk"]';
  const beforeFounder = await page.locator(`${founder} .critter-btn`).count();
  expect(beforeFounder).toBeGreaterThanOrEqual(3);

  // Destination = the room rendered directly ABOVE founder-desk (rooms render
  // highest-floor-first, founder last), so both source and target are on-screen
  // together after scrolling founder into view.
  const rooms = await page
    .locator('.floor[data-room]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.room).filter(Boolean));
  const fi = rooms.indexOf('founder-desk');
  const destRoom = rooms[fi - 1] ?? rooms.find((r) => r !== 'founder-desk')!;
  const destSel = `.floor[data-room="${destRoom}"]`;
  const beforeDest = await page.locator(`${destSel} .critter-btn`).count();

  const from = await center(page, `${founder} .critter-btn`);
  const to = await center(page, destSel);

  // real pointer drag
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y - 12, { steps: 3 }); // exceed drag threshold
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(150);
  // drag ghost + destination highlight should be present mid-drag
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.screenshot({ path: 'visual-artifacts/employee-dragging.png' });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'visual-artifacts/employee-after-drop.png' });

  // the destination room gained a teammate; the source lost one
  await expect
    .poll(async () => page.locator(`${destSel} .critter-btn`).count())
    .toBe(beforeDest + 1);
  expect(await page.locator(`${founder} .critter-btn`).count()).toBe(beforeFounder - 1);

  // persists across reload
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await page.locator(destSel).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await page.locator(`${destSel} .critter-btn`).count()).toBe(beforeDest + 1);
});

test('decoration Arrange Mode: tray opens and a decoration can be placed by dragging', async ({
  page,
}) => {
  await boot(page);
  // enter Arrange mode
  await page.getByRole('button', { name: /Arrange/i }).click();
  await page.waitForTimeout(300);
  const tray = page.locator('.deco-tray');
  await expect(tray).toBeVisible();
  await page.screenshot({ path: 'visual-artifacts/arrange-tray.png' });

  // the tray lists owned-but-unplaced decorations as draggable items
  const trayItem = page
    .locator('.deco-tray [data-deco], .deco-tray .deco-tray__item, .deco-tray button')
    .first();
  if ((await trayItem.count()) === 0) {
    test.info().annotations.push({ type: 'note', description: 'no unplaced tray items to drag' });
    return;
  }
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const from = await center(page, '.deco-tray button');
  const to = await center(page, '.floor[data-room="founder-desk"] .floor__stage');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 14, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'visual-artifacts/decoration-dragging.png' });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'visual-artifacts/decoration-after-drop.png' });
});

test('blur, focus, lost pointer streams, popups, and arrange mode never leave input blocked', async ({
  page,
}) => {
  await boot(page);
  const arrange = page.locator('.office__toolbar .chip-btn').first();
  await arrange.click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);

  // Old saves deliberately migrate owned decorations into inventory, so use a
  // real tray item rather than depending on a pre-placed fixture.
  const trayCard = page.locator('.deco-tray__card').first();
  const trayDecoration = trayCard.locator('.decor');
  await expect(trayDecoration).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener(
      'pointerdown',
      (event) => {
        document.documentElement.dataset.testPointerId = String(event.pointerId);
      },
      true,
    );
  });
  const startTrayDrag = async () => {
    const box = (await trayDecoration.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 - 12, {
      steps: 4,
    });
    await expect(page.locator('.drag-ghost')).toBeVisible();
    await expect(page.locator('.office--dragging')).toHaveCount(1);
    return page.locator('html').getAttribute('data-test-pointer-id').then(Number);
  };

  await startTrayDrag();

  // Simulate switching to another application while Electron owns capture.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(page.locator('.office--dragging')).toHaveCount(0);
  await expect(trayDecoration).not.toHaveClass(/is-dragging/);
  await expect(trayCard).toBeVisible(); // cancellation preserved committed storage state

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(trayDecoration).toBeFocused();
  await page.mouse.up(); // release Playwright's synthetic mouse after the OS-like cancellation
  await expect(trayCard).not.toHaveClass(/is-selected/); // no delayed click escaped cancellation

  // The arrange toggle remains a real click target after the cancelled stream.
  await arrange.click();
  await expect(page.locator('.office--decorating')).toHaveCount(0);
  await arrange.click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);

  // Returning without a cancelled interaction must retain the browser's own
  // focused control rather than hijacking focus to the toolbar.
  const search = page.locator('.deco-tray__search input');
  await search.focus();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect(search).toBeFocused();
  await expect(page.locator('.office--decorating')).toHaveCount(1);

  // Every in-window cancellation path tears down the same transient session.
  await startTrayDrag();
  await page.keyboard.press('Escape');
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.mouse.up();
  await expect(trayCard).not.toHaveClass(/is-selected/);

  const lostCapturePointer = await startTrayDrag();
  await trayDecoration.dispatchEvent('lostpointercapture', { pointerId: lostCapturePointer });
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.mouse.up();
  await expect(trayCard).not.toHaveClass(/is-selected/);

  const cancelledPointer = await startTrayDrag();
  await page.evaluate((pointerId) => {
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
  }, cancelledPointer);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.mouse.up();
  await expect(trayCard).not.toHaveClass(/is-selected/);

  // A swallowed release for pointer A must not block a later pointer B, while
  // A's eventual delayed click is still consumed without changing selection.
  const otherTrayCard = page.locator('.deco-tray__card').nth(1);
  const otherTrayDecoration = otherTrayCard.locator('.decor');
  await expect(otherTrayDecoration).toBeVisible();
  await trayDecoration.evaluate((element) => {
    const box = element.getBoundingClientRect();
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 71,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 71,
        pointerType: 'touch',
        isPrimary: true,
        buttons: 1,
        clientX: box.left + box.width / 2 + 20,
        clientY: box.top + box.height / 2 - 12,
        bubbles: true,
      }),
    );
  });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await otherTrayDecoration.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const init = {
      pointerId: 72,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
      bubbles: true,
    };
    element.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    element.dispatchEvent(new PointerEvent('click', { ...init, buttons: 0 }));
  });
  await expect(otherTrayCard).toHaveClass(/is-selected/);
  await trayDecoration.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent('click', {
        pointerId: 71,
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true,
      }),
    );
  });
  await expect(trayCard).not.toHaveClass(/is-selected/);
  await expect(otherTrayCard).toHaveClass(/is-selected/);
  await otherTrayDecoration.click();
  await expect(otherTrayCard).not.toHaveClass(/is-selected/);

  await startTrayDrag();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    delete (document as unknown as { visibilityState?: DocumentVisibilityState }).visibilityState;
  });
  await expect(trayDecoration).toBeFocused();
  await page.mouse.up();
  await expect(trayCard).not.toHaveClass(/is-selected/);

  // A popup may remain open, but returning focus must restore its trap and its
  // action buttons must still receive real clicks.
  if (!(await trayCard.evaluate((element) => element.classList.contains('is-selected')))) {
    await trayDecoration.click();
  }
  await page.locator('.deco-tray__move').click();
  const popup = page.locator('.move-decoration-popup');
  await expect(popup).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect
    .poll(() => popup.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  const cancel = popup.locator('.popup__actions .mini-btn');
  await cancel.click();
  await expect(popup).toHaveCount(0);

  // No transparent portal/backdrop survives and an ordinary control remains clickable.
  await expect(page.locator('.drag-ghost, .popup-backdrop')).toHaveCount(0);
  await arrange.click();
  await expect(page.locator('.office--decorating')).toHaveCount(0);

  // The unified cancellation path also protects employee state: a swallowed
  // Pip release must neither move him nor leak the trailing pet click.
  const pip = page.locator('.floor[data-room="founder-desk"] .critter-btn[aria-label="Pip"]');
  await pip.scrollIntoViewIfNeeded();
  await expect(pip).toBeVisible();
  const pipFriendshipBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('wmno.save.v1') ?? '{}').employees?.pip?.friendship,
  );
  const pipBox = (await pip.boundingBox())!;
  await page.mouse.move(pipBox.x + pipBox.width / 2, pipBox.y + pipBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(pipBox.x + pipBox.width / 2 + 18, pipBox.y + pipBox.height / 2 - 12, {
    steps: 4,
  });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(pip).toBeFocused();
  await page.mouse.up();
  await expect(pip).toBeVisible();
  const pipFriendshipAfter = await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange')); // production save hook
    const friendship = JSON.parse(
      localStorage.getItem('wmno.save.v1') ?? '{}',
    ).employees?.pip?.friendship;
    delete (document as unknown as { visibilityState?: DocumentVisibilityState }).visibilityState;
    return friendship;
  });
  expect(pipFriendshipAfter).toBe(pipFriendshipBefore);
});
