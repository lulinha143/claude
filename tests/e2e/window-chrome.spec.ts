import { test, expect, type Page } from '@playwright/test';
import { stubDesktop } from './support/shell';

// The frameless desktop window has no native title bar: the HUD shelf IS the chrome,
// and the minimise / maximise / close buttons sit at its right end. Their position
// is a pure layout outcome, so this walks a resize matrix at several UI scales and
// asserts the controls stay inside the shelf, on its row, never pushed off-screen
// or down over the office — and that the shelf is the window's drag handle.

const SAVE = {
  version: 10,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 7_670_000, goldenNuts: 36, reputation: 167, morale: 82, permanentKernels: 3 },
  prestige: { count: 1, branch: null, skills: {} },
  employees: { pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.4 } },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  settings: { language: 'en', reducedMotion: true, fontScale: 1, uiScale: 1 },
};

// Electron's supported range, plus the awkward shapes in between.
const SIZES: { w: number; h: number; name: string }[] = [
  { w: 320, h: 420, name: 'enforced minimum' },
  { w: 380, h: 460, name: 'default companion' },
  { w: 520, h: 520, name: 'square small' },
  { w: 700, h: 500, name: 'wide and short' },
  { w: 900, h: 700, name: 'medium' },
  { w: 1280, h: 800, name: 'large' },
  { w: 1920, h: 1080, name: 'maximised' },
  { w: 2560, h: 1080, name: 'ultrawide' },
  { w: 640, h: 1200, name: 'tall and narrow' },
];

async function bootDesktop(page: Page, uiScale: number) {
  await stubDesktop(page);
  await page.addInitScript((seed) => localStorage.setItem('wmno.save.v1', JSON.stringify(seed)), {
    ...SAVE,
    settings: { ...SAVE.settings, uiScale },
  });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 20_000 });
  for (let index = 0; index < 5; index += 1) {
    const dismiss = page.locator('.popup__actions button').first();
    if (await dismiss.count()) await dismiss.click({ timeout: 1_200 }).catch(() => {});
    await page.waitForTimeout(100);
  }
}

async function chromeGeometry(page: Page) {
  return page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>('.hud')!;
    const controls = document.querySelector<HTMLElement>('.window-controls')!;
    const stage = document.querySelector<HTMLElement>('.app__stage')!;
    const h = hud.getBoundingClientRect();
    const c = controls.getBoundingClientRect();
    const buttons = [...controls.querySelectorAll<HTMLElement>('.wc-btn')].filter(
      (b) => getComputedStyle(b).display !== 'none',
    );
    return {
      controlCount: buttons.length,
      hasClose: buttons.some((b) => b.classList.contains('wc-btn--close')),
      pastHudBottom: c.bottom - h.bottom,
      aboveHud: h.top - c.top,
      intoStage: c.bottom - stage.getBoundingClientRect().top,
      right: c.right,
      hudRight: h.right,
      hudOverflow: hud.scrollWidth - hud.clientWidth,
    };
  });
}

for (const uiScale of [1, 1.25, 1.5]) {
  test(`window controls stay on the HUD shelf at every window size (UI scale ${uiScale})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootDesktop(page, uiScale);
    await expect(page.locator('.window-controls')).toBeVisible();

    for (const { w, h, name } of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(220);
      const g = await chromeGeometry(page);
      const at = `${name} (${w}x${h}, scale ${uiScale})`;
      // Minimise and close always; maximise may give way on the narrowest shelf.
      expect(g.controlCount, `${at}: window controls`).toBeGreaterThanOrEqual(2);
      expect(g.hasClose, `${at}: close button`).toBe(true);
      expect(g.pastHudBottom, `${at}: controls overflow the HUD`).toBeLessThanOrEqual(0);
      expect(g.aboveHud, `${at}: controls above the HUD`).toBeLessThanOrEqual(1);
      expect(g.intoStage, `${at}: controls reach the office`).toBeLessThanOrEqual(0);
      expect(g.hudOverflow, `${at}: HUD content overflows`).toBeLessThanOrEqual(1);
      expect(g.hudRight - g.right, `${at}: controls off the right edge`).toBeGreaterThanOrEqual(-1);
    }
  });
}

test('the whole draggable shelf excludes its own buttons', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await bootDesktop(page, 1);
  // On Windows the hit target itself must be no-drag, or the window-drag handler
  // swallows the click and a visibly present button does nothing.
  const regions = await page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>('.hud')!;
    const read = (el: Element) =>
      getComputedStyle(el).getPropertyValue('-webkit-app-region').trim();
    return {
      hud: read(hud),
      buttons: Array.from(hud.querySelectorAll('button')).map(read),
      icons: Array.from(hud.querySelectorAll('.wc-btn svg')).map(read),
      stats: Array.from(hud.querySelectorAll('.hud-stat, .hud__nuts')).map(read),
    };
  });
  expect(regions.hud).toBe('drag');
  expect(regions.buttons.length).toBeGreaterThanOrEqual(6);
  for (const region of [...regions.buttons, ...regions.icons, ...regions.stats]) {
    expect(region).toBe('no-drag');
  }
});
