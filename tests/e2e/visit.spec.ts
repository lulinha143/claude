import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { CHARACTERS } from '../../src/content/characters';
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
