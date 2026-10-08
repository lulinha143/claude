import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect, type Page } from '@playwright/test';
import { GAME_EVENTS } from '../../src/content/events';
import { openSettingsTab } from './support/shell';

// Chapter 9: leaving the office and coming back. Closed, asleep or minimized, the
// time is settled once by its rule; the welcome back says what it brought and by
// which rule, points at what waits in its room, and goes when it is done with.
// Nothing waiting is decided while nobody can see it, a turned-back clock pays
// nothing and stretches nothing, and a reload or an import never pays twice.

const NOW = Date.now();
const HOUR = 3_600_000;
const quiet = Object.fromEntries(GAME_EVENTS.map((e) => [e.id, NOW + 6 * HOUR]));

function save(extra: Record<string, unknown> = {}) {
  return {
    version: 13,
    onboardingComplete: true,
    createdAt: NOW - 5 * 86_400_000,
    lastSaved: NOW - 2 * HOUR,
    eventCooldowns: quiet,
    company: { name: 'Nutshell Inc.' },
    resources: { nuts: 1_000, goldenNuts: 0, reputation: 0, morale: 72 },
    employees: {
      pip: { hired: true, level: 3, friendship: 40, room: 'founder-desk' },
      marlow: { hired: true, level: 3, friendship: 30, room: 'founder-desk' },
    },
    stats: { playTimeSeconds: 3_600, totalNutsEarned: 5_000 },
    settings: { language: 'en', reducedMotion: true, showHints: false },
    ...extra,
  };
}

async function boot(page: Page, seed: object, size: [number, number] = [380, 460], lang = 'en') {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.addInitScript(
    ({ data, locale }) => {
      // Seed once: a reload must load what the game itself filed.
      if (sessionStorage.getItem('returns-seeded')) return;
      sessionStorage.setItem('returns-seeded', '1');
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
      localStorage.setItem('wmno.lang', locale);
    },
    { data: seed, locale: lang },
  );
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
}

/** What is filed right now (the boot files its settlement at once). */
const filed = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('wmno.save.v1') ?? '{}'));

const setVisibility = (page: Page, state: 'hidden' | 'visible') =>
  page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);

async function inView(page: Page, selector: string) {
  const box = (await page.locator(selector).first().boundingBox())!;
  const viewport = page.viewportSize()!;
  return box.y + box.height > 0 && box.y < viewport.height;
}

test('a closed game is paid once at the away rules, and the note says how', async ({ page }) => {
  await boot(page, save());
  const note = page.locator('.return-note');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('data-mode', 'closed');
  await expect(note.locator('.return-note__away')).toContainText('2h');
  await expect(note.locator('.return-note__payoff')).toContainText('nuts');
  await expect(note.locator('.return-note__rule')).toContainText('60%');
  await expect(note.locator('.return-note__rule')).toContainText('8h');
  // Filed with the settlement: the boundary is now, so a reload cannot pay it again.
  const paid = await filed(page);
  expect(Math.abs(paid.lastSaved - Date.now())).toBeLessThan(10_000);
  expect(paid.resources.nuts).toBeGreaterThan(1_000);

  // The crate it filled is a line that goes there; the note is done with.
  await note.locator('.return-note__go[data-go="crate"]').click();
  await expect(note).toHaveCount(0);
  expect(await inView(page, '.floor[data-room="founder-desk"] .station-btn--crate')).toBe(true);
  const crate = page.locator('.floor[data-room="founder-desk"] .station-btn--crate');
  const box = (await crate.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.tap-pop--collect')).toBeVisible();

  // File it as the window goes out of sight, then reload.
  await setVisibility(page, 'hidden');
  const beforeReload = await filed(page);
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await expect(page.locator('.return-note')).toHaveCount(0);
  const again = await filed(page);
  // Seconds of play, not another two hours of it.
  expect(again.stats.totalNutsEarned - beforeReload.stats.totalNutsEarned).toBeLessThan(
    (paid.stats.totalNutsEarned - 5_000) / 20,
  );
});

test('a minimized window earns its open time in full, and is told so on return', async ({
  page,
}) => {
  await page.clock.install({ time: NOW });
  await boot(page, save({ lastSaved: NOW }));
  await expect(page.locator('.return-note')).toHaveCount(0);
  const rate = await page.evaluate(() =>
    Number(document.querySelector('.hud__rate')?.textContent?.replace(/[^0-9.]/g, '') ?? 0),
  );
  expect(rate).toBeGreaterThan(0);
  await setVisibility(page, 'hidden'); // files the company as it goes out of sight
  const before = await filed(page);
  // The browser wakes a hidden window about once a minute.
  for (let minute = 0; minute < 10; minute += 1) {
    await page.clock.fastForward(60_000);
    await page.clock.runFor(150);
  }
  await setVisibility(page, 'visible');
  const note = page.locator('.return-note');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('data-mode', 'open');
  await expect(note.locator('.return-note__rule')).toContainText('Left open in a corner');
  await setVisibility(page, 'hidden');
  const after = await filed(page);
  const gained =
    after.stats.totalNutsEarned +
    after.crate.nuts -
    before.stats.totalNutsEarned -
    before.crate.nuts;
  expect(gained).toBeGreaterThan(rate * 600 * 0.95);
});

test('a long absence is paid up to the cap, and the note says it was', async ({ page }) => {
  await boot(page, save({ lastSaved: NOW - 3 * 86_400_000 }));
  const note = page.locator('.return-note');
  await expect(note).toBeVisible();
  await expect(note.locator('.return-note__away')).toContainText('3 days');
  await expect(note.locator('.return-note__rule')).toContainText('we counted 8h');
});

test('something waiting when the game closed is still waiting, and the note leads to it', async ({
  page,
}) => {
  const left = NOW - 2 * HOUR;
  await boot(
    page,
    save({
      lastSaved: left,
      happenings: {
        incidents: [
          {
            id: 'incident-nut-audit-e2e',
            eventId: 'nut-audit',
            roomId: 'founder-desk',
            employeeId: 'marlow',
            at: left - 60_000,
            until: left + 24 * 60_000,
          },
        ],
        remarks: [],
        diary: [],
        sinceRare: 0,
      },
    }),
    [1280, 720],
  );
  // Two hours later it has not been decided for the player.
  await expect(page.locator('.floor[data-room="founder-desk"][data-incident]')).toHaveCount(1);
  const waiting = (await filed(page)).happenings.incidents[0];
  expect(waiting.until - Date.now()).toBeGreaterThan(20 * 60_000);
  const line = page.locator('.return-note__go[data-go="incident"]');
  await expect(line).toContainText('saw something');
  await line.click();
  await expect(page.locator('.return-note')).toHaveCount(0);
  expect(await inView(page, '.floor[data-room="founder-desk"]')).toBe(true);
});

test('a clock turned back pays nothing and leaves a boost the time it had', async ({ page }) => {
  // Filed an hour "in the future": the computer's clock has gone back since.
  await boot(
    page,
    save({ lastSaved: NOW + HOUR, boosts: [{ multiplier: 2, endsAt: NOW + HOUR + 30_000 }] }),
  );
  await page.waitForTimeout(600);
  await expect(page.locator('.return-note')).toHaveCount(0);
  const state = await filed(page);
  expect(state.resources.nuts).toBeLessThan(1_000 + 200);
  const left = (state.boosts[0].endsAt - Date.now()) / 1000;
  expect(left).toBeGreaterThan(20);
  expect(left).toBeLessThanOrEqual(31);
});

test('importing a company filed days ago pays nothing for those days, however often', async ({
  page,
}) => {
  await boot(page, save({ lastSaved: NOW, company: { name: 'Nutshell Inc.' } }), [1180, 900]);
  const file = join(tmpdir(), `zw-return-import-${Date.now()}.json`);
  writeFileSync(
    file,
    JSON.stringify(save({ lastSaved: NOW - 2 * 86_400_000, company: { name: 'Acorn Holdings' } })),
  );
  for (let round = 0; round < 2; round += 1) {
    // An import goes back to the office; the save file is filed under Settings.
    await openSettingsTab(page, 'file');
    await page.locator('.file-btn input[type=file]').setInputFiles(file);
    await page.locator('.savebar__confirm .danger-btn').click();
    await expect(page.locator('.savebar__confirm')).toHaveCount(0, { timeout: 10_000 });
    const state = await filed(page);
    expect(state.company.name).toBe('Acorn Holdings');
    // Two days of production would be far more than this.
    expect(state.resources.nuts).toBeLessThan(1_000 + 100);
    expect(Math.abs(state.lastSaved - Date.now())).toBeLessThan(10_000);
    await expect(page.locator('.return-note')).toHaveCount(0);
  }
});
