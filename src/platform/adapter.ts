import type { DesktopBridge, PlatformInfo, WindowCorner, WindowSettings } from './types';

// A single adapter the whole UI uses for "desktop companion" features. On the
// desktop it forwards to the preload bridge (`window.desktop`); in the browser
// it provides safe, no-op fallbacks so the exact same UI runs everywhere.

const BROWSER_DEFAULTS: WindowSettings = {
  alwaysOnTop: false,
  clickThrough: false,
  corner: null,
  scale: 1,
  frameless: false,
  quietMode: false,
  launchOnStartup: false,
  batterySaver: false,
  fpsLimit: 60,
};

export interface PlatformAdapter {
  readonly isDesktop: boolean;
  getWindowSettings(): Promise<WindowSettings>;
  setWindowSettings(partial: Partial<WindowSettings>): Promise<WindowSettings>;
  setAlwaysOnTop(value: boolean): Promise<WindowSettings>;
  setClickThrough(value: boolean): Promise<WindowSettings>;
  moveToCorner(corner: WindowCorner): Promise<WindowSettings>;
  setScale(scale: number): Promise<WindowSettings>;
  hideToTray(): Promise<void>;
  show(): Promise<void>;
  quit(): Promise<void>;
  getIdleSeconds(): Promise<number>;
  getPlatformInfo(): Promise<PlatformInfo>;
  onToggleVisibility(cb: () => void): () => void;
  onQuietMode(cb: (enabled: boolean) => void): () => void;
  onFocusChanged(cb: (focused: boolean) => void): () => void;
  onShowSettings(cb: () => void): () => void;
}

class DesktopAdapter implements PlatformAdapter {
  readonly isDesktop = true;
  constructor(private bridge: DesktopBridge) {}
  getWindowSettings() {
    return this.bridge.getWindowSettings();
  }
  setWindowSettings(p: Partial<WindowSettings>) {
    return this.bridge.setWindowSettings(p);
  }
  setAlwaysOnTop(v: boolean) {
    return this.bridge.setAlwaysOnTop(v);
  }
  setClickThrough(v: boolean) {
    return this.bridge.setClickThrough(v);
  }
  moveToCorner(c: WindowCorner) {
    return this.bridge.moveToCorner(c);
  }
  setScale(s: number) {
    return this.bridge.setScale(s);
  }
  hideToTray() {
    return this.bridge.hideToTray();
  }
  show() {
    return this.bridge.show();
  }
  quit() {
    return this.bridge.quit();
  }
  getIdleSeconds() {
    return this.bridge.getIdleSeconds();
  }
  getPlatformInfo() {
    return this.bridge.getPlatformInfo();
  }
  onToggleVisibility(cb: () => void) {
    return this.bridge.onToggleVisibility(cb);
  }
  onQuietMode(cb: (e: boolean) => void) {
    return this.bridge.onQuietMode(cb);
  }
  onFocusChanged(cb: (f: boolean) => void) {
    return this.bridge.onFocusChanged(cb);
  }
  onShowSettings(cb: () => void) {
    return this.bridge.onShowSettings(cb);
  }
}

class BrowserAdapter implements PlatformAdapter {
  readonly isDesktop = false;
  private settings: WindowSettings = { ...BROWSER_DEFAULTS };

  async getWindowSettings() {
    return this.settings;
  }
  async setWindowSettings(p: Partial<WindowSettings>) {
    this.settings = { ...this.settings, ...p };
    return this.settings;
  }
  async setAlwaysOnTop(v: boolean) {
    this.settings.alwaysOnTop = v;
    return this.settings;
  }
  async setClickThrough(v: boolean) {
    this.settings.clickThrough = v;
    return this.settings;
  }
  async moveToCorner(c: WindowCorner) {
    this.settings.corner = c;
    return this.settings;
  }
  async setScale(s: number) {
    this.settings.scale = s;
    return this.settings;
  }
  async hideToTray() {
    /* not available in the browser */
  }
  async show() {
    /* not available in the browser */
  }
  async quit() {
    /* the browser tab can't quit itself */
  }
  async getIdleSeconds() {
    // Browser cannot read OS idle time; Focus Harvest just won't auto-detect.
    return 0;
  }
  async getPlatformInfo(): Promise<PlatformInfo> {
    return { isDesktop: false, platform: 'browser', isSteamDeck: false, appVersion: 'web' };
  }
  onToggleVisibility() {
    return () => {};
  }
  onQuietMode() {
    return () => {};
  }
  onFocusChanged(cb: (f: boolean) => void) {
    const handler = () => cb(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }
  onShowSettings() {
    return () => {};
  }
}

let cached: PlatformAdapter | null = null;
export function getPlatform(): PlatformAdapter {
  if (cached) return cached;
  cached =
    typeof window !== 'undefined' && window.desktop
      ? new DesktopAdapter(window.desktop)
      : new BrowserAdapter();
  return cached;
}
