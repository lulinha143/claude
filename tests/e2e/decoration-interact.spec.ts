import { test, expect, type Page } from '@playwright/test';

// Proves decorations are really interactive in normal play (not arrange mode):
// tapping a lamp flicks it on/off, tapping a poster cycles its artwork. Sound
// routes through the SFX bus (Master Mute + SFX volume apply); motion is off
// under reduced motion but the state change still happens.

const DIR = 'visual-artifacts';

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 9_000_000, goldenNuts: 80, reputation: 400, morale: 82, permanentKernels: 3 },
  employees: { pip: { hired: true, level: 5, friendship: 60, room: 'founder-desk', x: 0.5 } },
  placements: {
    'desk-lamp': { surface: 'floor', x: 0.36, y: 0.1 },
    'motivational-poster': { surface: 'wall', x: 0.3, y: 0.62 },
  },
  decorationInstances: [
    {
      instanceId: 'deco-desk-lamp-1',
      decorationId: 'desk-lamp',
      roomId: 'founder-desk',
      surfaceType: 'floor',
      normalizedX: 0.36,
      normalizedY: 0.1,
      depth: 3,
      interactionState: {},
    },
    {
      instanceId: 'deco-motivational-poster-1',
      decorationId: 'motivational-poster',
      roomId: 'founder-desk',
      surfaceType: 'wall',
      normalizedX: 0.3,
      normalizedY: 0.62,
      depth: 1,
      interactionState: {},
    },
  ],
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:desk-lamp', 'deco:motivational-poster', 'deco:potted-fern'],
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

test('tapping decorations toggles a light and cycles a poster', async ({ page }) => {
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
  // NOT arrange mode — normal interactive office.
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const lamp = page.locator('.floor[data-room="founder-desk"] .decor--lamp').first();
  const poster = page.locator('.floor[data-room="founder-desk"] .decor--poster').first();

  // Lamp starts lit.
  await expect(lamp).toHaveAttribute('data-on', 'true');
  await lamp.click();
  await expect(lamp).toHaveAttribute('data-on', 'false'); // turned off
  await page.screenshot({ path: `${DIR}/interact-01-lamp-off.png` });
  await lamp.click();
  await expect(lamp).toHaveAttribute('data-on', 'true'); // back on

  // Poster cycles its emblem/"slogan".
  const v0 = await poster.getAttribute('data-variant');
  await poster.click();
  const v1 = await poster.getAttribute('data-variant');
  expect(v1).not.toBe(v0);
  await poster.click();
  const v2 = await poster.getAttribute('data-variant');
  expect(v2).not.toBe(v1);
});
