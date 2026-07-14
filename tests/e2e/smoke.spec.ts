import { test, expect, type Page } from '@playwright/test';

// Seeds a save so the test starts past the opening/onboarding with resources to
// spend. The schema fills every other field with defaults, so this minimal
// object is a valid save.
async function seedSave(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((data) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, {
    version: 3,
    onboardingComplete: true,
    lastSaved: Date.now(),
    resources: { nuts: 100000, goldenNuts: 5, reputation: 100, morale: 80, permanentKernels: 0 },
    ...extra,
  });
}

test('new game onboarding flow can be completed', async ({ page }) => {
  await page.goto('/');
  // Opening: click the acorn, then finish the title card.
  await page.getByText('Every empire starts with one nut.').waitFor();
  await page.locator('.acorn-cta').click();
  await page.getByRole('button', { name: /Let's go!/i }).click();
  // Onboarding appears — skip it.
  await page.getByRole('button', { name: 'Skip' }).click();
  // Office is visible.
  await expect(page.locator('.office')).toBeVisible();
});

test('collect, purchase an upgrade, settings, language, persistence', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');

  // No opening/onboarding because the save is not new and onboarding is done.
  await expect(page.locator('.office')).toBeVisible();

  // Collect a crate (nuts should not decrease).
  await page.locator('.crate-btn').click();

  // Go to the Upgrades shop and buy the first upgrade.
  await page.getByRole('button', { name: 'Upgrades' }).click();
  const firstBuy = page.locator('.card-list .buy-btn').first();
  await expect(firstBuy).toBeEnabled();
  await firstBuy.click();
  // The first production upgrade should now show a level pill.
  await expect(page.locator('.card-list .pill').first()).toBeVisible();

  // Open Settings and switch language to Brazilian Portuguese.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('select.select').first().selectOption('pt-BR');

  // The nav should now be localized (Escritório = Office).
  await expect(page.getByRole('button', { name: 'Escritório' })).toBeVisible();

  // Reload and confirm the language persisted.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Escritório' })).toBeVisible();
});

test('desktop-only settings are disabled in the browser demo', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  // The desktop window controls fieldset is disabled without window.desktop.
  await expect(page.locator('fieldset.desktop-controls')).toBeDisabled();
});
