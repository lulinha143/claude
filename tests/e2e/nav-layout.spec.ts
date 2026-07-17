import { test, expect, type Page } from '@playwright/test';

// Regression guard for the "sliding bar": the nav strip must NEVER produce a
// horizontal scrollbar (its tabs wrap / collapse to icons instead). Content
// panels may still scroll vertically where genuinely needed.

const SAVE = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: { pip: { hired: true, level: 6, room: 'founder-desk', x: 0.4 } },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  settings: { reducedMotion: true },
};

async function boot(page: Page) {
  await page.addInitScript((d) => {
    if (!localStorage.getItem('wmno.save.v1')) localStorage.setItem('wmno.save.v1', JSON.stringify(d));
  }, SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) await ok.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

for (const [label, w, h] of [
  ['compact', 420, 640],
  ['medium', 760, 720],
  ['normal', 1100, 780],
] as const) {
  test(`nav has no horizontal sliding bar at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    const nav = page.locator('.nav');
    await expect(nav).toBeVisible();
    // All 11 tabs present and reachable.
    await expect(page.locator('.nav__item')).toHaveCount(11);
    // No horizontal overflow => no scroll strip.
    const overflowX = await nav.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(2);
    const overflowStyle = await nav.evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowStyle).not.toBe('scroll');
    expect(overflowStyle).not.toBe('auto');
    await page.screenshot({ path: `visual-artifacts/nav-${label}.png` });
  });
}



test('localized nav tooltips stay inside every viewport and respect hover plus focus', async ({
  page,
}) => {
  await page.addInitScript((save) => {
    localStorage.setItem(
      'wmno.save.v1',
      JSON.stringify({ ...save, settings: { ...save.settings, language: 'pt-BR' } }),
    );
    localStorage.setItem('wmno.lang', 'pt-BR');
  }, SAVE);
  await page.setViewportSize({ width: 1100, height: 780 });
  await boot(page);

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const items = nav.locator('.nav__item');
  const tip = page.locator('body > .tooltip[role="tooltip"]');
  const assertInsideViewport = async (width: number, height: number) => {
    const box = await tip.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(7);
    expect(box!.y).toBeGreaterThanOrEqual(7);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width - 7);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height - 7);
  };

  for (const [width, height] of [
    [1100, 780],
    [760, 720],
    [360, 560],
  ] as const) {
    await page.setViewportSize({ width, height });

    await items.first().hover();
    await expect(tip).toBeVisible();
    await expect(tip.locator('.tooltip__title')).toHaveText('Escritório');
    await expect(tip).toContainText('Seu escritório aconchegante');
    await assertInsideViewport(width, height);

    await items.last().hover();
    await expect(tip.locator('.tooltip__title')).toHaveText('Ajustes');
    await expect(tip).toContainText('áudio e acessibilidade');
    await assertInsideViewport(width, height);
    if (width === 360) {
      await page.screenshot({ path: 'visual-artifacts/nav-tooltip-pt-compact.png' });
    }

    if (width <= 760) {
      await expect(items.first().locator('.nav__label')).toBeHidden();
      await expect(items.first()).toHaveAttribute('aria-label', 'Escritório');
    }
  }

  const office = items.first();
  const settings = items.last();

  // Focus keeps its stable description even when another control is hovered;
  // once focus leaves, the still-hovered control takes ownership.
  await office.focus();
  await settings.hover();
  await expect(tip.locator('.tooltip__title')).toHaveText('Escritório');
  await expect(tip).toHaveAttribute('id', (await office.getAttribute('aria-describedby'))!);
  await office.evaluate((element) => (element as HTMLElement).blur());
  await expect(tip.locator('.tooltip__title')).toHaveText('Ajustes');
  await page.mouse.move(2, 558);

  await settings.focus();
  await settings.hover();
  await page.mouse.move(2, 558);
  await expect(settings).toBeFocused();
  await expect(tip).toBeVisible(); // mouse left, keyboard focus still owns the tip

  await settings.hover();
  await settings.focus();
  await settings.evaluate((element) => (element as HTMLElement).blur());
  await expect(tip).toBeVisible(); // focus left, pointer hover still owns the tip
  await page.mouse.move(2, 558);
  await expect(tip).toHaveCount(0);

  // A focused edge item remains described and is remeasured after live resize.
  await settings.focus();
  await expect(tip).toBeVisible();
  await page.setViewportSize({ width: 320, height: 520 });
  await expect(tip.locator('.tooltip__title')).toHaveText('Ajustes');
  await assertInsideViewport(320, 520);
  const describedBy = await settings.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  await expect(tip).toHaveAttribute('id', describedBy!);

  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);

  // The same nav tooltip flips below a top-edge trigger and above a bottom-edge
  // trigger; both branches remain fully clamped inside the live viewport.
  await nav.evaluate((element) => {
    const html = element as HTMLElement;
    html.style.position = 'fixed';
    html.style.inset = '0 0 auto 0';
    html.style.zIndex = '20';
  });
  await office.hover();
  await expect(tip).toHaveAttribute('data-side', 'below');
  await assertInsideViewport(320, 520);
  await nav.evaluate((element) => {
    const html = element as HTMLElement;
    html.style.inset = 'auto 0 0 0';
    window.dispatchEvent(new Event('resize'));
  });
  await office.focus();
  await expect(tip).toHaveAttribute('data-side', 'above');
  await assertInsideViewport(320, 520);
  await nav.evaluate((element) => (element as HTMLElement).removeAttribute('style'));
  await office.evaluate((element) => (element as HTMLElement).blur());
  await page.mouse.move(2, 260);
  await expect(tip).toHaveCount(0);
});
