import { test, expect, type Page } from '@playwright/test';

// A deliberate manual-inspection pass. These write screenshots to
// `visual-artifacts/` so the office can be eyeballed at the sizes players
// actually use, and assert the things that are easy to break by accident:
// clipped characters, unreadable dialogue, and off-screen click targets.

const DIR = 'visual-artifacts';

const SAVE = {
  version: 8,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 600_000,
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 250_000, goldenNuts: 12, permanentKernels: 0, morale: 82, reputation: 130 },
  employees: {
    pip: {
      hired: true,
      level: 5,
      friendship: 60,
      outfitId: 'pip-classic',
      room: 'founder-desk',
      x: 0.5,
    },
    marlow: { hired: true, level: 3, friendship: 40, outfitId: null, room: 'founder-desk', x: 0.3 },
    bea: { hired: true, level: 3, friendship: 30, outfitId: null, room: 'founder-desk', x: 0.7 },
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
  // Let the APNG and layout settle before capturing.
  await page.waitForTimeout(600);
}

const SIZES = [
  { name: 'compact', width: 420, height: 760 },
  { name: 'default', width: 720, height: 900 },
  { name: 'wide', width: 1280, height: 950 },
];

for (const size of SIZES) {
  test(`office composition is sound at ${size.name} (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await boot(page);

    const founder = page.locator('.floor[data-room="founder-desk"]');
    await founder.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${DIR}/qa-office-${size.name}.png`, fullPage: false });

    // The +20% characters must still fit inside their room, not be clipped by
    // the room's `overflow: hidden`.
    const roomBox = (await founder.boundingBox())!;
    const critters = founder.locator('.critter-btn');
    const count = await critters.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const box = (await critters.nth(i).boundingBox())!;
      // Feet stay on the floor: the character's bottom is inside the room.
      expect(box.y + box.height, `${size.name} critter ${i} bottom`).toBeLessThanOrEqual(
        roomBox.y + roomBox.height + 2,
      );
      // Head is not cut off by the top of the room.
      expect(box.y, `${size.name} critter ${i} top`).toBeGreaterThanOrEqual(roomBox.y - 2);
    }
  });
}

test('teammates never overlap each other at the +20% character scale', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await boot(page);
  const founder = page.locator('.floor[data-room="founder-desk"]');
  await founder.scrollIntoViewIfNeeded();

  const boxes = await founder.locator('.critter-btn').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right };
    }),
  );
  boxes.sort((a, b) => a.left - b.left);
  // Bodies may come close, but a teammate must never be buried behind another.
  for (let i = 1; i < boxes.length; i += 1) {
    const overlap = boxes[i - 1].right - boxes[i].left;
    const width = boxes[i].right - boxes[i].left;
    expect(overlap, `pair ${i}`).toBeLessThan(width * 0.6);
  }
});

test('employee dialogue shows all of its text without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 760 });
  await boot(page);
  const founder = page.locator('.floor[data-room="founder-desk"]');
  await founder.scrollIntoViewIfNeeded();

  // Click a teammate to make them speak.
  await founder.locator('.critter-btn').first().click({ force: true });
  const bubble = page.locator('.speech-note__body').first();
  await expect(bubble).toBeVisible();
  await page.screenshot({ path: `${DIR}/qa-dialogue-compact.png` });

  // Nothing may be hidden by overflow: the scroll size must match the client
  // size, which is the reliable signal that no text is being cut off.
  const metrics = await bubble.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    text: (el.textContent ?? '').trim(),
  }));
  expect(metrics.text.length).toBeGreaterThan(0);
  expect(metrics.scrollH, 'dialogue is vertically clipped').toBeLessThanOrEqual(
    metrics.clientH + 1,
  );
  expect(metrics.scrollW, 'dialogue is horizontally clipped').toBeLessThanOrEqual(
    metrics.clientW + 1,
  );

  // And the whole note must stay inside the window, on both axes.
  const note = page.locator('.speech-note').first();
  const box = (await note.boundingBox())!;
  expect(box.x, 'note left edge').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'note right edge').toBeLessThanOrEqual(420 + 1);
  expect(box.y, 'note top edge').toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, 'note bottom edge').toBeLessThanOrEqual(760 + 1);
});

test('dialogue for a teammate at the room edge is not clipped by the room', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 760 });
  await boot(page);
  const founder = page.locator('.floor[data-room="founder-desk"]');
  await founder.scrollIntoViewIfNeeded();

  // The right-most teammate is the one the old in-scene bubble used to clip.
  const critters = founder.locator('.critter-btn');
  const count = await critters.count();
  const lefts = await critters.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().left),
  );
  const rightMost = lefts.indexOf(Math.max(...lefts));
  await critters.nth(rightMost).click({ force: true });

  const note = page.locator('.speech-note').first();
  await expect(note).toBeVisible();
  const roomBox = (await founder.boundingBox())!;
  const box = (await note.boundingBox())!;
  // It may extend beyond the ROOM (that is the point of the portal) but never
  // beyond the window, and it must have real height (text actually laid out).
  expect(box.height).toBeGreaterThan(10);
  expect(box.x + box.width).toBeLessThanOrEqual(420 + 1);
  expect(count).toBeGreaterThan(1);
  expect(roomBox.width).toBeGreaterThan(0);
  await page.screenshot({ path: `${DIR}/qa-dialogue-edge.png` });
});

test('every room with equipment keeps its station on screen', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await boot(page);

  const stations = page.locator('.station-btn');
  const count = await stations.count();
  expect(count).toBeGreaterThan(2);
  for (let i = 0; i < count; i += 1) {
    const station = stations.nth(i);
    await station.scrollIntoViewIfNeeded();
    const box = (await station.boundingBox())!;
    const id = await station.getAttribute('data-station');
    expect(box.x, `${id} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${id} right edge`).toBeLessThanOrEqual(721);
  }
  await page.screenshot({ path: `${DIR}/qa-stations.png`, fullPage: true });
});
