import { test, expect, type Locator, type Page } from '@playwright/test';

// Placement-feel proof for the semantic floor/rug path: live full-size ghost,
// authored region and footprint guides, collision feedback, transaction-safe
// cancellation, rug anchoring/depth, and persistence through resize + reload.

const DIR = 'visual-artifacts';
const SAVE_KEY = 'wmno.save.v1';
const STANDING_BASELINE_RATIO = 54 / 56;
const RUG_CENTER_RATIO = 46 / 56;

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 9_000_000, goldenNuts: 80, reputation: 400, morale: 82, permanentKernels: 3 },
  employees: { pip: { hired: true, level: 5, friendship: 60, room: 'morale', x: 0.5 } },
  placements: {
    'potted-fern': { surface: 'floor', x: 0.2, y: 0.1 },
    'desk-lamp': { surface: 'floor', x: 0.36, y: 0.1 },
    'motivational-poster': { surface: 'wall', x: 0.3, y: 0.62 },
    'window-view': { surface: 'wall', x: 0.72, y: 0.62 },
    'tiny-rug': { surface: 'floor', x: 0.5, y: 0.14 },
  },
  decorationInstances: [
    { instanceId: 'deco-potted-fern-1', decorationId: 'potted-fern', roomId: 'founder-desk', surfaceType: 'floor', normalizedX: 0.2, normalizedY: 0.1, depth: 3, interactionState: {} },
    { instanceId: 'deco-desk-lamp-1', decorationId: 'desk-lamp', roomId: 'founder-desk', surfaceType: 'floor', normalizedX: 0.36, normalizedY: 0.1, depth: 3, interactionState: {} },
    { instanceId: 'deco-motivational-poster-1', decorationId: 'motivational-poster', roomId: 'founder-desk', surfaceType: 'wall', normalizedX: 0.3, normalizedY: 0.62, depth: 1, interactionState: {} },
    { instanceId: 'deco-window-view-1', decorationId: 'window-view', roomId: 'founder-desk', surfaceType: 'wall', normalizedX: 0.72, normalizedY: 0.62, depth: 1, interactionState: {} },
    { instanceId: 'deco-tiny-rug-1', decorationId: 'tiny-rug', roomId: 'founder-desk', surfaceType: 'floor', normalizedX: 0.5, normalizedY: 0.14, depth: 0, interactionState: {} },
  ],
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:motivational-poster', 'deco:window-view', 'deco:tiny-rug'],
  },
};

async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('wmno.settings.v1')) {
        localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: false }));
      }
    } catch {
      /* ignore */
    }
  });
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, SAVE);
}

async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
}

async function enterDecorateMode(page: Page) {
  await page.locator('.office__toolbar button').first().click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
}

async function savedInstance(page: Page, decorationId: string) {
  return page.evaluate(
    ({ key, id }) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        decorationInstances?: Array<Record<string, unknown> & { decorationId?: string }>;
      };
      return parsed.decorationInstances?.find((instance) => instance.decorationId === id) ?? null;
    },
    { key: SAVE_KEY, id: decorationId },
  );
}

interface ActiveDrag {
  sourceBox: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;
  startX: number;
  startY: number;
  grabOffsetX: number;
  grabOffsetY: number;
}

async function beginDragAtAnchor(
  page: Page,
  source: Locator,
  anchorX: number,
  anchorY: number,
  anchorRatio: number,
): Promise<ActiveDrag> {
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error('drag source has no bounding box');
  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const grabOffsetX = startX - (sourceBox.x + sourceBox.width / 2);
  const grabOffsetY = startY - (sourceBox.y + sourceBox.height * anchorRatio);
  const targetX = anchorX + grabOffsetX;
  const targetY = anchorY + grabOffsetY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY + 6, { steps: 3 });
  await page.mouse.move(targetX, targetY, { steps: 8 });
  await page.waitForTimeout(120);
  return { sourceBox, startX, startY, grabOffsetX, grabOffsetY };
}

async function moveDragAnchor(page: Page, drag: ActiveDrag, anchorX: number, anchorY: number) {
  await page.mouse.move(anchorX + drag.grabOffsetX, anchorY + drag.grabOffsetY, { steps: 8 });
  await page.waitForTimeout(100);
}

async function prepare(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await enterDecorateMode(page);
}

test('floor preview is continuous, collision-aware, and Escape rolls back exactly', async ({ page }) => {
  await prepare(page);

  const room = page.locator('.floor[data-room="founder-desk"]');
  const fern = room.locator('[data-deco="potted-fern"]');
  const lamp = room.locator('[data-deco="desk-lamp"]');
  const stage = room.locator('.floor__stage');
  const stageBox = (await stage.boundingBox())!;
  const originalStyle = await fern.getAttribute('style');
  const originalInstance = await savedInstance(page, 'potted-fern');

  const drag = await beginDragAtAnchor(
    page,
    fern,
    stageBox.x + stageBox.width * 0.7,
    stageBox.y + stageBox.height * 0.88,
    STANDING_BASELINE_RATIO,
  );

  const validGhost = page.locator('.drag-ghost[data-region-kind="floor"][data-valid="true"]');
  const validGuide = room.locator('.floor__region-guide[data-region-kind="floor"].is-valid');
  await expect(validGhost).toBeVisible();
  await expect(validGhost.locator('.drag-ghost__surface')).toHaveText(/Floor/i);
  await expect(validGuide).toBeVisible();
  await expect(validGuide.locator('.floor__region-plane')).toBeVisible();
  const validFootprint = validGuide.locator('.floor__region-footprint');
  await expect(validFootprint).toBeVisible();
  const ghostArtBox = (await validGhost.locator('.decor svg').boundingBox())!;
  const footprintBox = (await validFootprint.boundingBox())!;
  const renderedBaseline = ghostArtBox.y + ghostArtBox.height * STANDING_BASELINE_RATIO;
  const footprintCenterY = footprintBox.y + footprintBox.height / 2;
  expect(Math.abs(renderedBaseline - footprintCenterY)).toBeLessThan(2);
  await expect(page.locator('.office--dragging')).toHaveCount(1);
  expect(await fern.getAttribute('style')).toBe(originalStyle);
  expect(await savedInstance(page, 'potted-fern')).toEqual(originalInstance);
  await page.screenshot({ path: `${DIR}/polish-01-dragging-ghost-guide.png` });

  const lampBox = (await lamp.boundingBox())!;
  await moveDragAnchor(
    page,
    drag,
    lampBox.x + lampBox.width / 2,
    lampBox.y + lampBox.height * STANDING_BASELINE_RATIO,
  );
  await expect(page.locator('.drag-ghost[data-region-kind="floor"][data-valid="false"]')).toBeVisible();
  await expect(room.locator('.floor__region-guide[data-region-kind="floor"].is-invalid')).toBeVisible();
  expect(await fern.getAttribute('style')).toBe(originalStyle);
  expect(await savedInstance(page, 'potted-fern')).toEqual(originalInstance);
  await page.screenshot({ path: `${DIR}/polish-02-invalid-collision-preview.png` });

  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(page.locator('.office--dragging')).toHaveCount(0);
  expect(await fern.getAttribute('style')).toBe(originalStyle);
  expect(await savedInstance(page, 'potted-fern')).toEqual(originalInstance);
});

test('pointercancel removes provisional floor state without saving', async ({ page }) => {
  await prepare(page);
  const room = page.locator('.floor[data-room="founder-desk"]');
  const fern = room.locator('[data-deco="potted-fern"]');
  const stageBox = (await room.locator('.floor__stage').boundingBox())!;
  const originalStyle = await fern.getAttribute('style');
  const originalInstance = await savedInstance(page, 'potted-fern');

  await beginDragAtAnchor(
    page,
    fern,
    stageBox.x + stageBox.width * 0.68,
    stageBox.y + stageBox.height * 0.88,
    STANDING_BASELINE_RATIO,
  );
  await expect(page.locator('.drag-ghost[data-valid="true"]')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
  });
  await page.mouse.up();

  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  expect(await fern.getAttribute('style')).toBe(originalStyle);
  expect(await savedInstance(page, 'potted-fern')).toEqual(originalInstance);
});

test('rug uses its full footprint, stays at depth zero, and persists after resize/reload', async ({ page }) => {
  await prepare(page);
  const room = page.locator('.floor[data-room="founder-desk"]');
  const rug = room.locator('[data-deco="tiny-rug"]');
  const stageBox = (await room.locator('.floor__stage').boundingBox())!;
  const before = await savedInstance(page, 'tiny-rug');

  await beginDragAtAnchor(
    page,
    rug,
    stageBox.x + stageBox.width * 0.58,
    stageBox.y + stageBox.height * 0.92,
    RUG_CENTER_RATIO,
  );

  const ghost = page.locator('.drag-ghost[data-region-kind="floor"][data-valid="true"]');
  const guide = room.locator('.floor__region-guide[data-region-kind="floor"].is-valid');
  const footprint = guide.locator('.floor__region-footprint');
  await expect(ghost).toBeVisible();
  await expect(ghost.locator('.drag-ghost__surface')).toHaveText(/Floor/i);
  await expect(guide).toBeVisible();
  await expect(footprint).toHaveAttribute('rx', '21');
  await expect(footprint).toHaveAttribute('ry', '3');
  const rugArtBox = (await ghost.locator('.decor svg').boundingBox())!;
  const rugFootprintBox = (await footprint.boundingBox())!;
  const renderedRugCenter = rugArtBox.y + rugArtBox.height * RUG_CENTER_RATIO;
  const rugFootprintCenter = rugFootprintBox.y + rugFootprintBox.height / 2;
  expect(Math.abs(renderedRugCenter - rugFootprintCenter)).toBeLessThan(2);
  expect(await savedInstance(page, 'tiny-rug')).toEqual(before);
  await page.screenshot({ path: `${DIR}/polish-03-rug-footprint.png` });

  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  const moved = await savedInstance(page, 'tiny-rug');
  expect(moved).not.toEqual(before);
  expect(moved).toMatchObject({ roomId: 'founder-desk', depth: 0 });
  await expect(rug).toHaveAttribute('data-region-kind', 'floor');
  const movedStyle = await rug.getAttribute('style');

  await page.setViewportSize({ width: 520, height: 520 });
  await room.scrollIntoViewIfNeeded();
  await expect(rug).toHaveAttribute('style', movedStyle ?? '');

  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await enterDecorateMode(page);
  const reloadedRug = page.locator('.floor[data-room="founder-desk"] [data-deco="tiny-rug"]');
  await expect(reloadedRug).toHaveAttribute('data-region-kind', 'floor');
  await expect(reloadedRug).toHaveAttribute('style', movedStyle ?? '');
  expect(await savedInstance(page, 'tiny-rug')).toEqual(moved);
});
