import { test, expect, type Page } from '@playwright/test';

// End-to-end proof of the three placement surfaces in the RUNNING game: floor
// items can never land on the wall/ceiling, wall items stay on walls, ceiling
// items stay on ceilings, and the drag preview matches the committed placement
// (no float, no teleport). Screenshots go to a git-ignored folder.
const DIR = 'visual-artifacts/verify';

const SAVE = {
  version: 8,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.', icon: 'paw' },
  resources: { nuts: 9_000_000_000, goldenNuts: 400, reputation: 4000, morale: 90, permanentKernels: 5 },
  employees: { pip: { hired: true, level: 6, room: 'founder-desk', x: 0.85 } },
  placements: {
    'potted-fern': { surface: 'floor', x: 0.28, y: 0.12 },
    'motivational-poster': { surface: 'wall', x: 0.55, y: 0.6 },
    chandelier: { surface: 'ceiling', x: 0.5, y: 0.9 },
    'desk-lamp': { surface: 'floor', x: 0.5, y: 0.12 },
    'conveyor-plushie': { surface: 'floor', x: 0.72, y: 0.12 },
  },
  decorationInstances: [
    { instanceId: 'v-fern', decorationId: 'potted-fern', roomId: 'founder-desk', surfaceType: 'floor', regionKind: 'floor', normalizedX: 0.28, normalizedY: 0.12, depth: 3, interactionState: {} },
    { instanceId: 'v-poster', decorationId: 'motivational-poster', roomId: 'founder-desk', surfaceType: 'wall', regionKind: 'wall', normalizedX: 0.55, normalizedY: 0.6, depth: 1, interactionState: {} },
    { instanceId: 'v-chand', decorationId: 'chandelier', roomId: 'founder-desk', surfaceType: 'ceiling', regionKind: 'ceiling', normalizedX: 0.5, normalizedY: 0.9, depth: 6, interactionState: {} },
    { instanceId: 'v-lamp', decorationId: 'desk-lamp', roomId: 'founder-desk', surfaceType: 'floor', regionKind: 'floor', normalizedX: 0.5, normalizedY: 0.12, depth: 3, interactionState: {} },
    { instanceId: 'v-plush', decorationId: 'conveyor-plushie', roomId: 'founder-desk', surfaceType: 'floor', regionKind: 'floor', normalizedX: 0.72, normalizedY: 0.12, depth: 3, interactionState: {} },
  ],
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: ['deco:potted-fern', 'deco:motivational-poster', 'deco:chandelier', 'deco:desk-lamp', 'deco:conveyor-plushie'] },
  settings: { reducedMotion: true, language: 'en', background: { enabled: false } },
};

async function boot(page: Page, w = 1280, h = 900) {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript((s) => { localStorage.setItem('wmno.save.v1', JSON.stringify(s)); localStorage.setItem('wmno.lang', 'en'); }, SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 5; i++) { const b = page.locator('.popup__actions button, .modal button').first(); if (await b.count()) await b.click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(120); }
  await page.locator('.office__toolbar button').first().click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
}

const kindOf = (page: Page, deco: string) =>
  page.locator(`.floor[data-room="founder-desk"] [data-deco="${deco}"]`).getAttribute('data-region-kind');
const bottomPctOf = async (page: Page, deco: string) => {
  const style = (await page.locator(`.floor[data-room="founder-desk"] [data-deco="${deco}"]`).getAttribute('style')) ?? '';
  return parseFloat(/bottom:\s*([\d.]+)%/.exec(style)?.[1] ?? 'NaN');
};

// Drag a placed deco toward a normalized stage point (0..1, y from floor line up).
async function dragDecoToward(page: Page, deco: string, nx: number, ny: number) {
  const stage = page.locator('.floor[data-room="founder-desk"] .floor__stage');
  const el = page.locator(`.floor[data-room="founder-desk"] [data-deco="${deco}"]`);
  const box = (await el.boundingBox())!;
  const sb = (await stage.boundingBox())!;
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height * 0.9;
  const tx = sb.x + nx * sb.width;
  const ty = sb.y + (1 - ny) * sb.height;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy + 4, { steps: 3 });
  await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 8 });
  const ghost = page.locator('.drag-ghost');
  const ghostClass = (await ghost.count()) ? ((await ghost.getAttribute('class').catch(() => '')) ?? '') : '';
  await page.mouse.up();
  await page.waitForTimeout(150);
  return ghostClass;
}

test.describe('surface locks in the running game', () => {
  test('a FLOOR item can never be dragged onto the wall or ceiling', async ({ page }) => {
    await boot(page);
    await dragDecoToward(page, 'potted-fern', 0.7, 0.95); // aim at the ceiling
    expect(await kindOf(page, 'potted-fern')).toBe('floor');
    expect(await bottomPctOf(page, 'potted-fern')).toBeLessThan(40);
    await dragDecoToward(page, 'potted-fern', 0.7, 0.6); // aim at the wall
    expect(await kindOf(page, 'potted-fern')).toBe('floor');
    expect(await bottomPctOf(page, 'potted-fern')).toBeLessThan(40);
    // valid floor move works and stays floor
    await dragDecoToward(page, 'potted-fern', 0.6, 0.12);
    expect(await kindOf(page, 'potted-fern')).toBe('floor');
    await page.screenshot({ path: `${DIR}/floor-locked.png` });
  });

  test('a WALL item stays on the wall when dragged to the floor', async ({ page }) => {
    await boot(page);
    await dragDecoToward(page, 'motivational-poster', 0.4, 0.05); // aim at the floor
    expect(await kindOf(page, 'motivational-poster')).toBe('wall');
    const b = await bottomPctOf(page, 'motivational-poster');
    expect(b).toBeGreaterThan(40);
    expect(b).toBeLessThan(85);
    await page.screenshot({ path: `${DIR}/wall-locked.png` });
  });

  test('a CEILING item stays on the ceiling when dragged down', async ({ page }) => {
    await boot(page);
    await dragDecoToward(page, 'chandelier', 0.4, 0.1); // aim at the floor
    expect(await kindOf(page, 'chandelier')).toBe('ceiling');
    expect(await bottomPctOf(page, 'chandelier')).toBeGreaterThan(80);
    await page.screenshot({ path: `${DIR}/ceiling-locked.png` });
  });

  test('floor items never jump onto the ceiling', async ({ page }) => {
    await boot(page);
    // desk-lamp and conveyor-plushie are floor items — aiming at the ceiling
    // must never move them off the floor.
    await dragDecoToward(page, 'desk-lamp', 0.5, 0.95);
    expect(await kindOf(page, 'desk-lamp')).toBe('floor');
    expect(await bottomPctOf(page, 'desk-lamp')).toBeLessThan(40);
    await dragDecoToward(page, 'conveyor-plushie', 0.5, 0.95);
    expect(await kindOf(page, 'conveyor-plushie')).toBe('floor');
    await page.screenshot({ path: `${DIR}/floor-items-locked.png` });
  });

  test('preview position matches the final saved placement (no float/teleport)', async ({ page }) => {
    await boot(page);
    const stage = page.locator('.floor[data-room="founder-desk"] .floor__stage');
    const el = page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]');
    const box = (await el.boundingBox())!;
    const sb = (await stage.boundingBox())!;
    const tx = sb.x + 0.62 * sb.width;
    const ty = sb.y + (1 - 0.16) * sb.height;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9);
    await page.mouse.down();
    await page.mouse.move(tx - 40, ty - 20, { steps: 5 });
    await page.mouse.move(tx, ty, { steps: 6 });
    const ghost = page.locator('.drag-ghost');
    await expect(ghost).toHaveClass(/is-ok/);
    const gb = (await ghost.boundingBox())!;
    const ghostCentreX = gb.x + gb.width / 2;
    await page.mouse.up();
    await page.waitForTimeout(180);
    const placed = (await el.boundingBox())!;
    const placedCentreX = placed.x + placed.width / 2;
    expect(Math.abs(placedCentreX - ghostCentreX)).toBeLessThan(24);
    await page.screenshot({ path: `${DIR}/preview-matches.png` });
  });
});
