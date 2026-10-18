import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { ROOMS } from '../../src/content/rooms';
import type { GameState } from '../../src/sim/types';
import { openView } from './support/shell';

/**
 * Chapter 7: stories, keepsakes and personal history, through the real DOM.
 *
 * A story part says, as it ends, where the story stands and what it set going;
 * the end of a story puts their keepsake on their desk and says so; an answer that
 * costs something says it first; the Album files what you said beside what they
 * said, names no story before it begins and opens on the keepsake from the object
 * itself, in the visit or in the office; all of it is there after a reload.
 */

const LOCALES: Record<string, unknown> = {
  en: JSON.parse(readFileSync(new URL('../../src/i18n/locales/en.json', import.meta.url), 'utf8')),
  'pt-BR': JSON.parse(
    readFileSync(new URL('../../src/i18n/locales/pt-BR.json', import.meta.url), 'utf8'),
  ),
};
const text = (key: string, lang = 'pt-BR') =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)[part],
      LOCALES[lang],
    ) as string;
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');

/** A company filed a moment ago, every room open, timestamps from now. */
function company(mutate: (s: GameState, now: number) => void, lang = 'pt-BR'): GameState {
  const now = Date.now();
  const s = createInitialState(now);
  s.onboardingComplete = true;
  s.resources.nuts = 100_000;
  s.resources.goldenNuts = 5;
  s.resources.morale = 70;
  s.resources.reputation = 2_000;
  for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
  s.stats.totalClicks = 200;
  s.stats.playTimeSeconds = 5_000;
  s.settings.language = lang;
  s.settings.reducedMotion = true;
  s.settings.showHints = false;
  mutate(s, now);
  return s;
}

function hire(s: GameState, id: string, friendship: number, room: string) {
  s.employees[id] = { ...s.employees[id], hired: true, level: 3, friendship, room };
}

/** Otto, with Part 1 told an hour ago and the stage it was told at. */
function ottoMidStory(s: GameState, now: number, friendship: number, parts = 1) {
  hire(s, 'otto', friendship, 'procurement');
  hire(s, 'rizzo', 30, 'procurement');
  s.flags['otto.tier.1'] = now - 4_000_000;
  s.flags['otto.tier.2'] = now - 3_900_000;
  s.flags['otto.arc.1'] = now - 3_600_000;
  s.flags['otto.arc.1.b'] = now - 3_600_000;
  const seen: Record<string, number> = { 'story-otto-1': now - 3_600_000 };
  if (parts >= 2) {
    s.flags['otto.tier.3'] = now - 2_000_000;
    s.flags['otto.arc.2'] = now - 1_800_000;
    s.flags['otto.arc.2.a'] = now - 1_800_000;
    seen['story-otto-2'] = now - 1_800_000;
  }
  s.employees.otto.talks = { count: parts, lastAt: now - 1_800_000, seen };
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

async function visit(page: Page, id: string) {
  await openView(page, 'employees');
  const button = page.locator(`.employee-card__talk[data-employee="${id}"]`);
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await page.locator('.visit').waitFor({ timeout: 8_000 });
}

const saved = (page: Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem('wmno.save.v1')!) as GameState;
  });

test('a story part says, as it ends, where the story stands and what it set going', async ({
  page,
}) => {
  await boot(
    page,
    company((s, now) => ottoMidStory(s, now, 45)),
    380,
    460,
  );
  await visit(page, 'otto');
  await expect(page.locator('.visit')).toHaveAttribute('data-topic', 'story-otto-2');
  await page.locator('.talk-choice[data-option-id="a"]').click();
  await expect(page.locator('.talk__said--reply')).toContainText(text('arc.otto.2.a.reply'));
  const after = page.locator('.visit__after');
  await expect(after.locator('.visit__after-note--story')).toHaveText(
    fill(text('visit.storyWaiting.friendship'), { tier: text('bond.tier.close') }),
  );
  await expect(after.locator('.visit__after-note--later')).toHaveText(text('incident.inMotion'));
  // ...and nothing it did not do.
  await expect(after.locator('.visit__after-note--remembered')).toHaveCount(0);
  // The whole end of it fits a corner window, with the way out on screen.
  const fits = await page.evaluate(() => {
    const done = document.querySelector('.talk__done')!.getBoundingClientRect();
    return done.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
  });
  expect(fits).toBe(true);

  // The Album files what you said, beside what they said back.
  await page.locator('.visit__tab[data-tab="scrapbook"]').click();
  const part2 = page.locator('.scrap--story').first();
  await expect(part2.locator('.scrap__said')).toHaveText(
    fill(text('scrapbook.youSaid'), { line: text('arc.otto.2.a.label') }),
  );
  await expect(part2.locator('.scrap__quote')).toHaveText(text('arc.otto.2.a.reply'));
  // The promised payoff is waiting, saved.
  expect((await saved(page)).scheduled.map((item) => item.effects[0]?.type)).toEqual(['find']);
});

test('the end of a story puts their keepsake on the desk, and the Album opens on it', async ({
  page,
}) => {
  await boot(
    page,
    company((s, now) => ottoMidStory(s, now, 75, 2)),
    320,
    420,
  );
  await visit(page, 'otto');
  await expect(page.locator('.visit')).toHaveAttribute('data-topic', 'story-otto-3');
  // Part 3 opens on what you said in Part 1 (the box for the pebble).
  await expect(page.locator('.talk__said')).toContainText(text('arc.otto.3.prompt.b'));
  await page.locator('.talk-choice[data-option-id="b"]').click();
  const reveal = page.locator('.visit__reveal');
  await expect(reveal).toContainText(text('item.ledger'));
  await expect(reveal).toContainText(text('visit.keepsake.revealed'));
  await expect(page.locator('.visit__after-note--story')).toHaveText(
    text('visit.storyWaiting.done'),
  );
  await expect(page.locator('.visit__after-note--moment')).toHaveText(text('visit.momentFiled'));
  // The ledger is by him in the scene now.
  await expect(page.locator('.visit__keepsake[data-employee="otto"]')).toBeVisible();
  const fits = await page.evaluate(() => {
    const see = document.querySelector('.visit__reveal-see')!.getBoundingClientRect();
    return (
      see.height >= 30 &&
      see.right <= innerWidth &&
      document.documentElement.scrollWidth <= innerWidth
    );
  });
  expect(fits).toBe(true);

  await page.locator('.visit__reveal-see').click();
  await expect(page.locator('.visit')).toHaveAttribute('data-tab', 'scrapbook');
  const card = page.locator('.visit-keepsake[data-employee="otto"]');
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute('data-placed', 'desk');
  await expect(card).toContainText(
    fill(text('visit.keepsake.sinceStory'), { story: text('arc.otto.title') }),
  );
  await expect(page.locator('.visit__story-line')).toContainText(text('visit.storyWaiting.done'));

  // Kept after a reload.
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await visit(page, 'otto');
  await page.locator('.visit__keepsake[data-employee="otto"]').click();
  await expect(page.locator('.visit-keepsake[data-employee="otto"]')).toBeFocused();
  expect((await saved(page)).flags['otto.arc.done']).toBeTruthy();
});

test('looking after a keepsake says its price first, and it stays on the desk', async ({
  page,
}) => {
  await boot(
    page,
    company((s, now) => {
      hire(s, 'bea', 25, 'construction');
      s.flags['bea.tier.1'] = now - 3_600_000;
    }),
    800,
    600,
  );
  await visit(page, 'bea');
  await page.locator('.talk__agenda summary').click();
  await page
    .locator('.talk__agenda')
    .getByRole('button', { name: text('item.plank'), exact: true })
    .click();
  await expect(page.locator('.talk__said')).toContainText(text('keepsake.bea.prompt'));
  const care = page.locator('.talk-choice[data-option-id="care"]');
  // What it costs, before it is taken; the other answer costs nothing.
  await expect(care.locator('.talk-choice__cost')).toContainText('180');
  await expect(care).toHaveAccessibleName(
    new RegExp(fill(text('talk.cost.nuts'), { value: '180' })),
  );
  await expect(page.locator('.talk-choice[data-option-id="other"] .talk-choice__cost')).toHaveCount(
    0,
  );
  const nuts = (await saved(page)).resources.nuts;
  await care.click();
  await expect(page.locator('.visit__reveal')).toContainText(text('item.plank'));
  // Beta: her desk.
  await expect(page.locator('.visit__reveal')).toContainText(
    text('visit.keepsake.revealed_female'),
  );
  // It took what it said: measured across the answer itself (the office keeps
  // earning between two saves, so the balance alone cannot say how much).
  await expect(
    page.locator('.talk__changed li.is-neg', { hasText: text('resource.nuts') }).locator('b'),
  ).toHaveText('-180');
  const after = await saved(page);
  expect(after.resources.nuts).toBeLessThan(nuts);
  expect(after.flags['favorite.bea.cared']).toBeTruthy();

  await page.locator('.visit__tab[data-tab="scrapbook"]').click();
  const card = page.locator('.visit-keepsake[data-employee="bea"]');
  await expect(card).toContainText(
    fill(text('visit.keepsake.sinceTalk'), { choice: text('keepsake.bea.care.label') }),
  );
  await expect(page.locator('.scrap--keepsake .scrap__quote')).toHaveText(
    text('keepsake.bea.care.reply'),
  );
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await visit(page, 'bea');
  await page.locator('.visit__tab[data-tab="scrapbook"]').click();
  await expect(page.locator('.visit-keepsake[data-employee="bea"]')).toHaveAttribute(
    'data-placed',
    'desk',
  );
});

test('a new face’s Album names no story and shows no keepsake', async ({ page }) => {
  await boot(
    page,
    company((s) => hire(s, 'nino', 4, 'meeting')),
    380,
    460,
  );
  await visit(page, 'nino');
  await page.locator('.visit__tab[data-tab="scrapbook"]').click();
  const book = page.locator('.visit__scrapbook');
  await expect(book).not.toContainText(text('arc.nino.title'));
  await expect(book).toContainText(fill(text('visit.storyUnnamed'), { name: 'Nino' }));
  await expect(book).toContainText(
    fill(text('visit.storyWaiting.first'), { tier: text('bond.tier.familiar') }),
  );
  await expect(page.locator('.visit-keepsake')).toHaveCount(0);
  await expect(page.locator('.visit')).not.toContainText(text('item.cushion'));
});

test('a keepsake on display in the office opens its card in their Album', async ({ page }) => {
  await boot(
    page,
    company((s, now) => {
      hire(s, 'bea', 30, 'construction');
      s.flags['favorite.bea.cared'] = now - 600_000;
      s.employees.bea.talks = {
        count: 1,
        lastAt: now - 600_000,
        seen: { 'keepsake-bea': now - 600_000 },
      };
    }),
    1280,
    720,
  );
  const floor = page.locator('.floor[data-room="construction"]');
  await floor.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const object = floor.locator('.office-keepsake[data-employee="bea"]');
  await expect(object).toBeVisible();
  await expect(object).toHaveAccessibleName(
    fill(text('visit.keepsake.seeItem'), { item: text('item.plank') }),
  );
  await object.hover();
  await expect(page.locator('.tooltip')).toContainText(text('item.plank'));
  await object.click();
  await expect(page.locator('.visit')).toHaveAttribute('data-tab', 'scrapbook');
  await expect(page.locator('.visit-keepsake[data-employee="bea"]')).toContainText(
    text('keepsake.bea.scene'),
  );
});

test('what you told them in Part 1 comes back in the office, unprompted, once', async ({
  page,
}) => {
  await boot(
    page,
    company((s, now) => {
      hire(s, 'otto', 25, 'procurement');
      s.flags['otto.arc.1'] = now - 400_000;
      s.flags['otto.arc.1.b'] = now - 400_000;
      s.happenings = {
        incidents: [],
        remarks: [{ employeeId: 'otto', key: 'arc.otto.callback.b', at: now - 1_000 }],
        diary: [],
        sinceRare: 0,
      };
    }),
    1280,
    720,
  );
  const floor = page.locator('.floor[data-room="procurement"]');
  await floor.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(page.locator('.speech-note')).toContainText(text('arc.otto.callback.b'), {
    timeout: 6_000,
  });
  await expect.poll(async () => (await saved(page)).happenings.remarks.length).toBe(0);
});

test('answering Part 1 in a visit sets that line aside for a few minutes later', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => hire(s, 'marlow', 20, 'morale')),
    380,
    460,
  );
  await visit(page, 'marlow');
  await expect(page.locator('.visit')).toHaveAttribute('data-topic', 'story-marlow-1');
  const answered = Date.now();
  await page.locator('.talk-choice[data-option-id="a"]').click();
  // Said as it ends: Marlow (Bento, in Portuguese) will bring it up.
  await expect(page.locator('.visit__after-note--remembered')).toHaveText(
    fill(text('incident.remembered'), { name: text('employee.marlow.name') }),
  );
  const [remark] = (await saved(page)).happenings.remarks;
  expect(remark).toMatchObject({ employeeId: 'marlow', key: 'arc.marlow.callback.a' });
  // About five minutes from now, not now.
  expect(remark.at - answered).toBeGreaterThan(290_000);
  expect(remark.at - answered).toBeLessThan(320_000);
});
