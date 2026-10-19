import { test, expect, type Page } from '@playwright/test';

// Verifies the ambient life + its throttle wiring on the rendered page: with
// motion allowed the office shows drifting dust motes and marks ambient 'on';
// under reduced motion the office marks ambient 'paused' and drops the motes.

function save(reducedMotion: boolean) {
  return {
    version: 6,
    onboardingComplete: true,
    lastSaved: Date.now(),
    resources: {
      nuts: 2_000_000,
      goldenNuts: 20,
      reputation: 400,
      morale: 80,
      permanentKernels: 1,
    },
    employees: { pip: { hired: true, level: 4, friendship: 50, room: 'founder-desk', x: 0.5 } },
    // Existing saves take settings from the save itself (not the settings key).
    settings: { reducedMotion },
    collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  };
}

async function boot(page: Page, reducedMotion: boolean) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1'))
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, save(reducedMotion));
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
}

test('ambient life runs and shows drifting dust when motion is allowed', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await boot(page, false);
  await expect(page.locator('html')).toHaveAttribute('data-ambient', 'on');
  // Each room seeds three staggered dust motes.
  const dust = page.locator('.floor[data-room="founder-desk"] .floor__dust');
  await expect(dust).toHaveCount(3);
});

test('ambient pauses and drops dust under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await boot(page, true);
  await expect(page.locator('html')).toHaveAttribute('data-ambient', 'paused');
  await expect(page.locator('.floor[data-room="founder-desk"] .floor__dust')).toHaveCount(0);
});
