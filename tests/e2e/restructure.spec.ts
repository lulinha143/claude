import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { evaluateAchievements } from '../../src/sim/achievements';
import { ensureDailyForDate } from '../../src/sim/dailyChallenges';
import { ROOMS } from '../../src/content/rooms';
import { EMPLOYEES_BY_ID } from '../../src/content/employees';
import { keepsakeFlag } from '../../src/content/employeeKeepsakes';
import type { GameState } from '../../src/sim/types';

/**
 * Chapter 10: progression, collections and the restructure, through the real DOM.
 *
 * The guide offers a restructure once a cycle and says what it pays; the continuity
 * file says what stays and what starts over; the confirmation restates the trade,
 * Escape steps back, and a double press restructures once, kept after a reload. The
 * new cycle shows its progress toward the next line and a goal to buy. The
 * Collections cabinet counts what the player has from where it was earned, opens a
 * drawer at its head, names nothing not yet found, and Escape steps back.
 */

const PT = JSON.parse(
  readFileSync(new URL('../../src/i18n/locales/pt-BR.json', import.meta.url), 'utf8'),
);
const text = (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], PT) as string;
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));

/** A company a few hours in, in Portuguese, with a cycle past the restructure line. */
function company(mutate: (s: GameState) => void = () => undefined): GameState {
  const now = Date.now();
  const s = createInitialState(now - 86_400_000);
  s.lastSaved = now;
  s.onboardingComplete = true;
  s.settings.language = 'pt-BR';
  s.settings.reducedMotion = true;
  s.settings.showHints = true;
  s.resources.nuts = 2_000_000;
  s.resources.goldenNuts = 9;
  s.resources.reputation = 4_000;
  for (const room of ROOMS) if (room.unlock.upgradeId) s.upgrades[room.unlock.upgradeId] = 1;
  s.stats.totalNutsEarned = 4_200_000;
  s.stats.playTimeSeconds = 9_000;
  s.stats.microgamesPlayed = 3;
  for (const id of ['marlow', 'otto', 'bea']) {
    s.employees[id] = {
      ...s.employees[id],
      hired: true,
      level: 3,
      friendship: 30,
      room: 'sorting',
    };
  }
  s.employees.pip.talks = { count: 2, lastAt: 0, seen: {} };
  s.collections.secrets.push('deco:potted-fern');
  // Nothing waiting in the building, so the guide's next word is the restructure.
  for (const id of ['broadcast', 'repair', 'conservatory', 'archive', 'security', 'incubator'])
    s.flags[`discovery.${id}`] = now - 1_000;
  // Today's assignments, all claimed (a restructure must not let them be claimed again).
  s.daily = ensureDailyForDate(undefined, now);
  s.daily.challenges = s.daily.challenges.map((c) => ({ ...c, progress: c.goal, claimed: true }));
  mutate(s);
  // What the save has already earned is filed with it (no catch-up note on boot).
  evaluateAchievements(s, now);
  return s;
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
  await page.waitForTimeout(400);
}

/** The save after asking the game to write it (as closing the window does). */
const saved = (page: Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem('wmno.save.v1')!) as GameState;
  });

async function openArchive(page: Page, view: 'prestige' | 'collections' | 'achievements') {
  if (!(await page.locator('.sheet').count())) {
    await page.locator('.dock__item[data-dock="archive"]').click();
  }
  await page.locator(`.sheet__tab[data-view="${view}"]`).click();
  await page.locator(`.sheet[data-sheet="${view}"]`).waitFor();
}

test('the guide offers the restructure once, and the file says what stays and what starts over', async ({
  page,
}) => {
  await boot(page, company(), 380, 460);
  await expect(page.locator('.dock__item[data-dock="archive"] .dock__dot')).toHaveCount(1);
  await expect(page.locator('.next-hint')).toContainText(text('nextStep.prestige'));
  await expect(page.locator('.next-hint__why')).toContainText(
    fill(text('nextStep.why.prestige_other'), { count: 2 }),
  );

  await openArchive(page, 'prestige');
  const file = page.locator('.restructure-file');
  await expect(file.locator('.restructure-gain')).toContainText(
    fill(text('prestige.kernelsEarned_other'), { count: 2 }),
  );
  const kept = file.locator('.restructure-list--kept');
  await expect(kept.locator('[data-line="golden"]')).toBeVisible();
  await expect(kept).toContainText(text('prestige.kept.identity'));
  const reset = file.locator('.restructure-list--reset');
  await expect(reset.locator('[data-line="hires"]')).toContainText(
    fill(text('prestige.reset.hires_other'), { count: 3, founder: 'Tico' }),
  );
  await expect(reset.locator('[data-line="rooms"]')).toBeVisible();
  // Read once, the suggestion retires for this cycle and the guide moves on.
  await expect.poll(async () => 'restructure.reviewed' in (await saved(page)).flags).toBe(true);
  await expect(page.locator('.dock__item[data-dock="archive"] .dock__dot')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('the confirmation restates the trade, Escape steps back, and a double press restructures once', async ({
  page,
}) => {
  const before = company();
  await boot(page, before, 320, 420);
  await openArchive(page, 'prestige');
  const open = page.locator('.restructure-open');
  await open.click();
  const confirm = page.locator('.restructure-confirm');
  await expect(confirm).toContainText(
    fill(text('prestige.confirmBody_other'), {
      count: 2,
      branch: text('prestige.branch.industrial.name'),
    }),
  );
  await expect(confirm).toContainText(text('prestige.confirmFinal'));
  await expect(page.locator('.restructure-confirm__cancel')).toBeFocused();
  await expect(page.locator('.restructure-confirm__go')).toBeInViewport();

  // Escape steps back to the file, not out of the Archive.
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(page.locator('.sheet[data-sheet="prestige"]')).toBeVisible();
  await expect(open).toBeFocused();

  // Pick a branch by keys, then confirm with two presses at once.
  await page.locator('.branch[aria-checked="true"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.branch[data-branch="cooperative"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await open.click();
  await page.evaluate(() => {
    const go = document.querySelector<HTMLButtonElement>('.restructure-confirm__go')!;
    go.click();
    go.click();
  });
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('.toasts')).toContainText(
    fill(text('notify.restructured_other'), {
      cycle: 2,
      count: 2,
      branch: text('prestige.branch.cooperative.name'),
    }),
  );
  await expect(page.locator('.goal-tag')).toBeVisible();
  const after = await saved(page);
  expect(after.prestige).toMatchObject({ count: 1, branch: 'cooperative' });
  expect(after.resources.permanentKernels).toBe(2);
  expect(after.resources.goldenNuts).toBeGreaterThanOrEqual(before.resources.goldenNuts);
  expect(Object.entries(after.employees).filter(([, rt]) => rt.hired)).toHaveLength(1);
  expect(after.employees.otto.friendship).toBe(30);
  expect(after.daily.challenges.every((c) => c.claimed)).toBe(true);
  expect(Math.abs(after.createdAt - before.createdAt)).toBeLessThan(1_000);

  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const reloaded = await saved(page);
  expect(reloaded.prestige.count).toBe(1);
  expect(reloaded.resources.permanentKernels).toBe(2);
});

test('the new cycle shows its way to the next line, and the skills trade kernels honestly', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      s.prestige = { count: 1, branch: 'science', skills: {}, nutsAtLastPrestige: 4_000_000 };
      s.resources.permanentKernels = 2;
    }),
    380,
    460,
  );
  await openArchive(page, 'prestige');
  await expect(page.locator('.restructure-gain')).toContainText(
    fill(text('prestige.lockedUntil'), { value: '1M' }),
  );
  await expect(page.locator('.restructure-gain [role="progressbar"]')).toBeVisible();
  await expect(page.locator('.restructure-open')).toHaveCount(0);
  await expect(page.locator('.branch[data-branch="science"] .branch__current')).toBeVisible();

  const head = page.locator('.restructure-skill[data-skill="head-start"]');
  await head.locator('.restructure-skill__buy').click();
  await expect(head).toContainText(text('prestige.skillBought'));
  await expect(head).toContainText(fill(text('prestige.skillLevel'), { level: 1, max: 10 }));
  // Short: the button stays pressable, says what is missing and charges nothing.
  const refinery = page.locator('.restructure-skill[data-skill="kernel-refinery"]');
  await refinery.locator('.restructure-skill__buy').click({ force: true });
  await expect(refinery).toContainText(fill(text('prestige.skillShortNote_other'), { count: 2 }));
  const s = await saved(page);
  expect(s.resources.permanentKernels).toBe(1);
  expect(s.prestige.skills).toEqual({ 'head-start': 1 });
});

test('the cabinet counts what was earned, names nothing unfound, and Escape steps back', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      s.collections.nuts.push('intern-acorn');
      s.flags[keepsakeFlag('otto', 'cared')] = Date.now() - 5_000;
      s.microgames.coffeeRescue = { best: 90, plays: 2, lastRewardAt: 0 };
    }),
    380,
    460,
  );
  await openArchive(page, 'collections');
  const nuts = page.locator('.collection-drawer[data-drawer="nuts"]');
  await expect(nuts).toContainText(fill(text('collections.countOf'), { have: 1, total: 24 }));
  const keepsakes = page.locator('.collection-drawer[data-drawer="keepsakes"]');
  await expect(keepsakes).toContainText(fill(text('collections.countOf'), { have: 1, total: 23 }));
  await expect(page.locator('.collection-drawer[data-drawer="masteries"]')).toContainText(
    fill(text('collections.next.masteryBest'), {
      game: text('microgame.coffeeRescue.name'),
      best: 90,
      line: 170,
    }),
  );

  await keepsakes.click();
  await expect(page.locator('.collection-open__back')).toBeFocused();
  await expect(page.locator('.collection-open__back')).toBeInViewport();
  const shelf = page.locator('.keepsake-shelf');
  // Otto's is known and named first; Bea's is not, and her object is named nowhere.
  await expect(shelf.locator('.keepsake-slot').first()).toHaveAttribute('data-employee', 'otto');
  await expect(shelf.locator('.keepsake-slot[data-employee="otto"]')).toContainText(
    text(EMPLOYEES_BY_ID.otto.favoriteItemKey),
  );
  await expect(shelf.locator('.keepsake-slot[data-employee="bea"]')).toContainText(
    fill(text('collections.keepsakeOf'), { name: 'Beta' }),
  );
  await expect(shelf).not.toContainText(text(EMPLOYEES_BY_ID.bea.favoriteItemKey));

  // Otto's album opens over the Archive; Escape closes the visit first, not the drawer.
  await shelf.locator('.keepsake-slot[data-employee="otto"] .keepsake-slot__see').click();
  await expect(page.locator('.visit[data-employee="otto"]')).toBeVisible();
  await expect(page.locator('.visit')).toHaveAttribute('data-tab', 'scrapbook');
  await page.keyboard.press('Escape');
  await expect(page.locator('.visit')).toHaveCount(0);
  await expect(shelf).toBeVisible();
  await page.locator('.collection-open__back').focus();

  await page.keyboard.press('Escape');
  await expect(page.locator('.collection-shelf')).toBeVisible();
  await expect(page.locator('.sheet[data-sheet="collections"]')).toBeVisible();
  await expect(keepsakes).toBeFocused();

  // A hidden achievement keeps its name and its reward to itself.
  await openArchive(page, 'achievements');
  const hidden = page.locator('.ach:not(.is-unlocked)').filter({ hasText: '???' }).first();
  await expect(hidden.locator('.ach__reward')).toHaveText('?');
});

test('a curiosity noticed in the office lands in the encyclopedia, and stays after a reload', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      s.flags['pip.arc.1'] = Date.now() - 60_000;
      s.office = {
        rooms: {},
        oddities: [{ id: 'first-acorn', roomId: 'founder-desk', at: Date.now() }],
      };
    }),
    380,
    460,
  );
  await openArchive(page, 'collections');
  const nuts = page.locator('.collection-drawer[data-drawer="nuts"]');
  await expect(nuts).toContainText(fill(text('collections.countOf'), { have: 0, total: 24 }));
  // Unfound, it is a blank that says only where it can turn up now (Pip's story opened it).
  await nuts.click();
  const acorn = page.locator('.nut-cell[data-nut="founder-acorn"]');
  await expect(acorn).toContainText(
    fill(text('collections.nutWhere'), { room: text('room.founderDesk.name') }),
  );
  await expect(acorn).not.toContainText(text('nut.founderAcorn.name'));
  await page.locator('.sheet__close').click();
  await page.evaluate(() =>
    document.querySelector('.floor[data-room="founder-desk"]')?.scrollIntoView({ block: 'center' }),
  );
  await page.locator('.office-oddity[data-oddity="first-acorn"]').click();
  await expect(page.locator('.floor[data-room="founder-desk"] .office-slip')).toContainText(
    text('play.oddity.nut'),
  );
  await openArchive(page, 'collections');
  await expect(nuts).toContainText(fill(text('collections.countOf'), { have: 1, total: 24 }));
  await nuts.click();
  await expect(acorn).not.toHaveClass(/is-locked/);
  await expect(acorn).toContainText(text('nut.founderAcorn.name'));
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await openArchive(page, 'collections');
  await expect(nuts).toContainText(fill(text('collections.countOf'), { have: 1, total: 24 }));
});
