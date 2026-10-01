import { test, expect, type Page } from '@playwright/test';
import { openView } from './support/shell';

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
  await page.addInitScript(
    (data) => {
      if (!localStorage.getItem('wmno.save.v1')) {
        localStorage.setItem('wmno.save.v1', JSON.stringify(data));
      }
    },
    {
      version: 3,
      onboardingComplete: true,
      lastSaved: Date.now(),
      resources: { nuts: 100000, goldenNuts: 5, reputation: 100, morale: 80, permanentKernels: 0 },
      settings: { reducedMotion: true },
      ...extra,
    },
  );
}

test('new game onboarding flow can be completed', async ({ page }) => {
  await seedReducedMotion(page);
  await page.goto('/');
  // Opening: claim the founding acorn, then enter the illustrated field guide.
  await page.getByText('Every empire starts with one nut.').waitFor();
  await page.getByRole('button', { name: 'Claim the first acorn' }).click();
  await page.getByRole('button', { name: 'Start the company' }).click();

  // The first run teaches by doing: the coach points at the crate; tapping it
  // pays out at once, and the first goal can be bought from the office itself.
  await expect(page.locator('.popup.onboarding')).toHaveCount(0);
  const crate = page.locator('.station-btn--crate');
  await expect(crate).toHaveClass(/is-coached/);
  const goal = page.locator('.goal-tag');
  await expect(goal).toBeVisible();
  await expect(goal).not.toHaveClass(/is-ready/);
  const box = (await crate.boundingBox())!;
  for (
    let i = 0;
    i < 60 && !(await goal.evaluate((el) => el.classList.contains('is-ready')));
    i += 1
  ) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await expect(crate).not.toHaveClass(/is-coached/);
  await expect(goal).toHaveClass(/is-ready/);
  const firstGoal = await goal.getAttribute('data-goal-id');
  await goal.click();
  await expect(page.locator('.goal-tag.is-bought')).toBeVisible();
  // A purchase is saved at once.
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('wmno.save.v1') ?? '{}')?.upgrades ?? {}),
    )
    .toHaveProperty(firstGoal!);

  // Office is visible and first-run completion persisted.
  await expect(page.locator('.office')).toBeVisible();
  await page.reload();
  await expect(page.locator('.office')).toBeVisible();
  await expect(page.locator('.opening-seq')).toHaveCount(0);
});

test('collect, purchase an upgrade, settings, language, persistence', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');

  // No opening/onboarding because the save is not new and onboarding is done.
  await expect(page.locator('.office')).toBeVisible();

  // Tap the founder's nut crate station (nuts should not decrease).
  await page.locator('.station-btn').first().dispatchEvent('pointerdown', { button: 0 });

  // Go to the Upgrades shop and buy the first upgrade.
  await openView(page, 'shop');
  const firstBuy = page.locator('.card-list .buy-btn').first();
  await expect(firstBuy).toBeEnabled();
  await firstBuy.click();
  // The first production upgrade should now show a level pill.
  await expect(page.locator('.card-list .pill').first()).toBeVisible();

  // Open Settings and switch language to Brazilian Portuguese.
  await openView(page, 'settings');
  await page.locator('select.select').first().selectOption('pt-BR');

  // The dock should now be localized (Equipe = Team).
  await expect(page.getByRole('button', { name: 'Equipe', exact: true })).toBeVisible();

  // Reload and confirm the language persisted.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Equipe', exact: true })).toBeVisible();
});

test('desktop-only settings are disabled in the browser demo', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');
  await openView(page, 'settings');
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
