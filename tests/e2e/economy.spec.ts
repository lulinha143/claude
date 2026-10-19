import { test, expect, type Page } from '@playwright/test';
import { GAME_EVENTS } from '../../src/content/events';
import { CLICK } from '../../src/sim/clickStations';
import { openView } from './support/shell';

// Chapter 4: the clicker economy as a player meets it. A purchase states its
// price and its effect, answers at once, lands exactly once (a reload shows one
// level, one charge) and shows up in the office; a purchase that is short says
// what is missing. A tap in a big company is worth a slice of its production,
// and the golden pod pays for time spent there, which a reload cannot reset.

const NOW = Date.now();
const quiet = Object.fromEntries(GAME_EVENTS.map((e) => [e.id, NOW + 3_600_000]));

function save(extra: Record<string, unknown> = {}) {
  return {
    version: 13,
    onboardingComplete: true,
    lastSaved: NOW,
    eventCooldowns: quiet,
    resources: { nuts: 120, goldenNuts: 0, reputation: 0, morale: 72 },
    employees: { pip: { hired: true, level: 1, friendship: 10, room: 'founder-desk' } },
    settings: { language: 'en', reducedMotion: true, showHints: false },
    ...extra,
  };
}

async function boot(page: Page, size: [number, number], seed: object) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('economy-seeded')) return;
    sessionStorage.setItem('economy-seeded', '1');
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    localStorage.setItem('wmno.lang', 'en');
  }, seed);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
}

/** The saved game, after the save the game itself makes when its window is hidden. */
const saved = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    return JSON.parse(localStorage.getItem('wmno.save.v1') ?? '{}');
  });

/** "1.25K" -> 1250 (the HUD's compact English numbers). */
function compact(text: string): number {
  const match = text.replace(/,/g, '').match(/([\d.]+)\s*([KMBT]?)/);
  if (!match) return Number.NaN;
  const scale = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[match[2] as '' | 'K' | 'M' | 'B' | 'T'];
  return Number(match[1]) * scale;
}

test('an upgrade states its price and effect, lands once, and shows in the office', async ({
  page,
}) => {
  await boot(page, [1280, 720], save());
  await openView(page, 'shop');
  const row = page.locator('.shop-item[data-upgrade="prod-1"]');
  await expect(row.locator('.shop-item__gain')).toContainText('/s');
  await expect(row.locator('.shop-item__cost')).toHaveText('50');
  await expect(row).toHaveClass(/is-affordable/);

  await row.locator('.shop-item__buy').click();
  // The answer, on the row: what just changed.
  await expect(row.locator('.shop-item__note.is-ok')).toContainText('Done!');
  await expect(row.locator('.shop-item__note.is-ok')).toContainText('/s');
  await expect(row.locator('.pill')).toContainText('1');
  // ...and in the office beside the sheet: a slip on the home floor.
  await expect(page.locator('.floor[data-room="founder-desk"] .office-slip')).toContainText(
    'Production Line 1',
  );

  // Exactly once: one level, one charge, after a reload too.
  const after = await saved(page);
  expect(after.upgrades['prod-1']).toBe(1);
  expect(after.resources.nuts).toBeLessThan(120 - 50 + 20);
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const again = await saved(page);
  expect(again.upgrades['prod-1']).toBe(1);
  expect(again.resources.nuts).toBeLessThan(120 - 50 + 30);
});

test('a purchase that is short says what is missing instead of doing nothing', async ({ page }) => {
  await boot(
    page,
    [380, 460],
    save({ resources: { nuts: 10, goldenNuts: 0, reputation: 0, morale: 72 } }),
  );
  await openView(page, 'shop');
  const row = page.locator('.shop-item[data-upgrade="prod-1"]');
  const button = row.locator('.shop-item__buy');
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).toContainText('Need');
  // A real click on it (Playwright would wait forever on an aria-disabled button).
  await button.click({ force: true });
  await expect(row.locator('.shop-item__note.is-short')).toContainText('short');
  expect((await saved(page)).upgrades?.['prod-1'] ?? 0).toBe(0);
});

test('automation that already banks everything is complete, not for sale', async ({ page }) => {
  await boot(
    page,
    [1280, 720],
    save({
      resources: { nuts: 1e9, goldenNuts: 0, reputation: 0, morale: 72 },
      upgrades: { 'auto-collector': 4 },
    }),
  );
  await openView(page, 'shop');
  await page.locator('.shop-tabs .tab[data-category="automation"]').click();
  const row = page.locator('.shop-item[data-upgrade="auto-collector"]');
  await expect(row.locator('.shop-item__buy')).toBeDisabled();
  await expect(row.locator('.shop-item__buy')).toContainText('Complete');
  await expect(page.locator('.goal-tag')).not.toHaveAttribute('data-goal-id', 'auto-collector');
});

test('a tap in a big company is worth a slice of its production', async ({ page }) => {
  const employees: Record<string, object> = {};
  for (const id of ['pip', 'marlow', 'rizzo', 'bea', 'corvus', 'mina', 'nixie', 'otto']) {
    employees[id] = { hired: true, level: 25, friendship: 30 };
  }
  await boot(
    page,
    [1280, 720],
    save({
      employees,
      upgrades: { 'room-sorting': 1, 'room-mailroom': 1, 'room-lab': 1 },
      resources: { nuts: 1000, goldenNuts: 0, reputation: 120, morale: 80 },
    }),
  );
  const rate = compact((await page.locator('.hud__rate').innerText()).replace('/s', ''));
  expect(rate).toBeGreaterThan(1000);
  const crate = page.locator('.station-btn--crate');
  await crate.scrollIntoViewIfNeeded();
  const box = (await crate.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const pop = page.locator('.tap-pop').first();
  await expect(pop).toBeVisible();
  const paid = compact(await pop.locator('.tap-pop__value').innerText());
  // It used to be about two nuts, whatever the company made.
  expect(paid).toBeGreaterThan(rate * 0.02);
});

test('the incubation pod pays for time spent there, and a reload is no shortcut', async ({
  page,
}) => {
  await boot(
    page,
    [1280, 720],
    save({ resources: { nuts: 1000, goldenNuts: 0, reputation: 400, morale: 80 } }),
  );
  const pod = page.locator('.station-btn[data-station="incubation-pod"]');
  /** The pod's own promise for its next tap, read from its tooltip (no crit in it). */
  const preview = async () => {
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('zw:focus-floor', { detail: { roomId: 'incubator' } })),
    );
    await pod.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await pod.hover();
    const tip = page.locator('.tooltip');
    await expect(tip).toContainText('of a golden nut');
    const match = (await tip.innerText()).match(/\+([\d.]+)%\s*of a golden nut/);
    return Number(match?.[1] ?? Number.NaN);
  };
  const full = await preview();
  expect(full).toBeGreaterThan(0);

  const box = (await pod.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const tappedAt = Date.now();
  await expect(page.locator('.tap-pop').first()).toBeVisible();
  const first = await saved(page);
  // Gold is paid whole; the refined share waits as dust, with the pod's clock.
  expect(Number.isInteger(first.resources.goldenNuts)).toBe(true);
  expect(first.clicker.goldenDust).toBeGreaterThan(0);
  const clock = first.clicker.premiumAt['incubation-pod'];
  expect(clock).toBeGreaterThan(0);

  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  expect((await saved(page)).clicker.premiumAt['incubation-pod']).toBe(clock);
  // Straight after the reload the pod has refined only for the time that passed.
  const after = await preview();
  const elapsed = Date.now() - tappedAt;
  expect(after).toBeLessThan(full);
  expect(after).toBeLessThanOrEqual(
    full * Math.min(1, (elapsed + 1_500) / CLICK.premiumRecoveryMs) + 0.1,
  );
});
