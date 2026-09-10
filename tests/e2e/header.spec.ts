import { test, expect, type Page } from '@playwright/test';

// The masthead has to hold company identity plus four resources plus controls at
// every supported window size without clipping or crushing a value. These assert
// the layout contract and write screenshots for the art-direction pass.

const SAVE = {
  version: 10,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 900_000,
  company: { name: 'Nutshell Inc.' },
  // Large values on purpose: the strip must survive 7-figure numbers.
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
  await expect(page.locator('.header')).toBeVisible();
  await page.waitForTimeout(250);
}

const WIDTHS = [
  { name: 'compact', width: 400 },
  { name: 'default', width: 720 },
  { name: 'wide', width: 1280 },
];

test('the masthead states the company and its live standing', async ({ page }) => {
  await boot(page, 720);
  await expect(page.locator('.header__company')).toHaveText('Nutshell Inc.');
  // The subtitle is now the DEPARTMENT: a fixed identity, not a changing value.
  await expect(page.locator('.header__department')).toContainText('Behavioural Research');
  await expect(page.locator('.header__department')).toContainText('Department');
  // The company's standing moved to the stamp, where a changing status belongs —
  // and it must be a real tier name plus the operating cycle, not placeholder text.
  const stamp = page.locator('.header__stamp');
  await expect(stamp).toBeVisible();
  await expect(stamp.locator('.header__stamp-tier')).not.toBeEmpty();
  await expect(stamp.locator('.header__stamp-cycle')).toContainText(/Cycle\s*\d+/i);
});

test('the resource strip labels every value and explains what is happening to it', async ({
  page,
}) => {
  await boot(page, 720);
  const cells = page.locator('.res-cell');
  await expect(cells).toHaveCount(4);
  // Self-describing: each cell names its resource rather than relying on an icon.
  for (const label of ['Nuts', 'Golden', 'Morale', 'Standing']) {
    await expect(page.locator('.res-cell__label').filter({ hasText: label })).toHaveCount(1);
  }
  // Nuts show the production rate; morale shows its effect on output.
  await expect(page.locator('.res-cell--nuts .res-cell__note')).toContainText('/s');
  await expect(page.locator('.res-cell--morale .res-cell__note')).toContainText('%');
});

test('the audio and window controls are still reachable', async ({ page }) => {
  await boot(page, 720);
  const mute = page.getByTestId('mute-toggle');
  await expect(mute).toBeVisible();
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('company-logo')).toBeVisible();
});

for (const size of WIDTHS) {
  test(`the masthead fits without clipping at ${size.name} (${size.width}px)`, async ({ page }) => {
    await boot(page, size.width);
    const header = page.locator('.header');
    const box = (await header.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(size.width + 1);

    // No resource value may be cut off horizontally.
    const overflow = await page.locator('.res-cell__value').evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent ?? '',
        clipped: el.scrollWidth > el.clientWidth + 1,
      })),
    );
    expect(overflow.length).toBe(4);
    for (const cell of overflow) {
      expect(cell.clipped, `"${cell.text}" clipped at ${size.width}px`).toBe(false);
    }

    // Every cell stays inside the window.
    const cells = await page
      .locator('.res-cell')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    for (const rect of cells) {
      expect(rect.left).toBeGreaterThanOrEqual(-1);
      expect(rect.right).toBeLessThanOrEqual(size.width + 1);
    }

    await header.screenshot({ path: `visual-artifacts/qa-header-${size.name}.png` });
  });
}

test('the masthead survives a 150% UI scale', async ({ page }) => {
  await boot(page, 720);
  // Drive the real setting rather than a CSS hack.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--ui-scale', '1.5');
    document.documentElement.dataset.uiScale = '150';
  });
  await page.waitForTimeout(200);
  const cells = await page
    .locator('.res-cell')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
  expect(cells).toHaveLength(4);
  for (const rect of cells) {
    expect(rect.right).toBeLessThanOrEqual(721);
  }
  await page.locator('.header').screenshot({ path: 'visual-artifacts/qa-header-scaled.png' });
});
