import { test, expect, type Page } from '@playwright/test';

const DIR = 'visual-artifacts';

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
  const guide = page.locator('.popup.onboarding');
  await expect(guide).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your first crate' })).toBeVisible();
  await expect(page.getByText('Page 1 of 5')).toBeVisible();
  await shot(page, 'first-run-guide-collect-1280x720');

  await page.getByRole('button', { name: 'Page 4: Watch the company grow' }).click();
  await expect(page.getByRole('heading', { name: 'Watch the company grow' })).toBeVisible();
  await shot(page, 'first-run-guide-company-1280x720');

  await page.getByRole('button', { name: 'Page 5: Make the office yours' }).click();
  await expect(page.getByRole('heading', { name: 'Make the office yours' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open the office' })).toBeVisible();
  await shot(page, 'first-run-guide-desktop-1280x720');

  // Direct page navigation is reversible and all progress is announced in text,
  // not by colour or dots alone.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Page 4 of 5')).toBeVisible();
  await page.getByRole('button', { name: 'Page 5: Make the office yours' }).click();
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
  await expect(page.getByRole('heading', { name: 'Sua primeira caixa' })).toBeVisible();
  await expectContained(page, '.popup.onboarding');
  await page.getByRole('button', { name: 'Página 5: Deixe o escritório do seu jeito' }).click();
  await expect(page.getByText('Página 5 de 5')).toBeVisible();
  await expectContained(page, '.popup.onboarding');
  await shot(page, 'first-run-guide-desktop-390x700-ptBR');
});

test('Escape offers a complete keyboard bypass without trapping focus', async ({ page }) => {
  await seedFreshSettings(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Claim the first acorn' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.opening-seq')).toHaveCount(0);
  await expect(page.locator('.popup.onboarding')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.popup.onboarding')).toHaveCount(0);
  await expect(page.locator('.office')).toBeVisible();
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
