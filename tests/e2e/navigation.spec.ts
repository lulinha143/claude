import { test, expect, type Page } from '@playwright/test';

// The navigation must read as real file tabs, not a row of glyphs. These assert the
// properties that make the metaphor work — labels, grouping, and above all the
// active tab being physically attached to the content it opened.

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

async function boot(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 950 });
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('wmno.save.v1')) {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
  }, SAVE);
  await page.goto('/');
  await expect(page.locator('.nav')).toBeVisible();
  await page.waitForTimeout(200);
}

test('every destination is a labelled tab', async ({ page }) => {
  await boot(page);
  const tabs = page.locator('.nav__tab');
  const count = await tabs.count();
  expect(count).toBeGreaterThanOrEqual(10);

  // A row of eleven unlabelled glyphs is a memory test; every tab names itself.
  for (let i = 0; i < count; i += 1) {
    const label = tabs.nth(i).locator('.nav__tab-label');
    await expect(label).toBeVisible();
    expect(((await label.textContent()) ?? '').trim().length).toBeGreaterThan(2);
  }
});

test('the open tab is physically attached to the content below it', async ({ page }) => {
  await boot(page);
  const active = page.locator('.nav__tab.is-active');
  await expect(active).toHaveCount(1);

  const style = await active.evaluate((el) => {
    const cs = getComputedStyle(el);
    const after = getComputedStyle(el, '::after');
    return {
      background: cs.backgroundColor,
      overlayHeight: parseFloat(after.height),
      overlayColour: after.backgroundColor,
    };
  });
  // It shares the content surface...
  expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
  // ...and paints over the filing rail beneath it, which is what makes the tab and
  // the panel read as one shape. Done with an overlay so every tab keeps identical
  // geometry and the strip's baseline never jitters when switching destinations.
  expect(style.overlayHeight).toBeGreaterThan(0);
  expect(style.overlayColour).toBe(style.background);
});

test('the open tab follows the player and only one is ever open', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.nav__tab[data-view="office"]')).toHaveClass(/is-active/);

  await page.locator('.nav__tab[data-view="employees"]').click();
  await expect(page.locator('.nav__tab[data-view="employees"]')).toHaveClass(/is-active/);
  await expect(page.locator('.nav__tab[data-view="office"]')).not.toHaveClass(/is-active/);
  await expect(page.locator('.nav__tab.is-active')).toHaveCount(1);
  // aria-current keeps the state available to assistive tech too.
  await expect(page.locator('.nav__tab[data-view="employees"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('tabs are grouped into filing sections', async ({ page }) => {
  await boot(page);
  const groups = await page
    .locator('.nav__tab')
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-group')))]);
  expect(groups.length).toBeGreaterThanOrEqual(3);
  // The dividers that separate them are rendered on the first tab of each section.
  expect(await page.locator('.nav__tab.starts-group').count()).toBeGreaterThanOrEqual(2);
});

test('every tab stays reachable and on-screen at narrow and wide widths', async ({ page }) => {
  for (const width of [400, 720, 1280]) {
    await boot(page, width);
    const tabs = page.locator('.nav__tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i += 1) {
      const box = (await tabs.nth(i).boundingBox())!;
      const id = await tabs.nth(i).getAttribute('data-view');
      expect(box.width, `${id} at ${width}px has no width`).toBeGreaterThan(16);
      expect(box.x, `${id} left edge at ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${id} right edge at ${width}px`).toBeLessThanOrEqual(width + 1);
    }
    await page.locator('.nav').screenshot({ path: `visual-artifacts/qa-nav-${width}.png` });
  }
});

test('navigating away leaves no stale tooltip behind', async ({ page }) => {
  await boot(page);
  await page.locator('.nav__tab[data-view="company"]').hover();
  await expect(page.locator('.tooltip[role="tooltip"]')).toBeVisible();
  await page.locator('.nav__tab[data-view="company"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tooltip[role="tooltip"]')).toHaveCount(0);
});
