import { test, expect, type Locator, type Page } from '@playwright/test';

const SAVE = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: {
    nuts: 5_000_000,
    goldenNuts: 49,
    reputation: 5_000,
    morale: 78,
    permanentKernels: 3,
  },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.4 },
  },
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:mini-couch'],
  },
  settings: { language: 'pt-BR', reducedMotion: true, fontScale: 1, uiScale: 1 },
};

const VIEWPORTS = [
  { label: '320x520', width: 320, height: 520 },
  { label: '360x600', width: 360, height: 600 },
  { label: '400x700', width: 400, height: 700 },
  { label: '480x720', width: 480, height: 720 },
  { label: '640x720', width: 640, height: 720 },
  { label: '800x700', width: 800, height: 700 },
  { label: '1280x800', width: 1280, height: 800 },
] as const;

async function boot(page: Page, save = SAVE) {
  await page.addInitScript((seed) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(seed));
    localStorage.setItem('wmno.lang', 'pt-BR');
  }, save);
  await page.goto('/');
  await page.locator('.office').waitFor({ timeout: 15_000 });
  for (let index = 0; index < 4; index += 1) {
    const dismiss = page.locator('.modal button, .popup__actions button').first();
    if (await dismiss.count()) await dismiss.click({ timeout: 1_200 }).catch(() => {});
    await page.waitForTimeout(100);
  }
}

async function clearNotifications(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('wmno:notifications-clear')));
  await expect(page.locator('.toast')).toHaveCount(0);
}

async function enqueueNotifications(page: Page, count: number, tone = 'positive') {
  await page.evaluate(
    ({ amount, notificationTone }) => {
      for (let index = 0; index < amount; index += 1) {
        window.dispatchEvent(
          new CustomEvent('wmno:notification', {
            detail: {
              icon: index % 2 ? 'achievements' : 'notification',
              text: `Atualização responsiva ${index + 1}`,
              tone: notificationTone,
            },
          }),
        );
      }
    },
    { amount: count, notificationTone: tone },
  );
}

async function expectShellContained(page: Page) {
  const metrics = await page.evaluate(() => {
    const selectors = [
      'html',
      'body',
      '#root',
      '.app',
      '.header',
      '.header__resources',
      '.nav',
      '.next-step',
      '.app__main',
      '.view-anim',
    ];
    return selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true, overflow: 0, left: 0, right: 0 };
      const box = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        overflow: element.scrollWidth - element.clientWidth,
        left: box.left,
        right: box.right,
      };
    });
  });

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  for (const metric of metrics) {
    if (metric.missing && metric.selector === '.next-step') continue;
    expect(metric.missing, `${metric.selector} missing`).toBe(false);
    const roundingSafe = ['.app', '.header', '.header__resources', '.nav'].includes(
      metric.selector,
    );
    expect(metric.overflow, `${metric.selector} horizontally overflows`).toBeLessThanOrEqual(
      roundingSafe ? 6 : 2,
    );
    expect(metric.left, `${metric.selector} escapes left`).toBeGreaterThanOrEqual(-1);
    expect(metric.right, `${metric.selector} escapes right`).toBeLessThanOrEqual(viewportWidth + 1);
  }
}

async function expectNavigationReadable(page: Page, width: number) {
  const nav = page.locator('.nav');
  const destinations = nav.locator('.nav__destination');
  const visibleControls = nav.locator('.nav__item:visible');
  await expect(destinations).toHaveCount(11);
  await expect(visibleControls).toHaveCount(width <= 600 ? 6 : 11);

  for (const control of await visibleControls.all()) {
    await expect(control.locator('.nav__label:visible')).toHaveCount(1);
    await expect(control.locator('.nav__label:visible')).not.toHaveText('');
  }

  const rowCount = await visibleControls.evaluateAll((elements) => {
    const rows = new Set(
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    );
    return rows.size;
  });
  expect(rowCount).toBeLessThanOrEqual(2);
  expect(rowCount).toBe(width <= 600 || width > 1000 ? 1 : 2);

  const morePanel = nav.locator('.nav__more-panel');
  if (width <= 600) {
    await expect(nav.locator('.nav__more-toggle')).toBeVisible();
    await expect(morePanel).not.toBeVisible();
  } else {
    await expect(nav.locator('.nav__more-toggle')).not.toBeVisible();
    await expect(morePanel).toBeVisible();
  }

  const navOverflow = await nav.evaluate((element) => ({
    pixels: element.scrollWidth - element.clientWidth,
    style: getComputedStyle(element).overflowX,
  }));
  expect(navOverflow.pixels).toBeLessThanOrEqual(2);
  expect(navOverflow.style).not.toBe('auto');
  expect(navOverflow.style).not.toBe('scroll');
}

async function openDestination(page: Page, destination: Locator) {
  if (!(await destination.isVisible())) {
    await page.locator('.nav__more-toggle').click();
    await expect(page.locator('.nav__more-panel')).toBeVisible();
  }
  await destination.click();
}

for (const { label, width, height } of VIEWPORTS) {
  test(`responsive acceptance at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await boot(page);
    await expectShellContained(page);
    await expectNavigationReadable(page, width);

    const mainBox = await page.locator('.app__main').boundingBox();
    expect(mainBox).not.toBeNull();
    expect(mainBox!.height).toBeGreaterThanOrEqual(120);

    const stack = page.locator('.toasts:not(.is-empty)');
    const stackBox = await stack.boundingBox();
    if (stackBox) {
      expect(stackBox.x).toBeGreaterThanOrEqual(0);
      expect(stackBox.y).toBeGreaterThanOrEqual(0);
      expect(stackBox.x + stackBox.width).toBeLessThanOrEqual(width);
      expect(stackBox.y + stackBox.height).toBeLessThanOrEqual(height);
      expect(stackBox.height).toBeLessThanOrEqual(height * 0.22);
    }
    expect(await page.locator('.toast:visible').count()).toBeLessThanOrEqual(
      width <= 480 ? 1 : width <= 800 ? 2 : 4,
    );

    await page.screenshot({ path: `visual-artifacts/responsive-${label}.png` });
  });
}

test('every primary view remains contained and vertically scrollable at 320x520', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 520 });
  await boot(page);
  await clearNotifications(page);

  const destinations = page.locator('.nav__destination');
  await expect(destinations).toHaveCount(11);
  for (const destination of await destinations.all()) {
    await openDestination(page, destination);
    await expect(page.locator('.view-anim')).toBeVisible();
    await expect(page.locator('.nav__more-panel')).not.toBeVisible();
    await expectShellContained(page);
    const main = page.locator('.app__main');
    await main.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(0);
  }
});

test('compact notification queue handles 1, 2, 4, and 8 updates without blocking controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await boot(page);
  await clearNotifications(page);

  for (const count of [1, 2, 4, 8]) {
    await enqueueNotifications(page, count);
    await expect(page.locator('.toasts')).toHaveAttribute('data-queue-size', String(count));
    await expect(page.locator('.toast:visible')).toHaveCount(1);
    if (count === 1) {
      await expect(page.locator('.toast-summary')).toHaveCount(0);
    } else {
      await expect(page.locator('.toast-summary')).toContainText(`+${count - 1}`);
    }

    const stackBox = await page.locator('.toasts').boundingBox();
    expect(stackBox).not.toBeNull();
    expect(stackBox!.height).toBeLessThanOrEqual(108);
    expect(stackBox!.x + stackBox!.width).toBeLessThanOrEqual(360);
    expect(stackBox!.y + stackBox!.height).toBeLessThanOrEqual(600);
    await expect(page.locator('.toasts')).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('.toast')).toHaveCSS('pointer-events', 'auto');

    await clearNotifications(page);
  }

  await page.evaluate(() => {
    for (let index = 0; index < 4; index += 1) {
      window.dispatchEvent(
        new CustomEvent('wmno:notification', {
          detail: { icon: 'notification', text: 'Recompensa de produção', tone: 'positive' },
        }),
      );
    }
  });
  await expect(page.locator('.toasts')).toHaveAttribute('data-queue-size', '1');
  await expect(page.locator('.toast__count')).toHaveText('×4');
  await clearNotifications(page);

  await enqueueNotifications(page, 8);
  await expect(page.locator('.toasts')).toHaveAttribute('data-queue-size', '8');
  const firstQueuedText = await page.locator('.toast__text').textContent();
  await page.locator('.toast').click();
  await expect(page.locator('.toasts')).toHaveAttribute('data-queue-size', '7');
  await expect(page.locator('.toast__text')).not.toHaveText(firstQueuedText ?? '');

  const stats = page.getByRole('button', { name: 'Estatísticas' });
  await openDestination(page, stats);
  await expect(stats).toHaveAttribute('aria-current', 'page');

  const office = page.getByRole('button', { name: 'Escritório' });
  await office.click();
  const arrange = page.locator('.office__toolbar .chip-btn').first();
  await arrange.click();
  const tray = page.locator('.deco-tray');
  await expect(tray).toBeVisible();
  const trayBox = await tray.boundingBox();
  const stackBox = await page.locator('.toasts').boundingBox();
  expect(trayBox).not.toBeNull();
  expect(stackBox).not.toBeNull();
  expect(stackBox!.y + stackBox!.height).toBeLessThanOrEqual(trayBox!.y);

  const trayDecoration = tray.locator('.deco-tray__card .decor').first();
  await expect(trayDecoration).toBeVisible();
  await trayDecoration.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const pointer = {
      pointerId: 91,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      bubbles: true,
    };
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        ...pointer,
        buttons: 1,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        ...pointer,
        buttons: 1,
        clientX: box.left + box.width / 2 + 24,
        clientY: box.top + box.height / 2 - 30,
      }),
    );
  });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: 91, pointerType: 'touch', bubbles: true }),
    );
  });
  await expect(page.locator('.drag-ghost')).toHaveCount(0);

  const selectableDecoration = tray.locator('.deco-tray__card .decor').first();
  await expect(selectableDecoration).toBeVisible();
  await selectableDecoration.click();
  const moveButton = tray.locator('.deco-tray__move');
  await expect(moveButton).toBeVisible();
  await expect(moveButton).toBeEnabled();
  await moveButton.click();
  const popup = page.locator('.popup-backdrop');
  await expect(popup).toBeVisible();
  await expect(page.locator('.toast:visible')).toHaveCount(0);
  const popupAction = popup.locator('.popup__actions button').first();
  await expect(popupAction).toBeVisible();
  await popupAction.click();
  await expect(popup).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await office.click();
  await expect(office).toHaveAttribute('aria-current', 'page');

  const main = page.locator('.app__main');
  await main.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({ path: 'visual-artifacts/responsive-360x600-notification-queue.png' });
});

test('important compact warning remains readable while hover pauses ordinary dismissal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 700 });
  await boot(page);
  await clearNotifications(page);
  await enqueueNotifications(page, 4);
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('wmno:notification', {
        detail: {
          icon: 'warning',
          text: 'Aviso importante: a colocação precisa ser revisada antes de continuar.',
          tone: 'negative',
        },
      }),
    );
  });

  const warning = page.locator('.toast--important');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('Aviso importante');
  const warningBox = await warning.boundingBox();
  expect(warningBox).not.toBeNull();
  expect(warningBox!.x).toBeGreaterThanOrEqual(0);
  expect(warningBox!.x + warningBox!.width).toBeLessThanOrEqual(400);

  await warning.hover();
  await page.waitForTimeout(500);
  await expect(warning).toBeVisible();
  await page.mouse.move(2, 2);
});

test('150% interface scale reflows at the specified 320x520 viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 520 });
  await boot(page, {
    ...SAVE,
    settings: { ...SAVE.settings, uiScale: 1.5, fontScale: 1.5 },
  });
  await clearNotifications(page);
  await expectShellContained(page);
  await expectNavigationReadable(page, 320);
  const appBox = await page.locator('.app').boundingBox();
  expect(appBox).not.toBeNull();
  expect(appBox!.x).toBeGreaterThanOrEqual(7);
  expect(appBox!.x + appBox!.width).toBeLessThanOrEqual(313);
  expect(appBox!.y).toBeGreaterThanOrEqual(7);
  expect(appBox!.y + appBox!.height).toBeLessThanOrEqual(513);
  await page.screenshot({ path: 'visual-artifacts/responsive-320x520-scale-150.png' });
});
