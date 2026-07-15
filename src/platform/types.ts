// Renderer-side mirror of the desktop bridge contract. Kept separate from the
// Electron `electron/ipc.ts` so the renderer never imports Electron types.

export type WindowCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WindowSettings {
  alwaysOnTop: boolean;
  clickThrough: boolean;
  corner: WindowCorner | null;
  scale: number;
  frameless: boolean;
  quietMode: boolean;
  launchOnStartup: boolean;
  batterySaver: boolean;
  fpsLimit: number;
  width?: number;
  height?: number;
  maximized?: boolean;
}

export interface PlatformInfo {
  isDesktop: boolean;
  platform: string;
  isSteamDeck: boolean;
  appVersion: string;
}

export interface DesktopBridge {
  isDesktop: true;
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

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
