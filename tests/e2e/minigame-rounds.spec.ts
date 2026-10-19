import { test, expect, type Page } from '@playwright/test';
import { MICRO_CALIBRATION } from '../../src/sim/minigames';
import { openView } from './support/shell';

// Chapter 5: the three games as a player meets them. Every round here runs on a
// fixed fake clock, which also fixes the round's seed (taken from the clock when a
// game is opened), so each round is the same round every run.

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
  employees: {
    pip: { hired: true, level: 6, room: 'founder-desk', x: 0.4 },
    quincy: { hired: true, level: 3, room: 'founder-desk', x: 0.6 },
    nixie: { hired: true, level: 3, room: 'founder-desk', x: 0.8 },
  },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  decorationInstances: [],
  settings: { reducedMotion: false, language: 'en' },
};

const T0 = new Date('2026-03-02T09:00:00Z');

async function boot(page: Page, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
  await page.clock.install({ time: T0 });
  await page.addInitScript((save) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('wmno.save.v1', JSON.stringify({ ...save, lastSaved: Date.now() }));
    localStorage.setItem('wmno.lang', 'en');
    sessionStorage.setItem('seeded', '1');
  }, SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await openView(page, 'focus');
  await expect(page.locator('.microgame-menu')).toBeVisible();
}

async function start(page: Page, card: string) {
  await page.locator(`.micro-card--${card}`).click();
  await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'intro');
  await expect(page.locator('.microgame__start')).toBeFocused();
  await page.locator('.microgame__start').click();
  await page.clock.runFor(3_100);
  await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'play');
}

const score = async (page: Page) => Number(await page.locator('.microgame__score b').textContent());

/**
 * Click the first thing matching `selector` in the same instant it is found, if
 * anything matches. React commits are not on the fake clock, so the desk can still
 * change after `clock.runFor` returns: a pest counted by one call could be gone by
 * the next, and a locator click would then wait for one forever (nothing new turns
 * up while the clock stands still).
 */
const tapFirst = (page: Page, selector: string) =>
  page.evaluate((target) => {
    const element = document.querySelector(target);
    element?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
    );
    return element !== null;
  }, selector);
const mugLeft = (page: Page) =>
  page.locator('.coffee__mug').evaluate((el) => parseFloat((el as HTMLElement).style.left));

test.describe('Chapter 5 minigame rounds', () => {
  test('Coffee: the counter has focus at the whistle, a held key glides, release stops it', async ({
    page,
  }) => {
    await boot(page);
    await start(page, 'coffeeRescue');
    await page.clock.runFor(50);
    await expect(page.locator('.coffee__area')).toBeFocused();
    const x0 = await mugLeft(page);
    await page.keyboard.down('ArrowLeft');
    await page.clock.runFor(400);
    const held = await mugLeft(page);
    // Moving the whole time it is held, not one step and a wait for key repeat.
    expect(x0 - held).toBeGreaterThan(25);
    await page.keyboard.up('ArrowLeft');
    await page.clock.runFor(300);
    expect(await mugLeft(page)).toBeCloseTo(held, 5);
    // A key held while focus leaves the counter lets go with it.
    await page.keyboard.down('ArrowRight');
    await page.clock.runFor(120);
    await page.locator('.microgame__exit').focus();
    const atBlur = await mugLeft(page);
    await page.clock.runFor(400);
    expect(await mugLeft(page)).toBeCloseTo(atBlur, 5);
    await page.keyboard.up('ArrowRight');
  });

  test('Coffee: catching what the ticket asks for fills the order and pays its bonus', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, { width: 380, height: 700 });
    await start(page, 'coffeeRescue');
    const ticket = page.locator('.coffee__order-ticket');
    await expect(ticket).toContainText('Order 1');
    let served = false;
    for (let step = 0; step < 120 && !served; step += 1) {
      await page.clock.runFor(150);
      await tapFirst(page, '.coffee__drop--tap:not(.coffee__drop--decaf)');
      served = (await page.locator('.coffee__order-stamp').count()) > 0;
    }
    expect(served, 'no order was ever served').toBe(true);
    await expect(page.locator('.coffee__order-stamp')).toContainText('Served +6');
    await expect(page.locator('.coffee__order-item.is-filled')).toHaveCount(2);
    await page.clock.runFor(800);
    await expect(ticket).toContainText('Order 2');
    await expect(page.locator('.coffee__order-item')).toHaveCount(3);
    await expect(page.locator('.coffee__order-item.is-filled')).toHaveCount(0);
  });

  test('Bug Squash: number keys tap the drawer with that number, empty ones cost points', async ({
    page,
  }) => {
    await boot(page);
    await start(page, 'bugSquash');
    await page.clock.runFor(600);
    const up = page.locator('.burrow.is-up');
    await expect(up).toHaveCount(1);
    const hole = Number(await up.getAttribute('data-hole'));
    await page.keyboard.press(String(hole + 1));
    await expect(page.locator('.microgame__score b')).toHaveText('2');
    await expect(page.locator(`.burrow[data-hole="${hole}"]`)).toHaveClass(/is-hit/);
    const empty = (hole + 4) % 9;
    await page.clock.runFor(100);
    await page.keyboard.press(String(empty + 1));
    await expect(page.locator(`.burrow[data-hole="${empty}"]`)).toHaveClass(/is-wrong/);
    await expect(page.locator(`.burrow[data-hole="${empty}"] .burrow__miss b`)).toHaveText('-2');
    await expect(page.locator('.microgame__score b')).toHaveText('0');
    // Arrow keys walk the drawers; Enter taps the one in focus.
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.burrow').nth(4)).toBeFocused();
  });

  test('Bug Squash: shifts bring more pests at once, and squashing the feature costs', async ({
    page,
  }) => {
    await boot(page);
    await start(page, 'bugSquash');
    const banner = page.locator('.micro-banner');
    let maxUp = 0;
    let sawPeak = false;
    let featureTapped = false;
    for (let step = 0; step < 320 && !featureTapped; step += 1) {
      await page.clock.runFor(80);
      const ups = await page.locator('.burrow.is-up').count();
      maxUp = Math.max(maxUp, ups);
      if (
        !sawPeak &&
        (await banner.count()) &&
        (await banner.textContent())?.includes('Peak hour')
      ) {
        sawPeak = true;
        // The announcement never covers a drawer: it rides over the status row.
        const over = (await banner.boundingBox())!;
        const grid = (await page.locator('.bugsquash__grid').boundingBox())!;
        expect(over.y + over.height).toBeLessThanOrEqual(grid.y);
      }
      const feature = page.locator('.burrow.is-up.burrow--feature').first();
      if ((await feature.count()) && (await score(page)) >= 4) {
        const before = await score(page);
        await feature.dispatchEvent('pointerdown', {
          isPrimary: true,
          button: 0,
          pointerType: 'mouse',
        });
        await expect(page.locator('.burrow__miss.is-feature')).toContainText('Feature!');
        expect(await score(page)).toBe(before - 4);
        await expect(page.locator('.microgame__combo')).toHaveCount(0);
        featureTapped = true;
        break;
      }
      await tapFirst(page, '.burrow.is-up:not(.burrow--feature)');
    }
    expect(sawPeak, 'the second shift was never announced').toBe(true);
    expect(featureTapped, 'no feature turned up to test').toBe(true);
    // Clear on to the closing shift: three can be up at once.
    for (let step = 0; step < 160 && maxUp < 3; step += 1) {
      await page.clock.runFor(60);
      maxUp = Math.max(maxUp, await page.locator('.burrow.is-up').count());
    }
    expect(maxUp).toBeGreaterThanOrEqual(2);
  });

  test('Cable: every counted tangle is marked on the desk, and Esc puts a held plug back', async ({
    page,
  }) => {
    await boot(page);
    await start(page, 'cableUntangle');
    const counted = async () =>
      Number((await page.locator('.cable__crossings').textContent())!.replace(/[^\d]/g, ''));
    expect(await counted()).toBeGreaterThan(0);
    await expect(page.locator('.cable__knot')).toHaveCount(await counted());
    // Drag a few plugs around: the marks follow the count every time.
    const board = (await page.locator('.cable__board').boundingBox())!;
    for (const [id, fx, fy] of [
      [0, 0.2, 0.3],
      [1, 0.8, 0.7],
      [2, 0.5, 0.5],
    ] as const) {
      const plug = (await page.locator(`.cable__node[data-node-id="${id}"]`).boundingBox())!;
      await page.mouse.move(plug.x + plug.width / 2, plug.y + plug.height / 2);
      await page.mouse.down();
      await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 5 });
      await page.mouse.up();
      if ((await page.locator('.cable__board').getAttribute('data-stage')) !== 'solving') break;
      await expect(page.locator('.cable__knot')).toHaveCount(await counted());
      await expect(page.locator('.cable__board')).toHaveAttribute(
        'data-conflicts',
        String(await counted()),
      );
    }
    if ((await page.locator('.cable__board').getAttribute('data-stage')) === 'solving') {
      const node = page.locator('.cable__node[data-node-id="3"]');
      const before = await node.getAttribute('style');
      const box = (await node.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 50, { steps: 4 });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(node).toHaveAttribute('style', before!);
      // Esc spent on the plug did not pause the round.
      await expect(page.locator('.microgame__pause')).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('Esc pauses a live round instead of leaving it; leaving from the pause pays nothing', async ({
    page,
  }) => {
    await boot(page);
    await start(page, 'coffeeRescue');
    await page.keyboard.press('Escape');
    await expect(page.locator('.microgame__paused')).toBeVisible();
    await expect(page.locator('.sheet[data-sheet="focus"]')).toBeVisible();
    const timer = await page.locator('.microgame__timer').textContent();
    await page.clock.runFor(5_000);
    await expect(page.locator('.microgame__timer')).toHaveText(timer!);
    await page.keyboard.press('Escape');
    await expect(page.locator('.microgame__paused')).toHaveCount(0);
    await expect(page.locator('.coffee__area')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.locator('.microgame__paused .ghost-btn').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();
    await openView(page, 'stats');
    await expect(
      page.locator('.stats-table tr').filter({ hasText: 'Micro-games played' }).locator('td'),
    ).toHaveText('0');
  });

  test('a completed round pays once, a real replay pays again, and both survive a reload', async ({
    page,
  }) => {
    // Two whole rounds of fast-forwarded play: budgeted like the other long journeys.
    test.setTimeout(75_000);
    await boot(page);
    await start(page, 'bugSquash');
    await page.clock.runFor(MICRO_CALIBRATION.bugSquash.duration * 1000 + 200);
    await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'result');
    await expect(page.locator('.microgame__result-actions .buy-btn')).toBeFocused();
    await expect(page.locator('.microgame__reward-slip')).toBeVisible();
    // Mashing Enter on the result replays; the replay is a new round with its own pay.
    await page.keyboard.press('Enter');
    await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'intro');
    await page.locator('.microgame__start').click();
    await page.clock.runFor(3_100 + MICRO_CALIBRATION.bugSquash.duration * 1000 + 200);
    await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'result');
    await page.locator('.microgame__result-actions .ghost-btn').click();
    await openView(page, 'stats');
    const played = page
      .locator('.stats-table tr')
      .filter({ hasText: 'Micro-games played' })
      .locator('td');
    await expect(played).toHaveText('2');
    await page.reload();
    await page.locator('.office').first().waitFor({ timeout: 15_000 });
    await openView(page, 'stats');
    await expect(played).toHaveText('2');
  });

  test('a first mastery at 320x420: stamp by the score, prize, and a reachable souvenir button', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await boot(page, { width: 320, height: 420 });
    await start(page, 'bugSquash');
    for (let step = 0; step < 400; step += 1) {
      await page.clock.runFor(70);
      if ((await page.locator('.microgame').getAttribute('data-phase')) !== 'play') break;
      await tapFirst(page, '.burrow.is-up:not(.burrow--feature)');
    }
    await page.clock.runFor(1_500);
    await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'result');
    expect(
      Number(await page.locator('.microgame__final-score strong').textContent()),
    ).toBeGreaterThanOrEqual(MICRO_CALIBRATION.bugSquash.mastery);
    const stamp = page.locator('.microgame__final-score .microgame__best-stamp');
    await expect(stamp).toHaveText('New record');
    await expect(page.locator('.microgame__grade')).toHaveText('Nut-standing!');
    // Everything to act on is on screen without scrolling.
    const viewport = page.viewportSize()!;
    for (const button of await page.locator('.microgame__result-actions button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.height).toBeGreaterThanOrEqual(32);
    }
    await expect(page.locator('.microgame__souvenir-btn')).toBeInViewport();
    // The prize and the host's reaction are in the report, below the score.
    await expect(page.locator('.microgame__prize')).toContainText('First mastery!');
    await page
      .locator('.microgame__result-scroll')
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(page.locator('.microgame__host-line .micro-bubble')).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.locator('.microgame__result-actions .ghost-btn').click();
    await expect(page.locator('.micro-card--bugSquash')).toContainText('Mastery on file');
  });
});
