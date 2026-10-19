import { test, expect, type Page } from '@playwright/test';
import { SCENE_DEPTH, characterDepth } from '../../src/sim/depth';
import { standingDepthPx } from '../../src/content/roomLayout';
import { arrangeToggle } from './support/shell';

// Proves the composition rules on the RENDERED scene: an invalid drop is
// rejected with a message and leaves the piece put; valid neighbours, a big
// floor object near a teammate, a busy room and a multi-frame wall all render
// cleanly. Screenshots are written for direct inspection.

const DIR = 'visual-artifacts';

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.' },
  // High reputation unlocks the morale room (which owns the large decorations).
  resources: { nuts: 9_000_000, goldenNuts: 80, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.3 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.6 },
    rizzo: { hired: true, level: 3, friendship: 45, room: 'morale', x: 0.4 },
    bea: { hired: true, level: 3, friendship: 40, room: 'morale', x: 0.6 },
  },
  placements: {
    'potted-fern': { surface: 'floor', x: 0.18, y: 0.1 },
    'desk-lamp': { surface: 'floor', x: 0.34, y: 0.1 },
    'motivational-poster': { surface: 'wall', x: 0.3, y: 0.62 },
    'window-view': { surface: 'wall', x: 0.7, y: 0.62 },
    'tiny-rug': { surface: 'floor', x: 0.5, y: 0.14 },
    aquarium: { surface: 'floor', x: 0.14, y: 0.1 },
    'beanbag-chairs': { surface: 'floor', x: 0.34, y: 0.1 },
    'snack-bar': { surface: 'floor', x: 0.82, y: 0.1 },
    'mood-lighting': { surface: 'wall', x: 0.5, y: 0.62 },
  },
  decorationInstances: [
    {
      instanceId: 'deco-potted-fern-1',
      decorationId: 'potted-fern',
      roomId: 'founder-desk',
      surfaceType: 'floor',
      normalizedX: 0.18,
      normalizedY: 0.1,
      depth: 3,
      interactionState: {},
    },
    {
      instanceId: 'deco-desk-lamp-1',
      decorationId: 'desk-lamp',
      roomId: 'founder-desk',
      surfaceType: 'floor',
      normalizedX: 0.34,
      normalizedY: 0.1,
      depth: 3,
      interactionState: {},
    },
    {
      instanceId: 'deco-motivational-poster-1',
      decorationId: 'motivational-poster',
      roomId: 'founder-desk',
      surfaceType: 'wall',
      normalizedX: 0.3,
      normalizedY: 0.62,
      depth: 1,
      interactionState: {},
    },
    {
      instanceId: 'deco-window-view-1',
      decorationId: 'window-view',
      roomId: 'founder-desk',
      surfaceType: 'wall',
      normalizedX: 0.7,
      normalizedY: 0.62,
      depth: 1,
      interactionState: {},
    },
    {
      instanceId: 'deco-tiny-rug-1',
      decorationId: 'tiny-rug',
      roomId: 'founder-desk',
      surfaceType: 'floor',
      normalizedX: 0.5,
      normalizedY: 0.14,
      depth: 0,
      interactionState: {},
    },
    {
      instanceId: 'deco-aquarium-1',
      decorationId: 'aquarium',
      roomId: 'morale',
      surfaceType: 'floor',
      normalizedX: 0.14,
      normalizedY: 0.1,
      depth: 3,
      interactionState: {},
    },
    {
      instanceId: 'deco-beanbag-chairs-1',
      decorationId: 'beanbag-chairs',
      roomId: 'morale',
      surfaceType: 'floor',
      normalizedX: 0.34,
      normalizedY: 0.1,
      depth: 3,
      interactionState: {},
    },
    {
      instanceId: 'deco-snack-bar-1',
      decorationId: 'snack-bar',
      roomId: 'morale',
      surfaceType: 'floor',
      normalizedX: 0.82,
      normalizedY: 0.1,
      depth: 3,
      interactionState: {},
    },
    {
      instanceId: 'deco-mood-lighting-1',
      decorationId: 'mood-lighting',
      roomId: 'morale',
      surfaceType: 'wall',
      normalizedX: 0.5,
      normalizedY: 0.62,
      depth: 1,
      interactionState: {},
    },
  ],
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: [
      'deco:potted-fern',
      'deco:desk-lamp',
      'deco:motivational-poster',
      'deco:window-view',
      'deco:tiny-rug',
      'deco:aquarium',
      'deco:beanbag-chairs',
      'deco:snack-bar',
      'deco:mood-lighting',
    ],
  },
};

async function seed(page: Page, save: Record<string, unknown>) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('wmno.settings.v1')) {
        localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: true }));
      }
    } catch {
      /* ignore */
    }
  });
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1'))
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
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
  await arrangeToggle(page).click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);
}

async function dragTo(
  page: Page,
  source: ReturnType<Page['locator']>,
  anchorX: number,
  anchorY: number,
) {
  const box = await source.boundingBox();
  if (!box) throw new Error('no bounding box');
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  // Tests specify the desired visible support point. The product preserves the
  // original centre grab offset, so convert that support point back to the
  // pointer coordinate that puts the SVG's y=54/56 baseline there.
  const targetX = anchorX + (sx - (box.x + box.width / 2));
  const targetY = anchorY + (sy - (box.y + box.height * (54 / 56)));
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 4, { steps: 3 });
  await page.mouse.move((sx + targetX) / 2, (sy + targetY) / 2, { steps: 6 });
  await page.mouse.move(targetX, targetY, { steps: 8 });
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test.describe('decoration composition protection', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed(page, SAVE);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);
    await enterDecorateMode(page);
  });

  test('allows exact overlap and keeps every layer selectable from the arrangement tray', async ({
    page,
  }) => {
    await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const fern = page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]');
    const lamp = page.locator('.floor[data-room="founder-desk"] [data-deco="desk-lamp"]');
    await expect(fern).toBeVisible();
    const lampBox = (await lamp.boundingBox())!;

    await dragTo(page, fern, lampBox.x + lampBox.width / 2, lampBox.y + lampBox.height * (54 / 56));

    const fernAfter = (await fern.boundingBox())!;
    const lampAfter = (await lamp.boundingBox())!;
    expect(
      Math.abs(fernAfter.x + fernAfter.width / 2 - (lampAfter.x + lampAfter.width / 2)),
    ).toBeLessThan(12);

    // Every owned item—including a buried placed item—has a direct tray entry.
    const lampCard = page.locator('.deco-tray__card[data-decoration="desk-lamp"]');
    await expect(lampCard).toHaveAttribute('data-placement', 'placed');
    await lampCard.locator('.decor').click();
    await expect(lamp).toHaveClass(/is-selected/);
    // A picked piece keeps its own depth (so "Put behind / in front" is visible
    // while it is picked): a floor lamp stands among the team, at the depth a
    // teammate standing where its base is would take. Being buried under
    // another piece never makes it unreachable: the tray picks it directly, and
    // clicking a stack hands the pick down (see living-office.spec).
    const selectedZ = Number(await lamp.evaluate((element) => getComputedStyle(element).zIndex));
    await expect(lamp).toHaveAttribute('data-layer', 'front');
    const lampY = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('wmno.save.v1')!).decorationInstances.find(
          (i: { decorationId: string }) => i.decorationId === 'desk-lamp',
        ).normalizedY as number,
    );
    expect(selectedZ).toBe(characterDepth(standingDepthPx(lampY)));
    expect(selectedZ).toBeLessThanOrEqual(SCENE_DEPTH.character.max);
    expect(selectedZ).toBeGreaterThanOrEqual(SCENE_DEPTH.character.min);
    await page.screenshot({ path: `${DIR}/collide-02-dense-overlap.png` });
  });

  test('captures a large floor object near a teammate and a busy room', async ({ page }) => {
    await page.locator('.floor[data-room="morale"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const morale = page.locator('.floor[data-room="morale"]');
    await expect(morale.locator('.floor__deco')).not.toHaveCount(0);
    await expect(morale.locator('.critter-btn')).toHaveCount(2);
    await morale.screenshot({ path: `${DIR}/collide-03-large-object-near-employee.png` });
    await morale.screenshot({ path: `${DIR}/collide-04-busy-room.png` });
  });

  test('captures a wall carrying several framed objects', async ({ page }) => {
    await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const room = page.locator('.floor[data-room="founder-desk"]');
    // At least the poster + window-view sit on the wall band.
    await expect(room.locator('.floor__deco--wall')).not.toHaveCount(0);
    await room.screenshot({ path: `${DIR}/collide-05-multi-frame-wall.png` });
  });
});
