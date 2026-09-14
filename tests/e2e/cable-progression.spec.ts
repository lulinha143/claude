import { test, expect, type Page } from '@playwright/test';
import { cableLevelSlots, cableLevelEdges } from '../../src/sim/minigames';
import { cableScratchRows, cableScratchPoint } from './support/cable-scratch';

// Regression cover for the highest-priority bug: after clearing a Cable
// Untangle desk the next round must ALWAYS load. These tests complete many
// consecutive rounds and hammer the pause/visibility path during the
// transition, which is exactly where the game used to get permanently stuck.

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: {
    nuts: 5_000_000,
    goldenNuts: 40,
    reputation: 4_000,
    morale: 82,
    permanentKernels: 3,
  },
  achievements: {
    'nuts-and-bolts': 1,
    'shell-company': 1,
    'touch-grass': 1,
    reputable: 1,
    minigamer: 1,
  },
  employees: { pip: { hired: true, level: 6, room: 'founder-desk', x: 0.4 } },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  decorationInstances: [],
  settings: { reducedMotion: false, language: 'en' },
};

async function boot(page: Page, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript((save) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    localStorage.setItem('wmno.lang', 'en');
  }, SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  for (let index = 0; index < 4; index += 1) {
    const dismiss = page.locator('.popup__actions button, .modal button').first();
    if (await dismiss.count()) await dismiss.click({ timeout: 1_000 }).catch(() => {});
    await page.waitForTimeout(100);
  }
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.locator('.microgame-menu')).toBeVisible();
}

async function startCable(page: Page) {
  await page.getByRole('button', { name: /Cable Untangle Desk/i }).click();
  const game = page.locator('.microgame');
  await expect(game).toHaveAttribute('data-phase', 'intro');
  await page.locator('.microgame__start').click();
  await expect(game).toHaveAttribute('data-phase', 'play', { timeout: 5_000 });
  await expect(page.locator('.cable__board')).toBeVisible();
  return game;
}

/**
 * Drag every plug onto its authored solution slot so the desk reads as clear.
 * Uses two passes — first scatter every plug onto a safe scratch row well away
 * from all slots, then place each into its solution slot — so plugs never stack
 * on top of one another and each pick-up unambiguously grabs the intended plug.
 */
async function solveCurrentBoard(page: Page) {
  const board = page.locator('.cable__board');
  await expect(board).toHaveAttribute('data-stage', 'solving');
  const levelId = await board.getAttribute('data-level');
  expect(levelId).toBeTruthy();
  const slots = cableLevelSlots(levelId!);
  const n = slots.length;
  expect(n).toBeGreaterThan(0);

  const boardBox = await board.boundingBox();
  expect(boardBox).not.toBeNull();

  // The layout exposes its deterministic horizontal transform so tests can
  // place nodes against the canonical profile slots without inferring from a
  // randomly tangled node position.
  const mirrored = (await board.getAttribute('data-mirrored')) === 'true';

  const toPixels = (x: number, y: number) => ({
    x: boardBox!.x + (mirrored ? 1 - x : x) * boardBox!.width,
    y: boardBox!.y + y * boardBox!.height,
  });

  const dragTo = async (id: number, x: number, y: number) => {
    const plug = page.locator(`.cable__node[data-node-id="${id}"]`);
    const box = await plug.boundingBox();
    if (!box) return;
    const dest = toPixels(x, y);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(dest.x, dest.y, { steps: 3 });
    await page.mouse.up();
  };

  // Scatter every plug onto two scratch rows first, so each pick-up unambiguously
  // grabs its own plug, then place each onto its solution slot.
  //
  // The rows are DERIVED from this board rather than fixed. They used to be hardcoded
  // at y 0.42/0.58 on the reasoning that "the convex ellipse layouts occupy only the
  // board perimeter, so the centre is always free of solution slots". That stopped
  // being true once desks could be wired as a wheel (hub slot dead centre) or as two
  // loops (two inset ellipses reaching into the middle band): a scratch row sitting on
  // top of a solution slot means a placed plug can cover the next plug we try to pick
  // up, which fails intermittently rather than outright. So pick the two rows with the
  // most clearance from every solution slot, keeping them far enough apart that the
  // two groups cannot touch either.
  const rows = cableScratchRows(slots);
  const scratchPoint = (id: number) => cableScratchPoint(id, n, rows);
  for (let id = 0; id < n; id += 1) {
    const scratch = scratchPoint(id);
    await dragTo(id, scratch.x, scratch.y);
  }

  // Place each plug onto its solution slot. Under heavy parallel CPU load a
  // pointer move can be coalesced and a plug may miss its slot, so re-seat any
  // remaining plugs until the desk reads clear (bounded retries).
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (let id = 0; id < n; id += 1) await dragTo(id, slots[id].x, slots[id].y);
    if ((await board.getAttribute('data-stage')) === 'cleared') return;
    const crossings = (await page.locator('.cable__crossings').textContent()) ?? '';
    if (/\b0\b/.test(crossings)) return;
  }
}

async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: next });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

// These tests physically drag many plugs; a single retry absorbs rare
// pointer-timing hiccups under heavy parallel CPU load without masking a real
// progression stall (which would fail every attempt).
test.describe.configure({ retries: 1 });

test.describe.serial('cable untangle keeps loading round after round', () => {
  test('clears at least six consecutive desks without repeating the recent profile', async ({
    page,
  }) => {
    await boot(page);
    await startCable(page);
    const board = page.locator('.cable__board');
    const seenLevels: string[] = [];

    for (let round = 0; round < 6; round += 1) {
      const startRound = Number(await board.getAttribute('data-round'));
      const levelId = await board.getAttribute('data-level');
      expect(levelId).toBeTruthy();
      expect(seenLevels.slice(-3)).not.toContain(levelId);
      seenLevels.push(levelId!);
      if ((await board.getAttribute('data-nodes')) === '9') {
        await page.screenshot({ path: 'visual-artifacts/minigame-cable-nine-1280x800.png' });
      }

      await solveCurrentBoard(page);
      await expect(board).toHaveAttribute('data-stage', 'cleared', { timeout: 10_000 });
      await expect(page.locator('.cable__cleared')).toBeVisible();

      // The very next desk MUST arrive: round counter advances, stage returns
      // to solving, and a fresh (tangled) board is presented.
      await expect(board).toHaveAttribute('data-round', String(startRound + 1), {
        timeout: 10_000,
      });
      await expect(board).toHaveAttribute('data-stage', 'solving', { timeout: 10_000 });
      await expect(page.locator('.cable__crossings')).not.toContainText('0');
    }
  });

  test('keeps a nine-plug hard desk playable inside a compact viewport', async ({ page }) => {
    await boot(page);
    await startCable(page);
    const board = page.locator('.cable__board');

    for (let round = 0; round < 4; round += 1) {
      await solveCurrentBoard(page);
      await expect(board).toHaveAttribute('data-round', String(round + 1), {
        timeout: 10_000,
      });
      await expect(board).toHaveAttribute('data-stage', 'solving', { timeout: 10_000 });
    }

    await page.setViewportSize({ width: 390, height: 700 });
    await page.waitForTimeout(150);
    await expect(board).toHaveAttribute('data-nodes', '9');
    await expect(page.locator('.cable__node')).toHaveCount(9);
    // Nine plugs no longer implies nine cables: a wheel adds eight spokes and a
    // chorded ring adds shortcuts. Check the renderer against the desk's own
    // authored cabling instead of against the node count.
    const compactLevel = await board.getAttribute('data-level');
    expect(compactLevel).toBeTruthy();
    await expect(page.locator('.cable__strand-body')).toHaveCount(
      cableLevelEdges(compactLevel!).length,
    );
    const boardBox = await board.boundingBox();
    expect(boardBox).not.toBeNull();
    for (const node of await page.locator('.cable__node').all()) {
      const box = await node.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(boardBox!.x - 1);
      expect(box!.y).toBeGreaterThanOrEqual(boardBox!.y - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(boardBox!.x + boardBox!.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(boardBox!.y + boardBox!.height + 1);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-nine-390x700.png' });
  });

  test('advances even when the window blurs/focuses repeatedly mid-transition', async ({
    page,
  }) => {
    await boot(page);
    await startCable(page);
    const board = page.locator('.cable__board');

    const startRound = Number(await board.getAttribute('data-round'));
    await solveCurrentBoard(page);
    await expect(board).toHaveAttribute('data-stage', 'cleared', { timeout: 5_000 });

    // Storm the visibility state during the celebration — the old timer would
    // restart forever and never load the next desk.
    for (let i = 0; i < 6; i += 1) {
      await setVisibility(page, 'hidden');
      await page.waitForTimeout(120);
      await setVisibility(page, 'visible');
      await page.waitForTimeout(120);
    }

    await expect(board).toHaveAttribute('data-round', String(startRound + 1), { timeout: 10_000 });
    await expect(board).toHaveAttribute('data-stage', 'solving', { timeout: 10_000 });
  });
});
