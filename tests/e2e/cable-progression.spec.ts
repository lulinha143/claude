import { test, expect, type Page } from '@playwright/test';
import { cableLevelSlots, cableLevelEdges } from '../../src/sim/minigames';
import { cableScratchRows, cableScratchPoint } from './support/cable-scratch';
import { watchCableClears, cableClears, cableTangleCount } from './support/cable-watch';
import { openView } from './support/shell';

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
  await openView(page, 'focus');
  await expect(page.locator('.microgame-menu')).toBeVisible();
}

async function startCable(page: Page, controlledClock = false) {
  await page.getByRole('button', { name: /Cable Untangle Desk/i }).click();
  const game = page.locator('.microgame');
  await expect(game).toHaveAttribute('data-phase', 'intro');
  await page.locator('.microgame__start').click();
  if (controlledClock) await page.clock.runFor(3100);
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
    await page.mouse.move(dest.x, dest.y);
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

  /* Stop the moment THIS desk is recorded as cleared, and check after every single drag.
     Two reasons, both of which used to break this helper under load.
     The scatter pass can solve the desk by itself — laying the plugs out in index order
     across two rows is frequently already untangled — and the seating pass can obviously
     finish early too. Because nothing is paused here (this suite needs the next desk to
     actually arrive), a cleared desk advances 1450ms later. Any drag issued after that
     point lands on the NEXT desk, dragging its plugs around before the test has even
     looked at it; the caller then finds a partly-disturbed board and a tangle count that
     belongs to a puzzle it never solved.
     `alreadyCleared` is the count of clears seen before this desk, so "cleared" means
     "one more than we started with" rather than "any clear has ever happened". */
  const alreadyCleared = (await cableClears(page)).length;
  const cleared = async () => (await cableClears(page)).length > alreadyCleared;

  for (let id = 0; id < n; id += 1) {
    const scratch = scratchPoint(id);
    await dragTo(id, scratch.x, scratch.y);
    if (await cleared()) return;
  }

  // One seating pass, with real pointer input. A failure must be visible rather
  // than retried eight times and blamed on pointer coalescing.
  for (let id = 0; id < n; id += 1) {
    await dragTo(id, slots[id].x, slots[id].y);
    if (await cleared()) return;
  }
  // The last drop is in; under parallel load React may not have committed it (and
  // the board announced its clear) yet. Give it a moment instead of reporting a
  // false "never cleared" — a desk that really stayed tangled still fails below.
  await expect
    .poll(cleared, { timeout: 5_000 })
    .toBe(true)
    .catch(() => {});
}

async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: next });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/* No retries, deliberately — see the same note in minigame-polish.spec.ts.
   These tests physically drag many plugs and used to take one retry for "rare
   pointer-timing hiccups under heavy parallel CPU load". That was a misdiagnosis. The
   real cause was the 1450ms auto-advance between desks: the solve helper kept dragging
   after a desk had cleared (so the next desk got disturbed), and the assertions polled a
   cleared state that had already ended. Both are fixed at the source, and one assertion
   here was simply wrong — `not.toContainText('0')` fails on "Tangles: 10". */

test.describe('cable untangle keeps loading round after round', () => {
  test('clears at least six consecutive desks without repeating the recent profile', async ({
    page,
  }) => {
    // Six desks of real pointer drags: a long sequence, budgeted like the other
    // multi-step journeys (30s was only ever enough on an idle machine).
    test.setTimeout(60_000);
    // Drive the countdown and celebrations explicitly. The six desks still use
    // real pointer drags; rendering/trace overhead cannot consume the round timer.
    const time = new Date();
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await boot(page);
    await startCable(page, true);
    await watchCableClears(page);
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
      /* That this desk cleared is asserted from the RECORDING, not from the live DOM.
         The cleared state only lasts 1450ms before the next desk loads, and this suite
         deliberately lets that advance happen — so by the time a `toHaveAttribute` poll
         runs, "solving" is the correct and expected answer. See support/cable-watch.ts. */
      await expect
        .poll(async () => (await cableClears(page)).length, {
          message: `desk ${levelId} (round ${startRound}) never reached a cleared state`,
          timeout: 5_000,
        })
        .toBe(round + 1);

      // The very next desk MUST arrive: round counter advances, stage returns
      // to solving, and a fresh (tangled) board is presented.
      await page.clock.runFor(1500);
      await expect(board).toHaveAttribute('data-round', String(startRound + 1), {
        timeout: 10_000,
      });
      await expect(board).toHaveAttribute('data-stage', 'solving', { timeout: 10_000 });
      // Compared as a NUMBER. `not.toContainText('0')` passed for years only because
      // small desks never showed a count with a zero digit in it; "Tangles: 10" on a
      // nine-plug desk contains "0" and failed a board that was correctly tangled.
      await expect.poll(() => cableTangleCount(page), { timeout: 10_000 }).toBeGreaterThan(0);
    }

    /* The whole sequence, checked once at the end: six distinct desks, each of which
       reported zero crossings and announced itself at the instant it cleared, with the
       round counter strictly increasing. */
    const clears = await cableClears(page);
    expect(clears).toHaveLength(6);
    for (const record of clears) {
      expect(record.crossings, `desk ${record.level} cleared without reporting zero`).toMatch(
        /\b0\b/,
      );
      expect(record.panel, `desk ${record.level} cleared without announcing it`).toContain(
        'All cables clear!',
      );
    }
    const rounds = clears.map((record) => record.round);
    expect(rounds, `rounds did not advance one per desk: ${rounds.join(',')}`).toEqual(
      [...rounds].sort((a, b) => a - b),
    );
    expect(new Set(rounds).size, 'two desks cleared on the same round counter').toBe(6);
  });

  test('keeps a nine-plug hard desk playable inside a compact viewport', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    await startCable(page);
    // Required by solveCurrentBoard: without the recorder it cannot tell when a desk has
    // cleared, so it would spend all eight seating attempts and keep dragging plugs onto
    // desks that had already advanced.
    await watchCableClears(page);
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
    await watchCableClears(page);
    const board = page.locator('.cable__board');

    const startRound = Number(await board.getAttribute('data-round'));
    await solveCurrentBoard(page);
    /* From the recording, not a live poll. The celebration is 1450ms long and this test
       must storm visibility DURING it, so it cannot afford to spend that window asking
       the DOM whether the window it is trying to catch is still open. solveCurrentBoard
       returns as soon as the clear is recorded, which is the start of the window. */
    expect((await cableClears(page)).length, 'the first desk never cleared').toBe(1);

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
