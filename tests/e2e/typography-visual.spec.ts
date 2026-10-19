import { expect, test, type Page } from '@playwright/test';
import { openView } from './support/shell';

const LABEL = process.env.TYPO_SHOT_LABEL ?? 'current';
const DIR = 'visual-artifacts/typography';

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Patas & Castanhas Ltda.' },
  resources: { nuts: 125_430, goldenNuts: 18, reputation: 250, morale: 86, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 7, friendship: 72, room: 'founder-desk', x: 0.24 },
    marlow: { hired: true, level: 4, friendship: 58, room: 'founder-desk', x: 0.62 },
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

async function seed(page: Page, language: 'en' | 'pt-BR') {
  await page.addInitScript(
    ({ save, lang }) => {
      localStorage.setItem(
        'wmno.save.v1',
        JSON.stringify({
          ...save,
          settings: { language: lang, reducedMotion: true, fontScale: 1, uiScale: 1 },
        }),
      );
    },
    { save: SAVE, lang: language },
  );
}

async function dismiss(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const button = page.locator('.popup__actions button, .modal button').first();
    if (!(await button.count())) break;
    await button.click().catch(() => {});
    await page.waitForTimeout(100);
  }
}

for (const scenario of [
  { name: 'desktop-en', width: 1280, height: 800, language: 'en' as const },
  { name: 'compact-en', width: 420, height: 760, language: 'en' as const },
  { name: 'desktop-ptBR', width: 1280, height: 800, language: 'pt-BR' as const },
]) {
  test(`${scenario.name} typography specimen`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await seed(page, scenario.language);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15_000 });
    await dismiss(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.app')).toBeVisible();
    await page.screenshot({
      path: `${DIR}/${LABEL}-${scenario.name}.png`,
      fullPage: false,
    });
  });
}

test('selected production fonts are bundled, active, and offline-safe', async ({ page }) => {
  const requests: string[] = [];
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    requests.push(request.url());
    if (request.resourceType() === 'font') fontRequests.push(request.url());
  });

  await seed(page, 'pt-BR');
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const loadedFaces = await page.evaluate(async () => ({
    display: (
      await document.fonts.load(
        '700 24px "DynaPuff"',
        'AÇÃO coração café avô órgão bênção maçã você',
      )
    ).length,
    body: (
      await document.fonts.load('400 16px "Nunito"', 'AÇÃO coração café avô órgão bênção maçã você')
    ).length,
  }));
  expect(loadedFaces.display).toBeGreaterThan(0);
  expect(loadedFaces.body).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.check('700 24px DynaPuff'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('400 16px Nunito'))).toBe(true);
  const families = await page
    .locator('body')
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(families).toContain('Nunito');
  // An accented room name renders in one of the two bundled faces (the floor
  // plaques are set in the display face).
  const accentedRoomLabel = page
    .locator('.floor__label')
    .filter({ hasText: 'Câmara de Soneca' })
    .first();
  await accentedRoomLabel.scrollIntoViewIfNeeded();
  await expect(accentedRoomLabel).toBeVisible();
  expect(
    await accentedRoomLabel.evaluate((element) => getComputedStyle(element).fontFamily),
  ).toMatch(/DynaPuff|Nunito/);

  await openView(page, 'collections');
  await expect(page.locator('.view--collections')).toBeVisible();
  await page.locator('.view--collections .ghost-btn').first().click();
  await expect(page.locator('.photo-mode')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.photo-mode__toolbar .buy-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^office-\d+\.png$/);

  const pageOrigin = new URL(page.url()).origin;
  const remoteRequests = requests.filter((url) => {
    const parsed = new URL(url);
    return (
      parsed.protocol !== 'data:' && parsed.protocol !== 'blob:' && parsed.origin !== pageOrigin
    );
  });
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(remoteRequests).toEqual([]);
});
