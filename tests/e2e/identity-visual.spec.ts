import { expect, test, type Page } from '@playwright/test';

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

    const brandMark = page.locator('.header__brand-mark');
    await expect(brandMark).toBeVisible();
    await expect(brandMark.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    const tactileHeader = await page.locator('.header').evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundImage, shadow: style.boxShadow };
    });
    expect(tactileHeader.background).not.toBe('none');
    expect(tactileHeader.shadow).not.toBe('none');

    const roomTagMark = await page
      .locator('.floor__label')
      .first()
      .evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
    expect(roomTagMark).not.toBe('none');

    await page.screenshot({ path: `${DIR}/${LABEL}-${scenario.name}-office.png`, fullPage: false });

    if (scenario.width >= 1000) {
      await page.locator('.nav__item').nth(1).click();
      await expect(page.locator('.view')).toBeVisible();
      await page.mouse.move(scenario.width - 24, scenario.height - 24);
      await dismiss(page);
      const card = page.locator('.card').first();
      await expect(card).toBeVisible();
      const tactileCard = await card.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundImage, shadow: style.boxShadow };
      });
      expect(tactileCard.background).not.toBe('none');
      expect(tactileCard.shadow).not.toBe('none');
      expect(
        await page
          .locator('.view h2')
          .evaluate((element) => getComputedStyle(element, '::after').backgroundImage),
      ).not.toBe('none');
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

  const brandMark = page.locator('.header__brand-mark');
  const markColors = await brandMark.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(markColors.color).not.toBe(markColors.background);

  const activeNav = page.locator('.nav__item.is-active');
  const activeColors = await activeNav.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(activeColors.color).toBe('rgb(0, 0, 0)');
  expect(activeColors.background).toBe('rgb(255, 255, 255)');

  for (const selector of ['.header::after', '.nav::after', '.floor__label::before']) {
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
  const headerBox = await page.locator('.header').boundingBox();
  const navBox = await page.locator('.nav').boundingBox();
  expect(appBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(headerBox!.x).toBeGreaterThanOrEqual(appBox!.x);
  expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(appBox!.x + appBox!.width + 1);
  expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(appBox!.x + appBox!.width + 1);

  const audioButton = page.getByTestId('mute-toggle');
  const before = await audioButton.getAttribute('aria-pressed');
  await audioButton.click();
  await expect(audioButton).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');

  await page.locator('.nav__item').nth(1).click();
  await expect(page.locator('.nav__item').nth(1)).toHaveClass(/is-active/);
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
