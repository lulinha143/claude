import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { ROOMS, ROOMS_BY_ID } from '../../src/content/rooms';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../../src/content/events';
import { WORLD_MOMENTS } from '../../src/content/happenings';
import { historyLabelKeys } from '../../src/content/historyLabels';
import type { GameState } from '../../src/sim/types';
import { openView } from './support/shell';

/**
 * The observation report, through the real game: an incident nobody looked into
 * is decided by the team while the office sits in a corner, the Archive's
 * timeline says so, the report tells it (and what passed unseen, without its
 * name), and each line goes back to its room. It survives a reload, the welcome
 * back links to it, and it reads at every window size, by keyboard, in high
 * contrast and with reduced motion.
 */

const HOUR = 3_600_000;
const LOCALES = Object.fromEntries(
  ['en', 'pt-BR'].map((locale) => [
    locale,
    JSON.parse(
      readFileSync(new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'),
    ) as unknown,
  ]),
);
const text = (key: string, locale = 'pt-BR') =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)[part],
      LOCALES[locale],
    ) as string;
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => values[name] ?? '');

function staff(s: GameState, roomId: string, ids: string[]) {
  for (const id of ids) {
    s.employees[id] = { ...s.employees[id], hired: true, level: 3, friendship: 30, room: roomId };
  }
}

/** A going company, filed just now, where nothing new starts while the test watches. */
function company(mutate: (s: GameState, now: number) => void, language = 'pt-BR'): GameState {
  const now = Date.now();
  const s = createInitialState(now);
  s.onboardingComplete = true;
  s.resources.nuts = 100_000;
  s.resources.morale = 60;
  s.resources.reputation = 2_000;
  for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
  s.stats.totalClicks = 200;
  s.stats.playTimeSeconds = 5_000;
  s.settings.language = language;
  s.settings.reducedMotion = true;
  s.settings.showHints = false;
  s.eventCooldowns = Object.fromEntries([
    ...GAME_EVENTS.map((def) => [def.id, now + 6 * HOUR]),
    ...WORLD_MOMENTS.map((def) => [`moment:${def.id}`, now + 6 * HOUR]),
  ]);
  staff(s, 'meeting', ['hazel', 'nino']);
  staff(s, 'lab', ['axel']);
  staff(s, 'research', ['moss']);
  staff(s, 'broadcast', ['echo']);
  staff(s, 'marketing', ['corvus', 'rosa']);
  mutate(s, now);
  return s;
}

/** Something of everything: decided by the team, by the player, on file; unseen; a moment; waiting. */
function busy(s: GameState, now: number) {
  const ago = (minutes: number) => now - minutes * 60_000;
  s.eventHistory = [
    { eventId: 'the-minutes', choiceId: 'sign', at: ago(26 * 60) },
    { eventId: 'the-minutes', choiceId: 'wake', at: ago(50), by: 'team', roomId: 'meeting' },
    {
      eventId: 'night-shift-report',
      choiceId: 'ask',
      at: ago(40),
      by: 'player',
      roomId: 'research',
    },
    {
      eventId: 'night-shift-report',
      choiceId: 'leave',
      at: ago(39),
      by: 'player',
      roomId: 'research',
    },
    { eventId: 'centrifuge-wont-stop', choiceId: 'unplug', at: ago(20), by: 'team', roomId: 'lab' },
  ];
  s.happenings.diary = [
    { at: ago(45), kind: 'moment', momentId: 'nap-on-the-agenda', roomId: 'meeting' },
    { at: ago(30), kind: 'faded', eventId: 'thirteenth-button', roomId: 'founder-desk' },
  ];
  s.happenings.incidents = [
    {
      id: 'incident-the-rebrand-e2e',
      eventId: 'the-rebrand',
      roomId: 'marketing',
      employeeId: 'corvus',
      at: ago(5),
      until: now + HOUR,
    },
  ];
}

async function boot(page: Page, state: GameState, width: number, height: number) {
  await page.addInitScript((save) => {
    // Seed once: a reload must load what the game itself filed.
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    }
    localStorage.setItem('wmno.lang', save.settings.language);
  }, state);
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
}

/** Flush a save and read it back. */
const saved = (page: Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem('wmno.save.v1')!) as GameState;
  });

async function inView(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  const viewport = page.viewportSize()!;
  return !!box && box.y + box.height > 0 && box.y < viewport.height;
}

/** The Archive's company page, and the report from its timeline. */
async function openReport(page: Page) {
  await openView(page, 'company');
  await page.locator('.observation-open').click();
  const report = page.locator('.observation-popup');
  await expect(report).toBeVisible();
  return report;
}

test('an incident nobody looked into is the team’s call, on file, and leads back to its room', async ({
  page,
}) => {
  await boot(
    page,
    company((s, now) => {
      s.happenings.incidents = [
        {
          id: 'incident-the-minutes-e2e',
          eventId: 'the-minutes',
          roomId: 'meeting',
          employeeId: 'hazel',
          at: now - 25 * 60_000,
          until: now + 3_000,
        },
      ];
    }),
    1280,
    720,
  );
  // It waits in the meeting room; the office is in sight, and nobody looks into it.
  await expect(page.locator('.floor[data-room="meeting"][data-incident]')).toHaveCount(1);
  await expect(page.locator('.floor[data-room="meeting"][data-incident]')).toHaveCount(0, {
    timeout: 15_000,
  });
  const decided = (await saved(page)).eventHistory.at(-1)!;
  expect(decided).toMatchObject({ eventId: 'the-minutes', by: 'team', roomId: 'meeting' });
  const choice = text(historyLabelKeys('the-minutes', decided.choiceId).choiceKey);

  // The Archive's timeline says who took it.
  await openView(page, 'company');
  const latest = page.locator('.company-timeline .timeline__row').first();
  await expect(latest).toHaveAttribute('data-by', 'team');
  await expect(latest.locator('.decision-by')).toHaveText(text('observation.by.team'));
  await expect(latest).toContainText(choice);

  // The report, from there: who, what, where.
  const open = page.locator('.observation-open');
  await expect(open).toHaveText(text('observation.open'));
  await open.click();
  const report = page.locator('.observation-popup');
  await expect(report).toBeVisible();
  await expect(report.locator('.observation__title')).toHaveText(text('observation.title'));
  const team = report.locator('.observation__row[data-stamp="team"]');
  await expect(team).toHaveCount(1);
  await expect(team).toContainText(text(GAME_EVENTS_BY_ID['the-minutes'].titleKey));
  await expect(team).toContainText(fill(text('observation.decision.team'), { choice }));
  await expect(team.locator('.observation__where')).toHaveText(text(ROOMS_BY_ID.meeting.nameKey));
  // Told once: the diary's "it started" and "the team handled it" are not lines of their own.
  await expect(report.locator('.observation__row')).toHaveCount(1);
  // Escape puts it away, and the keyboard is back where it was.
  await page.keyboard.press('Escape');
  await expect(report).toHaveCount(0);
  await expect(open).toBeFocused();

  // Its line goes to the room: the report and the Archive close, the tower brings it up.
  await open.click();
  await report.locator('.observation__row[data-stamp="team"] .observation__go').click();
  await expect(report).toHaveCount(0);
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect.poll(() => inView(page, '.floor[data-room="meeting"]')).toBe(true);

  // A reload keeps the record, and who took the decision.
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const again = await openReport(page);
  await expect(again.locator('.observation__row[data-stamp="team"]')).toContainText(choice);
  expect((await saved(page)).eventHistory.at(-1)).toMatchObject({
    eventId: 'the-minutes',
    by: 'team',
    roomId: 'meeting',
  });
});

test('the welcome back links to the report; what passed unseen stays unnamed', async ({ page }) => {
  await boot(
    page,
    company((s, now) => {
      const left = now - 2 * HOUR;
      s.lastSaved = left;
      s.eventHistory = [
        {
          eventId: 'the-minutes',
          choiceId: 'wake',
          at: left - 30 * 60_000,
          by: 'team',
          roomId: 'meeting',
        },
      ];
      s.happenings.diary = [
        {
          at: left - 20 * 60_000,
          kind: 'faded',
          eventId: 'night-shift-report',
          roomId: 'research',
        },
      ];
    }),
    380,
    460,
  );
  const note = page.locator('.return-note');
  await expect(note).toBeVisible();
  const link = note.locator('.return-note__report');
  await expect(link).toHaveText(text('observation.fromReturn'));
  const box = (await link.boundingBox())!;
  expect(box.height, 'a usable target').toBeGreaterThanOrEqual(30);
  const dock = (await page.locator('.dock').boundingBox())!;
  expect(box.y + box.height, 'above the dock').toBeLessThanOrEqual(dock.y + 1);
  await link.click();

  const report = page.locator('.observation-popup');
  await expect(report).toBeVisible();
  // A document opens at its letterhead, not scrolled to its first line's button.
  await expect(report.locator('.observation__title')).toBeInViewport();
  expect(await report.locator('.popup__content').evaluate((el) => el.scrollTop)).toBe(0);
  const passed = report.locator('.observation__row[data-stamp="passed"]');
  await expect(passed).toContainText(text('observation.passed'));
  await expect(passed.locator('.observation__redacted')).toBeVisible();
  await expect(passed.locator('.sr-only')).toHaveText(text('observation.unnamed'));
  const title = GAME_EVENTS_BY_ID['night-shift-report'].titleKey;
  await expect(report).not.toContainText(text(title));
  await expect(report).not.toContainText(text(title, 'en'));
  await expect(report.locator('.observation__row[data-stamp="team"]')).toHaveCount(1);

  // Going there puts the report and the note away and brings the floor up.
  await passed.locator('.observation__go').click();
  await expect(report).toHaveCount(0);
  await expect(note).toHaveCount(0);
  await expect.poll(() => inView(page, '.floor[data-room="research"]')).toBe(true);
});

test('the welcome back offers no report when nothing is on file', async ({ page }) => {
  await boot(
    page,
    company((s, now) => {
      s.lastSaved = now - 2 * HOUR;
    }),
    380,
    460,
  );
  const note = page.locator('.return-note');
  await expect(note).toBeVisible();
  await expect(page.locator('.return-note__report')).toHaveCount(0);
  await note.locator('.return-note__close').click();
  await expect(note).toHaveCount(0);
  // The Archive's way in is always there; an empty file says how it fills.
  const report = await openReport(page);
  await expect(report.locator('.observation__empty')).toContainText(text('observation.emptyTitle'));
});

const SIZES: Array<[number, number]> = [
  [320, 420],
  [380, 460],
  [800, 600],
  [1280, 720],
  [1440, 900],
  [1920, 1080],
];

test('reads at every window size, with nothing cut off or scrolling sideways', async ({ page }) => {
  await boot(page, company(busy), 1280, 720);
  const report = await openReport(page);
  // Waiting now, then four decisions (a chain is one), a moment and something unseen.
  await expect(report.locator('.observation__row')).toHaveCount(7);
  await expect(report.locator('.observation__day').first()).toHaveAttribute('data-day', 'now');
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    const size = `${width}×${height}`;
    const layout = await page.evaluate(() => {
      const popup = document.querySelector<HTMLElement>('.observation-popup')!;
      const content = popup.querySelector<HTMLElement>('.popup__content') ?? popup;
      const rect = popup.getBoundingClientRect();
      const close = popup
        .querySelector<HTMLElement>('.popup__actions button')!
        .getBoundingClientRect();
      const clipped = [
        ...popup.querySelectorAll<HTMLElement>(
          '.observation__what, .observation__text, .observation__mark, .observation__go, .observation__where',
        ),
      ]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.className}: ${el.textContent}`);
      const goes = [...popup.querySelectorAll<HTMLElement>('.observation__go')].map((el) => {
        const box = el.getBoundingClientRect();
        const row = el.closest('.observation__row')!.getBoundingClientRect();
        return {
          height: box.height,
          inside: box.left >= row.left - 1 && box.right <= row.right + 1,
        };
      });
      const smallest = Math.min(
        ...[...popup.querySelectorAll<HTMLElement>('.observation__row *')]
          .filter((el) => el.childNodes.length && el.textContent?.trim())
          .map((el) => parseFloat(getComputedStyle(el).fontSize)),
      );
      return {
        page: document.documentElement.scrollWidth - window.innerWidth,
        sideways: content.scrollWidth - content.clientWidth,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        close: { top: close.top, bottom: close.bottom, height: close.height },
        clipped,
        goes,
        smallest,
      };
    });
    expect(layout.page, `${size}: the page does not scroll sideways`).toBeLessThanOrEqual(0);
    expect(layout.sideways, `${size}: the report does not scroll sideways`).toBeLessThanOrEqual(1);
    expect(layout.rect.left, size).toBeGreaterThanOrEqual(0);
    expect(layout.rect.right, size).toBeLessThanOrEqual(width);
    expect(layout.rect.top, size).toBeGreaterThanOrEqual(0);
    expect(layout.rect.bottom, size).toBeLessThanOrEqual(height);
    expect(layout.close.bottom, `${size}: Close stays in the window`).toBeLessThanOrEqual(height);
    expect(layout.close.height, `${size}: Close is a usable target`).toBeGreaterThanOrEqual(30);
    expect(layout.clipped, `${size}: nothing is cut off`).toEqual([]);
    // Every line but the one on file from an older save leads somewhere.
    expect(layout.goes).toHaveLength(6);
    for (const go of layout.goes) {
      expect(go.height, `${size}: a way there is a usable target`).toBeGreaterThanOrEqual(30);
      expect(go.inside, `${size}: a way there stays on its line`).toBe(true);
    }
    expect(layout.smallest, `${size}: readable text`).toBeGreaterThanOrEqual(11);
  }
  // In the smallest window the file scrolls within its paper, its action pinned.
  await page.setViewportSize({ width: 320, height: 420 });
  await page.waitForTimeout(250);
  const last = report.locator('.observation__foot');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await expect(report.locator('.popup__actions button')).toBeInViewport();
});

test('works by keyboard, in high contrast and with reduced motion (English)', async ({ page }) => {
  await boot(
    page,
    company((s, now) => {
      busy(s, now);
      s.settings.highContrast = true;
    }, 'en'),
    800,
    600,
  );
  await openView(page, 'company');
  const open = page.locator('.observation-open');
  await expect(open).toHaveText(text('observation.open', 'en'));
  await open.focus();
  await page.keyboard.press('Enter');
  const report = page.locator('.observation-popup');
  await expect(report).toBeVisible();
  await expect(report.locator('.observation__title')).toHaveText(text('observation.title', 'en'));
  const focusInside = () =>
    page.evaluate(() => !!document.activeElement?.closest('.observation-popup'));
  await expect.poll(focusInside).toBe(true);
  // The keyboard goes round the file and stays in it, either way round.
  await page.keyboard.press('Shift+Tab');
  await expect(report.locator('.popup__actions button')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await focusInside()).toBe(true);
  const stops = await report.locator('button').count();
  for (let i = 0; i < stops + 2; i += 1) {
    await page.keyboard.press('Tab');
    expect(await focusInside()).toBe(true);
  }

  // High contrast: black words and frames; reduced motion: nothing animates in.
  expect(await page.evaluate(() => document.documentElement.dataset.highContrast)).toBe('true');
  const looks = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      mark: style('.observation__mark[data-stamp="team"]').color,
      row: style('.observation__row').borderTopColor,
      bar: style('.observation__redacted').backgroundColor,
      popup: style('.observation-popup').animationName,
    };
  });
  expect(looks.mark).toBe('rgb(0, 0, 0)');
  expect(looks.row).toBe('rgb(0, 0, 0)');
  expect(looks.bar).not.toBe('rgba(0, 0, 0, 0)');
  expect(looks.popup).toBe('none');

  // English copy, and the way to what is waiting lands on its ticket.
  const waiting = report.locator('.observation__row[data-stamp="waiting"]');
  await expect(waiting).toContainText(text('observation.stampWaiting', 'en'));
  const go = waiting.locator('.observation__go');
  await expect(go).toHaveAttribute(
    'aria-label',
    fill(text('observation.goLabel', 'en'), { room: text(ROOMS_BY_ID.marketing.nameKey, 'en') }),
  );
  await go.focus();
  await page.keyboard.press('Enter');
  await expect(report).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.activeElement?.closest('.floor[data-room="marketing"] .office-incident') ? 1 : 0,
      ),
    )
    .toBe(1);
});
