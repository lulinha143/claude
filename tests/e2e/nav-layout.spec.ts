import { test, expect, type Locator, type Page } from '@playwright/test';

// The dock: five destinations along the bottom of the window (the office itself is
// the screen, and Settings is the HUD gear). It replaced an eleven-tab rail, so the
// contract is different: fewer, bigger, labelled targets on one row at every size,
// with names wherever they fit and accessible names everywhere.

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: {
    nuts: 5_000_000,
    goldenNuts: 40,
    reputation: 4_000,
    morale: 82,
    permanentKernels: 3,
  },
  employees: { pip: { hired: true, level: 6, room: 'founder-desk', x: 0.4 } },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  decorationInstances: [],
  settings: { reducedMotion: true },
};

const VIEWPORTS = [
  { label: '320x420', width: 320, height: 420 },
  { label: '320x520', width: 320, height: 520 },
  { label: '360x600', width: 360, height: 600 },
  { label: '380x460', width: 380, height: 460 },
  { label: '400x700', width: 400, height: 700 },
  { label: '480x720', width: 480, height: 720 },
  { label: '520x520', width: 520, height: 520 },
  { label: '640x720', width: 640, height: 720 },
  { label: '800x700', width: 800, height: 700 },
  { label: '900x420', width: 900, height: 420 },
  { label: '1280x800', width: 1280, height: 800 },
] as const;

async function boot(page: Page, language = 'en') {
  await page.addInitScript(
    ({ save, locale }) => {
      localStorage.setItem(
        'wmno.save.v1',
        JSON.stringify({ ...save, settings: { ...save.settings, language: locale } }),
      );
      localStorage.setItem('wmno.lang', locale);
    },
    { save: SAVE, locale: language },
  );
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  for (let index = 0; index < 4; index += 1) {
    const dismiss = page.locator('.popup__actions button').first();
    if (await dismiss.count()) await dismiss.click({ timeout: 1_200 }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function visibleRowCount(items: Locator) {
  return items.evaluateAll(
    (elements) =>
      new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top))).size,
  );
}

async function expectInsideViewport(locator: Locator, width: number, height: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(5);
  expect(box!.y).toBeGreaterThanOrEqual(5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width - 5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height - 5);
}

for (const { label, width, height } of VIEWPORTS) {
  test(`every dock destination stays directly visible at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await boot(page);

    const dock = page.locator('.dock');
    const destinations = dock.locator('.dock__item:visible');
    await expect(dock).toBeVisible();
    await expect(destinations).toHaveCount(5);
    expect(await visibleRowCount(destinations)).toBe(1);

    // The dock sits at the very bottom of the window, below the office.
    const dockBox = (await dock.boundingBox())!;
    expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(height + 1);
    expect(dockBox.y + dockBox.height).toBeGreaterThanOrEqual(height - 1);

    const labelled = width >= 350;
    for (const control of await destinations.all()) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      // Comfortable targets: a companion window is often driven by a trackpad.
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(38);
      const iconBox = await control.locator('.ui-icon').boundingBox();
      expect(iconBox!.width).toBeGreaterThanOrEqual(18);
      expect(await control.getAttribute('aria-label')).toBeTruthy();
      const labelEl = control.locator('.dock__label');
      if (labelled) {
        await expect(labelEl).toBeVisible();
        const clipped = await labelEl.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(clipped, `${await control.getAttribute('aria-label')} label clipped`).toBe(false);
      } else {
        await expect(labelEl).toBeHidden();
      }
    }

    const overflow = await dock.evaluate((element) => ({
      pixels: element.scrollWidth - element.clientWidth,
      documentPixels: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.pixels).toBeLessThanOrEqual(2);
    expect(overflow.documentPixels).toBeLessThanOrEqual(2);

    await page.screenshot({ path: `visual-artifacts/dock-${label}.png` });
  });
}

test('every localized destination is directly keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 460 });
  await boot(page, 'pt-BR');

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const names = ['Equipe', 'Melhorias', 'Decorar', 'Atividades', 'Arquivo'];
  for (const name of names) {
    const destination = nav.getByRole('button', { name, exact: true });
    await expect(destination).toBeVisible();
    await destination.focus();
    await page.keyboard.press('Enter');
    await expect(destination).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sheet')).toBeVisible();
  }
  // Settings is the HUD gear.
  const gear = page.getByRole('button', { name: 'Ajustes', exact: true });
  await gear.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sheet[data-sheet="settings"]')).toBeVisible();
});

test('pressing a destination dismisses its tooltip instead of leaving it over the sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const team = nav.getByRole('button', { name: 'Team', exact: true });
  const tip = page.locator('body > .tooltip[role="tooltip"]');

  await team.hover();
  await expect(tip.locator('.tooltip__title')).toHaveText('Team');
  await team.click();
  await expect(page.locator('.sheet[data-sheet="employees"]')).toBeVisible();
  await expect(tip).toHaveCount(0);
});

test('localized hover and focus tooltips stay in the body portal and recover after blur', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'pt-BR');

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const tip = page.locator('body > .tooltip[role="tooltip"]');

  for (const { width, height } of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    const team = nav.getByRole('button', { name: 'Equipe' });
    const archive = nav.getByRole('button', { name: 'Arquivo' });

    await team.hover();
    await expect(tip).toHaveCount(1);
    await expect(tip.locator('.tooltip__title')).toHaveText('Equipe');
    await expect(tip).toContainText('conheça seus bichos');
    await expectInsideViewport(tip, width, height);
    await expect(team).toHaveAttribute('aria-describedby', /.+/);

    await page.mouse.move(2, Math.floor(height / 2));
    await expect(tip).toHaveCount(0);

    await archive.focus();
    await expect(tip.locator('.tooltip__title')).toHaveText('Arquivo');
    await expect(tip).toContainText('coleções');
    await expectInsideViewport(tip, width, height);

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(tip).toHaveCount(0);
    await team.focus();
    await expect(tip.locator('.tooltip__title')).toHaveText('Equipe');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await team.evaluate((element) => (element as HTMLElement).blur());
  }
});
