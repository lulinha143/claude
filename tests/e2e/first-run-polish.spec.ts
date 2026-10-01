import { test, expect, type Page } from '@playwright/test';
import { openView } from './support/shell';

const DIR = 'visual-artifacts';
const REPLAY_PT = 'Repetir tutorial';

async function seedFreshSettings(page: Page, language = 'en', reducedMotion = true) {
  await page.addInitScript(
    ({ locale, reduceMotion }) => {
      localStorage.removeItem('wmno.save.v1');
      localStorage.setItem(
        'wmno.settings.v1',
        JSON.stringify({ reducedMotion: reduceMotion, language: locale }),
      );
    },
    { locale: language, reduceMotion: reducedMotion },
  );
}

async function expectContained(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

test('premium first run is illustrated, keyboard-safe, and fully navigable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedFreshSettings(page);
  await page.goto('/');

  const opening = page.locator('.opening-seq__dialog');
  await expect(opening).toHaveAttribute('role', 'dialog');
  await expect(opening).toHaveAttribute('aria-modal', 'true');
  const claim = page.getByRole('button', { name: 'Claim the first acorn' });
  await expect(claim).toBeFocused();
  await expectContained(page, '.opening-seq__dialog');
  await shot(page, 'first-run-opening-intro-1280x720');

  await claim.press('Enter');
  const start = page.getByRole('button', { name: 'Start the company' });
  await expect(start).toBeVisible();
  await expect(start).toBeFocused();
  await shot(page, 'first-run-opening-title-1280x720');

  await start.click();
  // The first run teaches by doing: no guide is forced open; the coach points at
  // the founder's crate instead.
  await expect(page.locator('.office')).toBeVisible();
  await expect(page.locator('.popup.onboarding')).toHaveCount(0);
  await expect(page.locator('.station-btn--crate.is-coached')).toBeVisible();
  await shot(page, 'first-run-coach-1280x720');

  // The field guide is still there to read, from Settings.
  await openView(page, 'settings');
  await page.getByRole('button', { name: 'Replay tutorial' }).click();
  const guide = page.locator('.popup.onboarding');
  await expect(guide).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A company in a tree' })).toBeVisible();
  await expect(page.getByText('Page 1 of 4')).toBeVisible();
  // The guide shows the real cast artwork, not a drawn stand-in.
  await expect(guide.locator('.employee-sprite').first()).toBeVisible();
  await shot(page, 'first-run-guide-office-1280x720');

  await page.getByRole('button', { name: 'Page 3: Make it yours' }).click();
  await expect(page.getByRole('heading', { name: 'Make it yours' })).toBeVisible();
  await shot(page, 'first-run-guide-grow-1280x720');

  await page.getByRole('button', { name: 'Page 4: Come back any time' }).click();
  await expect(page.getByRole('heading', { name: 'Come back any time' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open the office' })).toBeVisible();
  await shot(page, 'first-run-guide-return-1280x720');

  // Direct page navigation is reversible and all progress is announced in text,
  // not by colour or dots alone.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('Page 3 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Page 4: Come back any time' }).click();
  await page.getByRole('button', { name: 'Open the office' }).click();
  await expect(page.locator('.office')).toBeVisible();
});

test('compact localized first run stays contained and respects reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await seedFreshSettings(page, 'pt-BR');
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Pegar a primeira bolota' })).toBeVisible();
  await expectContained(page, '.opening-seq__dialog');
  await expect(page.locator('.opening-seq__dialog')).toHaveCSS('animation-name', 'none');
  await shot(page, 'first-run-opening-intro-390x700-ptBR');

  await page.getByRole('button', { name: 'Pegar a primeira bolota' }).click();
  await page.getByRole('button', { name: 'Abrir a empresa' }).click();
  // Straight into the office, the coach on the crate, everything inside the window.
  await expect(page.locator('.station-btn--crate.is-coached')).toBeVisible();
  await expectContained(page, '.station-btn--crate');
  await expectContained(page, '.goal-tag');
  await openView(page, 'settings');
  await page.getByRole('button', { name: REPLAY_PT }).click();
  await expect(
    page.getByRole('heading', { name: 'Uma empresa dentro de uma árvore' }),
  ).toBeVisible();
  await expectContained(page, '.popup.onboarding');
  await page.getByRole('button', { name: 'Página 4: Volte quando quiser' }).click();
  await expect(page.getByText('Página 4 de 4')).toBeVisible();
  await expectContained(page, '.popup.onboarding');
  await shot(page, 'first-run-guide-return-390x700-ptBR');
});

test('Escape offers a complete keyboard bypass without trapping focus', async ({ page }) => {
  await seedFreshSettings(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Claim the first acorn' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.opening-seq')).toHaveCount(0);
  // Nothing else is stacked behind the opening: the office is playable at once.
  await expect(page.locator('.popup.onboarding')).toHaveCount(0);
  await expect(page.locator('.office')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveCount(1);
});

test('minimum desktop window keeps opening actions visible and focus locked during impact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await seedFreshSettings(page, 'en', false);
  await page.goto('/');

  const claim = page.getByRole('button', { name: 'Claim the first acorn' });
  await expect(claim).toBeVisible();
  await expectContained(page, '.acorn-cta');

  await claim.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skip opening' })).toBeFocused();

  const start = page.getByRole('button', { name: 'Start the company' });
  await expect(start).toBeVisible();
  await expectContained(page, '.opening-seq__continue');
});
