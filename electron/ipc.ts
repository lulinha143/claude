// Shared, explicitly-typed IPC channel contract between the Electron main
// process and the renderer's preload bridge. Keeping this in one place makes
// the surface auditable: the renderer can ONLY invoke these channels.

export type WindowCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WindowSettings {
  alwaysOnTop: boolean;
  clickThrough: boolean;
  corner: WindowCorner | null;
  scale: number; // 0.75 | 1 | 1.25 | 1.5
  frameless: boolean;
  quietMode: boolean;
  launchOnStartup: boolean;
  batterySaver: boolean;
  fpsLimit: number; // 30 | 60
}

export const DEFAULT_WINDOW_SETTINGS: WindowSettings = {
  alwaysOnTop: true,
  clickThrough: false,
  corner: 'bottom-right',
  scale: 1,
  frameless: true,
  quietMode: false,
  launchOnStartup: false,
  batterySaver: false,
  fpsLimit: 60,
};

// Channels the renderer may invoke (request/response).
export const IPC = {
  getWindowSettings: 'window:get-settings',
  setWindowSettings: 'window:set-settings',
  setAlwaysOnTop: 'window:set-always-on-top',
  setClickThrough: 'window:set-click-through',
  moveToCorner: 'window:move-to-corner',
  setScale: 'window:set-scale',
  hideToTray: 'window:hide-to-tray',
  show: 'window:show',
  quit: 'app:quit',
  getPlatformInfo: 'platform:info',
  getIdleSeconds: 'system:idle-seconds',
} as const;

// Channels main pushes to the renderer (events).
export const IPC_EVENTS = {
  toggleVisibility: 'event:toggle-visibility',
  quietMode: 'event:quiet-mode',
  focusChanged: 'event:focus-changed',
  showSettings: 'event:show-settings',
} as const;

export interface PlatformInfo {
  isDesktop: true;
  platform: NodeJS.Platform;
  isSteamDeck: boolean;
  appVersion: string;
}
