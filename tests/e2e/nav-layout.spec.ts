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
