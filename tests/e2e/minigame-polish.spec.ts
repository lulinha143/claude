import { test, expect, type Page } from '@playwright/test';

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
  await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'play', { timeout: 5_000 });
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

test.describe.serial('premium minigame presentation', () => {
  test('opens and plays Coffee Rescue through its shared result', async ({ page }) => {
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
      await page.waitForTimeout(1_500);
    }
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-play-1280x800.png' });
    await game.locator('.microgame__exit').click();
    await expect(game).toHaveAttribute('data-phase', 'result');
    await expect(game.locator('.microgame__reward-slip')).toBeVisible();
    await page.waitForTimeout(750);
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-result-1280x800.png' });
  });

  test('opens and plays Bug Squash with a tactile hit', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Bug Squash');
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-intro-1280x800.png' });
    await startGame(page);
    await expect(game.locator('.bugsquash__desk')).toBeVisible();
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    await activeBug.click();
    await expect(game.locator('.burrow.is-hit')).toBeVisible();
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-hit-1280x800.png' });
    await game.locator('.microgame__exit').click();
    await expect(game).toHaveAttribute('data-phase', 'result');
    await page.waitForTimeout(750);
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-result-1280x800.png' });
  });

  test('organizes the authored Cable desk with matching plugs and ports', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Cable Untangle Desk');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-intro-1280x800.png' });
    await startGame(page);
    await expect(game.locator('.cable__board')).toBeVisible();
    await expect(game.locator('.cable__strand-body')).toHaveCount(5);
    await expect(game.locator('.cable__port')).toHaveCount(5);
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-tangled-1280x800.png' });

    const plugs = game.locator('.cable__node');
    const ports = game.locator('.cable__port');
    const firstPlug = await plugs.nth(0).boundingBox();
    const ownPort = await ports.nth(0).boundingBox();
    expect(firstPlug).not.toBeNull();
    expect(ownPort).not.toBeNull();
    await page.mouse.move(firstPlug!.x + firstPlug!.width / 2, firstPlug!.y + firstPlug!.height / 2);
    await page.mouse.down();
    await page.mouse.move(ownPort!.x + ownPort!.width / 2, ownPort!.y + ownPort!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(plugs.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(game.locator('.cable__port.is-connected')).toHaveCount(1);

    // Rejecting an already-connected plug at the wrong port must restore its
    // original connection instead of silently rolling back only its position.
    const snappedPlug = await plugs.nth(0).boundingBox();
    const wrongPort = await ports.nth(1).boundingBox();
    await page.mouse.move(snappedPlug!.x + snappedPlug!.width / 2, snappedPlug!.y + snappedPlug!.height / 2);
    await page.mouse.down();
    await page.mouse.move(wrongPort!.x + wrongPort!.width / 2, wrongPort!.y + wrongPort!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(plugs.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(game.locator('.cable__port.is-connected')).toHaveCount(1);
    await expect(plugs.nth(0)).toHaveClass(/is-rejected/);
    await game.locator('.microgame__pause').click();
    await expect(plugs.nth(0)).not.toHaveClass(/is-rejected/);
    await game.locator('.microgame__paused .buy-btn').click();

    for (let index = 1; index < 5; index += 1) {
      await plugs.nth(index).focus();
      await page.keyboard.press('Enter');
      await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
    }
    await expect(game.locator('.cable__cleared')).toBeVisible();
    await expect(game.locator('.cable__port.is-connected')).toHaveCount(5);
    await page.waitForTimeout(750);
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-complete-1280x800.png' });
    await game.locator('.microgame__pause').click();
    await page.waitForTimeout(1_600);
    await expect(game.locator('.cable__cleared')).toBeVisible();
  });

  test('shared minigame cabinet stays contained at compact size', async ({ page }) => {
    await boot(page, { width: 390, height: 700 });
    const game = await openGame(page, 'Cable Untangle Desk');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-intro-390x700.png' });
    await startGame(page);
    const bounds = await game.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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

  test('pause safety freezes play and preserves a manual pause across visibility changes', async ({ page }) => {
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

  test('replay rewards exactly once per completed round and close never duplicates it', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Bug Squash');
    await startGame(page);
    await game.locator('.microgame__exit').click();
    await expect(game).toHaveAttribute('data-phase', 'result');
    await game.getByRole('button', { name: /play again/i }).click();
    await expect(game).toHaveAttribute('data-phase', 'intro');
    await startGame(page);
    await game.locator('.microgame__exit').click();
    await expect(game).toHaveAttribute('data-phase', 'result');
    await game.getByRole('button', { name: /back to office/i }).click();
    await page.getByRole('button', { name: 'Stats', exact: true }).click();
    const row = page.locator('.stats-table tr').filter({ hasText: 'Micro-games played' });
    await expect(row.locator('td')).toHaveText('2');
  });

  test('reduced-motion Coffee feedback clears while preserving its awarded score', async ({ page }) => {
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

  test('operating-system reduced motion disables JavaScript score tweening', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    const game = await openGame(page, 'Bug Squash');
    await startGame(page);
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    await activeBug.click();
    const liveScore = await game.locator('.microgame__score b').textContent();
    await game.locator('.microgame__exit').click();
    await expect(game).toHaveAttribute('data-phase', 'result');
    await page.waitForTimeout(120);
    await expect(game.locator('.microgame__final-score strong')).toHaveText(liveScore ?? '0');
  });
});
