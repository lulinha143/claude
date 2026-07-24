import { test, expect, type Page } from '@playwright/test';

// Decoration surface-category + controlled free-placement E2E.
//
// This exercises the RENDERED drag-and-drop (not just the data model):
//   - a placed FLOOR decoration can be dragged to a new spot on the floor
//   - a placed WALL decoration can be dragged to a new spot on the wall
//   - an item can be dragged out of the inventory tray onto its room
//   - an invalid drop (wrong room) is rejected and leaves the piece untouched
//   - a moved decoration keeps its position across a reload (persistence)
//
// It also writes annotated PNGs to `visual-artifacts/` for direct inspection.

const DIR = 'visual-artifacts';

// Founder's Desk owns a spread of floor + wall decorations. `desk-lamp` is
// flagged stowed (decohide) so it starts in the inventory tray, letting us test
// the tray -> scene placement path; the rest auto-place at tidy defaults.
const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.' },
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.2 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.6 },
  },
  placements: {
    'potted-fern': { surface: 'floor', x: 0.2, y: 0.1 },
    'tiny-rug': { surface: 'floor', x: 0.5, y: 0.14 },
    'motivational-poster': { surface: 'wall', x: 0.32, y: 0.62 },
    'window-view': { surface: 'wall', x: 0.7, y: 0.62 },
  },
  decorationInstances: [
    { instanceId: 'deco-potted-fern-1', decorationId: 'potted-fern', roomId: 'founder-desk', surfaceType: 'floor', normalizedX: 0.2, normalizedY: 0.1, depth: 3, interactionState: {} },
    { instanceId: 'deco-tiny-rug-1', decorationId: 'tiny-rug', roomId: 'founder-desk', surfaceType: 'floor', normalizedX: 0.5, normalizedY: 0.14, depth: 0, interactionState: {} },
    { instanceId: 'deco-motivational-poster-1', decorationId: 'motivational-poster', roomId: 'founder-desk', surfaceType: 'wall', normalizedX: 0.32, normalizedY: 0.62, depth: 1, interactionState: {} },
    { instanceId: 'deco-window-view-1', decorationId: 'window-view', roomId: 'founder-desk', surfaceType: 'wall', normalizedX: 0.7, normalizedY: 0.62, depth: 1, interactionState: {} },
    { instanceId: 'deco-desk-lamp-1', decorationId: 'desk-lamp', roomId: null, surfaceType: 'floor', normalizedX: 0.5, normalizedY: 0.06, depth: 2, interactionState: {} },
  ],
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: [
      'deco:potted-fern', // floor
      'deco:tiny-rug', // floor (rug)
      'deco:motivational-poster', // wall
      'deco:window-view', // wall
      'deco:desk-lamp', // floor — kept in inventory
      'decohide:desk-lamp',
    ],
  },
};

async function seed(page: Page, save: Record<string, unknown>) {
  // Seed only when no save exists yet. addInitScript re-runs on every
  // navigation (including page.reload()); an unconditional write would clobber
  // the game's own saved progress and make the reload-persistence test meaningless.
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
  }, save);
}

async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
  await page.waitForTimeout(200);
}

async function enterDecorateMode(page: Page) {
  const toggle = page.locator('.office__toolbar button').first();
  await toggle.click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);
}

// Drag from a source element's centre to an absolute (x, y) in the viewport,
// dispatching enough pointer moves to cross the 7px drag threshold.
async function dragFromElementTo(
  page: Page,
  source: ReturnType<Page['locator']>,
  x: number,
  y: number,
  anchorRatio?: number,
) {
  const box = await source.boundingBox();
  if (!box) throw new Error('drag source has no bounding box');
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  const targetX = anchorRatio === undefined ? x : x + (sx - (box.x + box.width / 2));
  const targetY = anchorRatio === undefined ? y : y + (sy - (box.y + box.height * anchorRatio));
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // several small steps so hypot() exceeds DRAG_THRESHOLD and target updates
  await page.mouse.move(sx + 10, sy + 4, { steps: 3 });
  await page.mouse.move((sx + targetX) / 2, (sy + targetY) / 2, { steps: 6 });
  await page.mouse.move(targetX, targetY, { steps: 8 });
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

function styleNumbers(style: string) {
  const left = /left:\s*([\d.]+)%/.exec(style)?.[1];
  const bottom = /bottom:\s*([\d.]+)%/.exec(style)?.[1];
  return { left: left ? parseFloat(left) : NaN, bottom: bottom ? parseFloat(bottom) : NaN };
}

test.describe('decoration free-placement', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await seed(page, SAVE);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);
    await enterDecorateMode(page);
    // Bring the Founder's Desk (bottom room) into view above the tray.
    await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  });

  test('drag a placed FLOOR decoration to a new floor spot', async ({ page }) => {
    const stage = page.locator('.floor[data-room="founder-desk"] .floor__stage');
    const deco = page.locator('.floor[data-room="founder-desk"] .floor__deco--floor').first();
    await expect(deco).toBeVisible();
    const before = styleNumbers((await deco.getAttribute('style')) ?? '');

    await page.screenshot({ path: `${DIR}/deco-01-floor-before.png` });

    const box = (await stage.boundingBox())!;
    // Drop near the far side of the floor band (low in the stage = floor line).
    const targetX = box.x + box.width * 0.82;
    const targetY = box.y + box.height * 0.9;
    await dragFromElementTo(page, deco, targetX, targetY, 54 / 56);

    const after = styleNumbers((await deco.getAttribute('style')) ?? '');
    await page.screenshot({ path: `${DIR}/deco-02-floor-after.png` });

    // It moved horizontally and stayed a floor piece.
    expect(Math.abs(after.left - before.left)).toBeGreaterThan(8);
    await expect(deco).toHaveClass(/floor__deco--floor/);
  });

  test('drag a placed WALL decoration to a new wall spot', async ({ page }) => {
    const stage = page.locator('.floor[data-room="founder-desk"] .floor__stage');
    const deco = page.locator('.floor[data-room="founder-desk"] .floor__deco--wall').first();
    await expect(deco).toBeVisible();
    const before = styleNumbers((await deco.getAttribute('style')) ?? '');

    const box = (await stage.boundingBox())!;
    // Aim high in the stage (wall band), clear of the larger window frame.
    const targetX = box.x + box.width * 0.5;
    const targetY = box.y + box.height * 0.3;
    await dragFromElementTo(page, deco, targetX, targetY);

    const after = styleNumbers((await deco.getAttribute('style')) ?? '');
    await page.screenshot({ path: `${DIR}/deco-03-wall-after.png` });

    expect(Math.abs(after.left - before.left)).toBeGreaterThan(8);
    // Still on the wall band (roughly 44%..82% per SURFACE_BANDS).
    expect(after.bottom).toBeGreaterThan(40);
    expect(after.bottom).toBeLessThan(85);
    await expect(deco).toHaveClass(/floor__deco--wall/);
  });

  test('place a decoration from the inventory tray onto the floor', async ({ page }) => {
    const stage = page.locator('.floor[data-room="founder-desk"] .floor__stage');
    // desk-lamp starts stowed → it should be a card in the tray.
    const card = page.locator('.deco-tray__card .decor').first();
    await expect(card).toBeVisible();
    await page.screenshot({ path: `${DIR}/deco-04-tray.png` });

    const placedBefore = await page.locator('.floor[data-room="founder-desk"] .floor__deco').count();
    const box = (await stage.boundingBox())!;
    await dragFromElementTo(page, card, box.x + box.width * 0.5, box.y + box.height * 0.85);

    const placedAfter = await page.locator('.floor[data-room="founder-desk"] .floor__deco').count();
    await page.screenshot({ path: `${DIR}/deco-05-tray-placed.png` });
    expect(placedAfter).toBe(placedBefore + 1);
  });

  test('an invalid drop (outside the room) leaves the decoration in place', async ({ page }) => {
    const deco = page.locator('.floor[data-room="founder-desk"] .floor__deco--floor').first();
    const before = styleNumbers((await deco.getAttribute('style')) ?? '');
    // Drop on the toolbar at the very top — not over the owning room.
    await dragFromElementTo(page, deco, 200, 10, 54 / 56);
    const after = styleNumbers((await deco.getAttribute('style')) ?? '');
    // Unchanged (rejected drop): still on floor, same coordinates.
    expect(Math.abs(after.left - before.left)).toBeLessThan(1);
    expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(1);
    await expect(deco).toHaveClass(/floor__deco--floor/);
  });

  test('a moved decoration persists across reload', async ({ page }) => {
    const stage = page.locator('.floor[data-room="founder-desk"] .floor__stage');
    // Target a specific piece (potted-fern) so reload ordering can't confuse us.
    const deco = page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]');
    const before = styleNumbers((await deco.getAttribute('style')) ?? '');
    const box = (await stage.boundingBox())!;
    await dragFromElementTo(page, deco, box.x + box.width * 0.78, box.y + box.height * 0.9, 54 / 56);
    const moved = styleNumbers((await deco.getAttribute('style')) ?? '');
    // Sanity: the drag actually moved it before we test persistence.
    expect(Math.abs(moved.left - before.left)).toBeGreaterThan(8);

    // Reload; the game's own save (written on move) should restore the position.
    await page.reload();
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);
    await enterDecorateMode(page);
    await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();

    const reloaded = styleNumbers(
      (await page
        .locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]')
        .getAttribute('style')) ?? '',
    );
    expect(Math.abs(reloaded.left - moved.left)).toBeLessThan(2);
    expect(Math.abs(reloaded.bottom - moved.bottom)).toBeLessThan(2);
  });

  test('dragging highlights compatible rooms and moves the instance across floors', async ({ page }) => {
    const source = page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]');
    const destination = page.locator('.floor[data-room="morale"] .floor__stage');
    await expect(source).toBeVisible();
    await expect(destination).toBeVisible();
    const sourceBox = (await source.boundingBox())!;
    const destinationBox = (await destination.boundingBox())!;
    const sx = sourceBox.x + sourceBox.width / 2;
    const sy = sourceBox.y + sourceBox.height / 2;
    const desiredAnchorX = destinationBox.x + destinationBox.width * 0.75;
    const desiredAnchorY = destinationBox.y + destinationBox.height * 0.9;
    const tx = desiredAnchorX + (sx - (sourceBox.x + sourceBox.width / 2));
    const ty = desiredAnchorY + (sy - (sourceBox.y + sourceBox.height * (54 / 56)));

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 12, sy + 4, { steps: 3 });
    await expect(page.locator('.floor[data-room="morale"]')).toHaveClass(/is-deco-target/);
    await page.mouse.move(tx, ty, { steps: 10 });
    await expect(page.locator('.floor[data-room="morale"]')).toHaveClass(/is-deco-hover/);
    await page.mouse.up();

    await expect(page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]')).toHaveCount(0);
    await expect(page.locator('.floor[data-room="morale"] [data-deco="potted-fern"]')).toBeVisible();
  });

  test('Move To dialog supports keyboard dismissal and touch-friendly room choice', async ({ page }) => {
    const decoration = page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"] .decor');
    await decoration.click();
    const moveButton = page.getByRole('button', { name: 'Move To…' }).first();
    await moveButton.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: /Move Potted Fern/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(moveButton).toBeFocused();

    await moveButton.click();
    await page.getByRole('button', { name: /Move to Coffee & Morale Division/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.floor[data-room="morale"] [data-deco="potted-fern"]')).toBeVisible();
  });
});
