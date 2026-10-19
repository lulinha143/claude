import { test, expect, type Page } from '@playwright/test';
import { openView } from './support/shell';

// Navigation in the game shell: the office is always there, and every other screen
// opens OVER it as a sheet. These assert what makes that work: one destination open
// at a time, pressing it again (or Escape, or the close button) returns to the
// office, and the Archive holds the five records pages behind tabs.

const SAVE = {
  version: 10,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 900_000,
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 900_000, goldenNuts: 20, permanentKernels: 0, morale: 78, reputation: 260 },
  employees: {
    pip: { hired: true, level: 5, friendship: 60, room: 'founder-desk', x: 0.5 },
  },
  upgrades: {},
  collections: { nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: true },
};

async function boot(page: Page, width = 1280, save: object = SAVE) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('wmno.save.v1')) {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
  }, save);
  await page.goto('/');
  await expect(page.locator('.dock')).toBeVisible();
  await page.waitForTimeout(200);
}

test('every destination is a labelled dock item', async ({ page }) => {
  await boot(page);
  const items = page.locator('.dock__item');
  await expect(items).toHaveCount(5);
  for (const item of await items.all()) {
    const label = item.locator('.dock__label');
    await expect(label).toBeVisible();
    expect(((await label.textContent()) ?? '').trim().length).toBeGreaterThan(2);
  }
});

test('a destination opens over the office and only one is ever open', async ({ page }) => {
  await boot(page);
  // The office never leaves: it is the screen, and a sheet opens on top of it.
  await expect(page.locator('.office')).toBeVisible();
  await expect(page.locator('.sheet')).toHaveCount(0);

  await page.locator('.dock__item[data-dock="team"]').click();
  await expect(page.locator('.sheet[data-sheet="employees"]')).toBeVisible();
  await expect(page.locator('.dock__item[data-dock="team"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.office')).toBeVisible();

  await page.locator('.dock__item[data-dock="upgrades"]').click();
  await expect(page.locator('.sheet')).toHaveCount(1);
  await expect(page.locator('.sheet[data-sheet="shop"]')).toBeVisible();
  await expect(page.locator('.dock__item[aria-pressed="true"]')).toHaveCount(1);

  // Pressing the open destination again returns to the office.
  await page.locator('.dock__item[data-dock="upgrades"]').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('.dock__item[aria-pressed="true"]')).toHaveCount(0);
});

test('Escape and the close button both return to the office', async ({ page }) => {
  await boot(page, 380);
  await page.locator('.dock__item[data-dock="decorate"]').click();
  await expect(page.locator('.sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0);
  // Focus comes back to the dock item that opened it.
  await expect(page.locator('.dock__item[data-dock="decorate"]')).toBeFocused();

  await page.locator('.dock__item[data-dock="activities"]').click();
  await page.locator('.sheet__close').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
});

test('the Archive holds the records pages behind tabs, Prestige only when relevant', async ({
  page,
}) => {
  await boot(page);
  await page.locator('.dock__item[data-dock="archive"]').click();
  const tabs = page.locator('.sheet__tab');
  await expect(tabs).toHaveText(['Company', 'Collections', 'Achievements', 'Stats']);
  await expect(page.locator('.sheet[data-sheet="company"]')).toBeVisible();

  await page.locator('.sheet__tab[data-view="stats"]').click();
  await expect(page.locator('.sheet[data-sheet="stats"]')).toBeVisible();
  await expect(page.locator('.sheet__tab[data-view="stats"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // Reopening the Archive returns to the page last read.
  await page.locator('.dock__item[data-dock="archive"]').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await page.locator('.dock__item[data-dock="archive"]').click();
  await expect(page.locator('.sheet[data-sheet="stats"]')).toBeVisible();
});

test('the Prestige tab appears once the company has been through a cycle', async ({ page }) => {
  await boot(page, 1280, { ...SAVE, prestige: { count: 1, branch: null, skills: {} } });
  await openView(page, 'prestige');
  await expect(page.locator('.sheet__tab[data-view="prestige"]')).toBeVisible();
  await expect(page.locator('.sheet[data-sheet="prestige"]')).toBeVisible();
});

test('every dock item stays reachable and on-screen at narrow and wide widths', async ({
  page,
}) => {
  for (const width of [320, 400, 720, 1280]) {
    await boot(page, width);
    const items = page.locator('.dock__item');
    for (let i = 0; i < 5; i += 1) {
      const box = (await items.nth(i).boundingBox())!;
      const id = await items.nth(i).getAttribute('data-dock');
      expect(box.width, `${id} at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box.x, `${id} left edge at ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${id} right edge at ${width}px`).toBeLessThanOrEqual(width + 1);
    }
    await page.locator('.dock').screenshot({ path: `visual-artifacts/qa-dock-${width}.png` });
  }
});

test('navigating away leaves no stale tooltip behind', async ({ page }) => {
  await boot(page);
  await page.locator('.dock__item[data-dock="archive"]').hover();
  await expect(page.locator('.tooltip[role="tooltip"]')).toBeVisible();
  await page.locator('.dock__item[data-dock="archive"]').click();
  await expect(page.locator('.tooltip[role="tooltip"]')).toHaveCount(0);
});

test('Settings is a tabbed control panel that the keyboard can page through', async ({ page }) => {
  await boot(page, 380);
  await openView(page, 'settings');
  const tabs = page.locator('.settings-tab');
  await expect(tabs).toHaveCount(5);
  await expect(page.locator('.settings-tab[aria-selected="true"]')).toHaveAttribute(
    'data-tab',
    'general',
  );
  // Every tab fits the companion window; the page below is short, not a long form.
  for (const tab of await tabs.all()) {
    const box = (await tab.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(381);
  }
  await page.locator('.settings-tab[data-tab="general"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.settings-panel')).toHaveAttribute('data-tab', 'audio');
  await expect(page.locator('.settings-tab[data-tab="audio"]')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('.settings-panel')).toHaveAttribute('data-tab', 'file');
  await expect(page.locator('.savebar')).toBeVisible();

  // A switch row is one target: clicking its label flips it, and it persists.
  await page.locator('.settings-tab[data-tab="access"]').click();
  const reduced = page.getByRole('checkbox', { name: 'Reduced motion' });
  await expect(reduced).toBeChecked();
  await page.locator('.toggle-row', { hasText: 'Reduced motion' }).click();
  await expect(reduced).not.toBeChecked();
  // Option names are words, not internal values.
  await expect(page.locator('.setting-row select').first()).toContainText('Deuteranopia (green)');

  // Reopening Settings returns to the page last read.
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0);
  await openView(page, 'settings');
  await expect(page.locator('.settings-panel')).toHaveAttribute('data-tab', 'access');
});
