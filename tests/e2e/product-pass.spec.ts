import { test, expect } from '@playwright/test';
import { createInitialState } from '../../src/sim/state';

for (const config of [
  { width: 1280, lang: 'en' },
  { width: 320, lang: 'en' },
  { width: 390, lang: 'pt-BR' },
]) {
  test(`room recipe to purchase and activity purpose ${config.width} ${config.lang}`, async ({
    page,
  }) => {
    const state = createInitialState(Date.now());
    state.onboardingComplete = true;
    state.resources.nuts = 10000;
    state.settings.language = config.lang;
    state.settings.reducedMotion = true;
    // One already-earned mastery and an already-owned souvenir exercise the
    // three distinct descriptions without pretending all prizes are still available.
    state.microgames.cableUntangle = { best: 35, plays: 1, lastRewardAt: 0 };
    state.collections.secrets.push('deco:specimen-shelf');
    await page.addInitScript((save) => {
      localStorage.setItem('wmno.save.v1', JSON.stringify(save));
      localStorage.setItem('wmno.lang', save.settings.language);
    }, state);
    await page.setViewportSize({ width: config.width, height: 800 });
    await page.goto('/');
    await page
      .getByRole('button', { name: config.lang === 'en' ? 'Decorate' : 'Decorar', exact: true })
      .click();
    await page.locator('.decorate__search input').fill('nothing-matches');
    await page.locator('.ensemble-notes summary').click();
    await page.locator('.ensemble-notes__browse').first().click();
    await expect(page.locator('.ensemble-selection')).toBeFocused();
    await expect(page.locator('.decocard')).toHaveCount(3);
    await expect(page.locator('.decorate__search input')).toHaveValue('');
    await page.locator('[data-decoration="potted-fern"] .buy-btn').click();
    await expect(page.locator('[data-decoration="potted-fern"]')).toHaveClass(/is-owned/);
    await page.screenshot({
      path: `visual-artifacts/review/product-recipe-${config.width}-${config.lang}.png`,
    });
    await page.locator('.ensemble-selection button').click();
    await expect(page.locator('.decocard')).toHaveCount(5);
    await page
      .getByRole('button', { name: config.lang === 'en' ? 'Focus' : 'Foco', exact: true })
      .click();
    await expect(page.locator('.micro-card--coffeeRescue')).toContainText(
      config.lang === 'en' ? 'Pip' : 'Tico',
    );
    await expect(page.locator('.micro-card--coffeeRescue .micro-card__souvenir')).toContainText(
      '30',
    );
    await expect(page.locator('.micro-card--bugSquash .micro-card__souvenir')).toContainText(
      config.lang === 'en' ? 'first mastery award' : 'primeiro prêmio',
    );
    await expect(page.locator('.micro-card--cableUntangle .micro-card__souvenir')).toContainText(
      config.lang === 'en' ? 'Mastery on file' : 'Maestria registrada',
    );
    await page.screenshot({
      path: `visual-artifacts/review/product-activities-${config.width}-${config.lang}.png`,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.micro-card--coffeeRescue').click();
    await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'intro');
  });
}
