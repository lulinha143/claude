import { test, expect, type Page } from '@playwright/test';
import { closeSheet, openView } from './support/shell';

// Phase 1's contract for the game screen, measured in the real build:
//   1. HUD + dock take at most a quarter of a companion window; nothing scrolls sideways.
//   2. The home floor opens on screen with every teammate's head and bubble visible.
//   3. Popups are centred and exactly as tall as what they say.
//   4. Opening and closing a sheet returns to the same floor and scroll position.
//   5. The opening's words are readable (contrast ≥ 4.5:1).
//   6. Portuguese HUD and dock labels fit at the smallest window.

const MID_GAME = {
  version: 10,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 900_000,
  company: { name: 'Nutshell Inc.' },
  resources: {
    nuts: 5_000_000,
    goldenNuts: 40,
    permanentKernels: 0,
    morale: 80,
    reputation: 1_600,
  },
  employees: {
    pip: { hired: true, level: 4, friendship: 50, room: 'founder-desk', x: 0.5 },
    marlow: { hired: true, level: 4, friendship: 50, room: 'founder-desk', x: 0.5 },
    nino: { hired: true, level: 4, friendship: 50, room: 'founder-desk', x: 0.5 },
    junie: { hired: true, level: 4, friendship: 50, room: 'founder-desk', x: 0.5 },
    moss: { hired: true, level: 4, friendship: 50, room: 'research', x: 0.5 },
    mina: { hired: true, level: 4, friendship: 50, room: 'research', x: 0.5 },
    rizzo: { hired: true, level: 4, friendship: 50, room: 'procurement', x: 0.5 },
  },
  upgrades: {
    'room-sorting': 1,
    'room-lab': 1,
    'room-meeting': 1,
    'room-research': 1,
    'room-marketing': 1,
    'room-construction': 1,
    'room-procurement': 1,
  },
  collections: { nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: true },
};

const SIZES = [
  { width: 320, height: 420 },
  { width: 380, height: 460 },
  { width: 800, height: 600 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function boot(page: Page, save: object | null, lang = 'en') {
  await page.addInitScript(
    ({ seed, locale }) => {
      if (seed) localStorage.setItem('wmno.save.v1', JSON.stringify(seed));
      localStorage.setItem('wmno.lang', locale);
    },
    { seed: save, locale: lang },
  );
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
}

async function skipFirstRun(page: Page) {
  await page.getByRole('button', { name: 'Skip opening' }).click();
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await expect(page.locator('.popup-backdrop')).toHaveCount(0);
}

/** Wait for the tower to settle on its home floor (scale published, re-centred). */
async function settled(page: Page) {
  await page.waitForTimeout(500);
}

async function homeFloorReport(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.app__stage')!.getBoundingClientRect();
    const home = document.querySelector<HTMLElement>('.floor[data-room="founder-desk"]')!;
    const floor = home.getBoundingClientRect();
    const people = [...home.querySelectorAll<HTMLElement>('.critter-btn')].map((button) => {
      const sprite = button.querySelector('.employee-sprite, svg.critter')!.getBoundingClientRect();
      const bubble = button.querySelector('.employee-bubble')!.getBoundingClientRect();
      return {
        name: button.getAttribute('aria-label'),
        top: Math.min(sprite.top, bubble.top),
        bottom: Math.max(sprite.bottom, bubble.bottom),
        left: Math.min(sprite.left, bubble.left),
        right: Math.max(sprite.right, bubble.right),
      };
    });
    return {
      stage: { top: stage.top, bottom: stage.bottom, left: stage.left, right: stage.right },
      floor: { top: floor.top, bottom: floor.bottom },
      people,
    };
  });
}

test('1 — HUD and dock stay within a quarter of a companion window, nothing scrolls sideways', async ({
  page,
}) => {
  await boot(page, MID_GAME);
  for (const { width, height } of SIZES) {
    await page.setViewportSize({ width, height });
    await settled(page);
    const hud = (await page.locator('.hud').boundingBox())!;
    const dock = (await page.locator('.dock').boundingBox())!;
    if (width <= 380) {
      expect(hud.height + dock.height, `chrome at ${width}x${height}`).toBeLessThanOrEqual(
        height * 0.25,
      );
    }
    const sideways = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      world: (() => {
        const w = document.querySelector<HTMLElement>('.office__world')!;
        return w.scrollWidth - w.clientWidth;
      })(),
    }));
    expect(sideways.doc, `document scrolls sideways at ${width}x${height}`).toBeLessThanOrEqual(0);
    expect(sideways.world, `office scrolls sideways at ${width}x${height}`).toBeLessThanOrEqual(0);
  }
});

for (const kind of ['fresh', 'mid-game'] as const) {
  for (const { width, height } of [
    { width: 320, height: 420 },
    { width: 380, height: 460 },
    { width: 1280, height: 720 },
  ]) {
    test(`2 — the home floor opens with every head and bubble visible (${kind}, ${width}x${height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await boot(page, kind === 'fresh' ? null : MID_GAME);
      if (kind === 'fresh') await skipFirstRun(page);
      await settled(page);
      const report = await homeFloorReport(page);
      expect(report.people.length, `${kind} at ${width}x${height}`).toBe(kind === 'fresh' ? 1 : 4);
      for (const person of report.people) {
        const at = `${person.name} (${kind}) at ${width}x${height}`;
        expect(person.top, `${at}: head/bubble above the view`).toBeGreaterThanOrEqual(
          report.stage.top - 1,
        );
        expect(person.bottom, `${at}: below the view`).toBeLessThanOrEqual(report.stage.bottom + 1);
        expect(person.top, `${at}: bubble clipped by its room`).toBeGreaterThanOrEqual(
          report.floor.top - 1,
        );
        expect(person.left, `${at}: off the left edge`).toBeGreaterThanOrEqual(
          report.stage.left - 1,
        );
        expect(person.right, `${at}: off the right edge`).toBeLessThanOrEqual(
          report.stage.right + 1,
        );
      }
      // A full room seats its four teammates without their desks colliding.
      if (kind === 'mid-game') {
        const boxes = await page
          .locator('.floor[data-room="founder-desk"] .employee-sprite')
          .evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect()).sort((a, b) => a.left - b.left),
          );
        for (let i = 1; i < boxes.length; i += 1) {
          expect(boxes[i].left, `desks overlap at ${width}x${height}`).toBeGreaterThanOrEqual(
            boxes[i - 1].right - 6,
          );
        }
      }
      await page.screenshot({ path: `visual-artifacts/shell-home-${kind}-${width}x${height}.png` });
    });
  }
}

async function expectPopupFitsContent(page: Page, label: string) {
  const g = await page.evaluate(() => {
    const popup = document.querySelector<HTMLElement>('.popup')!;
    const box = popup.getBoundingClientRect();
    const cs = getComputedStyle(popup);
    const children = [...popup.children].filter(
      (child) => getComputedStyle(child).position !== 'absolute',
    );
    const lastBottom = Math.max(...children.map((child) => child.getBoundingClientRect().bottom));
    return {
      centreX: box.left + box.width / 2,
      centreY: box.top + box.height / 2,
      vw: window.innerWidth,
      vh: window.innerHeight,
      height: box.height,
      emptyBelow:
        box.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom) - lastBottom,
      scrolls: popup.scrollHeight > popup.clientHeight + 1,
    };
  });
  expect(Math.abs(g.centreX - g.vw / 2), `${label}: not centred horizontally`).toBeLessThanOrEqual(
    2,
  );
  if (!g.scrolls) {
    expect(Math.abs(g.centreY - g.vh / 2), `${label}: not centred vertically`).toBeLessThanOrEqual(
      2,
    );
    // Exactly as tall as its content: no blank band under the last element.
    expect(g.emptyBelow, `${label}: taller than its content`).toBeLessThanOrEqual(2);
  }
}

test('3 — popups are centred and as tall as what they say', async ({ browser }) => {
  for (const { width, height } of [
    { width: 380, height: 460 },
    { width: 1280, height: 720 },
  ]) {
    // An event, then its chained step. (A fresh context each time: saves persist.)
    const eventContext = await browser.newContext();
    const eventPage = await eventContext.newPage();
    await eventPage.setViewportSize({ width, height });
    await boot(eventPage, {
      ...MID_GAME,
      eventInProgress: { eventId: 'printer-demands', step: null },
    });
    await expect(eventPage.locator('.popup')).toBeVisible();
    await eventPage.waitForTimeout(400);
    await expectPopupFitsContent(eventPage, `event at ${width}`);
    await eventPage.locator('.popup button').first().click();
    await expect(eventPage.locator('.popup')).toBeVisible();
    await eventPage.waitForTimeout(400);
    await expectPopupFitsContent(eventPage, `event step at ${width}`);
    await eventContext.close();

    // The first-run guide.
    const guideContext = await browser.newContext();
    const guidePage = await guideContext.newPage();
    await guidePage.setViewportSize({ width, height });
    await boot(guidePage, null);
    await guidePage.getByRole('button', { name: 'Skip opening' }).click();
    await expect(guidePage.locator('.popup.guide')).toBeVisible();
    await guidePage.waitForTimeout(400);
    await expectPopupFitsContent(guidePage, `guide at ${width}`);
    await guideContext.close();
  }
});

test('4 — every sheet returns to the same floor and scroll position', async ({ page }) => {
  for (const { width, height } of [
    { width: 380, height: 460 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize({ width, height });
    await boot(page, MID_GAME);
    await settled(page);
    const world = page.locator('.office__world');
    // Somewhere that is not the default: a couple of floors up.
    await world.evaluate((el) => {
      el.scrollTop = Math.max(0, el.scrollTop - 260);
    });
    await page.waitForTimeout(250);
    const before = await world.evaluate((el) => el.scrollTop);
    for (const view of ['employees', 'shop', 'decorate', 'focus', 'company', 'settings'] as const) {
      await openView(page, view);
      await closeSheet(page);
      await expect
        .poll(() => world.evaluate((el) => el.scrollTop), { message: `after ${view} at ${width}` })
        .toBeLessThanOrEqual(before + 2);
      expect(await world.evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(before - 2);
    }
  }
});

function luminance(rgb: string): number {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

for (const { width, height } of [
  { width: 380, height: 460 },
  { width: 1280, height: 720 },
]) {
  test(`5 — the opening is readable: every line clears 4.5:1 (${width}x${height})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await boot(page, null);
    await expect(page.locator('.opening-card')).toBeVisible();
    // The real Pip artwork, not the vector fallback.
    await expect(page.locator('.opening-card .employee-sprite')).toBeVisible();
    const colours = await page.evaluate(() => {
      const card = getComputedStyle(document.querySelector('.opening-card')!).backgroundColor;
      return ['.opening-card__eyebrow', '.opening-card__prompt', '.opening-card__line'].map(
        (selector) => ({
          selector,
          fg: getComputedStyle(document.querySelector(selector)!).color,
          bg: card,
        }),
      );
    });
    for (const { selector, fg, bg } of colours) {
      const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      expect(ratio, `${selector} contrast at ${width}`).toBeGreaterThanOrEqual(4.5);
    }
    // Nothing on the card overlaps the call to action.
    const overlap = await page.evaluate(() => {
      const cta = document.querySelector('.acorn-cta')!.getBoundingClientRect();
      const line = document.querySelector('.opening-card__line')!.getBoundingClientRect();
      return line.bottom - cta.top;
    });
    expect(overlap).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `visual-artifacts/shell-opening-${width}x${height}.png` });
  });
}

test('6 — Portuguese HUD and dock labels fit at the smallest windows', async ({ page }) => {
  await boot(page, { ...MID_GAME, settings: { ...MID_GAME.settings, language: 'pt-BR' } }, 'pt-BR');
  for (const { width, height } of [
    { width: 320, height: 420 },
    { width: 380, height: 460 },
  ]) {
    await page.setViewportSize({ width, height });
    await settled(page);
    const clipped = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '.dock__label, .hud__nuts-value, .hud-stat__value, .sheet__title',
        ),
      ]
        .filter((el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            text: el.textContent,
            clipped: el.scrollWidth > el.clientWidth + 1,
            outside: r.left < -1 || r.right > window.innerWidth + 1,
          };
        })
        .filter((entry) => entry.clipped || entry.outside),
    );
    expect(clipped, `clipped pt-BR labels at ${width}x${height}`).toEqual([]);
  }
  // Every dock destination keeps its Portuguese name for assistive tech.
  for (const name of ['Equipe', 'Melhorias', 'Decorar', 'Atividades', 'Arquivo']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
});
