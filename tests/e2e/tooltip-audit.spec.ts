import { test, expect, type Page } from '@playwright/test';

// Audit proof for the newly-covered controls: the office room stats explain
// themselves on hover, and Settings toggles reveal their hint on KEYBOARD FOCUS
// (not just mouse) — the accessibility requirement.

const SAVE = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.3 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.6 },
  },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: ['deco:potted-fern', 'deco:motivational-poster'] },
};

async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('wmno.settings.v1')) {
        localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: true }));
      }
    } catch {
      /* ignore */
    }
  });
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) localStorage.setItem('wmno.save.v1', JSON.stringify(data));
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
  await page.waitForTimeout(200);
}

test('room stats and settings toggles are self-explanatory (hover + keyboard)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);

  const tip = page.locator('.tooltip[role="tooltip"]');

  // Office room capacity stat explains itself on hover.
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.locator('.floor[data-room="founder-desk"] .floor__stat').first().hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(/capacity/i);
  await expect(tip).toContainText(/\/\s*6|of\s*6|six/i);

  // Settings: a desktop toggle reveals its hint on KEYBOARD FOCUS.
  await page.getByRole('button', { name: 'Settings' }).click();
  const alwaysOnTop = page.locator('fieldset.desktop-controls .toggle-row span[tabindex="0"]').first();
  await alwaysOnTop.scrollIntoViewIfNeeded();
  await alwaysOnTop.focus();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(/above|top/i);
});
