import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { ROOMS } from '../../src/content/rooms';
import type { GameState } from '../../src/sim/types';
import { openView } from './support/shell';

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

/**
 * A company filed a moment ago. Every timestamp is taken from the moment the
 * save is made, never from when this file was loaded: a worker that ran other
 * tests first used to boot a company (and a promise "due in six seconds") that
 * was really filed a minute earlier.
 */
function company(mutate: (s: GameState, now: number) => void, language = 'en'): GameState {
  const now = Date.now();
  const s = createInitialState(now);
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
  mutate(s, now);
  return s;
}

function staff(s: GameState, roomId: string, ids: string[], friendship = 30) {
  for (const id of ids) {
    s.employees[id] = { ...s.employees[id], hired: true, level: 3, friendship, room: roomId };
  }
}

/** The rebrand has started happening in the marketing burrow; Corvus noticed it. */
function rebrandWaiting(s: GameState, now: number) {
  staff(s, 'marketing', ['corvus', 'rosa']);
  s.happenings = {
    incidents: [
      {
        id: 'incident-the-rebrand-e2e',
        eventId: 'the-rebrand',
        roomId: 'marketing',
        employeeId: 'corvus',
        at: now - 5_000,
        until: now + 3_600_000,
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

/** The bet made in the lab (the bug bounty's contest), due `inMs` after the save is made. */
function betDue(inMs: number) {
  return (s: GameState, now: number) => {
    staff(s, 'lab', ['quincy', 'nixie']);
    s.scheduled = [
      {
        id: 'bug-bounty:e2e',
        at: now + inMs,
        sourceEventId: 'bug-bounty',
        titleKey: 'incident.bugBounty.title',
        bodyKey: 'incident.bugBounty.body',
        effects: [{ type: 'moment', momentId: 'lunch-bet' }],
        quiet: true,
      },
    ];
  };
}

test('a promise lands in the world: the bet pays off in the lab, out loud', async ({ page }) => {
  await boot(page, company(betDue(6_000)), 1280, 720);
  // The view stays on the lab (the boot's own trip home used to pull it back).
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

test('a promise that lands while the player is on another floor waits to be seen there', async ({
  page,
}) => {
  await boot(page, company(betDue(1_500)), 1280, 720);
  // The bet comes due while the Founder's Desk is in view, and is paid once...
  await expect
    .poll(async () => {
      const save = await saved(page);
      return [
        save.scheduled.length,
        save.happenings.diary.filter((e) => e.kind === 'moment').length,
      ];
    })
    .toEqual([0, 1]);
  const lab = page.locator('.floor[data-room="lab"]');
  await expect(lab).toHaveAttribute('data-onscreen', 'false');
  await expect(lab.locator('.office-slip--moment')).toHaveCount(0);
  // ...and plays out when the player gets to the lab, not before.
  await goTo(page, 'lab');
  await expect(lab.locator('.office-slip--moment')).toContainText(text('scene.lunch-bet.title'), {
    timeout: 6_000,
  });
  await expect(page.locator('.speech-note')).toContainText(text('scene.lunch-bet.line1'));
  await expect(page.locator('.speech-note')).toContainText(text('scene.lunch-bet.line2'), {
    timeout: 6_000,
  });
  expect((await saved(page)).happenings.diary.filter((e) => e.kind === 'moment').length).toBe(1);
});

test('a teammate brings up a choice they remember, unprompted, when their floor is in view', async ({
  page,
}) => {
  await boot(
    page,
    company((s, now) => {
      staff(s, 'security', ['bia']);
      s.flags['trusted-bia'] = now - 600_000;
      s.happenings = {
        incidents: [],
        remarks: [{ employeeId: 'bia', key: 'memory.trustedBia', at: now - 1_000 }],
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

test('each answer says what it will do, and the people it is about react on the card', async ({
  page,
}) => {
  await boot(page, company(rebrandWaiting), 1280, 720);
  const floor = await goTo(page, 'marketing');
  await floor.locator('.office-incident[data-employee="corvus"]').click();
  const card = page.locator('.event-modal');
  await expect(card).toBeVisible();

  // What it costs and pays, who it changes, the room it changes: said before choosing.
  const neon = card.locator('.event-choice[data-option-id="neon"]');
  const effects = neon.locator('.event-choice__effects');
  await expect(effects).toContainText('+5 reputation');
  await expect(effects).toContainText('Rosa ends up sad');
  await expect(effects).toContainText('Marketing Burrow: Buzz mode');
  await expect(neon).toHaveAttribute('aria-describedby', (await effects.getAttribute('id'))!);
  // Only the answer that sets something in motion says it may come back.
  await expect(card.locator('.event-choice[data-option-id="both"]')).toContainText(
    text('event.effects.later'),
  );
  await expect(neon).not.toContainText(text('event.effects.later'));

  // Pointing at an answer: the two of them show how they would take it.
  const scene = card.locator('.incident-scene');
  await expect(scene.locator('[data-reacting="true"]')).toHaveCount(0);
  const pink = card.locator('.event-choice[data-option-id="pink"]');
  await pink.hover();
  await expect(pink).toHaveAttribute('data-considered', 'true');
  await expect(
    scene.locator('[data-employee="corvus"][data-reacting="true"] .sticker'),
  ).toHaveCount(1);
  await expect(scene.locator('[data-employee="rosa"][data-reacting="true"] .sticker')).toHaveCount(
    1,
  );
  // ...and by keys, the same.
  await page.mouse.move(2, 2);
  await expect(scene.locator('[data-reacting="true"]')).toHaveCount(0);
  await neon.focus();
  await page.keyboard.press('Tab');
  await expect(pink).toBeFocused();
  await expect(pink).toHaveAttribute('data-considered', 'true');

  // Taking it does what it said, and the outcome shows them taking it.
  const before = await saved(page);
  await page.keyboard.press('Enter');
  const outcome = page.locator('.consequence-modal');
  await expect(outcome).toBeVisible();
  await expect(
    outcome.locator('.incident-scene [data-employee="rosa"][data-reacting="true"]'),
  ).toHaveCount(1);
  await expect(outcome.locator('.consequence-line').first()).toContainText('Morale +5');
  const after = await saved(page);
  expect(after.office.rooms.marketing?.mode).toBe('brand');
  expect(after.employees.rosa.emotion?.id).toBe('proud');
  expect(after.eventHistory.at(-1)).toMatchObject({ eventId: 'the-rebrand', choiceId: 'pink' });
  expect(after.resources.morale).toBeGreaterThan(before.resources.morale + 3);
  await outcome.locator('.popup__actions button').click();

  // The choice holds after a reload: the burrow still runs the campaign it called for.
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const reloaded = await saved(page);
  expect(reloaded.office.rooms.marketing?.mode).toBe('brand');
  expect(reloaded.flags['rebrand.pink']).toBeTruthy();
});

test('what was noticed can be picked up in the Archive, with where it came from and led', async ({
  page,
}) => {
  await boot(
    page,
    company((s, now) => {
      staff(s, 'cafeteria', ['marlow']);
      staff(s, 'marketing', ['corvus', 'rosa']);
      for (const id of ['soup-week', 'missing-stapler', 'neon-pink-sign'])
        s.flags[`oddity.${id}`] = now - 3_600_000;
      s.flags['rebrand.neonpink'] = now - 7_200_000;
      s.flags['soup.named'] = now - 1_800_000;
      s.flags['soup.done'] = now - 1_800_000;
      s.eventHistory.push({ eventId: 'soup-week-two', choiceId: 'name', at: now - 1_800_000 });
    }, 'pt-BR'),
    380,
    460,
  );
  const open = async () => {
    await openView(page, 'collections');
    await page.locator('.view--collections .tab').last().click();
    return page.locator('.curiosity-log');
  };
  let log = await open();
  // The clue still open heads the board; the one already followed does not.
  const leads = log.locator('.curiosity-lead');
  await expect(leads).toHaveCount(1);
  await expect(leads.first()).toContainText(text('oddity.missing-stapler.lead', 'pt-BR'));
  // Where it points stays a blank, only marked.
  await expect(log.locator('.curiosity.is-pointed')).toHaveCount(1);
  await expect(log).not.toContainText(text('oddity.stapler-return.title', 'pt-BR'));

  // Picked up: the thing itself, and the decision it came out of.
  await log.locator('.curiosity[data-oddity="neon-pink-sign"] .curiosity__card').click();
  const file = log.locator('.curiosity-file[data-oddity="neon-pink-sign"]');
  await expect(file).toContainText(text('oddity.neon-pink-sign.found', 'pt-BR'));
  await expect(file).toContainText(text('incident.rebrand.title', 'pt-BR'));
  await expect(file).toContainText(text('incident.rebrand.both', 'pt-BR'));
  // Another: where the soup led, and the call that was made.
  await log.locator('.curiosity[data-oddity="soup-week"] .curiosity__card').click();
  const soup = log.locator('.curiosity-file[data-oddity="soup-week"]');
  await expect(soup).toContainText(text('incident.soup.title', 'pt-BR'));
  await expect(soup).toContainText(text('incident.soup.name', 'pt-BR'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  // All of it is still there after a reload.
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  log = await open();
  await log.locator('.curiosity[data-oddity="soup-week"] .curiosity__card').click();
  await expect(log.locator('.curiosity-file[data-oddity="soup-week"]')).toContainText(
    text('incident.soup.name', 'pt-BR'),
  );
  await expect(log.locator('.curiosity-lead')).toHaveCount(1);
});
