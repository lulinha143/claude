import { test, expect, type Locator, type Page } from '@playwright/test';

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
    const dismiss = page.locator('.modal .buy-btn, .modal button, .popup__actions button').first();
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
  test(`every destination tab stays directly visible at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await boot(page);

    const nav = page.locator('.nav');
    const destinations = nav.locator('.nav__destination:visible');
    await expect(nav).toBeVisible();
    await expect(destinations).toHaveCount(11);
    await expect(nav.locator('.nav__more-toggle, .nav__more-panel')).toHaveCount(0);
    // One row, always. A wrapped strip steals height from a 420px-tall window and a
    // scrolled one hides destinations behind a gesture nobody expects, so the tabs
    // give up their names — and then their breathing room — rather than their row.
    expect(await visibleRowCount(destinations)).toBe(1);

    // The navigation is a strip of folder tabs rather than an icon row, so a tab is
    // as wide as its label needs. What still has to hold is that every tab is a
    // real, comfortably sized hit target with its icon intact.
    for (const control of await destinations.all()) {
      // No overflow/"more" panel labels: every destination is present directly.
      await expect(control.locator('.nav__panel-label, .nav__label')).toHaveCount(0);
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(22);
      expect(box!.height).toBeLessThanOrEqual(44);
      const iconBox = await control.locator('.ui-icon').boundingBox();
      expect(iconBox).not.toBeNull();
      expect(iconBox!.width).toBeGreaterThanOrEqual(12);
      expect(iconBox!.width).toBeLessThanOrEqual(20);
    }

    const active = nav.locator('.nav__item[aria-current="page"]');
    await expect(active).toHaveCount(1);
    // The open tab is identified by ATTACHMENT to the content below rather than by
    // a glow: it overlaps the filing rail and shares the panel surface.
    const activeTreatment = await active.evaluate((element) => {
      const cs = getComputedStyle(element);
      const after = getComputedStyle(element, '::after');
      return {
        background: cs.backgroundColor,
        // The overlay that erases the filing rail under the open tab.
        overlayHeight: parseFloat(after.height),
        overlayColour: after.backgroundColor,
        marker: getComputedStyle(element.querySelector('.nav__tab-marker')!).backgroundColor,
      };
    });
    expect(activeTreatment.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(activeTreatment.overlayHeight).toBeGreaterThan(0);
    expect(activeTreatment.overlayColour).toBe(activeTreatment.background);
    expect(activeTreatment.marker).not.toBe('rgba(0, 0, 0, 0)');

    const overflow = await nav.evaluate((element) => ({
      pixels: element.scrollWidth - element.clientWidth,
      style: getComputedStyle(element).overflowX,
      documentPixels: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.pixels).toBeLessThanOrEqual(2);
    expect(overflow.documentPixels).toBeLessThanOrEqual(2);
    expect(overflow.style).not.toBe('scroll');
    expect(overflow.style).not.toBe('auto');

    await page.screenshot({ path: `visual-artifacts/nav-all-icons-${label}.png` });
  });
}

test('every localized destination is directly keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 520 });
  await boot(page, 'pt-BR');

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const names = [
    'Escritório',
    'Equipe',
    'Melhorias',
    'Decorar',
    'Foco',
    'Empresa',
    'Coleções',
    'Conquistas',
    'Estatísticas',
    'Prestígio',
    'Ajustes',
  ];
  for (const name of names) {
    const destination = nav.getByRole('button', { name, exact: true });
    await expect(destination).toBeVisible();
    await destination.focus();
    await page.keyboard.press('Enter');
    await expect(destination).toHaveAttribute('aria-current', 'page');
  }
});

test('hovered navigation labels override a previously clicked destination', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page);

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const settings = nav.getByRole('button', { name: 'Settings', exact: true });
  const office = nav.getByRole('button', { name: 'Office', exact: true });
  const tip = page.locator('body > .tooltip[role="tooltip"]');

  await settings.click();
  await expect(settings).toBeFocused();
  const settingsDescriptionId = await settings.getAttribute('aria-describedby');
  expect(settingsDescriptionId).not.toBeNull();

  await office.hover();
  await expect(tip.locator('.tooltip__title')).toHaveText('Office');
  await expect(tip).toContainText('cozy office');
  await expect(page.locator(`[id="${settingsDescriptionId}"]`)).toHaveCount(1);
  await expect(page.locator('body > .tooltip[role="tooltip"]')).toHaveCount(1);
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
    const office = nav.getByRole('button', { name: 'Escritório' });
    const settings = nav.getByRole('button', { name: 'Ajustes' });

    await office.hover();
    await expect(tip).toHaveCount(1);
    await expect(tip.locator('.tooltip__title')).toHaveText('Escritório');
    await expect(tip).toContainText('Seu escritório aconchegante');
    await expectInsideViewport(tip, width, height);
    await expect(office).toHaveAttribute('aria-describedby', /.+/);

    await page.mouse.move(2, Math.floor(height / 2));
    await expect(tip).toHaveCount(0);

    await settings.focus();
    await expect(tip.locator('.tooltip__title')).toHaveText('Ajustes');
    await expect(tip).toContainText('áudio e acessibilidade');
    await expectInsideViewport(tip, width, height);

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(tip).toHaveCount(0);
    await office.focus();
    await expect(tip.locator('.tooltip__title')).toHaveText('Escritório');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await office.evaluate((element) => (element as HTMLElement).blur());
  }
});
