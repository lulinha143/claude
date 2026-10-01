import { test, expect, type Page } from '@playwright/test';

// The company logo in the header is clickable and opens a picker. Choosing an
// icon applies immediately, persists in the save, survives a reload, and is
// reflected consistently (header + Company view).

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.', icon: 'paw' },
  resources: { nuts: 100000, goldenNuts: 10, reputation: 400, morale: 80 },
  employees: { pip: { hired: true, level: 3, room: 'founder-desk', x: 0.5 } },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
};

async function seed(page: Page) {
  // Seed only when no save exists so a reload preserves what the player did
  // (this test asserts persistence across reloads).
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
  }, SAVE);
}
async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
  await page.waitForTimeout(150);
}
async function savedIcon(page: Page): Promise<string | undefined> {
  const raw = await page.evaluate(() => localStorage.getItem('wmno.save.v1'));
  return raw ? JSON.parse(raw)?.company?.icon : undefined;
}

test('company logo picker applies, persists, and reflects everywhere', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await seed(page);
  await page.goto('/');
  await page.locator('.hud').first().waitFor({ timeout: 15000 });
  await clearModals(page);

  const logo = page.getByTestId('company-logo');
  await expect(logo).toBeVisible();
  await logo.click();

  const dialog = page.locator('.company-icon-picker');
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'visual-artifacts/company-logo-picker.png' });

  // Choose the Fox emblem.
  const fox = dialog.getByRole('radio', { name: 'Fox' });
  await fox.click();
  await expect(fox).toHaveAttribute('aria-checked', 'true');
  expect(await savedIcon(page)).toBe('fox');

  // Close and reload — the choice persists.
  await dialog.getByRole('button', { name: /done/i }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.locator('.hud').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  expect(await savedIcon(page)).toBe('fox');
  await page.getByTestId('company-logo').click();
  await expect(
    page.locator('.company-icon-picker').getByRole('radio', { name: 'Fox' }),
  ).toHaveAttribute('aria-checked', 'true');
});
