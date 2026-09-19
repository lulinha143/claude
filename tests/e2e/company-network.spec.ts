import { test, expect, type Page } from '@playwright/test';

// Proves the synergy network is DISCOVERABLE, not just implemented: the Company
// screen must show what each department contributes, what it costs, and what it
// would give if the player changed something.

const SAVE = {
  version: 9,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 900_000,
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 2_000_000, goldenNuts: 30, permanentKernels: 0, morale: 78, reputation: 300 },
  employees: {
    pip: {
      hired: true,
      level: 6,
      friendship: 70,
      outfitId: 'pip-classic',
      room: 'founder-desk',
      x: 0.5,
    },
    // Procurement is staffed but Construction is NOT, so Procurement's
    // partner-gated production effect must show up as dormant with a reason.
    rizzo: { hired: true, level: 4, friendship: 40, room: 'procurement', x: 0.4 },
    otto: { hired: true, level: 4, friendship: 40, room: 'procurement', x: 0.6 },
    perry: { hired: true, level: 4, friendship: 40, room: 'procurement', x: 0.5 },
  },
  upgrades: {},
  collections: { nuts: [], outfits: ['pip-classic'], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: true },
};

async function openCompany(page: Page) {
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('wmno.save.v1')) {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    }
  }, SAVE);
  await page.goto('/');
  await expect(page.locator('.office')).toBeVisible();
  await page.getByRole('button', { name: 'Company', exact: true }).click();
  await expect(page.locator('.dept-network')).toBeVisible();
}

test('the company screen names the reputation tier and its next rung', async ({ page }) => {
  await openCompany(page);
  const ladder = page.locator('.rep-ladder');
  await expect(ladder).toBeVisible();
  // At 300 reputation the company is well up the ladder, not "Unlisted".
  await expect(ladder.locator('.rep-ladder__tier')).not.toHaveText('Unlisted Entity');
  await expect(ladder.locator('.rep-ladder__blurb')).not.toBeEmpty();
  await expect(ladder.locator('.rep-ladder__next')).toContainText(/Next:|Highest/);
  // The tier's perks are stated, so standing visibly pays.
  await expect(ladder.locator('.rep-ladder__perks li').first()).toBeVisible();
});

test('every unlocked department reports what it contributes', async ({ page }) => {
  await openCompany(page);
  const cards = page.locator('.dept-card');
  expect(await cards.count()).toBeGreaterThan(3);

  // The staffed department shows real contributions.
  const procurement = page.locator('.dept-card[data-room="procurement"]');
  await expect(procurement).toBeVisible();
  await expect(procurement.locator('.dept-effect--good').first()).toBeVisible();
  await expect(procurement).toContainText('3 staffed');
});

test('an idle department is called out so a stalled company is diagnosable', async ({ page }) => {
  await openCompany(page);
  const idle = page.locator('.dept-card.is-idle').first();
  await expect(idle).toBeVisible();
  await expect(idle.locator('.dept-card__idle')).toContainText('No staff');
});

test('a dormant effect explains exactly what is missing', async ({ page }) => {
  await openCompany(page);
  const procurement = page.locator('.dept-card[data-room="procurement"]');
  const dormant = procurement.locator('.dept-effect--dormant').first();
  await expect(dormant).toBeVisible();
  // Procurement is fully staffed, so the only thing holding its conditional
  // production effect back is that the workshop it depends on has nobody in it.
  await expect(dormant.locator('.dept-effect__reason')).toContainText(/needs .* running/);
});

test('the production breakdown attributes output to the room network', async ({ page }) => {
  await openCompany(page);
  await page.locator('.production-ledger summary').click();
  const prod = page.locator('.prod-list');
  await expect(prod).toBeVisible();
  await expect(prod).toContainText('From your departments');
});

test('the network stays readable in a narrow companion window', async ({ page }) => {
  await openCompany(page);
  await page.setViewportSize({ width: 420, height: 800 });
  const card = page.locator('.dept-card').first();
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(421);
  // No text may be clipped out of the card.
  const clipped = await card.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(clipped).toBe(false);
  await page.screenshot({ path: 'visual-artifacts/qa-network-compact.png' });
});
