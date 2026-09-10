import { test, expect, type Page } from '@playwright/test';

// The frameless desktop window has no native title bar: the letterhead IS the
// chrome, and the minimise / maximise / close buttons are ordinary flow children
// inside it. That makes their position a pure layout outcome, and it went wrong.
//
// Resizing the window substantially pushed the controls DOWN, over the navigation
// and the game. Three things caused it, all fixed here and all guarded below:
//
//   1. A stale rule re-templated the header from two ROWS into two COLUMNS and
//      centred them, so the short identity row was vertically centred against the
//      much taller figures strip. Its own attempt to pin the controls to row 1 was
//      a no-op, because they are not a direct child of the header.
//   2. The header had no `flex` of its own, so inside `.app`'s flex column it was
//      a shrinkable item: in a short window it compressed below its content height
//      while its children kept theirs, and the overflow painted over the content.
//   3. Its breakpoints were viewport media queries, but the shell is `zoom`ed by
//      the UI-scale setting and capped at 1200px, so they fired at sizes that bore
//      no relation to the space the header actually had.
//
// So this walks a resize matrix at several UI scales and asserts the controls stay
// inside the chrome and level with the company name.

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

/**
 * Boot with `window.desktop` stubbed, so `getPlatform()` returns the desktop
 * adapter and the REAL window controls render. The browser build renders nothing
 * there, so without this the thing under test would not exist.
 */
async function bootDesktop(page: Page, uiScale: number) {
  await page.addInitScript(
    (seed) => {
      localStorage.setItem('wmno.save.v1', JSON.stringify(seed));
      const settings = {
        alwaysOnTop: false,
        clickThrough: false,
        corner: null,
        scale: 1,
        frameless: true,
        quietMode: false,
        launchOnStartup: false,
        batterySaver: false,
        fpsLimit: 60,
        closeToTray: false,
      };
      const noop = () => () => {};
      (window as unknown as { desktop: unknown }).desktop = {
        isDesktop: true,
        getWindowSettings: () => Promise.resolve(settings),
        setWindowSettings: () => Promise.resolve(settings),
        setAlwaysOnTop: () => Promise.resolve(settings),
        setClickThrough: () => Promise.resolve(settings),
        moveToCorner: () => Promise.resolve(settings),
        setScale: () => Promise.resolve(settings),
        hideToTray: () => Promise.resolve(),
        show: () => Promise.resolve(),
        minimize: () => Promise.resolve(),
        toggleMaximize: () => Promise.resolve(false),
        isMaximized: () => Promise.resolve(false),
        closeWindow: () => Promise.resolve(),
        quit: () => Promise.resolve(),
        getIdleSeconds: () => Promise.resolve(0),
        getPlatformInfo: () =>
          Promise.resolve({
            isDesktop: true,
            platform: 'win32',
            isSteamDeck: false,
            appVersion: '0.0.0-test',
          }),
        onToggleVisibility: noop,
        onQuietMode: noop,
        onFocusChanged: noop,
        onShowSettings: noop,
        onMaximizeChanged: noop,
      };
    },
    { ...SAVE, settings: { ...SAVE.settings, uiScale } },
  );
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 20_000 });
  for (let index = 0; index < 5; index += 1) {
    const dismiss = page.locator('.modal button, .popup__actions button').first();
    if (await dismiss.count()) await dismiss.click({ timeout: 1_200 }).catch(() => {});
    await page.waitForTimeout(100);
  }
}

async function chromeGeometry(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.header')!;
    const controls = document.querySelector<HTMLElement>('.window-controls')!;
    const nav = document.querySelector<HTMLElement>('.nav')!;
    const main = document.querySelector<HTMLElement>('.app__main')!;
    const title = document.querySelector<HTMLElement>('.header__company')!;
    const h = header.getBoundingClientRect();
    const c = controls.getBoundingClientRect();
    return {
      controlCount: controls.querySelectorAll('.wc-btn').length,
      // Distances that must stay negative: the controls end before the header does.
      pastHeaderBottom: c.bottom - h.bottom,
      intoNav: c.bottom - nav.getBoundingClientRect().top,
      intoMain: c.bottom - main.getBoundingClientRect().top,
      // Level with the company name, i.e. in the title bar rather than adrift.
      offTitle: Math.abs(c.top - title.getBoundingClientRect().top),
      insideHeaderTop: c.top - h.top,
      height: c.height,
      right: c.right,
      headerRight: h.right,
      // The header must be tall enough for what is in it. When it was allowed to
      // shrink, its content overflowed downward over the navigation.
      headerOverflow: header.scrollHeight - header.clientHeight,
    };
  });
}

for (const uiScale of [1, 1.25, 1.5]) {
  test(`window controls stay in the title bar at every window size (UI scale ${uiScale})`, async ({
    page,
  }) => {
    // Boot once, then resize — a resize is exactly what used to break it.
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootDesktop(page, uiScale);
    await expect(page.locator('.window-controls')).toBeVisible();

    for (const { w, h, name } of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(220);
      const g = await chromeGeometry(page);
      const at = `${name} (${w}x${h}, scale ${uiScale})`;

      expect(g.controlCount, `${at}: three controls`).toBe(3);
      expect(g.pastHeaderBottom, `${at}: controls overflow the header`).toBeLessThanOrEqual(0);
      expect(g.intoNav, `${at}: controls reach the navigation`).toBeLessThanOrEqual(0);
      expect(g.intoMain, `${at}: controls reach the play area`).toBeLessThanOrEqual(0);
      expect(g.insideHeaderTop, `${at}: controls above the header`).toBeGreaterThanOrEqual(-1);
      // THE drift assertion. "Inside the header" is not enough: the bug pushed the
      // controls down while the header grew around them, so they stayed technically
      // contained but stopped being title-bar controls. They belong in the first
      // row, so their top must sit within their own height of the header's top.
      expect(g.insideHeaderTop, `${at}: controls pushed down out of the title bar`).toBeLessThan(
        g.height,
      );
      // Level with the company name, within one control's height.
      expect(g.offTitle, `${at}: controls adrift from the title`).toBeLessThan(g.height);
      // The header never compresses below its content.
      expect(g.headerOverflow, `${at}: header content overflows the header`).toBeLessThanOrEqual(1);
      // Still tucked into the top-right corner rather than pushed off-screen.
      expect(g.headerRight - g.right, `${at}: controls off the right edge`).toBeGreaterThanOrEqual(
        -1,
      );
    }
  });
}

test('the whole draggable title bar excludes its own buttons', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await bootDesktop(page, 1);
  // On Windows the hit target itself must be no-drag, or the window-drag handler
  // swallows the click and a visibly present button does nothing.
  const regions = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.header')!;
    const read = (el: Element) =>
      getComputedStyle(el).getPropertyValue('-webkit-app-region').trim();
    return {
      header: read(header),
      buttons: Array.from(header.querySelectorAll('.wc-btn')).map(read),
      icons: Array.from(header.querySelectorAll('.wc-btn svg')).map(read),
    };
  });
  expect(regions.header).toBe('drag');
  expect(regions.buttons.length).toBe(3);
  for (const region of [...regions.buttons, ...regions.icons]) {
    expect(region).toBe('no-drag');
  }
});
