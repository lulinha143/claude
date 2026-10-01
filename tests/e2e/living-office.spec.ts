import { test, expect, type Page } from '@playwright/test';
import { GAME_EVENTS } from '../../src/content/events';
import { SCENE_DEPTH } from '../../src/sim/depth';
import { arrangeToggle } from './support/shell';

// Phase 2 contract: the office itself is the game. Emotion stickers belong to
// each teammate and stay readable; furniture is picked up and put down at its
// real size; wall art and rugs sit behind the team, floor furniture in front,
// and the player can swap a wall or floor piece and keep that choice.

const ROOM = 'founder-desk';

type Placed = [id: string, surface: 'floor' | 'wall', x: number, y: number];

function save(placed: Placed[], extra: Record<string, unknown> = {}) {
  return {
    version: 7,
    onboardingComplete: true,
    lastSaved: Date.now(),
    eventCooldowns: Object.fromEntries(GAME_EVENTS.map((e) => [e.id, Date.now() + 3_600_000])),
    resources: { nuts: 50_000, goldenNuts: 10, reputation: 300, morale: 72 },
    employees: {
      pip: { hired: true, level: 3, friendship: 60, room: ROOM },
      marlow: { hired: true, level: 2, friendship: 45, room: ROOM },
      nino: { hired: true, level: 2, friendship: 50, room: ROOM },
      junie: { hired: true, level: 2, friendship: 40, room: ROOM },
    },
    decorationInstances: placed.map(([id, surface, x, y]) => ({
      instanceId: `deco-${id}`,
      decorationId: id,
      roomId: ROOM,
      surfaceType: surface,
      normalizedX: x,
      normalizedY: y,
      depth: 0,
      interactionState: {},
    })),
    collections: {
      secrets: placed.map(([id]) => `deco:${id}`),
      nuts: [],
      outfits: [],
      logos: [],
      moments: [],
    },
    settings: { language: 'en', reducedMotion: false, showHints: false },
    ...extra,
  };
}

const FURNISHED: Placed[] = [
  ['potted-fern', 'floor', 0.18, 0.08],
  ['desk-lamp', 'floor', 0.62, 0.08],
  ['tiny-rug', 'floor', 0.5, 0.02],
  ['motivational-poster', 'wall', 0.4, 0.65],
];

/** Seed once per test (a reload keeps what the player did). */
async function boot(page: Page, width: number, height: number, data: object) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('living-office-seeded')) return;
    sessionStorage.setItem('living-office-seeded', '1');
    localStorage.setItem('wmno.save.v1', JSON.stringify(seed));
    localStorage.setItem('wmno.lang', 'en');
  }, data);
  await page.goto('/');
  await page.locator(`.floor[data-room="${ROOM}"]`).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
}

const zOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => Number(getComputedStyle(el).zIndex));

for (const [width, height] of [
  [320, 420],
  [380, 460],
  [1280, 720],
] as const) {
  test(`stickers are each teammate's own, readable and inside the window at ${width}x${height}`, async ({
    page,
  }) => {
    await boot(page, width, height, save(FURNISHED));
    const report = await page.evaluate((room) => {
      const floor = document.querySelector(`.floor[data-room="${room}"]`)!;
      return [...floor.querySelectorAll<HTMLElement>('.critter-btn')].map((button) => {
        const id = button.dataset.employee!;
        const sticker = floor.querySelector<HTMLElement>(
          `.employee-bubble[data-employee="${id}"]`,
        )!;
        const art = button.querySelector('.employee-sprite, svg.critter')!.getBoundingClientRect();
        const s = sticker.getBoundingClientRect();
        return {
          id,
          kind: sticker.dataset.sticker,
          z: Number(getComputedStyle(sticker).zIndex),
          art: { left: art.left, right: art.right, top: art.top, bottom: art.bottom },
          sticker: { left: s.left, right: s.right, top: s.top, bottom: s.bottom, width: s.width },
        };
      });
    }, ROOM);

    expect(report).toHaveLength(4);
    // Roommates do not all wear the same face.
    expect(new Set(report.map((r) => r.kind)).size).toBeGreaterThan(1);
    for (const r of report) {
      // Big enough to read in a corner window.
      expect(r.sticker.width, `${r.id} sticker size`).toBeGreaterThanOrEqual(28);
      // Above that teammate (its centre over their artwork), not floating at the ceiling.
      const centre = (r.sticker.left + r.sticker.right) / 2;
      expect(centre).toBeGreaterThan(r.art.left);
      expect(centre).toBeLessThan(r.art.right);
      expect(r.sticker.bottom).toBeLessThan(r.art.bottom);
      expect(r.sticker.bottom).toBeGreaterThan(r.art.top - 12);
      // Fully inside the window.
      expect(r.sticker.top).toBeGreaterThanOrEqual(0);
      expect(r.sticker.left).toBeGreaterThanOrEqual(0);
      expect(r.sticker.right).toBeLessThanOrEqual(width);
      // Above every piece of furniture and every character.
      expect(r.z).toBe(SCENE_DEPTH.sticker);
    }
    // Neighbours never cover each other's sticker.
    const sorted = [...report].sort((a, b) => a.sticker.left - b.sticker.left);
    for (let i = 1; i < sorted.length; i += 1) {
      const overlap = sorted[i - 1].sticker.right - sorted[i].sticker.left;
      const vertical =
        Math.min(sorted[i - 1].sticker.bottom, sorted[i].sticker.bottom) -
        Math.max(sorted[i - 1].sticker.top, sorted[i].sticker.top);
      expect(overlap > 2 && vertical > 2, `${sorted[i - 1].id} / ${sorted[i].id}`).toBe(false);
    }
  });
}

test('wall art and rugs sit behind the team, floor furniture in front', async ({ page }) => {
  await boot(page, 1280, 720, save(FURNISHED));
  const floor = `.floor[data-room="${ROOM}"]`;
  const characters = await page
    .locator(`${floor} .critter-btn`)
    .evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).zIndex)));
  const front = Math.max(...characters);
  const back = Math.min(...characters);
  expect(await zOf(page, `${floor} [data-deco="motivational-poster"]`)).toBeLessThan(back);
  expect(await zOf(page, `${floor} [data-deco="tiny-rug"]`)).toBeLessThan(back);
  expect(await zOf(page, `${floor} [data-deco="potted-fern"]`)).toBeGreaterThan(front);
  expect(await zOf(page, `${floor} [data-deco="desk-lamp"]`)).toBeGreaterThan(front);
  await expect(page.locator(`${floor} [data-deco="motivational-poster"]`)).toHaveAttribute(
    'data-layer',
    'back',
  );
});

test('front/back is one plain control, persists, and undoes', async ({ page }) => {
  await boot(page, 1280, 720, save(FURNISHED));
  const floor = `.floor[data-room="${ROOM}"]`;
  const poster = page.locator(`${floor} [data-deco="motivational-poster"]`);
  const characterFront = SCENE_DEPTH.character.max;

  await arrangeToggle(page).click();
  await poster.locator('.decor').click();
  await expect(poster).toHaveClass(/is-selected/);
  const toggle = page.locator(`${floor} .deco-layer-btn`);
  await expect(toggle).toHaveText(/Put in front/);
  await toggle.click();
  await expect(poster).toHaveAttribute('data-layer', 'front');
  expect(await zOf(page, `${floor} [data-deco="motivational-poster"]`)).toBeGreaterThan(
    characterFront,
  );
  await expect(toggle).toHaveText(/Put behind/);

  // Undo puts it back behind the team; redo brings it forward again.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(poster).toHaveAttribute('data-layer', 'back');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(poster).toHaveAttribute('data-layer', 'front');

  // Kept across a restart.
  await page.reload();
  await page.locator(floor).waitFor();
  await expect(poster).toHaveAttribute('data-layer', 'front');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('wmno.save.v1')!).decorationInstances.find(
          (i: { decorationId: string }) => i.decorationId === 'motivational-poster',
        ).layer,
    ),
  ).toBe('front');

  await arrangeToggle(page).click();
  // Rugs and ceiling pieces never offer the control: their side never changes.
  await page.locator(`${floor} [data-deco="tiny-rug"] .decor`).click();
  await expect(page.locator(`${floor} [data-deco="tiny-rug"]`)).toHaveClass(/is-selected/);
  await expect(page.locator(`${floor} .deco-layer-btn`)).toHaveCount(0);
});

for (const [width, height] of [
  [380, 460],
  [1280, 720],
] as const) {
  test(`a picked-up piece is the same size in the paw as in the room at ${width}x${height}`, async ({
    page,
  }) => {
    await boot(page, width, height, save(FURNISHED));
    await arrangeToggle(page).click();
    const fern = page.locator(`.floor[data-room="${ROOM}"] [data-deco="potted-fern"]`);
    await fern.scrollIntoViewIfNeeded();
    const placed = (await fern.locator('.decor svg').boundingBox())!;

    // One clean selection treatment: no frame, no grips.
    await fern.locator('.decor').click();
    await expect(fern).toHaveClass(/is-selected/);
    const chrome = await fern.evaluate((el) => ({
      before: getComputedStyle(el, '::before').content,
      after: getComputedStyle(el, '::after').content,
      outline: getComputedStyle(el.querySelector('.decor')!).outlineStyle,
    }));
    expect(chrome.before).toBe('none');
    expect(chrome.after).toBe('none');
    expect(chrome.outline).toBe('none');

    const x = placed.x + placed.width / 2;
    const y = placed.y + placed.height * 0.75;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 24, y - 3, { steps: 5 });
    const ghost = page.locator('.drag-ghost .decor svg');
    await expect(ghost).toBeVisible();
    const inHand = (await ghost.boundingBox())!;
    expect(Math.abs(inHand.width - placed.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(inHand.height - placed.height)).toBeLessThanOrEqual(1);
    // The piece left its spot: it is in the paw now.
    expect(await fern.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
  });
}

test('pieces stacked on the same spot can each be picked by clicking again', async ({ page }) => {
  await boot(
    page,
    1280,
    720,
    save([
      ['potted-fern', 'floor', 0.3, 0.08],
      ['desk-lamp', 'floor', 0.3, 0.08],
    ]),
  );
  await arrangeToggle(page).click();
  const floor = `.floor[data-room="${ROOM}"]`;
  const point = await page.evaluate((selector) => {
    const boxes = ['potted-fern', 'desk-lamp'].map((id) =>
      document.querySelector(`${selector} [data-deco="${id}"] .decor`)!.getBoundingClientRect(),
    );
    const left = Math.max(...boxes.map((b) => b.left));
    const right = Math.min(...boxes.map((b) => b.right));
    const top = Math.max(...boxes.map((b) => b.top));
    const bottom = Math.min(...boxes.map((b) => b.bottom));
    return { x: (left + right) / 2, y: top + (bottom - top) * 0.6 };
  }, floor);

  const picked = () =>
    page.evaluate(
      (selector) =>
        document.querySelector<HTMLElement>(`${selector} .floor__deco.is-selected`)?.dataset.deco ??
        null,
      floor,
    );
  await page.mouse.click(point.x, point.y);
  const first = await picked();
  expect(first).not.toBeNull();
  await page.mouse.click(point.x, point.y);
  const second = await picked();
  expect(second).not.toBeNull();
  expect(second).not.toBe(first);
  await page.mouse.click(point.x, point.y);
  expect(await picked()).toBe(first);
});

test('a save from before front/back loads with every piece on its natural side', async ({
  page,
}) => {
  const old = save(FURNISHED);
  // Old saves stored depths on the previous all-in-front scale, and no layer.
  for (const instance of old.decorationInstances) instance.depth = 186;
  await boot(page, 1280, 720, old);
  const floor = `.floor[data-room="${ROOM}"]`;
  await expect(page.locator(`${floor} [data-deco="motivational-poster"]`)).toHaveAttribute(
    'data-layer',
    'back',
  );
  await expect(page.locator(`${floor} [data-deco="potted-fern"]`)).toHaveAttribute(
    'data-layer',
    'front',
  );
  expect(await zOf(page, `${floor} [data-deco="motivational-poster"]`)).toBeLessThan(
    SCENE_DEPTH.character.min,
  );
});

test('a picked piece moves to wherever you tap, in a corner window', async ({ page }) => {
  await boot(page, 380, 460, save(FURNISHED));
  await arrangeToggle(page).click();
  const floor = `.floor[data-room="${ROOM}"]`;
  const savedX = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('wmno.save.v1')!).decorationInstances.find(
          (i: { decorationId: string }) => i.decorationId === 'potted-fern',
        ).normalizedX as number,
    );
  const before = await savedX();
  await page.locator(`${floor} [data-deco="potted-fern"] .decor`).click();
  await expect(page.locator(`${floor} [data-deco="potted-fern"]`)).toHaveClass(/is-selected/);
  const stage = (await page.locator(`${floor} .floor__stage`).boundingBox())!;
  // The whole room being decorated is on screen above the storage strip.
  const tray = (await page.locator('.deco-tray').boundingBox())!;
  expect(stage.y + stage.height).toBeLessThanOrEqual(tray.y + 1);
  await page.mouse.click(stage.x + stage.width * 0.8, stage.y + stage.height * 0.9);
  await expect.poll(savedX).toBeGreaterThan(before + 0.3);
  await expect(page.locator(`${floor} [data-deco="potted-fern"]`)).toHaveClass(/is-selected/);
});
