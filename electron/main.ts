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
// Startup logging + crash safety.
// A packaged app must never die silently. Everything below writes to
// <userData>/startup.log AND stdout (visible with --enable-logging), and the
// global handlers stop an unhandled error from tearing the process down before
// we can see why.
// ---------------------------------------------------------------------------
function logFile(): string {
  try {
    return path.join(app.getPath('userData'), 'startup.log');
  } catch {
    return path.join(app.getPath('temp'), 'wmno-startup.log');
  }
}

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.appendFileSync(logFile(), line);
  } catch {
    /* logging must never throw */
  }
  try {
    process.stdout.write(line);
  } catch {
    /* ignore */
  }
}

process.on('uncaughtException', (err) => {
  // Handling this prevents the default Node behaviour of exiting the process,
  // so a stray error (e.g. a bad icon) can no longer kill the app on launch.
  log(`uncaughtException: ${err && err.stack ? err.stack : String(err)}`);
});
process.on('unhandledRejection', (reason) => {
  log(`unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
});

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

  // Only pass a validated NativeImage; never an undefined/invalid path.
  const appIcon = loadIconImage('icon.png');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    x: pos?.x,
    y: pos?.y,
    show: false, // shown on ready-to-show (with a safety fallback) to avoid a white flash
    frame: !settings.frameless,
    // Opaque, NOT transparent. A transparent frameless window on Windows has
    // unreliable native resizing and its visible edge sits inside a transparent
    // margin, so the OS resize grip never lines up with the border the player
    // sees. An opaque frameless window keeps the standard Windows resize frame
    // (WS_THICKFRAME) right at the visible edge — precise from every side and
    // corner — while our custom title bar still handles dragging + controls.
    // (Windows 11 rounds the corners of opaque frameless windows for us.)
    transparent: false,
    backgroundColor: '#2a2118',
    // A real desktop app: resizable from every edge/corner, maximizable and
    // restorable. The renderer UI is fully responsive to whatever size results.
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    skipTaskbar: false,
    alwaysOnTop: settings.alwaysOnTop,
    ...(appIcon ? { icon: appIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  log(`BrowserWindow created (icon=${appIcon ? 'set' : 'default'}).`);

  // Reveal the window once it is ready; a fallback timer guarantees it is never
  // stuck hidden even if 'ready-to-show' doesn't fire (transparent windows).
  let shown = false;
  const reveal = () => {
    if (shown || !mainWindow) return;
    shown = true;
    mainWindow.show();
    log('mainWindow shown.');
  };
  mainWindow.once('ready-to-show', reveal);
  setTimeout(reveal, 2500);

  // Diagnostics for renderer / process failures.
  mainWindow.webContents.on('did-finish-load', () => log('renderer did-finish-load.'));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log(`did-fail-load: code=${code} desc=${desc} url=${url}`);
    reveal(); // still show the window so the failure is visible, not a silent close
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log(`render-process-gone: ${JSON.stringify(details)}`);
  });
  mainWindow.webContents.on('preload-error', (_e, p, err) => {
    log(`preload-error: ${p} — ${String(err)}`);
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
  mainWindow.on('maximize', () => {
    persistBounds();
    mainWindow?.webContents.send(IPC_EVENTS.maximizeChanged, true);
  });
  mainWindow.on('unmaximize', () => {
    persistBounds();
    mainWindow?.webContents.send(IPC_EVENTS.maximizeChanged, false);
  });

  if (isDev) {
    log(`loading dev server: ${process.env.WMNO_DEV_SERVER}`);
    void mainWindow.loadURL(process.env.WMNO_DEV_SERVER as string).catch((e) => log(`loadURL failed: ${e}`));
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html');
    log(`loading renderer file: ${indexHtml} (exists=${fs.existsSync(indexHtml)})`);
    void mainWindow.loadFile(indexHtml).catch((e) => log(`loadFile failed: ${e}`));
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

// ---------------------------------------------------------------------------
// Icon resolution — robust in BOTH development and packaged builds.
//   • Packaged: icons are shipped via electron-builder `extraResources`, so they
//     live next to `process.resourcesPath` (NOT inside app.asar, NOT the cwd).
//   • Dev / bundled: fall back to the repo `build/` dir relative to __dirname.
// We verify the file exists and is a real file, and only ever hand Electron a
// validated, non-empty NativeImage (never undefined/null/''/a dir/SVG/URL).
// ---------------------------------------------------------------------------
function iconCandidates(file: string): string[] {
  const list: string[] = [];
  if (app.isPackaged) {
    list.push(path.join(process.resourcesPath, file)); // extraResources -> resources/<file>
    list.push(path.join(process.resourcesPath, 'build', file));
    list.push(path.join(__dirname, '..', 'build', file)); // if ever packed into asar
  } else {
    list.push(path.join(__dirname, '..', 'build', file)); // dist-electron/../build
    list.push(path.join(process.cwd(), 'build', file));
  }
  return list;
}

function resolveIconPath(file: string): string | undefined {
  for (const p of iconCandidates(file)) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

/** A validated, non-empty NativeImage for `file`, or null if none is usable. */
function loadIconImage(file: string): Electron.NativeImage | null {
  const p = resolveIconPath(file);
  if (!p) {
    log(`icon not found: ${file} (searched: ${iconCandidates(file).join(', ')})`);
    return null;
  }
  try {
    const img = nativeImage.createFromPath(p);
    if (img.isEmpty()) {
      log(`icon loaded but empty (skipping): ${p}`);
      return null;
    }
    return img;
  } catch (err) {
    log(`icon failed to load: ${p} — ${String(err)}`);
    return null;
  }
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
  // A tray icon MUST be a valid, non-empty image. Passing an empty NativeImage
  // (the old behaviour when no icon file existed) triggers the
  // "Argument must be a file path or a NativeImage" warning and, on Windows,
  // can throw during Tray construction — which was tearing the app down on
  // launch. If we have no usable icon we simply skip the tray.
  const img = loadIconImage('tray.png') ?? loadIconImage('icon.png');
  if (!img) {
    log('No valid tray icon available — skipping tray creation (app still runs).');
    return;
  }
  try {
    tray = new Tray(img);
    tray.setToolTip('Working My Nuts Off!');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => toggleVisibility());
    log('Tray created.');
  } catch (err) {
    log(`Tray creation failed (continuing without a tray): ${String(err)}`);
    tray = null;
  }
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
  ipcMain.handle(IPC.minimize, () => mainWindow?.minimize());
  ipcMain.handle(IPC.toggleMaximize, () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle(IPC.isMaximized, () => mainWindow?.isMaximized() ?? false);
  // The Close button: save window state, then either hide to tray (only if the
  // player opted in) or quit for real. Game progress is persisted by the
  // renderer before it calls this.
  ipcMain.handle(IPC.closeWindow, () => {
    saveSettings();
    if (settings.closeToTray && tray) {
      mainWindow?.hide();
    } else {
      app.quit();
    }
  });
  ipcMain.handle(IPC.quit, () => {
    saveSettings();
    app.quit();
  });

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

// Surface GPU/renderer/utility child-process failures instead of dying quietly.
app.on('child-process-gone', (_e, details) => log(`child-process-gone: ${JSON.stringify(details)}`));
app.on('render-process-gone', (_e, _wc, details) => log(`render-process-gone (app): ${JSON.stringify(details)}`));

app.whenReady().then(() => {
  log(
    `app ready. isPackaged=${app.isPackaged} version=${app.getVersion()} ` +
      `resourcesPath=${process.resourcesPath} __dirname=${__dirname}`,
  );
  try {
    hardenSession();
    registerIpc();
    createWindow(); // create the window FIRST so a later failure can't leave us window-less
    try {
      createTray();
    } catch (err) {
      log(`createTray threw (continuing): ${String(err)}`);
    }

    // Global hotkey to show/hide the companion (non-fatal if it fails).
    try {
      globalShortcut.register('CommandOrControl+Shift+N', () => toggleVisibility());
    } catch (err) {
      log(`globalShortcut register failed: ${String(err)}`);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    log('startup complete.');
  } catch (err) {
    log(`FATAL during startup: ${err instanceof Error ? err.stack : String(err)}`);
    // Make sure a window exists so the app doesn't vanish silently.
    if (!mainWindow) {
      try {
        createWindow();
      } catch (err2) {
        log(`recovery createWindow failed: ${String(err2)}`);
      }
    }
  }
});

app.on('window-all-closed', () => {
  // Tray keeps the app alive; only quit explicitly.
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
