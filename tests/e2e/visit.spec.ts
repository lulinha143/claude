import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { CHARACTERS } from '../../src/content/characters';
import { EMPLOYEE_SPRITES } from '../../src/art/employeeSprites';
import type { GameState } from '../../src/sim/types';
import { openView } from './support/shell';

/**
 * Gameplay chapter 2: visiting a teammate, through the real DOM.
 *
 * The visit is a game mode: the teammate stands large in their own room and the
 * conversation, the gift notebook and the scrapbook share the panel. These pin
 * what broke (or would) while building it: the teammate shrinking to a corner in
 * small windows, a conversation that needs scrolling, empty answer boxes, the
 * favourite gift given away by any gift, and the office never asking you over.
 */

const LOCALES: Record<string, unknown> = {
  en: JSON.parse(readFileSync(new URL('../../src/i18n/locales/en.json', import.meta.url), 'utf8')),
  'pt-BR': JSON.parse(
    readFileSync(new URL('../../src/i18n/locales/pt-BR.json', import.meta.url), 'utf8'),
  ),
};
const text = (lang: string, key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)[part],
      LOCALES[lang],
    ) as string;

function company(mutate: (s: GameState) => void, lang = 'en'): GameState {
  const s = createInitialState(Date.now());
  s.onboardingComplete = true;
  s.resources.nuts = 50_000;
  s.resources.goldenNuts = 5;
  s.resources.morale = 70;
  s.stats.totalClicks = 50;
  s.settings.language = lang;
  s.settings.reducedMotion = true;
  mutate(s);
  return s;
}

function hire(s: GameState, id: string, friendship: number) {
  s.employees[id].hired = true;
  s.employees[id].level = 3;
  s.employees[id].friendship = friendship;
}

async function boot(page: Page, state: GameState, width: number, height: number) {
  // Seed once: the script re-runs on reload, and the reload checks below must read
  // what the game saved, not the seed.
  await page.addInitScript(
    ({ save, lang }) => {
      if (!localStorage.getItem('wmno.save.v1')) {
        localStorage.setItem('wmno.save.v1', JSON.stringify(save));
      }
      localStorage.setItem('wmno.lang', lang);
    },
    { save: state, lang: state.settings.language },
  );
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
}

async function visit(page: Page, id: string) {
  await openView(page, 'employees');
  const button = page.locator(`.employee-card__talk[data-employee="${id}"]`);
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await page.locator('.visit').waitFor({ timeout: 8_000 });
  await page.waitForTimeout(300);
}

async function tab(page: Page, id: 'talk' | 'gifts' | 'scrapbook') {
  await page.locator(`.visit__tab[data-tab="${id}"]`).click();
  await expect(page.locator('.visit')).toHaveAttribute('data-tab', id);
}

for (const lang of ['en', 'pt-BR']) {
  for (const [width, height] of [
    [320, 420],
    [380, 460],
  ] as const) {
    test(`a visit at ${width}x${height} (${lang}): the teammate leads and the conversation fits`, async ({
      page,
    }) => {
      await boot(
        page,
        company((s) => hire(s, 'marlow', 20), lang),
        width,
        height,
      );
      await visit(page, 'marlow');
      await expect(page.locator('.visit')).toHaveAttribute('data-topic', 'story-marlow-1');
      await expect(page.locator('.talk__said')).toContainText(text(lang, 'arc.marlow.1.prompt'));
      await expect(page.locator('.visit__tab[data-tab="scrapbook"]')).toContainText(
        text(lang, 'visit.tab.scrapbook'),
      );

      const m = await page.evaluate(() => {
        const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const img = document.querySelector('.talk__portrait img') as HTMLImageElement;
        const art = img.getBoundingClientRect();
        const pageEl = document.querySelector('.visit__page') as HTMLElement;
        const choices = [...document.querySelectorAll('.talk-choice')].map((el) => {
          const r = el.getBoundingClientRect();
          const label = el.querySelector('.talk-choice__label')!.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height, label: label.height };
        });
        return {
          frame: box('.visit__frame'),
          artHeight: art.height,
          upscale: Math.max(art.width / img.naturalWidth, art.height / img.naturalHeight),
          overflow: pageEl.scrollHeight - pageEl.clientHeight,
          choices,
          wide: document.documentElement.scrollWidth > innerWidth,
          inner: [innerWidth, innerHeight],
        };
      });
      // The whole window is the visit, and the teammate is its main character.
      expect(Math.round(m.frame.width)).toBe(m.inner[0]);
      expect(Math.round(m.frame.height)).toBe(m.inner[1]);
      expect(m.artHeight, 'teammate size').toBeGreaterThanOrEqual(m.inner[1] * 0.3);
      expect(m.upscale, 'art is never enlarged').toBeLessThanOrEqual(1.02);
      // An ordinary conversation needs no scrolling, and every answer is in view.
      expect(m.overflow, 'conversation scrolls').toBeLessThanOrEqual(2);
      expect(m.choices.length).toBe(2);
      for (const choice of m.choices) {
        expect(choice.bottom).toBeLessThanOrEqual(m.inner[1]);
        // Sized to the words: no answer is an empty box.
        expect(choice.height - choice.label).toBeLessThanOrEqual(24);
      }
      expect(m.wide, 'no sideways scroll').toBe(false);
      await page.screenshot({
        path: `visual-artifacts/review/visit-${lang}-${width}x${height}.png`,
      });
    });
  }
}

test('a large window frames the visit over the office, the art at its own size', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => hire(s, 'marlow', 20)),
    1280,
    720,
  );
  await visit(page, 'marlow');
  const m = await page.evaluate(() => {
    const frame = document.querySelector('.visit__frame')!.getBoundingClientRect();
    const stage = document.querySelector('.visit__stage')!.getBoundingClientRect();
    const img = document.querySelector('.talk__portrait img') as HTMLImageElement;
    const art = img.getBoundingClientRect();
    return {
      frame: frame.width,
      share: art.height / stage.height,
      upscale: Math.max(art.width / img.naturalWidth, art.height / img.naturalHeight),
    };
  });
  expect(m.frame).toBeLessThanOrEqual(920);
  expect(m.share, 'teammate share of the stage').toBeGreaterThanOrEqual(0.3);
  expect(m.upscale).toBeLessThanOrEqual(1.02);
  await page.screenshot({ path: 'visual-artifacts/review/visit-en-1280x720.png' });
});

test('a favourite is found by trying gifts, never given away by another one', async ({ page }) => {
  const { loves, likes, odd } = CHARACTERS.rosa.gifts;
  await boot(
    page,
    company((s) => {
      hire(s, 'rosa', 30);
      s.flags[`rosa.gift.${odd}`] = Date.now() - 3_600_000;
    }),
    1000,
    800,
  );
  await visit(page, 'rosa');
  await tab(page, 'gifts');
  await expect(page.locator('.talk__gift-preference')).toContainText(
    text('en', 'gifts.favoriteUnknown'),
  );
  await expect(page.locator(`.visit-gift[data-gift="${odd}"]`)).toHaveAttribute(
    'data-reaction',
    'odd',
  );
  await expect(page.locator(`.visit-gift[data-gift="${loves}"]`)).toHaveAttribute(
    'data-reaction',
    'untried',
  );

  await page.locator(`.visit-gift[data-gift="${likes}"]`).click();
  await expect(page.locator('.talk__said--reply')).toContainText(text('en', 'gifts.liked.rosa'));
  await tab(page, 'gifts');
  // Liked is not loved: the favourite is still to be found.
  await expect(page.locator('.talk__gift-preference')).toContainText(
    text('en', 'gifts.favoriteUnknown'),
  );
  await expect(page.locator(`.visit-gift[data-gift="${likes}"]`)).toHaveAttribute(
    'data-reaction',
    'liked',
  );
  // They need a breather before the next present.
  await expect(page.locator(`.visit-gift[data-gift="${loves}"]`)).toBeDisabled();
  await page.screenshot({ path: 'visual-artifacts/review/visit-gifts.png' });
});

test('the favourite, once found, is remembered in the notebook and the scrapbook', async ({
  page,
}) => {
  const { loves } = CHARACTERS.bia.gifts;
  await boot(
    page,
    company((s) => hire(s, 'bia', 30)),
    1000,
    800,
  );
  await visit(page, 'bia');
  await tab(page, 'gifts');
  await page.locator(`.visit-gift[data-gift="${loves}"]`).click();
  await expect(page.locator('.talk__said--reply')).toContainText(text('en', 'gifts.reactions.bia'));
  await expect(page.locator('.talk__gift-filed')).toBeVisible();

  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await visit(page, 'bia');
  await tab(page, 'gifts');
  await expect(page.locator('.talk__gift-preference')).toContainText(
    text('en', `gifts.preferenceNames.${loves}`),
  );
  await tab(page, 'scrapbook');
  await expect(page.locator('.talk__memories .scrap--gift')).toHaveCount(1);
});

test('a teammate waves you over when they have something to tell you', async ({ page }) => {
  await boot(
    page,
    company((s) => {
      hire(s, 'marlow', 20);
      s.employees.marlow.room = 'founder-desk';
      s.flags['marlow.tier.1'] = Date.now() - 3_600_000;
    }),
    1280,
    720,
  );
  const nudge = page.locator('.office-nudge[data-employee="marlow"]');
  await expect(nudge).toHaveAttribute('data-kind', 'story');
  await nudge.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'visual-artifacts/review/visit-office-nudge.png' });
  await nudge.click();
  await expect(page.locator('.visit')).toHaveAttribute('data-topic', 'story-marlow-1');
  await page.locator('.talk-choice[data-option-id="a"]').click();
  await expect(page.locator('.talk__said--reply')).toContainText(
    text('en', 'arc.marlow.1.a.reply'),
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.visit')).toHaveCount(0);
  // Said and done: they stop waving.
  await expect(nudge).toHaveCount(0);

  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const flags = await page.evaluate(
    () => JSON.parse(localStorage.getItem('wmno.save.v1')!).flags as Record<string, number>,
  );
  expect(flags['marlow.arc.1.a']).toBeTruthy();
  await visit(page, 'marlow');
  await tab(page, 'scrapbook');
  await expect(page.locator('.talk__memories .scrap--story')).toContainText(
    text('en', 'arc.marlow.title'),
  );
});

test('in Portuguese, everyone answers to their own name', async ({ page }) => {
  await boot(
    page,
    company((s) => {
      hire(s, 'rizzo', 20);
      hire(s, 'nino', 20);
    }, 'pt-BR'),
    380,
    460,
  );
  await visit(page, 'rizzo');
  await expect(page.locator('.talk__name')).toHaveText('Guaxi');
  await page.keyboard.press('Escape');
  await visit(page, 'nino');
  await expect(page.locator('.talk__name')).toHaveText('Nino');
});

/** The whole cast on the payroll, each in their own room and between story parts. */
function everyone(lang: string): GameState {
  return company((s) => {
    const hour = Date.now() - 3_600_000;
    for (const id of Object.keys(CHARACTERS)) {
      hire(s, id, 10);
      // Their own topics were had an hour ago, so a quick word is what comes up.
      s.employees[id].talks = {
        count: 1,
        lastAt: hour,
        seen: { 'rizzo-inventory': hour, 'dorm-sleep': hour },
      };
    }
    s.resources.reputation = 1_600;
    for (const room of [
      'sorting',
      'lab',
      'meeting',
      'research',
      'marketing',
      'construction',
      'procurement',
      'vault',
      'nap',
      'morale',
    ])
      s.upgrades[`room-${room}`] = 1;
  }, lang);
}

test('all 23 open a check-in in their own words, at one scale, and Escape goes back to them', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await boot(page, everyone('pt-BR'), 380, 460);
  await openView(page, 'employees');
  const figures: number[] = [];
  const said = new Set<string>();
  for (const id of Object.keys(CHARACTERS)) {
    const button = page.locator(`.employee-card__talk[data-employee="${id}"]`);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const visit = page.locator('.visit');
    await expect(visit).toHaveAttribute('data-topic', 'check-in');
    const line = (await page.locator('.talk__said').textContent())!.trim();
    const own = Object.values(
      (LOCALES['pt-BR'] as { checkin: Record<string, Record<string, string>> }).checkin[id],
    );
    expect(own, `${id} speaks their own lines`).toContain(line);
    said.add(line);
    const m = await page.evaluate(() => {
      const img = document.querySelector('.talk__portrait img') as HTMLImageElement;
      const page = document.querySelector('.visit__page') as HTMLElement;
      return {
        height: img.getBoundingClientRect().height,
        natural: img.naturalHeight,
        overflow: page.scrollHeight - page.clientHeight,
      };
    });
    expect(m.height / m.natural, `${id} is never enlarged`).toBeLessThanOrEqual(1.02);
    expect(m.overflow, `${id}: the opening fits`).toBeLessThanOrEqual(2);
    figures.push(m.height * (1 - EMPLOYEE_SPRITES[id].figureTop));
    // Escape leaves the visit, not the Team sheet, and focus is back on their card.
    await page.keyboard.press('Escape');
    await expect(visit).toHaveCount(0);
    await expect(page.locator('.sheet[data-sheet="employees"]')).toBeVisible();
    await expect(button).toBeFocused();
  }
  expect(said.size, 'nobody shares an opening').toBe(23);
  // One presentation scale: the visible figures match (the registry's ~5%).
  expect(Math.max(...figures) / Math.min(...figures)).toBeLessThan(1.07);
});

test('a visit reads the room, offers the way home, and keeps the keyboard inside', async ({
  page,
}) => {
  await boot(
    page,
    company((s) => {
      hire(s, 'bea', 10);
      s.employees.bea.room = 'lab';
      s.upgrades['room-lab'] = 1;
      // Her own wing opens with standing.
      s.resources.reputation = 40;
    }, 'pt-BR'),
    1280,
    720,
  );
  await visit(page, 'bea');
  await expect(page.locator('.talk__said')).toHaveText(text('pt-BR', 'checkin.bea.away'));
  await expect(page.locator('.visit__fit')).toHaveText(text('pt-BR', 'visit.fit.disliked'));
  // The first answer has the keyboard; Tab goes round inside the visit.
  await expect(page.locator('.talk-choice').first()).toBeFocused();
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.visit')))).toBe(
      true,
    );
  }
  // Arrow keys move between the visit's tabs.
  await page.locator('.visit__tab[data-tab="talk"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.visit')).toHaveAttribute('data-tab', 'gifts');
  await expect(page.locator('.visit__tab[data-tab="gifts"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.visit')).toHaveAttribute('data-tab', 'talk');

  // Back to her own room: the scene and the plate change with her.
  await page.locator('.visit__act[data-act="home"]').click();
  await expect(page.locator('.visit__slip')).toContainText(text('pt-BR', 'room.construction.name'));
  await expect(page.locator('.visit')).toHaveAttribute('data-fit', 'favorite');
  await expect(page.locator('.visit__act')).toHaveCount(0);
  await page.screenshot({ path: 'visual-artifacts/review/visit-home-1280x720.png' });
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('wmno.save.v1')!).employees.bea.room as string,
  );
  expect(saved).toBe('construction');
});

test('a teammate you poke offers a chat on their note', async ({ page }) => {
  await boot(
    page,
    company((s) => {
      hire(s, 'marlow', 10);
      s.employees.marlow.room = 'founder-desk';
    }, 'pt-BR'),
    380,
    460,
  );
  const critter = page.locator('.critter-btn[data-employee="marlow"]');
  await critter.scrollIntoViewIfNeeded();
  await critter.click();
  const offer = page.locator('.speech-note .speech-note__action');
  await expect(offer).toHaveText(text('pt-BR', 'visit.invite.talk'));
  await offer.click();
  await expect(page.locator('.visit')).toHaveAttribute('data-topic', 'check-in');
  await page.keyboard.press('Escape');
  await expect(page.locator('.visit')).toHaveCount(0);
  await expect(critter).toBeFocused();
});
