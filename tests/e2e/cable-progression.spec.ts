import { test, expect, type Page } from '@playwright/test';
import { cableLevelSlots } from '../../src/sim/minigames';

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

  // The seed may mirror the composition horizontally; detect it from node 0,
  // which always opens on slot 0 (left side when un-mirrored).
  const node0 = await page.locator('.cable__node[data-node-id="0"]').boundingBox();
  expect(node0).not.toBeNull();
  const mirrored = node0!.x + node0!.width / 2 > boardBox!.x + boardBox!.width / 2;

  const toPixels = (x: number, y: number) => ({
    x: boardBox!.x + (mirrored ? 1 - x : x) * boardBox!.width,
    y: boardBox!.y + y * boardBox!.height,
  });

  // Lean drag: the plug is released at the pointer-up coordinate, so a couple
  // of moves are enough. Kept fast so all rounds finish well within the shift
  // timer even under heavy parallel CPU load.
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

  // Scratch row sits at y=0.5 — every authored slot is >0.13 away vertically,
  // so no scratch plug can collide with a slot or another scratch plug.
  const scratchX = (id: number) => 0.14 + (0.72 * id) / Math.max(1, n - 1);
  for (let id = 0; id < n; id += 1) await dragTo(id, scratchX(id), 0.5);

  // Place each plug onto its solution slot. Under heavy parallel CPU load a
  // pointer move can be coalesced and a plug may miss its slot, so re-seat any
  // remaining plugs until the desk reads clear (bounded retries).
  for (let attempt = 0; attempt < 4; attempt += 1) {
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
  test('clears at least six consecutive desks without ever stalling', async ({ page }) => {
    await boot(page);
    await startCable(page);
    const board = page.locator('.cable__board');

    for (let round = 0; round < 6; round += 1) {
      const startRound = Number(await board.getAttribute('data-round'));
      await solveCurrentBoard(page);
      await expect(board).toHaveAttribute('data-stage', 'cleared', { timeout: 10_000 });
      await expect(page.locator('.cable__cleared')).toBeVisible();

      // The very next desk MUST arrive: round counter advances, stage returns
      // to solving, and a fresh (tangled) board is presented.
      await expect(board).toHaveAttribute('data-round', String(startRound + 1), { timeout: 10_000 });
      await expect(board).toHaveAttribute('data-stage', 'solving', { timeout: 10_000 });
      await expect(page.locator('.cable__crossings')).not.toContainText('0');
    }
  });

  test('advances even when the window blurs/focuses repeatedly mid-transition', async ({ page }) => {
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
