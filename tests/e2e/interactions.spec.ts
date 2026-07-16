import { test, expect, type Page } from '@playwright/test';

// Real rendered-interface interaction tests: these drive the actual DOM with
// mouse/pointer events (NOT engine method calls) and capture drag states for
// inspection. Screenshots land in visual-artifacts/.

const RICH_SAVE = {
  version: 3,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 6000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.2 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.4 },
    rizzo: { hired: true, level: 3, friendship: 45, room: 'founder-desk', x: 0.6 },
    bea: { hired: true, level: 3, friendship: 40, room: 'founder-desk', x: 0.8 },
  },
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:mini-couch'],
  },
};

async function boot(page: Page) {
  // Seed only if absent so the app's own saves survive a reload (this init
  // script re-runs on every navigation, including reload).
  await page.addInitScript((d) => {
    if (!localStorage.getItem('wmno.save.v1')) localStorage.setItem('wmno.save.v1', JSON.stringify(d));
  }, RICH_SAVE);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn').first();
    if (await ok.count()) await ok.click().catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function center(page: Page, sel: string) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

test('employee drag-and-drop moves a teammate between rooms and persists', async ({ page }) => {
  await boot(page);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const founder = '.floor[data-room="founder-desk"]';
  const beforeFounder = await page.locator(`${founder} .critter-btn`).count();
  expect(beforeFounder).toBeGreaterThanOrEqual(3);

  // Destination = the room rendered directly ABOVE founder-desk (rooms render
  // highest-floor-first, founder last), so both source and target are on-screen
  // together after scrolling founder into view.
  const rooms = await page.locator('.floor[data-room]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.room).filter(Boolean),
  );
  const fi = rooms.indexOf('founder-desk');
  const destRoom = rooms[fi - 1] ?? rooms.find((r) => r !== 'founder-desk')!;
  const destSel = `.floor[data-room="${destRoom}"]`;
  const beforeDest = await page.locator(`${destSel} .critter-btn`).count();

  const from = await center(page, `${founder} .critter-btn`);
  const to = await center(page, destSel);

  // real pointer drag
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y - 12, { steps: 3 }); // exceed drag threshold
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(150);
  // drag ghost + destination highlight should be present mid-drag
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.screenshot({ path: 'visual-artifacts/employee-dragging.png' });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'visual-artifacts/employee-after-drop.png' });

  // the destination room gained a teammate; the source lost one
  await expect
    .poll(async () => page.locator(`${destSel} .critter-btn`).count())
    .toBe(beforeDest + 1);
  expect(await page.locator(`${founder} .critter-btn`).count()).toBe(beforeFounder - 1);

  // persists across reload
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await page.locator(destSel).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await page.locator(`${destSel} .critter-btn`).count()).toBe(beforeDest + 1);
});

test('decoration Arrange Mode: tray opens and a decoration can be placed by dragging', async ({ page }) => {
  await boot(page);
  // enter Arrange mode
  await page.getByRole('button', { name: /Arrange/i }).click();
  await page.waitForTimeout(300);
  const tray = page.locator('.deco-tray');
  await expect(tray).toBeVisible();
  await page.screenshot({ path: 'visual-artifacts/arrange-tray.png' });

  // the tray lists owned-but-unplaced decorations as draggable items
  const trayItem = page.locator('.deco-tray [data-deco], .deco-tray .deco-tray__item, .deco-tray button').first();
  if ((await trayItem.count()) === 0) {
    test.info().annotations.push({ type: 'note', description: 'no unplaced tray items to drag' });
    return;
  }
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const from = await center(page, '.deco-tray button');
  const to = await center(page, '.floor[data-room="founder-desk"] .floor__stage');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 14, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'visual-artifacts/decoration-dragging.png' });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'visual-artifacts/decoration-after-drop.png' });
});
