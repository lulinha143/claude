import { test, expect, type Page } from '@playwright/test';
import { GAME_EVENTS } from '../../src/content/events';
import { CLICK } from '../../src/sim/clickStations';

// Gameplay chapter 1: the core loop, played the way a player plays it, in a
// corner-sized window. Tap the crate, see it pay, buy the first goal from the
// office, keep a rhythm to rush a room, take a teammate's find, build the next
// floor, and leave the game open (or the computer asleep) without losing time.

const NOW = Date.now();

function save(extra: Record<string, unknown> = {}) {
  return {
    version: 7,
    onboardingComplete: true,
    lastSaved: NOW,
    eventCooldowns: Object.fromEntries(GAME_EVENTS.map((e) => [e.id, NOW + 3_600_000])),
    resources: { nuts: 300, goldenNuts: 0, reputation: 0, morale: 72 },
    employees: {
      pip: { hired: true, level: 2, friendship: 40, room: 'founder-desk' },
      marlow: { hired: true, level: 2, friendship: 30, room: 'founder-desk' },
    },
    settings: { language: 'en', reducedMotion: false, showHints: false },
    ...extra,
  };
}

async function boot(page: Page, size: [number, number], seed: object | null) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('core-loop-seeded')) return;
    sessionStorage.setItem('core-loop-seeded', '1');
    if (data) localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    else localStorage.removeItem('wmno.save.v1');
    localStorage.setItem('wmno.lang', 'en');
  }, seed);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
}

/** The saved game, after the save the game itself makes when its window is hidden. */
const nuts = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    return JSON.parse(localStorage.getItem('wmno.save.v1') ?? '{}');
  });

async function inside(page: Page, selector: string) {
  const box = (await page.locator(selector).first().boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x, `${selector} left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${selector} top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${selector} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${selector} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

for (const size of [
  [320, 420],
  [380, 460],
] as [number, number][]) {
  test(`the first seconds are a game, in a ${size[0]}x${size[1]} window`, async ({ page }) => {
    await boot(page, size, null);
    await page.getByRole('button', { name: 'Skip opening' }).click();

    // The office, the team, and one obvious thing to do: no guide in the way.
    await expect(page.locator('.popup.onboarding')).toHaveCount(0);
    const crate = page.locator('.station-btn--crate');
    await expect(crate).toHaveClass(/is-coached/);
    await inside(page, '.station-btn--crate');
    const goal = page.locator('.goal-tag');
    await expect(goal).toBeVisible();
    await inside(page, '.goal-tag');
    await expect(goal.locator('.goal-tag__gain')).toContainText('/s');

    // Tapping pays at once, and the coach steps back after the first taps.
    const box = (await crate.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.tap-pop').first()).toBeVisible();
    for (let i = 0; i < 80; i += 1) {
      if (await goal.evaluate((el) => el.classList.contains('is-ready'))) break;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await expect(crate).not.toHaveClass(/is-coached/);
    // A rhythm that long rushed the founder's floor.
    await expect(page.locator('.floor[data-room="founder-desk"]')).toHaveClass(/is-rushing/);

    // The first goal is bought from the office, and says what it changed.
    await expect(goal).toHaveClass(/is-ready/);
    const bought = await goal.getAttribute('data-goal-id');
    await goal.click();
    await expect(page.locator('.goal-tag.is-bought')).toBeVisible();
    await expect(page.locator('.goal-tag.is-bought .goal-tag__gain')).toContainText('+');
    await expect.poll(async () => (await nuts(page)).upgrades?.[bought!] ?? 0).toBe(1);
    // ...and then there is a next goal.
    await expect(page.locator('.goal-tag:not(.is-bought)')).toBeVisible({ timeout: 5_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('the crate fills while you are away and pays it all out', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await boot(page, [380, 460], save());
  const crate = page.locator('.station-btn--crate');
  const before = (await nuts(page)).resources.nuts as number;

  // Ten minutes of the game left open in the corner. A hidden window ticks about
  // once a minute; every one of those minutes still counts.
  for (let minute = 0; minute < 10; minute += 1) {
    await page.clock.fastForward(60_000);
    await page.clock.runFor(150);
  }
  await expect(crate.locator('.station-btn__stash')).toBeVisible();
  await expect(crate).toHaveAttribute('data-fill', /[1-4]/);
  await crate.hover();
  await expect(page.locator('.tooltip')).toContainText('In the crate');

  const stored = ((await nuts(page)).crate?.nuts ?? 0) as number;
  expect(stored).toBeGreaterThan(0);
  const box = (await crate.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.tap-pop--collect')).toBeVisible();
  const after = await nuts(page);
  expect(after.crate.nuts).toBeLessThan(stored);
  expect(after.resources.nuts).toBeGreaterThan(before + stored * 0.9);
});

test('keeping the game open is never worse than closing it', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await boot(page, [380, 460], save());
  const rate = await page.evaluate(() =>
    Number(document.querySelector('.hud__rate')?.textContent?.replace(/[^0-9.]/g, '') ?? 0),
  );
  expect(rate).toBeGreaterThan(0);

  // A throttled window ticking once a minute: a whole minute is credited each time.
  const first = await nuts(page);
  const start = (first.stats.totalNutsEarned as number) + (first.crate?.nuts ?? 0);
  await page.clock.fastForward(60_000);
  await page.clock.runFor(200);
  const afterMinute = await nuts(page);
  const earned = afterMinute.stats.totalNutsEarned + afterMinute.crate.nuts - start;
  expect(earned).toBeGreaterThan(rate * 60 * 0.95);

  // The computer slept with the game open: settled like time away, with a note.
  await page.clock.fastForward(30 * 60_000);
  await page.clock.runFor(200);
  await expect(page.locator('.offline-modal')).toBeVisible();
  await expect(page.locator('.offline-modal__crate')).toContainText('crate');
});

test('keeping a rhythm rushes the room, and the office shows it', async ({ page }) => {
  await boot(page, [1280, 720], save());
  const floor = page.locator('.floor[data-room="founder-desk"]');
  const crate = floor.locator('.station-btn--crate');
  const box = (await crate.boundingBox())!;
  for (let i = 0; i < CLICK.rushStreak; i += 1) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
  }
  await expect(floor).toHaveClass(/is-rushing/);
  await expect(floor.locator('.floor__rush')).toContainText(`×${CLICK.rushMultiplier}`);
  await expect(page.locator('.hud__gain')).toBeVisible();
  await expect(crate).toHaveClass(/is-rushing/);
});

test("a teammate's find waits in the office and pays when taken", async ({ page }) => {
  await boot(
    page,
    [380, 460],
    save({
      finds: [
        {
          id: 'find-e2e',
          employeeId: 'marlow',
          roomId: 'founder-desk',
          kind: 'operational',
          createdAt: NOW,
        },
      ],
    }),
  );
  const find = page.locator('.office-find[data-find="find-e2e"]');
  await expect(find).toBeVisible();
  await inside(page, '.office-find');
  await find.click();
  await expect(find).toHaveCount(0);
  await expect(page.locator('.tap-pop--collect, .tap-pop--golden').first()).toBeVisible();
  // The finder says something and is visibly pleased about it.
  await expect(page.locator('.speech-note')).toBeVisible();
  await expect(page.locator('.employee-bubble[data-employee="marlow"]')).toHaveAttribute(
    'data-sticker',
    'joy',
  );
  await expect.poll(async () => (await nuts(page)).clicker?.findsCollected ?? 0).toBe(1);
});

test('the next floor is built from the top of the tower', async ({ page }) => {
  await boot(
    page,
    [380, 460],
    save({ resources: { nuts: 900, goldenNuts: 0, reputation: 0, morale: 72 } }),
  );
  const build = page.locator('.floor--locked .floor__build');
  await build.scrollIntoViewIfNeeded();
  await expect(build).toBeEnabled();
  await expect(build).toContainText('500');
  await build.click();
  await expect(page.locator('.floor[data-room="sorting"]')).toBeVisible();
});
