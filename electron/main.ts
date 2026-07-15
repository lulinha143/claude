import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  screen,
  globalShortcut,
  powerMonitor,
  nativeImage,
  session,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {
  IPC,
  IPC_EVENTS,
  DEFAULT_WINDOW_SETTINGS,
  type WindowSettings,
  type WindowCorner,
  type PlatformInfo,
} from './ipc';

// ---------------------------------------------------------------------------
// Single-instance lock: a desktop pet should never run twice.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const BASE_WIDTH = 380;
const BASE_HEIGHT = 460;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 420;
const MAX_WIDTH = 2600;
const MAX_HEIGHT = 1800;
const isDev = !!process.env.WMNO_DEV_SERVER;
let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: WindowSettings = { ...DEFAULT_WINDOW_SETTINGS };

// Window settings are persisted next to the OS userData dir so position/scale
// survive restarts. This is separate from game progression, which the renderer
// persists itself.
function settingsPath(): string {
  return path.join(app.getPath('userData'), 'window-settings.json');
}

function loadSettings(): void {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8');
    settings = { ...DEFAULT_WINDOW_SETTINGS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULT_WINDOW_SETTINGS };
  }
}

function saveSettings(): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist window settings', err);
  }
}

function scaledSize(): { width: number; height: number } {
  return {
    width: Math.round(BASE_WIDTH * settings.scale),
    height: Math.round(BASE_HEIGHT * settings.scale),
  };
}

function cornerPosition(corner: WindowCorner): { x: number; y: number } {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area = display.workArea;
  const { width, height } = scaledSize();
  const margin = 16;
  switch (corner) {
    case 'top-left':
      return { x: area.x + margin, y: area.y + margin };
    case 'top-right':
      return { x: area.x + area.width - width - margin, y: area.y + margin };
    case 'bottom-left':
      return { x: area.x + margin, y: area.y + area.height - height - margin };
    case 'bottom-right':
    default:
      return {
        x: area.x + area.width - width - margin,
        y: area.y + area.height - height - margin,
      };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Applies window flags. When `resize` is true (an explicit scale/corner change)
 * the window snaps back to the scaled base size and the remembered free-resize
 * bounds are cleared; otherwise a manual resize is preserved.
 */
function applyWindowSettings(resize = false): void {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
  if (resize && !mainWindow.isMaximized()) {
    settings.width = undefined;
    settings.height = undefined;
    const { width, height } = scaledSize();
    mainWindow.setSize(width, height);
    if (settings.corner) {
      const pos = cornerPosition(settings.corner);
      mainWindow.setPosition(pos.x, pos.y);
    }
  }
  saveSettings();
}

function createWindow(): void {
  loadSettings();
  // Prefer the player's remembered free-resize bounds; otherwise fall back to
  // the scaled base size.
  const scaled = scaledSize();
  const width = clamp(settings.width ?? scaled.width, MIN_WIDTH, MAX_WIDTH);
  const height = clamp(settings.height ?? scaled.height, MIN_HEIGHT, MAX_HEIGHT);
  const pos = settings.corner && settings.width == null ? cornerPosition(settings.corner) : undefined;

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    x: pos?.x,
    y: pos?.y,
    frame: !settings.frameless,
    transparent: settings.frameless,
    backgroundColor: settings.frameless ? '#00000000' : '#2a2118',
    // A real desktop app: resizable from every edge/corner, maximizable and
    // restorable. The renderer UI is fully responsive to whatever size results.
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    skipTaskbar: false,
    alwaysOnTop: settings.alwaysOnTop,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
  if (settings.maximized) mainWindow.maximize();

  // Remember free-resize bounds + maximized state (debounced).
  const persistBounds = () => {
    if (!mainWindow) return;
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (!mainWindow) return;
      settings.maximized = mainWindow.isMaximized();
      if (!settings.maximized) {
        const b = mainWindow.getBounds();
        settings.width = b.width;
        settings.height = b.height;
      }
      saveSettings();
    }, 400);
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('maximize', persistBounds);
  mainWindow.on('unmaximize', persistBounds);

  if (isDev) {
    void mainWindow.loadURL(process.env.WMNO_DEV_SERVER as string);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('focus', () => mainWindow?.webContents.send(IPC_EVENTS.focusChanged, true));
  mainWindow.on('blur', () => mainWindow?.webContents.send(IPC_EVENTS.focusChanged, false));

  mainWindow.on('close', () => {
    saveSettings();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function iconPath(): string | undefined {
  const candidate = path.join(__dirname, '../build/icon.png');
  return fs.existsSync(candidate) ? candidate : undefined;
}

function toggleVisibility(): void {
  if (!mainWindow) return createWindow();
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { label: 'Hide', click: () => mainWindow?.hide() },
    {
      label: 'Quiet Mode',
      type: 'checkbox',
      checked: settings.quietMode,
      click: (item) => {
        settings.quietMode = item.checked;
        saveSettings();
        mainWindow?.webContents.send(IPC_EVENTS.quietMode, settings.quietMode);
      },
    },
    { type: 'separator' },
    { label: 'Settings…', click: () => mainWindow?.webContents.send(IPC_EVENTS.showSettings) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function createTray(): void {
  const img = iconPath()
    ? nativeImage.createFromPath(iconPath() as string)
    : nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('Working My Nuts Off!');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => toggleVisibility());
}

function detectSteamDeck(): boolean {
  // Steam sets this environment variable inside the Deck's game runtime.
  return process.env.SteamDeck === '1' || process.env.SteamOS === '1';
}

function registerIpc(): void {
  ipcMain.handle(IPC.getWindowSettings, () => settings);

  ipcMain.handle(IPC.setWindowSettings, (_e, partial: Partial<WindowSettings>) => {
    settings = { ...settings, ...partial };
    // Re-snap the size only when the player explicitly changes scale or corner.
    const resize = typeof partial.scale === 'number' || 'corner' in partial;
    applyWindowSettings(resize);
    if (typeof partial.launchOnStartup === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: partial.launchOnStartup });
    }
    return settings;
  });

  ipcMain.handle(IPC.setAlwaysOnTop, (_e, value: boolean) => {
    settings.alwaysOnTop = value;
    mainWindow?.setAlwaysOnTop(value, 'screen-saver');
    saveSettings();
    return settings;
  });

  ipcMain.handle(IPC.setClickThrough, (_e, value: boolean) => {
    settings.clickThrough = value;
    mainWindow?.setIgnoreMouseEvents(value, { forward: true });
    saveSettings();
    return settings;
  });

  ipcMain.handle(IPC.moveToCorner, (_e, corner: WindowCorner) => {
    settings.corner = corner;
    applyWindowSettings(true);
    return settings;
  });

  ipcMain.handle(IPC.setScale, (_e, scale: number) => {
    settings.scale = scale;
    applyWindowSettings(true);
    return settings;
  });

  ipcMain.handle(IPC.hideToTray, () => mainWindow?.hide());
  ipcMain.handle(IPC.show, () => mainWindow?.show());
  ipcMain.handle(IPC.quit, () => app.quit());

  ipcMain.handle(IPC.getIdleSeconds, () => {
    // Only the number of seconds the whole system has been idle. This never
    // inspects keystrokes, window titles, clipboard, or any user content.
    return powerMonitor.getSystemIdleTime();
  });

  ipcMain.handle(IPC.getPlatformInfo, (): PlatformInfo => {
    return {
      isDesktop: true,
      platform: process.platform,
      isSteamDeck: detectSteamDeck(),
      appVersion: app.getVersion(),
    };
  });
}

function hardenSession(): void {
  // Belt-and-suspenders CSP on top of the meta tag in index.html.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'",
        ],
      },
    });
  });

  // Block any attempt to open external windows or navigate away.
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
      if (isDev && url.startsWith(process.env.WMNO_DEV_SERVER as string)) return;
      event.preventDefault();
    });
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  hardenSession();
  registerIpc();
  createWindow();
  createTray();

  // Global hotkey to show/hide the companion.
  globalShortcut.register('CommandOrControl+Shift+N', () => toggleVisibility());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Tray keeps the app alive; only quit explicitly.
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
