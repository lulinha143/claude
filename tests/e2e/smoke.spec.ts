import { test, expect, type Page } from '@playwright/test';

// Turn on the in-game "reduced motion" setting so the app stops its looping
// decorative animations (the bobbing acorn, the pulsing crate). Those never
// settle, which otherwise leaves the real control perpetually "unstable" for
// the pointer. We still click the actual rendered control — just a still one.
// Stored under the settings key so it applies even to a brand-new game, and
// baked into seeded saves (whose settings come from the save itself, not the
// separate settings key).
async function seedReducedMotion(page: Page) {
  // Only seed when absent. addInitScript re-runs on every navigation (including
  // page.reload()); an unconditional write would clobber whatever the app has
  // since persisted and defeat the persistence assertions.
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('wmno.settings.v1')) {
        localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: true }));
      }
    } catch {
      /* ignore */
    }
  });
}

// Seeds a save so the test starts past the opening/onboarding with resources to
// spend. The schema fills every other field with defaults, so this minimal
// object is a valid save. Seeded only when absent, so a reload exercises the
// game's OWN persisted state rather than re-injecting the starting snapshot.
async function seedSave(page: Page, extra: Record<string, unknown> = {}) {
  await seedReducedMotion(page);
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
  }, {
    version: 3,
    onboardingComplete: true,
    lastSaved: Date.now(),
    resources: { nuts: 100000, goldenNuts: 5, reputation: 100, morale: 80, permanentKernels: 0 },
    settings: { reducedMotion: true },
    ...extra,
  });
}

test('new game onboarding flow can be completed', async ({ page }) => {
  await seedReducedMotion(page);
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
  // Without the Electron bridge the whole desktop-controls fieldset is disabled.
  // `toBeDisabled()` on a <fieldset> is unreliable (Playwright only treats
  // button/input/select/textarea/option/optgroup as disable-able), so assert
  // the real user-visible outcome: the controls inside cannot be operated.
  const fieldset = page.locator('fieldset.desktop-controls');
  await expect(fieldset).toHaveAttribute('disabled', '');
  await expect(fieldset.locator('input[type="checkbox"]').first()).toBeDisabled();
  await expect(fieldset.locator('select').first()).toBeDisabled();
  await expect(fieldset.locator('button.ghost-btn')).toBeDisabled();
});
