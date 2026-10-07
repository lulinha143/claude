import { test, expect, type Page } from '@playwright/test';
import { openView } from './support/shell';

// The HUD is one slim shelf: the company's logo sticker, the nut counter as the hero
// number, a few stat stickers and the tools. It must hold 7-figure numbers without
// clipping at every size, stay one row, and the company's identity (name,
// department, standing stamp, cycle) must still be readable — in the Archive.

const SAVE = {
  version: 10,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 900_000,
  company: { name: 'Nutshell Inc.' },
  // Large values on purpose: the stickers must survive 7-figure numbers.
  resources: { nuts: 7_670_000, goldenNuts: 36, permanentKernels: 0, morale: 82, reputation: 167 },
  employees: {
    pip: {
      hired: true,
      level: 8,
      friendship: 70,
      outfitId: 'pip-classic',
      room: 'founder-desk',
      x: 0.5,
    },
  },
  upgrades: {},
  collections: { nuts: [], outfits: ['pip-classic'], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: true },
};

async function boot(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('wmno.save.v1')) {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    }
  }, SAVE);
  await page.goto('/');
  await expect(page.locator('.hud')).toBeVisible();
  await page.waitForTimeout(250);
}

const WIDTHS = [
  { name: 'minimum', width: 320 },
  { name: 'companion', width: 380 },
  { name: 'default', width: 720 },
  { name: 'wide', width: 1280 },
];

test('the Company page states the company, its department and live standing', async ({ page }) => {
  await boot(page, 720);
  await openView(page, 'company');
  await expect(page.locator('.company-letterhead__name')).toHaveText('Nutshell Inc.');
  await expect(page.locator('.company-letterhead__dept')).toContainText('Behavioural Research');
  const stamp = page.locator('.company-letterhead__stamp');
  await expect(stamp).toBeVisible();
  await expect(stamp.locator('span').first()).not.toBeEmpty();
  await expect(stamp).toContainText(/Cycle\s*\d+/i);
});

test('the HUD names every value for assistive tech and shows the production rate', async ({
  page,
}) => {
  await boot(page, 720);
  await expect(page.getByTestId('hud-nuts')).toHaveAttribute('aria-label', /^Nuts: 7\.\d+M$/);
  await expect(page.locator('.hud__rate')).toContainText('/s');
  for (const label of ['Golden Nuts', 'Morale', 'Reputation']) {
    await expect(page.locator(`.hud-stat[aria-label^="${label}:"]`)).toHaveCount(1);
  }
});

test('the audio controls, settings gear and logo are reachable', async ({ page }) => {
  await boot(page, 720);
  const mute = page.getByTestId('mute-toggle');
  await expect(mute).toBeVisible();
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('company-logo')).toBeVisible();
  await page.locator('.hud__settings').click();
  await expect(page.locator('.sheet[data-sheet="settings"]')).toBeVisible();
  await page.locator('.hud__settings').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
});

for (const size of WIDTHS) {
  test(`the HUD fits on one row without clipping at ${size.name} (${size.width}px)`, async ({
    page,
  }) => {
    await boot(page, size.width);
    const hud = page.locator('.hud');
    const box = (await hud.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.height).toBeLessThanOrEqual(46);

    // No visible value may be cut off, and nothing may leave the window.
    const values = await page
      .locator('.hud__nuts-value, .hud-stat:visible .hud-stat__value')
      .evaluateAll((els) =>
        els.map((el) => ({
          text: el.textContent ?? '',
          clipped: el.scrollWidth > el.clientWidth + 1,
          rect: el.getBoundingClientRect().toJSON() as DOMRect,
        })),
      );
    expect(values.length).toBeGreaterThanOrEqual(3);
    for (const value of values) {
      expect(value.clipped, `"${value.text}" clipped at ${size.width}px`).toBe(false);
      expect(value.rect.left).toBeGreaterThanOrEqual(-1);
      expect(value.rect.right).toBeLessThanOrEqual(size.width + 1);
    }
    const overflow = await hud.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await hud.screenshot({ path: `visual-artifacts/qa-hud-${size.name}.png` });
  });
}

test('the HUD survives a 150% UI scale', async ({ page }) => {
  await boot(page, 720);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--ui-scale', '1.5');
    document.documentElement.dataset.uiScale = '150';
  });
  await page.waitForTimeout(200);
  const rects = await page
    .locator('.hud__nuts, .hud-stat:visible, .hud__tool:visible')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
  expect(rects.length).toBeGreaterThanOrEqual(4);
  for (const right of rects) expect(right).toBeLessThanOrEqual(721);
  await page.locator('.hud').screenshot({ path: 'visual-artifacts/qa-hud-scaled.png' });
});

test('the company is named on its masthead where the shelf has room, and on the tree everywhere', async ({
  page,
}) => {
  await boot(page, 1280, 720);
  const masthead = page.getByTestId('hud-masthead');
  await expect(masthead).toBeVisible();
  await expect(masthead.locator('.hud__company')).toHaveText('Nutshell Inc.');
  await expect(masthead.locator('.hud__dept')).toHaveText('Behavioural Research Department');
  // The masthead opens the company file, and pressing it again returns to the office.
  await masthead.click();
  await expect(page.locator('.sheet[data-sheet="company"]')).toBeVisible();
  await masthead.click();
  await expect(page.locator('.sheet')).toHaveCount(0);

  // A companion window has no room on the shelf: the tree's own sign carries it.
  await page.setViewportSize({ width: 380, height: 460 });
  await page.waitForTimeout(300);
  await expect(masthead).toBeHidden();
  const sign = page.locator('.company-sign__board');
  await expect(sign).toBeVisible();
  await expect(sign).toContainText('Nutshell Inc.');
  await sign.click();
  await expect(page.locator('.sheet[data-sheet="company"]')).toBeVisible();
  // The way back is named, not just a cross.
  await expect(page.locator('.sheet__close')).toContainText('Office');
  await page.locator('.sheet__close').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
});
