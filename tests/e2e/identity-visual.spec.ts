import { expect, test, type Page } from '@playwright/test';
import { openView } from './support/shell';

const LABEL = process.env.IDENTITY_SHOT_LABEL ?? 'current';
const DIR = 'visual-artifacts/identity';

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Patas & Castanhas Ltda.' },
  resources: {
    nuts: 5_000_000,
    goldenNuts: 40,
    reputation: 4_000,
    morale: 82,
    permanentKernels: 3,
  },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.2 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.45 },
  },
  collections: {
    nuts: [],
    outfits: [],
    logos: ['default'],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:motivational-poster'],
  },
  placements: {
    'potted-fern': { surface: 'floor', x: 0.18, y: 0.06 },
    'desk-lamp': { surface: 'floor', x: 0.82, y: 0.06 },
    'motivational-poster': { surface: 'wall', x: 0.5, y: 0.62 },
  },
};

async function seed(page: Page, language: 'en' | 'pt-BR', highContrast = false) {
  await page.addInitScript(
    ({ save, lang, contrast }) => {
      localStorage.setItem(
        'wmno.save.v1',
        JSON.stringify({
          ...save,
          settings: {
            language: lang,
            reducedMotion: true,
            fontScale: 1,
            uiScale: 1,
            highContrast: contrast,
          },
        }),
      );
    },
    { save: SAVE, lang: language, contrast: highContrast },
  );
}

async function dismiss(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const button = page.locator('.popup__actions button, .modal button').first();
    if (!(await button.count())) break;
    await button.click().catch(() => {});
    await page.waitForTimeout(100);
  }
  for (let i = 0; i < 12; i += 1) {
    const toast = page.locator('.toast').first();
    if (!(await toast.count())) break;
    await toast.click({ force: true }).catch(() => {});
  }
}

for (const scenario of [
  { name: 'desktop-en', width: 1280, height: 800, language: 'en' as const },
  { name: 'compact-en', width: 420, height: 760, language: 'en' as const },
  { name: 'desktop-ptBR', width: 1280, height: 800, language: 'pt-BR' as const },
]) {
  test(`${scenario.name} handmade identity`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await seed(page, scenario.language);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15_000 });
    await dismiss(page);
    await page.evaluate(() => document.fonts.ready);

    // The HUD is a walnut shelf (grain + shadow) carrying a die-cut logo sticker.
    const brandMark = page.locator('.hud__logo');
    await expect(brandMark).toBeVisible();
    await expect(brandMark.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    const shelf = await page.locator('.hud').evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundImage, shadow: style.boxShadow };
    });
    expect(shelf.background).not.toBe('none');
    expect(shelf.shadow).not.toBe('none');
    const sticker = await brandMark.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(sticker).not.toBe('none');

    // Each floor carries a painted name plaque, never an unstyled label.
    const plaque = await page
      .locator('.floor[data-room] .floor__label')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, font: style.fontFamily };
      });
    expect(plaque.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(plaque.font).toContain('DynaPuff');

    // One two-face identity: no Georgia (or any serif) anywhere on screen.
    const serif = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.app *')]
        .filter((element) => element.childElementCount === 0 && element.textContent?.trim())
        .map((element) => getComputedStyle(element).fontFamily)
        .filter((family) => /georgia|serif(?!-)/i.test(family) && !/sans-serif/i.test(family)),
    );
    expect(serif).toEqual([]);

    await page.screenshot({ path: `${DIR}/${LABEL}-${scenario.name}-office.png`, fullPage: false });

    if (scenario.width >= 1000) {
      await openView(page, 'shop');
      await expect(page.locator('.view--shop')).toBeVisible();
      await page.mouse.move(scenario.width - 24, scenario.height - 24);
      await dismiss(page);
      const card = page.locator('.sheet .card').first();
      await expect(card).toBeVisible();
      // Cards are cream paper with an ink outline and a soft lift.
      const paperCard = await card.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          border: style.borderTopWidth,
          shadow: style.boxShadow,
          radius: style.borderTopLeftRadius,
        };
      });
      expect(paperCard.border).not.toBe('0px');
      expect(paperCard.shadow).not.toBe('none');
      expect(parseFloat(paperCard.radius)).toBeGreaterThanOrEqual(8);
      // The sheet's title is set in the display face.
      expect(
        await page
          .locator('.sheet__title')
          .evaluate((element) => getComputedStyle(element).fontFamily),
      ).toContain('DynaPuff');
      await page.screenshot({
        path: `${DIR}/${LABEL}-${scenario.name}-cards.png`,
        fullPage: false,
      });
    }
  });
}

test('high-contrast identity preserves marks, states, and compact reachability', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 760 });
  await seed(page, 'en', true);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await dismiss(page);

  const app = page.locator('.app');
  await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');

  const brandMark = page.locator('.hud__logo');
  const markColors = await brandMark.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(markColors.color).not.toBe(markColors.background);

  // Decorative pseudo-elements (the room's wainscot and floor shading) never
  // intercept a click.
  for (const selector of ['.floor[data-room]::before', '.floor[data-room]::after']) {
    const [base, pseudo] = selector.split('::');
    expect(
      await page
        .locator(base)
        .first()
        .evaluate(
          (element, pseudoName) => getComputedStyle(element, `::${pseudoName}`).pointerEvents,
          pseudo,
        ),
    ).toBe('none');
  }

  const appBox = await app.boundingBox();
  const hudBox = await page.locator('.hud').boundingBox();
  const dockBox = await page.locator('.dock').boundingBox();
  expect(appBox).not.toBeNull();
  expect(hudBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(hudBox!.x).toBeGreaterThanOrEqual(appBox!.x);
  expect(hudBox!.x + hudBox!.width).toBeLessThanOrEqual(appBox!.x + appBox!.width + 1);
  expect(dockBox!.x + dockBox!.width).toBeLessThanOrEqual(appBox!.x + appBox!.width + 1);

  const audioButton = page.getByTestId('mute-toggle');
  const before = await audioButton.getAttribute('aria-pressed');
  await audioButton.click();
  await expect(audioButton).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');

  await openView(page, 'shop');
  const upgradesDock = page.locator('.dock__item[data-dock="upgrades"]');
  await expect(upgradesDock).toHaveClass(/is-active/);
  // The open destination is ink on white paper in high contrast.
  const activeColors = await upgradesDock.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(activeColors.color).toBe('rgb(0, 0, 0)');
  expect(activeColors.background).toBe('rgb(255, 255, 255)');
  const disabledPurchase = page.locator('.buy-btn:disabled').first();
  if (await disabledPurchase.count()) {
    const disabledColors = await disabledPurchase.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(disabledColors.color).not.toBe(disabledColors.background);
  }

  await page.screenshot({ path: `${DIR}/${LABEL}-compact-high-contrast.png`, fullPage: false });
});
