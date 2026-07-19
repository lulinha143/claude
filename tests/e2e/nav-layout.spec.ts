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
  return items.evaluateAll((elements) => {
    const visible = elements.filter((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    });
    return new Set(visible.map((element) => Math.round(element.getBoundingClientRect().top))).size;
  });
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
  test(`icon-only navigation stays compact and contained at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await boot(page);

    const nav = page.locator('.nav');
    const destinations = nav.locator('.nav__destination');
    const permanentControls = nav.locator('.nav__primary .nav__item:visible');
    const more = nav.locator('.nav__more-toggle');
    const panel = nav.locator('.nav__more-panel');

    await expect(nav).toBeVisible();
    await expect(destinations).toHaveCount(11);
    await expect(permanentControls).toHaveCount(6);
    expect(await visibleRowCount(permanentControls)).toBe(1);
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).not.toBeVisible();

    for (const control of await permanentControls.all()) {
      await expect(control.locator('.nav__panel-label, .nav__label')).toHaveCount(0);
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(34);
      expect(box!.width).toBeLessThanOrEqual(42);
      expect(box!.height).toBeGreaterThanOrEqual(34);
      expect(box!.height).toBeLessThanOrEqual(42);
      const iconBox = await control.locator('.ui-icon').boundingBox();
      expect(iconBox).not.toBeNull();
      expect(iconBox!.width).toBeGreaterThanOrEqual(18);
      expect(iconBox!.width).toBeLessThanOrEqual(24);
    }

    const active = nav.locator('.nav__primary .nav__item[aria-current="page"]');
    await expect(active).toHaveCount(1);
    const activeTreatment = await active.evaluate((element) => {
      const style = getComputedStyle(element);
      const marker = getComputedStyle(element, '::after');
      return {
        border: style.borderTopColor,
        shadow: style.boxShadow,
        markerWidth: marker.width,
      };
    });
    expect(activeTreatment.shadow).not.toBe('none');
    expect(activeTreatment.markerWidth).toBe('8px');

    const overflow = await nav.evaluate((element) => ({
      pixels: element.scrollWidth - element.clientWidth,
      style: getComputedStyle(element).overflowX,
      documentPixels: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.pixels).toBeLessThanOrEqual(2);
    expect(overflow.documentPixels).toBeLessThanOrEqual(2);
    expect(overflow.style).not.toBe('scroll');
    expect(overflow.style).not.toBe('auto');

    await page.screenshot({ path: `visual-artifacts/nav-icons-${label}.png` });

    await more.click();
    await expect(panel).toBeVisible();
    await expect(panel.locator('.nav__destination:visible')).toHaveCount(6);
    await expect(panel.locator('.nav__panel-label:visible')).toHaveCount(6);
    await expectInsideViewport(panel, width, height);
    await page.screenshot({ path: `visual-artifacts/nav-more-${label}.png` });
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
  });
}

test('More menu is localized, keyboard accessible, stateful, and dismissible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await boot(page, 'pt-BR');

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const more = nav.getByRole('button', { name: 'Mais' });
  const panel = nav.getByRole('group', { name: 'Mais destinos' });
  const company = nav.getByRole('button', { name: 'Empresa' });
  const stats = nav.getByRole('button', { name: 'Estatísticas', exact: true });

  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.nav__destination:visible')).toHaveCount(6);
  await expect(company).toBeFocused();
  await expect(panel.locator('.nav__panel-label')).toHaveText([
    'Empresa',
    'Coleções',
    'Conquistas',
    'Estatísticas',
    'Prestígio',
    'Ajustes',
  ]);

  await stats.focus();
  await page.keyboard.press('Enter');
  await expect(panel).not.toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute('aria-current', 'page');
  await expect(more).toHaveAttribute('aria-label', 'Mais, destino atual: Estatísticas');

  await more.click();
  await expect(company).toBeFocused();
  await expect(more).not.toHaveAttribute('aria-current', 'page');
  await expect(stats).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(more).toBeFocused();

  await more.click();
  const mainBox = await page.locator('.app__main').boundingBox();
  expect(mainBox).not.toBeNull();
  await page.mouse.click(mainBox!.x + 4, mainBox!.y + mainBox!.height - 4);
  await expect(panel).not.toBeVisible();

  await more.click();
  await expect(company).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(panel).not.toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(more).toBeFocused();
  await more.click();
  await expect(panel).toBeVisible();
});

test('localized hover/focus tooltips use one body portal, flip, and recover after blur', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'pt-BR');

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const tip = page.locator('body > .tooltip[role="tooltip"]');

  for (const { width, height } of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    const office = nav.getByRole('button', { name: 'Escritório' });
    const more = nav.getByRole('button', { name: /^Mais(?:,|$)/ });

    await office.hover();
    await expect(tip).toHaveCount(1);
    await expect(tip).toBeVisible();
    await expect(tip.locator('.tooltip__title')).toHaveText('Escritório');
    await expect(tip).toContainText('Seu escritório aconchegante');
    await expectInsideViewport(tip, width, height);
    await expect(office).toHaveAttribute('aria-label', 'Escritório');
    await expect(office).toHaveAttribute('aria-describedby', /.+/);
    await expect(office.locator('.nav__panel-label, .nav__label')).toHaveCount(0);

    await page.mouse.move(2, Math.floor(height / 2));
    await expect(tip).toHaveCount(0);

    await more.focus();
    await expect(tip).toBeVisible();
    await expect(tip.locator('.tooltip__title')).toHaveText('Mais');
    await expect(tip).toContainText('todos os outros destinos');
    await expectInsideViewport(tip, width, height);
    await more.click();

    const settings = nav.getByRole('button', { name: 'Ajustes' });
    await settings.focus();
    await expect(tip).toBeVisible();
    await expect(tip.locator('.tooltip__title')).toHaveText('Ajustes');
    await expect(tip).toContainText('áudio e acessibilidade');
    await expectInsideViewport(tip, width, height);
    await expect(settings).toHaveAttribute('aria-label', 'Ajustes');
    await expect(settings.locator('.nav__panel-label')).toHaveText('Ajustes');

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(tip).toHaveCount(0);
    await expect(nav.locator('.nav__more-panel')).not.toBeVisible();

    await office.focus();
    await expect(tip).toBeVisible();
    await expect(tip.locator('.tooltip__title')).toHaveText('Escritório');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await office.evaluate((element) => (element as HTMLElement).blur());
  }
});
