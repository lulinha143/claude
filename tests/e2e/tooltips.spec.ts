import { test, expect, type Page } from '@playwright/test';

// Tooltip audit proof. Hovers each top-bar resource and asserts a rich tooltip
// appears with a title, explanation, live impact and current value; captures a
// screenshot of the Reputation tooltip (the one the brief called out).

const DIR = 'visual-artifacts';

const SAVE = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.' },
  resources: { nuts: 1_234_567, goldenNuts: 42, reputation: 60, morale: 82, permanentKernels: 3 },
  employees: { pip: { hired: true, level: 4, friendship: 40, room: 'founder-desk', x: 0.5 } },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
};

async function seed(page: Page, save: Record<string, unknown>) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
  }, save);
}

async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
  await page.waitForTimeout(200);
}

test('every top-bar resource shows a rich tooltip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);

  const tip = page.locator('.tooltip[role="tooltip"]');

  // Reputation: name + explanation + next-unlock + current value.
  await page.locator('.res--rep').hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Reputation');
  await expect(tip).toContainText(/Unlocks new rooms/i);
  await expect(tip).toContainText(/Next unlock at/i); // "how it changes / what it works toward"
  await expect(tip).toContainText(/Now:/i); // current value
  await page.screenshot({ path: `${DIR}/tooltip-reputation.png` });

  // Morale: shows the live production impact.
  await page.locator('.res--morale').hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Morale');
  await expect(tip).toContainText(/% production right now/i);

  // Nuts, Golden and the rate badge all resolve a titled tooltip.
  for (const sel of ['.res--nuts', '.res--golden', '.header__rate']) {
    await page.locator(sel).hover();
    await expect(tip).toBeVisible();
    await expect(tip.locator('.tooltip__title')).toHaveCount(1);
    await expect(tip).toContainText(/Now:/i);
  }
});
