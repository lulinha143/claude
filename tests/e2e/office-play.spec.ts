import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { ROOMS } from '../../src/content/rooms';
import type { GameState } from '../../src/sim/types';
import { openView } from './support/shell';

/**
 * Gameplay chapter 3: playing inside the office, through the real DOM.
 *
 * Each room's station carries a routine of its own and shows it on the machine;
 * curiosities turn up at a room's fixtures; a facility room's secret stands out
 * in the room itself. These play each one the way a player would, in the corner
 * window and at desktop sizes, and check what they did survives a reload.
 */

const EN = JSON.parse(
  readFileSync(new URL('../../src/i18n/locales/en.json', import.meta.url), 'utf8'),
) as unknown;
const text = (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], EN) as string;

const NOW = Date.now();

function company(mutate: (s: GameState) => void): GameState {
  const s = createInitialState(NOW);
  s.onboardingComplete = true;
  s.resources.nuts = 100_000;
  s.resources.goldenNuts = 5;
  s.resources.morale = 60;
  s.resources.reputation = 2_000;
  for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
  s.stats.totalClicks = 200;
  s.stats.playTimeSeconds = 5_000;
  s.settings.language = 'en';
  s.settings.reducedMotion = true;
  s.settings.showHints = false;
  mutate(s);
  return s;
}

function staff(s: GameState, roomId: string, ids: string[], friendship = 30) {
  for (const id of ids) {
    s.employees[id] = { ...s.employees[id], hired: true, level: 3, friendship, room: roomId };
  }
}

async function boot(page: Page, state: GameState, width: number, height: number) {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    }
    localStorage.setItem('wmno.lang', 'en');
  }, state);
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

/** Bring a floor into view, the way the elevator does. */
async function goTo(page: Page, roomId: string) {
  const floor = page.locator(`.floor[data-room="${roomId}"]`);
  await floor.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  return floor;
}

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('wmno.save.v1')!) as GameState);

test('a pot brewed in the Break Room is poured for the room, and the next one keeps brewing across a reload', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'morale', ['marlow']);
      s.office = {
        rooms: { morale: { startedAt: NOW - 200_000, readyAt: NOW - 1_000 } },
        oddities: [],
      };
    }),
    320,
    420,
  );
  const floor = await goTo(page, 'morale');
  const chip = floor.locator('.play-chip');
  await expect(chip).toHaveAttribute('data-status', 'ready');
  await expect(chip).toContainText(text('play.morale.ready'));
  // The machine itself shows it.
  await expect(floor.locator('.station-btn')).toHaveClass(/is-play-ready/);
  const before = (await saved(page)).resources.morale;
  await chip.click();
  await expect(floor.locator('.office-slip')).toContainText(text('play.morale.done.pot'));
  // Marlow, who runs the Break Room, says something about it.
  await expect(page.locator('.speech-note')).toContainText(text('play.morale.say'));
  await expect(chip).toHaveAttribute('data-status', 'idle');
  await expect.poll(async () => (await saved(page)).resources.morale).toBeGreaterThan(before);

  await chip.click();
  await expect(chip).toHaveAttribute('data-status', 'running');
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const again = await goTo(page, 'morale');
  await expect(again.locator('.play-chip')).toHaveAttribute('data-status', 'running');
  expect((await saved(page)).office.rooms.morale.readyAt).toBeGreaterThan(Date.now());
});

test('a clogged chute is freed with three taps on the machine and the room rushes', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'sorting', ['bia']);
      s.office = { rooms: { sorting: { jamAt: NOW, taps: 0 } }, oddities: [] };
    }),
    380,
    460,
  );
  const floor = await goTo(page, 'sorting');
  await expect(floor.locator('.play-chip')).toHaveAttribute('data-status', 'jammed');
  await expect(floor.locator('.station-btn')).toHaveClass(/is-play-jammed/);
  const station = floor.locator('.station-btn');
  for (let i = 0; i < 3; i += 1) {
    await station.click();
    await page.waitForTimeout(120);
  }
  await expect(floor).toHaveClass(/is-rushing/);
  await expect(floor.locator('.play-chip')).toHaveCount(0);
  await expect(floor.locator('.office-slip')).toBeVisible();
  await expect.poll(async () => (await saved(page)).office.rooms.sorting?.jamAt).toBeUndefined();
});

test('something on the security cameras can be caught before it goes', async ({ page }) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'security', ['perry']);
      s.office = {
        rooms: { security: { blipAt: NOW, blipUntil: NOW + 600_000 } },
        oddities: [],
      };
    }),
    800,
    600,
  );
  const floor = await goTo(page, 'security');
  const chip = floor.locator('.play-chip');
  await expect(chip).toContainText(text('play.security.blip'));
  const before = (await saved(page)).resources.reputation;
  await chip.click();
  await expect(floor.locator('.office-slip')).toBeVisible();
  await expect(chip).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).resources.reputation).toBeGreaterThan(before);
});

test('a parcel in the mailroom is handed to the teammate it is for', async ({ page }) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'research', ['moss'], 20);
      s.office = { rooms: { mailroom: { parcelAt: NOW, parcelFor: 'moss' } }, oddities: [] };
    }),
    380,
    460,
  );
  const floor = await goTo(page, 'mailroom');
  const chip = floor.locator('.play-chip');
  await expect(chip).toContainText('For Moss');
  await chip.click();
  await expect(floor.locator('.office-slip')).toContainText('Delivered to Moss');
  // Moss works on another floor; the thanks are said there, in his voice.
  await goTo(page, 'research');
  await expect(page.locator('.speech-note')).toContainText(text('play.parcel.moss'));
  await expect.poll(async () => (await saved(page)).employees.moss.friendship).toBe(23);
});

test("the broadcast booth's show is chosen in the room and changes how it feels", async ({
  page,
}) => {
  await boot(
    page,
    company((s) => staff(s, 'broadcast', ['echo', 'rosa'])),
    1280,
    720,
  );
  const floor = await goTo(page, 'broadcast');
  const chip = floor.locator('.play-chip');
  await expect(chip).toContainText(text('play.broadcast.off'));
  await chip.click();
  await expect(chip).toContainText(text('play.broadcast.mode.calm.name'));
  await expect(floor.locator('.office-slip')).toContainText(
    text('play.broadcast.mode.calm.effect'),
  );
  await expect(page.locator('.employee-bubble[data-employee="echo"]')).toHaveAttribute(
    'data-mood',
    'relaxed',
  );
  await chip.click();
  await expect(chip).toContainText(text('play.broadcast.mode.upbeat.name'));
  await expect.poll(async () => (await saved(page)).office.rooms.broadcast?.mode).toBe('upbeat');
});

test('a curiosity at the corkboard is noticed, remembered, and logged in the Archive', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      s.office = { rooms: {}, oddities: [{ id: 'memo', roomId: 'founder-desk', at: NOW }] };
    }),
    320,
    420,
  );
  const floor = await goTo(page, 'founder-desk');
  // The fixture hums, and the marker sits on it.
  await expect(floor).toHaveAttribute('data-oddity', 'wall');
  const marker = floor.locator('.office-oddity[data-oddity="memo"]');
  await expect(marker).toBeVisible();
  await marker.click();
  const slip = floor.locator('.office-slip');
  await expect(slip).toContainText(text('play.oddity.new'));
  await expect(slip).toContainText(text('oddity.memo.found'));
  await expect(marker).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).flags['oddity.memo']).toBeTruthy();

  await openView(page, 'collections');
  await page.getByRole('tab', { name: /secret/i }).click();
  const log = page.locator('.curiosity-log');
  await expect(log).toContainText(text('oddity.memo.title'));
  await expect(log.locator('.curiosity-room[data-room="founder-desk"]')).toContainText('1/2');
});

test("a facility room's secret stands out in the room once enough has been noticed there", async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'repair', ['bea']);
      s.flags['oddity.borrowed-wrench'] = NOW - 60_000;
      s.flags['oddity.dont-button'] = NOW - 30_000;
    }),
    380,
    460,
  );
  const floor = await goTo(page, 'repair');
  // In the room, not in a menu or the room's header.
  const secret = floor.locator('.floor__stage .floor__discovery');
  await expect(secret).toBeVisible();
  await expect(floor.locator('.floor__header .floor__discovery')).toHaveCount(0);
  await secret.click();
  await expect(page.locator('.annex-evidence')).toBeVisible();
});

test('the elevator says which floors want a hand', async ({ page }) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'morale', ['marlow']);
      s.office = {
        rooms: { morale: { startedAt: NOW - 200_000, readyAt: NOW - 1_000 } },
        oddities: [{ id: 'slogan', roomId: 'marketing', at: NOW }],
      };
    }),
    380,
    460,
  );
  await page.locator('.elevator__list-btn').click();
  const list = page.locator('.elevator__floors');
  const morale = await page.evaluate(
    () => document.querySelector('.floor[data-room="morale"]') !== null,
  );
  expect(morale).toBe(true);
  await expect(list.locator('.elevator__floor-news--play')).toHaveCount(1);
  await expect(list.locator('.elevator__floor-news--oddity')).toHaveCount(1);
});

for (const [width, height] of [
  [320, 420],
  [380, 460],
  [800, 600],
  [1280, 720],
  [1440, 900],
] as const) {
  test(`room play stays inside its room and readable at ${width}x${height}`, async ({ page }) => {
    await boot(
      page,
      company((s) => {
        staff(s, 'morale', ['marlow']);
        staff(s, 'sorting', ['bia']);
        s.office = {
          rooms: {
            morale: { startedAt: NOW - 200_000, readyAt: NOW - 1_000 },
            sorting: { jamAt: NOW, taps: 1 },
            'founder-desk': { parcelAt: NOW, parcelFor: 'pip' },
          },
          oddities: [{ id: 'memo', roomId: 'founder-desk', at: NOW }],
        };
      }),
      width,
      height,
    );
    for (const room of ['morale', 'sorting', 'founder-desk']) {
      const floor = await goTo(page, room);
      const m = await floor.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const label = el.querySelector('.floor__label')!.getBoundingClientRect();
        const items = [...el.querySelectorAll('.play-chip, .office-oddity')].map((item) => {
          const r = item.getBoundingClientRect();
          const style = getComputedStyle(item);
          return {
            inside:
              r.left >= box.left - 1 &&
              r.right <= box.right + 1 &&
              r.top >= box.top - 1 &&
              r.bottom <= box.bottom + 1,
            underLabel:
              r.top < label.bottom &&
              r.bottom > label.top &&
              r.left < label.right &&
              r.right > label.left,
            font: parseFloat(style.fontSize),
            size: Math.min(r.width, r.height),
          };
        });
        return { items, wide: document.documentElement.scrollWidth > innerWidth };
      });
      expect(m.items.length, `${room} has something to press`).toBeGreaterThan(0);
      for (const item of m.items) {
        expect(item.inside, `${room} ${width}x${height}: inside the room`).toBe(true);
        expect(item.underLabel, `${room} ${width}x${height}: clear of the room's label`).toBe(
          false,
        );
        expect(item.font, 'legible').toBeGreaterThanOrEqual(11);
        expect(item.size, 'big enough to hit').toBeGreaterThanOrEqual(20);
      }
      expect(m.wide).toBe(false);
    }
    await page.screenshot({ path: `visual-artifacts/review/office-play-${width}x${height}.png` });
  });
}
