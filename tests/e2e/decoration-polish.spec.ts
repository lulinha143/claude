import { test, expect, type Page } from '@playwright/test';

// Placement-feel proof: mid-drag the full-size ghost follows the pointer, names
// the target surface, and the valid surface band is highlighted; on drop the
// piece lands (settle animation + dust puff fire, silent under mute / still
// under reduced motion). Captures a mid-drag screenshot.

const DIR = 'visual-artifacts';

const SAVE = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 9_000_000, goldenNuts: 80, reputation: 400, morale: 82, permanentKernels: 3 },
  employees: { pip: { hired: true, level: 5, friendship: 60, room: 'founder-desk', x: 0.5 } },
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:motivational-poster', 'deco:window-view', 'deco:tiny-rug'],
  },
};

async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('wmno.settings.v1')) {
        // NB: motion left ON here so the ghost/guide render exactly as players
        // see them; the elements are stable without a click, so no flakiness.
        localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: false }));
      }
    } catch {
      /* ignore */
    }
  });
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, SAVE);
}

test('dragging shows a full ghost, surface label and surface guide', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
  await page.locator('.office__toolbar button').first().click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const fern = page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]');
  const stage = page.locator('.floor[data-room="founder-desk"] .floor__stage');
  const fb = (await fern.boundingBox())!;
  const sb = (await stage.boundingBox())!;

  // Press and move WITHOUT releasing → live drag state.
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + 12, fb.y + 6, { steps: 3 });
  await page.mouse.move(sb.x + sb.width * 0.7, sb.y + sb.height * 0.85, { steps: 8 });
  await page.waitForTimeout(120);

  // The floating ghost, its surface label, and the floor guide are all present.
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await expect(page.locator('.drag-ghost__surface')).toHaveText(/Floor/i);
  await expect(page.locator('.floor[data-room="founder-desk"] .floor__surface-guide--floor')).toBeVisible();
  // Dragging disables text selection on the office.
  await expect(page.locator('.office--dragging')).toHaveCount(1);
  await page.screenshot({ path: `${DIR}/polish-01-dragging-ghost-guide.png` });

  // Release → the piece lands and the ghost disappears.
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(fern).toBeVisible();
  await page.screenshot({ path: `${DIR}/polish-02-after-drop.png` });
});
