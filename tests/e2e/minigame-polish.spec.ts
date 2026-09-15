import { test, expect, type Page } from '@playwright/test';
import { cableLevelEdges, cableLevelSlots } from '../../src/sim/minigames';
import { cableScratchRows, cableScratchPoint } from './support/cable-scratch';

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

async function openGame(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  const game = page.locator('.microgame');
  await expect(game).toHaveAttribute('data-phase', 'intro');
  await expect(game.locator('.microgame-emblem')).toBeVisible();
  await page.waitForTimeout(750);
  return game;
}

async function startGame(page: Page) {
  await page.locator('.microgame__start').click();
  await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'countdown');
  await expect(page.locator('.microgame__countdown')).toBeVisible();
  await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'play', {
    timeout: 5_000,
  });
  await expect(page.locator('.microgame__bar')).toBeVisible();
  await page.waitForTimeout(500);
}

async function setDocumentVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((nextState) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: nextState,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/* One retry, for the same reason tests/e2e/cable-progression.spec.ts takes one.
   The Cable case in here physically drags plugs, and solving a desk from its authored
   slots means ten drags rather than the five fixed moves it used to make — necessary,
   because a wheel wires a hub into the centre and no fixed perimeter ordering can clear
   it. Under parallel CPU load a press can occasionally land on a plug that has not
   finished moving out of the way, so the wrong node is grabbed and the board is left
   tangled. A single retry absorbs that without masking anything: a genuine failure to
   solve fails every attempt, and this block is serial, so the retry re-runs it from a
   clean boot rather than from whatever state the flake left behind. */
test.describe.configure({ retries: 1 });

test.describe.serial('premium minigame presentation', () => {
  test('opens, plays, and safely leaves Coffee Rescue without a reward', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-intro-1280x800.png' });
    await startGame(page);
    await expect(game.locator('.coffee__cafe')).toBeVisible();
    const drop = game.locator('.coffee__drop').first();
    await expect(drop).toBeVisible({ timeout: 3_000 });
    const dropBox = await drop.boundingBox();
    const areaBox = await game.locator('.coffee__area').boundingBox();
    if (dropBox && areaBox) {
      await page.mouse.move(dropBox.x + dropBox.width / 2, areaBox.y + areaBox.height - 22);
      await expect(game.locator('.microgame__score b')).not.toHaveText('0', { timeout: 4_000 });
    }
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-play-1280x800.png' });
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();
    await expect(page.locator('.microgame__reward-slip')).toHaveCount(0);
  });

  test('opens and plays Bug Squash with a tactile hit', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Bug Squash');
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-intro-1280x800.png' });
    await startGame(page);
    await expect(game.locator('.bugsquash__desk')).toBeVisible();
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    const activeIndex = await activeBug.evaluate((element) =>
      [...element.parentElement!.children].indexOf(element),
    );
    const claimedBurrow = game.locator('.burrow').nth(activeIndex);
    await claimedBurrow.click();
    await expect(game.locator('.burrow.is-hit')).toBeVisible();
    await expect(game.locator('.microgame__score b')).toHaveText('2');
    // A duplicate activation that lands inside the just-hit grace window must
    // not become an unfair empty-drawer penalty.
    // Dispatch synchronously because Playwright's actionability checks wait for
    // the intentional drawer-hit animation, which would no longer exercise the
    // real duplicate-event race window.
    await claimedBurrow.dispatchEvent('click');
    await expect(game.locator('.microgame__score b')).toHaveText('2');
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-hit-1280x800.png' });
    await page.waitForTimeout(220);
    const emptyBurrow = game.locator('.burrow').nth((activeIndex + 1) % 9);
    await emptyBurrow.click();
    await expect(emptyBurrow).toHaveClass(/is-wrong/);
    // ASCII hyphen-minus, not U+2212: the bundled fonts are Latin subsets and the
    // typographic minus sign renders as a tofu box without a system fallback.
    await expect(emptyBurrow.locator('.burrow__miss b')).toHaveText('-2');
    await expect(emptyBurrow.locator('.burrow__miss b')).toBeVisible();
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-penalty-1280x800.png' });
    await expect(game.locator('.microgame__score b')).toHaveText('0');
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();
  });

  test('untangles the Cable desk with robust pointer movement and one clear rule', async ({
    page,
  }) => {
    await boot(page);
    const game = await openGame(page, 'Cable Untangle Desk');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-intro-1280x800.png' });
    await startGame(page);
    const board = game.locator('.cable__board');
    const plugs = game.locator('.cable__node');
    await expect(board).toBeVisible();
    await expect(plugs).toHaveCount(5);
    /* Cable count comes from the desk that actually loaded, not from a constant.
       Asserting "5 cables for 5 plugs" quietly assumed every desk is a single ring;
       a wheel wires four rim cables plus four spokes to the same five plugs. Checking
       against the authored edge list is the stronger claim anyway: the renderer must
       draw exactly the cabling the level defines, whatever its shape. */
    const levelId = await board.getAttribute('data-level');
    expect(levelId).toBeTruthy();
    const authoredEdges = cableLevelEdges(levelId!);
    expect(authoredEdges.length).toBeGreaterThanOrEqual(5);
    await expect(game.locator('.cable__strand-body')).toHaveCount(authoredEdges.length);
    await expect(
      game.locator('.cable__port, .cable__desk-art, .cable__tag, .cable__node-label'),
    ).toHaveCount(0);
    await expect(game.locator('.cable__crossings')).not.toContainText('0');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-tangled-1280x800.png' });

    // A press/release completed in the same turn must never strand active drag
    // state, which was the source of the intermittent stuck-cable regression.
    const firstPlug = await plugs.nth(0).boundingBox();
    expect(firstPlug).not.toBeNull();
    await page.mouse.move(
      firstPlug!.x + firstPlug!.width / 2,
      firstPlug!.y + firstPlug!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.up();
    await expect(game.locator('.cable__node.is-active')).toHaveCount(0);

    // An interrupted native pointer sequence restores the original position.
    const beforeCancel = await plugs.nth(0).boundingBox();
    const beforeCancelPosition = await plugs.nth(0).evaluate((element) => ({
      left: (element as HTMLElement).style.left,
      top: (element as HTMLElement).style.top,
    }));
    await page.mouse.move(
      beforeCancel!.x + beforeCancel!.width / 2,
      beforeCancel!.y + beforeCancel!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(beforeCancel!.x + 90, beforeCancel!.y + 70, { steps: 4 });
    await plugs
      .nth(0)
      .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
    await page.mouse.up();
    await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
    await expect
      .poll(() =>
        plugs.nth(0).evaluate((element) => ({
          left: (element as HTMLElement).style.left,
          top: (element as HTMLElement).style.top,
        })),
      )
      .toEqual(beforeCancelPosition);

    const boardBox = await board.boundingBox();
    expect(boardBox).not.toBeNull();
    // The board reports its own horizontal flip; inferring it from where plug 0
    // happens to have been tangled is a guess that a non-ring shape can get wrong.
    const mirrored = (await board.getAttribute('data-mirrored')) === 'true';
    const target = (x: number, y: number) => ({
      x: boardBox!.x + (mirrored ? 1 - x : x) * boardBox!.width,
      y: boardBox!.y + y * boardBox!.height,
    });
    /* Drag, then CHECK the plug actually arrived, and try again if it did not.
       Solving a desk from its authored slots means ten drags rather than the five fixed
       moves this test used to make, and under load a coalesced pointer move can leave a
       plug short of its target. That matters most during the scatter pass: a plug that
       stops short can end up overlapping another, and then the next pick-up grabs the
       wrong one and the whole solve wanders off. Verifying each drag removes the timing
       sensitivity at its source, which is better than letting the test retry wholesale
       and better than granting it retries it should not need. */
    const dragPlug = async (id: number, x: number, y: number) => {
      const destination = target(x, y);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const box = await plugs.nth(id).boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.down();
        await page.mouse.move(destination.x, destination.y, { steps: 8 });
        await page.mouse.up();
        await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
        /* Compare the COMMITTED position, not the painted one. The node carries its
           position as `style.left/top` percentages straight from game state, while its
           bounding box is still easing into place for a moment afterwards. Measuring the
           rect immediately after mouse-up therefore reported "did not arrive" under load
           even when the drag had registered perfectly, all three attempts were spent, and
           the plug was abandoned mid-board — which is how this ended up leaving "Tangles:
           3" in parallel runs while passing on its own. */
        const committed = await plugs.nth(id).evaluate((el) => ({
          left: parseFloat((el as HTMLElement).style.left),
          top: parseFloat((el as HTMLElement).style.top),
        }));
        const wantX = (mirrored ? 1 - x : x) * 100;
        if (Math.abs(committed.left - wantX) <= 1.5 && Math.abs(committed.top - y * 100) <= 1.5) {
          return;
        }
      }
    };

    /* Solve from the desk's OWN authored slots rather than from a fixed sequence of
       coordinates. The previous sequence used the centre of the board as spare space
       and then walked the plugs around the perimeter, which only clears a single ring
       — a wheel wires a hub INTO that centre, so no perimeter-only ordering can ever
       finish it. Scatter clear of the slots first so each pick-up grabs its own plug,
       then seat every plug on its slot. */
    const solveSlots = cableLevelSlots(levelId!);
    expect(solveSlots).toHaveLength(5);
    const rows = cableScratchRows(solveSlots);
    for (let id = 0; id < solveSlots.length; id += 1) {
      const scratch = cableScratchPoint(id, solveSlots.length, rows);
      await dragPlug(id, scratch.x, scratch.y);
    }
    for (let attempt = 0; attempt < 6; attempt += 1) {
      for (let id = 0; id < solveSlots.length; id += 1) {
        await dragPlug(id, solveSlots[id].x, solveSlots[id].y);
      }
      const crossings = (await game.locator('.cable__crossings').textContent()) ?? '';
      if (/\b0\b/.test(crossings)) break;
    }
    await expect(game.locator('.cable__crossings')).toContainText('0');
    await expect(game.locator('.cable__cleared')).toBeVisible();
    await expect(game.locator('.cable__cleared')).toContainText('All cables clear!');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-complete-1280x800.png' });
    await game.locator('.microgame__pause').click();
    await page.waitForTimeout(1_600);
    await expect(game.locator('.cable__cleared')).toBeVisible();
  });

  test('every minigame stays readable and pointer-playable at compact size', async ({ page }) => {
    await boot(page, { width: 390, height: 700 });

    let game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const area = await game.locator('.coffee__area').boundingBox();
    expect(area).not.toBeNull();
    /* PLAY it, rather than parking the mug on one drop's starting column.
       Two things made the parked version unreliable, and both are real behaviour:
       the drop kinds fall at different speeds, so the one that was measured is not
       necessarily the one that reaches the mug; and the decaf is a hazard, so a mug
       left sitting in one column happily catches it — and since a first mug pays 2
       while a caught decaf costs 3, the score can land back on "0" and the check that
       it is non-zero fails a moment after it passed.
       Following the lowest catchable drop and stepping aside for the hazard is what a
       player does, and it is what "pointer-playable" actually means. */
    const mugY = area!.y + area!.height - 18;
    let scored = false;
    for (let i = 0; i < 90 && !scored; i += 1) {
      const next = await page.evaluate(() => {
        const drops = [...document.querySelectorAll('.coffee__drop')].map((el) => {
          const b = el.getBoundingClientRect();
          return {
            hazard: el.classList.contains('coffee__drop--decaf'),
            cx: b.x + b.width / 2,
            cy: b.y + b.height / 2,
          };
        });
        if (!drops.length) return null;
        drops.sort((a, b) => b.cy - a.cy);
        return drops[0];
      });
      if (next) {
        // Chase what is catchable; slide away from what is not.
        const toX = next.hazard
          ? next.cx - area!.x > area!.width / 2
            ? area!.x + 10
            : area!.x + area!.width - 10
          : next.cx;
        await page.mouse.move(toX, mugY);
      }
      await page.waitForTimeout(60);
      scored = (await game.locator('.microgame__score b').textContent())?.trim() !== '0';
    }
    expect(scored, 'a compact Coffee board never paid out for a caught drop').toBe(true);
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-play-390x700.png' });
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();

    game = await openGame(page, 'Bug Squash');
    await startGame(page);
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    await activeBug.dispatchEvent('click');
    await expect(game.locator('.burrow.is-hit')).toBeVisible();
    await expect(game.locator('.bug.is-squashed')).toBeVisible();
    await expect(game.locator('.microgame__score b')).not.toHaveText('0');
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-hit-390x700.png' });
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();

    game = await openGame(page, 'Cable Untangle Desk');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-intro-390x700.png' });
    await startGame(page);
    const cableBoard = game.locator('.cable__board');
    const cablePlug = game.locator('.cable__node').first();
    const cablePlugBox = await cablePlug.boundingBox();
    expect(cablePlugBox).not.toBeNull();
    await page.mouse.move(
      cablePlugBox!.x + cablePlugBox!.width / 2,
      cablePlugBox!.y + cablePlugBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(cablePlugBox!.x + 35, cablePlugBox!.y + 55, { steps: 4 });
    await page.mouse.up();
    await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
    await expect(cableBoard).toBeVisible();

    const bounds = await game.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-play-390x700.png' });
  });

  test('a hidden countdown stays frozen until the app is visible again', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await game.locator('.microgame__start').click();
    await expect(game).toHaveAttribute('data-phase', 'countdown');
    await setDocumentVisibility(page, 'hidden');
    const countdown = game.locator('.microgame__countdown strong');
    const frozenValue = await countdown.textContent();
    await page.waitForTimeout(1_200);
    await expect(countdown).toHaveText(frozenValue ?? '3');
    await setDocumentVisibility(page, 'visible');
    await expect(game).toHaveAttribute('data-phase', 'play', { timeout: 5_000 });
  });

  test('pause safety freezes play and preserves a manual pause across visibility changes', async ({
    page,
  }) => {
    await boot(page);
    const game = await openGame(page, 'Bug Squash');
    await startGame(page);

    const timer = game.locator('.microgame__timer');
    const pause = game.locator('.microgame__pause');
    const timeBefore = await timer.textContent();
    const activeBefore = await game.locator('.burrow.is-up').count();
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(game.locator('.microgame__paused')).toBeVisible();
    await page.waitForTimeout(1_250);
    await expect(timer).toHaveText(timeBefore ?? '');
    expect(await game.locator('.burrow.is-up').count()).toBe(activeBefore);
    await expect(game.locator('.burrow').first()).toBeDisabled();

    await setDocumentVisibility(page, 'hidden');
    await setDocumentVisibility(page, 'visible');
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(game.locator('.microgame__paused')).toBeVisible();

    await game.locator('.microgame__paused .buy-btn').click();
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(1_100);
    expect(await timer.textContent()).not.toBe(timeBefore);
  });

  test('leaving active rounds never grants a reward and a fresh round starts cleanly', async ({
    page,
  }) => {
    await boot(page);
    let game = await openGame(page, 'Bug Squash');
    await startGame(page);
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    await activeBug.click();
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();

    game = await openGame(page, 'Bug Squash');
    await startGame(page);
    await expect(game.locator('.microgame__score b')).toHaveText('0');
    await game.locator('.microgame__exit').click();
    await page.getByRole('button', { name: 'Stats', exact: true }).click();
    const row = page.locator('.stats-table tr').filter({ hasText: 'Micro-games played' });
    await expect(row.locator('td')).toHaveText('0');
  });

  test('Coffee keyboard control is scoped, pause is inert, and compact geometry stays visible', async ({
    page,
  }) => {
    await boot(page, { width: 320, height: 520 });
    const game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const area = game.locator('.coffee__area');
    const mug = game.locator('.coffee__mug');
    await area.scrollIntoViewIfNeeded();
    await area.focus();
    const before = Number.parseFloat(
      (await mug.getAttribute('style'))?.match(/left:\s*([\d.]+)/)?.[1] ?? '0',
    );
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () =>
        Number.parseFloat((await mug.getAttribute('style'))?.match(/left:\s*([\d.]+)/)?.[1] ?? '0'),
      )
      .toBeGreaterThan(before);

    const moved = await mug.getAttribute('style');
    await game.locator('.microgame__exit').focus();
    await page.keyboard.press('ArrowRight');
    await expect(mug).toHaveAttribute('style', moved ?? '');

    await game.locator('.microgame__pause').click();
    await expect(game.locator('.microgame__playfield')).toHaveAttribute('inert', '');
    const resume = game.locator('.microgame__paused .buy-btn');
    await expect(resume).toBeFocused();
    await resume.click();
    await expect(area).toBeFocused();

    const areaBox = await area.boundingBox();
    const mugBox = await mug.boundingBox();
    expect(areaBox).not.toBeNull();
    expect(mugBox).not.toBeNull();
    expect(mugBox!.x).toBeGreaterThanOrEqual(areaBox!.x);
    expect(mugBox!.x + mugBox!.width).toBeLessThanOrEqual(areaBox!.x + areaBox!.width);
    await expect(game.locator('.coffee__streak')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test('reduced-motion Coffee feedback clears while preserving its awarded score', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const drop = game.locator('.coffee__drop--tap').first();
    await expect(drop).toBeVisible({ timeout: 3_000 });
    await drop.dispatchEvent('click');
    await expect(game.locator('.microgame__score b')).not.toHaveText('0');
    await expect(game.locator('.coffee__catch-fx')).toHaveCount(0);
  });

  test('changing the OS motion preference waits until the next round', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const fallingDrop = game.locator('.coffee__drop:not(.coffee__drop--tap)').first();
    await expect(fallingDrop).toBeVisible({ timeout: 3_000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(600);
    await expect(game.locator('.coffee__drop--tap')).toHaveCount(0);
    await expect(game.locator('.coffee__area')).toHaveAttribute('tabindex', '0');
  });
});
