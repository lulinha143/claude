import { expect, test } from '@playwright/test';

test('renders all offline-safe pairings and captures the decision sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.goto('/typography.html');
  await page.evaluate(() => document.fonts.ready);

  const availability = Object.fromEntries(
    await Promise.all(
      ['Baloo 2', 'DynaPuff', 'Nunito', 'Sniglet', 'Atkinson Hyperlegible'].map(async (family) => [
        family,
        await page.evaluate(async (name) => {
          const faces = await document.fonts.load(
            `400 18px "${name}"`,
            'AÇÃO coração café avô órgão bênção maçã você',
          );
          return faces.length > 0 && document.fonts.check(`400 18px "${name}"`);
        }, family),
      ]),
    ),
  );
  expect(availability).toEqual({
    'Baloo 2': true,
    DynaPuff: true,
    Nunito: true,
    Sniglet: true,
    'Atkinson Hyperlegible': true,
  });
  await expect(page.locator('[data-pairing]')).toHaveCount(4);
  await expect(page.locator('[data-pairing="dynapuff"]')).toHaveClass(/is-selected/);
  await page.screenshot({
    path: 'visual-artifacts/typography/comparison-ptBR.png',
    fullPage: true,
  });

  await page.getByLabel('Language').selectOption('en');
  await page.getByText('Compact 320px').click();
  await page.screenshot({
    path: 'visual-artifacts/typography/comparison-compact-en.png',
    fullPage: true,
  });
});
