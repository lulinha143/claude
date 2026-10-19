import { test, expect, type Page } from '@playwright/test';
import { ROOM_CAP } from '../../src/sim/rooms';
import { openSettingsTab } from './support/shell';

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
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:motivational-poster'],
  },
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
    if (!localStorage.getItem('wmno.save.v1'))
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
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

test('room stats and settings toggles are self-explanatory (hover + keyboard)', async ({
  page,
}) => {
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
  // The room capacity is four, and the tooltip has to say so.
  await expect(tip).toContainText(new RegExp(`/\\s*${ROOM_CAP}|of\\s*${ROOM_CAP}|four`, 'i'));

  // Settings: a desktop toggle reveals its hint on KEYBOARD FOCUS (Window page).
  await openSettingsTab(page, 'display');
  const alwaysOnTop = page
    .locator('fieldset.desktop-controls .toggle-row span[tabindex="0"]')
    .first();
  await alwaysOnTop.scrollIntoViewIfNeeded();
  await alwaysOnTop.focus();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(/above|top/i);
});
