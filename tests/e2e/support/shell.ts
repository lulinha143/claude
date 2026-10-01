import type { Page } from '@playwright/test';

// The Phase 1 game shell, as the specs drive it. The office is always on screen;
// every other screen opens as a sheet from the dock (Settings from the HUD gear),
// and the five "records" pages live behind the Archive's tabs.

export type ShellView =
  | 'office'
  | 'employees'
  | 'shop'
  | 'decorate'
  | 'focus'
  | 'company'
  | 'collections'
  | 'achievements'
  | 'stats'
  | 'prestige'
  | 'settings';

const DOCK: Record<string, string> = {
  employees: 'team',
  shop: 'upgrades',
  decorate: 'decorate',
  focus: 'activities',
  company: 'archive',
  collections: 'archive',
  achievements: 'archive',
  stats: 'archive',
  prestige: 'archive',
};

/** Open a destination the way a player would: dock (or gear), then Archive tab. */
export async function openView(page: Page, view: ShellView): Promise<void> {
  if (view === 'office') {
    await closeSheet(page);
    return;
  }
  // count() first: getAttribute() on a missing element would wait for it to appear.
  const sheet = page.locator('.sheet');
  const current = (await sheet.count()) ? await sheet.getAttribute('data-sheet') : null;
  if (current === view) return;
  if (view === 'settings') {
    await page.locator('.hud__settings').click();
  } else {
    const dock = DOCK[view];
    const archiveOpen = dock === 'archive' && current !== null && DOCK[current] === 'archive';
    if (!archiveOpen) await page.locator(`.dock__item[data-dock="${dock}"]`).click();
    if (dock === 'archive') await page.locator(`.sheet__tab[data-view="${view}"]`).click();
  }
  await page.locator(`.sheet[data-sheet="${view}"]`).waitFor({ timeout: 10_000 });
}

/** Back to the office (the sheet's close button). No-op if nothing is open. */
export async function closeSheet(page: Page): Promise<void> {
  const close = page.locator('.sheet__close');
  if (await close.count()) {
    await close.click();
    await page.locator('.sheet').waitFor({ state: 'detached', timeout: 10_000 });
  }
}

/** The office's Arrange toggle (pinned beside the tree, never scrolled away). */
export function arrangeToggle(page: Page) {
  return page.locator('.scene-btn--arrange');
}

/** Bring a floor into view the way the elevator does. */
export async function goToFloor(page: Page, roomId: string): Promise<void> {
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('zw:focus-floor', { detail: { roomId: id } }));
  }, roomId);
  await page.waitForTimeout(120);
}

/**
 * Stub `window.desktop` so `getPlatform()` returns the desktop adapter and the
 * REAL window controls render (the browser build renders none).
 */
export async function stubDesktop(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
  });
}
