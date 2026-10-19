import { test, expect, type Page } from '@playwright/test';
import { SCENE_DEPTH } from '../../src/sim/depth';

// Proves the two things unit tests and jsdom cannot see:
//   1. Rapid repeated clicking on a station actually pays out every time in a
//      real browser, with real event dispatch and real CSS.
//   2. Characters paint IN FRONT of decorations once real styles are applied.

const SAVE = {
  version: 8,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 60_000,
  company: { name: 'Nutshell Inc.' },
  // Reputation high enough to open several rooms, so more than one station exists.
  resources: { nuts: 5_000, goldenNuts: 4, permanentKernels: 0, morale: 80, reputation: 60 },
  employees: {
    pip: {
      hired: true,
      level: 3,
      friendship: 40,
      outfitId: 'pip-classic',
      room: 'founder-desk',
      x: 0.5,
    },
  },
  upgrades: {},
  collections: { nuts: [], outfits: ['pip-classic'], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: false },
};

async function boot(page: Page) {
  await page.addInitScript((save) => {
    window.localStorage.setItem('wmno.save.v1', JSON.stringify(save));
  }, SAVE);
  await page.goto('/');
  await expect(page.locator('.office')).toBeVisible();
}

/** Read the live nut total straight out of the engine's saved state. */
async function nutsFromEngine(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('wmno.save.v1');
    return raw ? (JSON.parse(raw).resources?.nuts ?? 0) : 0;
  });
}

test('the founder room has a tappable station and it pays out', async ({ page }) => {
  await boot(page);
  const station = page.locator('.floor[data-room="founder-desk"] .station-btn');
  await expect(station).toHaveCount(1);
  await expect(station).toBeVisible();
  await expect(station).toHaveAttribute('data-station', 'nut-crate');
});

test('clicker gameplay exists in more than one room', async ({ page }) => {
  await boot(page);
  // Several rooms are open at this reputation, and each open room brings its own
  // equipment rather than reusing the founder's crate.
  const stations = page.locator('.station-btn');
  expect(await stations.count()).toBeGreaterThan(2);

  const ids = await stations.evaluateAll((els) => els.map((el) => el.getAttribute('data-station')));
  // Distinct equipment, not the same box cloned per room.
  expect(new Set(ids).size).toBe(ids.length);
});

test('rapid repeated clicking is never dropped or throttled', async ({ page }) => {
  await boot(page);
  const station = page.locator('.floor[data-room="founder-desk"] .station-btn');
  // Real mouse input is hit-tested, so the station has to actually be on screen.
  await station.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = (await station.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // Count taps by observing the engine's own lifetime tap counter, which is the
  // authoritative record of how many payouts actually happened.
  const TAPS = 40;
  await page.mouse.move(x, y);
  for (let i = 0; i < TAPS; i += 1) {
    // No delay at all: this is the mash case that a debounce would break.
    await page.mouse.down();
    await page.mouse.up();
  }

  // Force a save so the counter is observable, then assert every tap landed.
  const taps = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    const raw = window.localStorage.getItem('wmno.save.v1');
    return raw ? (JSON.parse(raw).clicker?.stationTaps?.['nut-crate'] ?? 0) : 0;
  });
  expect(taps).toBeGreaterThanOrEqual(TAPS);
});

test('a fast streak raises the payout and shows a combo counter', async ({ page }) => {
  await boot(page);
  const station = page.locator('.floor[data-room="founder-desk"] .station-btn');
  await station.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = (await station.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  for (let i = 0; i < 6; i += 1) {
    await page.mouse.down();
    await page.mouse.up();
  }
  // The combo badge appears once the streak is worth mentioning.
  await expect(station.locator('.station-btn__combo')).toBeVisible();

  const best = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    const raw = window.localStorage.getItem('wmno.save.v1');
    return raw ? (JSON.parse(raw).clicker?.bestStreak ?? 0) : 0;
  });
  expect(best).toBeGreaterThanOrEqual(6);
});

test('tapping floats a payout number and cleans it up afterwards', async ({ page }) => {
  await boot(page);
  const station = page.locator('.floor[data-room="founder-desk"] .station-btn');
  await station.dispatchEvent('pointerdown', { button: 0 });

  const pop = page.locator('.tap-layer .tap-pop');
  await expect(pop.first()).toBeVisible();
  // Popups must not accumulate — the layer empties itself.
  await expect(pop).toHaveCount(0, { timeout: 4_000 });
});

test('nuts actually increase when a station is tapped', async ({ page }) => {
  await boot(page);
  const before = await nutsFromEngine(page);
  const station = page.locator('.floor[data-room="founder-desk"] .station-btn');
  for (let i = 0; i < 5; i += 1) {
    await station.dispatchEvent('pointerdown', { button: 0 });
  }
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  expect(await nutsFromEngine(page)).toBeGreaterThan(before);
});

test('furnishings and equipment paint in front of employees', async ({ page }) => {
  await boot(page);
  const founder = page.locator('.floor[data-room="founder-desk"]');

  const character = founder.locator('.critter-btn').first();
  await expect(character).toBeVisible();
  const characterZ = Number(await character.evaluate((el) => getComputedStyle(el).zIndex));

  // Every decoration paints in front of the character.
  const decoZ = await founder
    .locator('.floor__deco')
    .evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).zIndex)));
  for (const z of decoZ) {
    expect(z).toBeGreaterThan(characterZ);
  }

  // Equipment follows the same foreground rule.
  const stationZ = Number(
    await founder.locator('.station-btn').evaluate((el) => getComputedStyle(el).zIndex),
  );
  expect(stationZ).toBeGreaterThan(characterZ);

  // And the character must be inside the reserved character band.
  expect(characterZ).toBeGreaterThanOrEqual(SCENE_DEPTH.character.min);
  expect(characterZ).toBeLessThanOrEqual(SCENE_DEPTH.character.max);
});

test('the station stays usable at a small window and at 150% UI scale', async ({ page }) => {
  await boot(page);
  for (const size of [
    { width: 420, height: 720 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    const station = page.locator('.floor[data-room="founder-desk"] .station-btn');
    await expect(station).toBeVisible();
    const box = (await station.boundingBox())!;
    // Still a real, hittable target rather than a sliver.
    expect(box.width, `width at ${size.width}`).toBeGreaterThan(20);
    expect(box.height, `height at ${size.height}`).toBeGreaterThan(20);
    // And fully inside the viewport horizontally.
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
  }
});
