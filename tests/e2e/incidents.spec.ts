import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { ROOMS } from '../../src/content/rooms';
import type { GameState } from '../../src/sim/types';

/**
 * Gameplay chapter 4: things happen in the office, through the real DOM.
 *
 * Something starts happening in a room and waits there: the teammate who
 * noticed it holds up a ticket, the room's name and the elevator say so, and
 * nothing opens until the player looks. The card is set in that room with the
 * people it is about; the outcome is the same card turned over. What was set in
 * motion turns up later in the world, and people bring up what they remember.
 */

const LOCALES = Object.fromEntries(
  ['en', 'pt-BR'].map((locale) => [
    locale,
    JSON.parse(
      readFileSync(new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'),
    ) as unknown,
  ]),
);
const text = (key: string, locale = 'en') =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)[part],
      LOCALES[locale],
    ) as string;

const NOW = Date.now();

function company(mutate: (s: GameState) => void, language = 'en'): GameState {
  const s = createInitialState(NOW);
  s.onboardingComplete = true;
  s.resources.nuts = 100_000;
  s.resources.goldenNuts = 5;
  s.resources.morale = 60;
  s.resources.reputation = 2_000;
  for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
  s.stats.totalClicks = 200;
  s.stats.playTimeSeconds = 5_000;
  s.settings.language = language;
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

/** The rebrand has started happening in the marketing burrow; Corvus noticed it. */
function rebrandWaiting(s: GameState) {
  staff(s, 'marketing', ['corvus', 'rosa']);
  s.happenings = {
    incidents: [
      {
        id: 'incident-the-rebrand-e2e',
        eventId: 'the-rebrand',
        roomId: 'marketing',
        employeeId: 'corvus',
        at: NOW - 5_000,
        until: NOW + 3_600_000,
      },
    ],
    remarks: [],
    diary: [],
    sinceRare: 0,
  };
}

async function boot(page: Page, state: GameState, width: number, height: number) {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    }
    localStorage.setItem('wmno.lang', save.settings.language);
  }, state);
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

async function goTo(page: Page, roomId: string) {
  const floor = page.locator(`.floor[data-room="${roomId}"]`);
  await floor.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  return floor;
}

/** Flush a save and read it back. */
const saved = (page: Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem('wmno.save.v1')!) as GameState;
  });

test('something happening waits in its room until the player looks into it', async ({ page }) => {
  await boot(page, company(rebrandWaiting), 1280, 720);
  const floor = await goTo(page, 'marketing');
  // The room says so, and Corvus holds up a ticket. No card has opened.
  await expect(floor).toHaveAttribute('data-incident', 'uncommon');
  const ticket = floor.locator('.office-incident[data-employee="corvus"]');
  await expect(ticket).toBeVisible();
  await expect(page.locator('.event-modal')).toHaveCount(0);
  // The elevator knows which floor.
  await page.locator('.elevator__list-btn').click();
  await expect(page.locator('.elevator__floors .elevator__floor-news--incident')).toHaveCount(1);
  await page.locator('.elevator__list-btn').click();

  // It is still waiting after a reload.
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const again = await goTo(page, 'marketing');
  await expect(again.locator('.office-incident[data-employee="corvus"]')).toBeVisible();
  expect((await saved(page)).happenings.incidents.map((item) => item.eventId)).toContain(
    'the-rebrand',
  );
});

test('the card is set where it happens, and the outcome is the same card turned over', async ({
  page,
}) => {
  await boot(page, company(rebrandWaiting), 1280, 720);
  const floor = await goTo(page, 'marketing');
  await floor.locator('.office-incident[data-employee="corvus"]').click();

  const card = page.locator('.event-modal');
  await expect(card).toBeVisible();
  const scene = card.locator('.incident-scene');
  await expect(scene).toHaveAttribute('data-room', 'marketing');
  await expect(scene.locator('[data-employee="corvus"]')).toHaveCount(1);
  await expect(scene.locator('[data-employee="rosa"]')).toHaveCount(1);
  await expect(scene).toContainText(text('incident.stamp.uncommon'));
  await expect(card).toContainText(text('incident.rebrand.title'));

  await card.locator('.event-choice[data-option-id="both"]').click();
  const outcome = page.locator('.consequence-modal');
  await expect(outcome).toBeVisible();
  await expect(outcome.locator('.incident-scene[data-told="true"]')).toHaveAttribute(
    'data-room',
    'marketing',
  );
  // What happened, in their words, before the numbers.
  await expect(outcome.locator('.consequence-reaction').first()).toHaveText(
    text('incident.rebrand.bothReply'),
  );
  await expect(outcome.locator('.consequence-line').first()).toBeVisible();
  // Some of it is only hinted at; someone will remember.
  await expect(outcome.locator('.consequence-note--motion')).toHaveText(text('incident.inMotion'));
  await expect(outcome.locator('.consequence-note--memory')).toContainText('Corvus');
  await outcome.locator('.popup__actions button').click();
  await expect(outcome).toHaveCount(0);

  // Decided, and remembered, across a reload.
  await expect(floor.locator('.office-incident')).toHaveCount(0);
  const save = await saved(page);
  expect(save.eventHistory.map((entry) => entry.eventId)).toContain('the-rebrand');
  expect(save.happenings.incidents).toEqual([]);
  expect(save.happenings.remarks.map((remark) => remark.employeeId)).toContain('corvus');
  expect(
    save.scheduled.some((item) =>
      item.effects.some(
        (effect) => effect.type === 'oddity' && effect.oddityId === 'neon-pink-sign',
      ),
    ),
  ).toBe(true);
});

test('asking the teammate who noticed it: once to hear it, twice to look', async ({ page }) => {
  await boot(page, company(rebrandWaiting), 1280, 720);
  const floor = await goTo(page, 'marketing');
  const corvus = floor.locator('.critter-btn[data-employee="corvus"]');
  await corvus.click();
  await expect(page.locator('.speech-note')).toContainText(text('incident.rebrand.hook'));
  await corvus.click();
  await expect(page.locator('.event-modal')).toBeVisible();
  await expect(page.locator('.event-modal .incident-scene')).toHaveAttribute(
    'data-room',
    'marketing',
  );
});

for (const [width, height] of [
  [320, 420],
  [380, 460],
  [1280, 720],
] as const) {
  test(`the card and its outcome fit at ${width}x${height} in Portuguese`, async ({ page }) => {
    await boot(page, company(rebrandWaiting, 'pt-BR'), width, height);
    const floor = await goTo(page, 'marketing');
    // A direct activation: at a corner size a notice may sit over the room.
    await floor
      .locator('.office-incident[data-employee="corvus"]')
      .evaluate((el: HTMLElement) => el.click());
    const card = page.locator('.event-modal');
    await expect(card).toContainText(text('incident.rebrand.title', 'pt-BR'));
    const fits = async (selector: string) =>
      page.evaluate((sel) => {
        const popup = document.querySelector('.popup')!.getBoundingClientRect();
        const items = [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect());
        return {
          popup:
            popup.left >= 0 &&
            popup.top >= 0 &&
            popup.right <= innerWidth &&
            popup.bottom <= innerHeight,
          items: items.every(
            (r) => r.width > 0 && r.top >= popup.top - 1 && r.bottom <= popup.bottom + 1,
          ),
          count: items.length,
          wide: document.documentElement.scrollWidth > innerWidth,
        };
      }, selector);
    const ask = await fits('.event-choice, .incident-scene, .event-modal__body');
    expect(ask).toEqual({ popup: true, items: true, count: 5, wide: false });

    await card.locator('.event-choice[data-option-id="pink"]').click();
    const outcome = page.locator('.consequence-modal');
    await expect(outcome.locator('.consequence-reaction')).toHaveText(
      text('incident.rebrand.pinkReply', 'pt-BR'),
    );
    const told = await fits('.incident-scene, .consequence-reaction, .popup__actions button');
    expect(told).toEqual({ popup: true, items: true, count: 3, wide: false });
  });
}

test('a promise lands in the world: the bet pays off in the lab, out loud', async ({ page }) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'lab', ['quincy', 'nixie']);
      s.scheduled = [
        {
          id: 'bug-bounty:e2e',
          at: NOW + 6_000,
          sourceEventId: 'bug-bounty',
          titleKey: 'incident.bugBounty.title',
          bodyKey: 'incident.bugBounty.body',
          effects: [{ type: 'moment', momentId: 'lunch-bet' }],
          quiet: true,
        },
      ];
    }),
    1280,
    720,
  );
  const floor = await goTo(page, 'lab');
  // No notice: the room plays it out.
  await expect(floor.locator('.office-slip--moment')).toContainText(text('scene.lunch-bet.title'), {
    timeout: 15_000,
  });
  await expect(page.locator('.speech-note')).toContainText(text('scene.lunch-bet.line1'));
  await expect(page.locator('.speech-note')).toContainText(text('scene.lunch-bet.line2'), {
    timeout: 6_000,
  });
  await expect(page.locator('.toasts')).not.toContainText(text('incident.bugBounty.title'));
});

test('a teammate brings up a choice they remember, unprompted, when their floor is in view', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      staff(s, 'security', ['bia']);
      s.flags['trusted-bia'] = NOW - 600_000;
      s.happenings = {
        incidents: [],
        remarks: [{ employeeId: 'bia', key: 'memory.trustedBia', at: NOW - 1_000 }],
        diary: [],
        sinceRare: 0,
      };
    }, 'pt-BR'),
    1280,
    720,
  );
  await goTo(page, 'security');
  await expect(page.locator('.speech-note')).toContainText(text('memory.trustedBia', 'pt-BR'), {
    timeout: 6_000,
  });
  // Said once; it is not waiting any more.
  await expect.poll(async () => (await saved(page)).happenings.remarks.length).toBe(0);
});
