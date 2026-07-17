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
// GPU / hardware-acceleration safe mode. MUST run before app.whenReady().
// A crashing GPU/renderer process (common with older Electron on some Windows
// GPU drivers) tears the renderer down before it can load — the exact
// did-start-loading -> render-view-deleted -> webContents destroyed -> ERR_FAILED
// sequence seen on Windows. Safe mode disables hardware acceleration.
// Sources (any one enables it):
//   • --disable-gpu-safe-mode CLI flag
//   • WMNO_DISABLE_GPU=1 env var
//   • a persisted <userData>/gpu-safe-mode marker (auto-written after a startup
//     renderer crash, so the app self-heals on the next launch)
// --force-gpu / WMNO_FORCE_GPU=1 clears the marker and forces acceleration on.
// ---------------------------------------------------------------------------
function gpuFlagPath(): string {
  try {
    return path.join(app.getPath('userData'), 'gpu-safe-mode');
  } catch {
    return path.join(app.getPath('temp'), 'wmno-gpu-safe-mode');
  }
}
const forceGpu = process.argv.includes('--force-gpu') || process.env.WMNO_FORCE_GPU === '1';
if (forceGpu) {
  try {
    fs.rmSync(gpuFlagPath(), { force: true });
  } catch {
    /* ignore */
  }
}
const gpuSafeMode =
  !forceGpu &&
  (process.argv.includes('--disable-gpu-safe-mode') ||
    process.env.WMNO_DISABLE_GPU === '1' ||
    (() => {
      try {
        return fs.existsSync(gpuFlagPath());
      } catch {
        return false;
      }
    })());
if (gpuSafeMode) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

// Startup state used by the recovery flow.
let startupSucceeded = false;

/**
 * DISABLED during diagnosis (directive #5). The old behaviour — auto-write the
 * safe-mode marker, app.relaunch() + app.exit() on a startup renderer crash —
 * could turn an ordinary load error into an immediate teardown, and combined
 * with the single-instance lock could get the relaunched instance denied and
 * killed. Safe mode remains a MANUAL flag only (--disable-gpu-safe-mode /
 * WMNO_DISABLE_GPU / a hand-created gpu-safe-mode marker). We NEVER
 * auto-relaunch, auto-exit, or auto-write the marker anymore.
 */
function maybeGpuFallback(reason: string): boolean {
  log(`renderer trouble during startup (${reason}) — GPU auto-relaunch is DISABLED; not restarting.`);
  return false;
}

// ---------------------------------------------------------------------------
// Single-instance lock: a desktop pet should never run twice. Logged loudly so
// we can tell if a lingering (tray/relaunched/crashed) instance is denying the
// lock and quitting THIS process during startup.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
log(`requestSingleInstanceLock -> ${gotLock} (pid=${process.pid})`);
if (!gotLock) {
  log('single-instance lock DENIED — another instance holds it — quitting this process.');
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

// Guards the error page against loading itself in a loop if it, too, fails.
let errorPageShown = false;

/**
 * Resolve the renderer's index.html.
 *
 * Packaged: load from `resources/app.asar.unpacked/dist` — NOT from inside
 * app.asar. Node can `require()` from the asar (the main process runs), but
 * Chromium's `file://` navigation into asar content fails with ERR_FAILED on
 * the real Windows build. electron-builder `asarUnpack: ["dist/**"]` writes the
 * whole renderer to disk so it (and every relative asset) loads as a plain
 * file, which is exactly the non-asar `file://` case that already works.
 *
 * Dev / unpacked launch: `__dirname` is `<root>/dist-electron`, so
 * `../dist/index.html` is correct.
 */
function resolveRendererPath(): string {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html'),
        path.join(__dirname, '..', 'dist', 'index.html'),
        path.join(app.getAppPath(), 'dist', 'index.html'),
      ]
    : [path.join(__dirname, '..', 'dist', 'index.html')];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

/**
 * Load the renderer from a real filesystem path via `loadFile` (which builds a
 * correctly-encoded file URL itself). We load from app.asar.unpacked, never
 * from inside app.asar, so Chromium's file:// loader isn't reading through the
 * archive.
 */
function loadRenderer(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    log('loadRenderer: window missing/destroyed — aborting.');
    return;
  }
  // Test hook: force the recovery path so the error window can be verified.
  if (process.env.WMNO_FORCE_RENDERER_FAIL) {
    log('WMNO_FORCE_RENDERER_FAIL set — simulating a renderer load failure.');
    showStartupError('Simulated renderer failure (WMNO_FORCE_RENDERER_FAIL).', 'file:///nonexistent/index.html');
    return;
  }
  const rendererPath = resolveRendererPath();
  const exists = fs.existsSync(rendererPath);
  const unpacked = rendererPath.includes('app.asar.unpacked');
  log(
    `loading renderer: isPackaged=${app.isPackaged} unpacked=${unpacked} ` +
      `resourcesPath=${process.resourcesPath} __dirname=${__dirname} ` +
      `rendererPath=${rendererPath} exists=${exists} winDestroyed=${mainWindow.isDestroyed()}`,
  );
  if (!exists) {
    showStartupError('Renderer index.html not found in the packaged app.', rendererPath);
    return;
  }
  mainWindow
    .loadFile(rendererPath)
    .then(() => log('loadFile resolved.'))
    .catch((e) => {
      log(`loadFile rejected: ${String(e)} winDestroyed=${mainWindow ? mainWindow.isDestroyed() : 'null'}`);
      showStartupError(String(e), rendererPath);
    });
}

/**
 * A minimal, self-contained recovery window that does not depend on the game
 * bundle. Framed (so it always has a native close button), immediately visible,
 * opaque. Used when the real window is gone or the renderer failed to load.
 */
function createRecoveryWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 480,
    show: true,
    frame: true,
    transparent: false,
    backgroundColor: '#2a2118',
    title: 'Working My Nuts Off! — startup error',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  log('recovery window created.');
  return win;
}

/**
 * Never fail silently and NEVER touch a destroyed window. If the main window is
 * gone (a prior crash), spin up a fresh recovery window; otherwise reuse the
 * existing one. Shows a readable inline page (no game bundle, no external
 * assets) with the failed path + log location. Fully wrapped so it cannot throw
 * an unhandled rejection.
 */
function showStartupError(description: string, failedPath: string): void {
  try {
    // The Windows crash proved a window can survive with a DESTROYED
    // webContents (mainWindow.isDestroyed()===false but
    // mainWindow.webContents.isDestroyed()===true). Loading into that dead
    // webContents throws "Object has been destroyed", so treat it as unusable
    // and build a brand-new recovery window instead of reusing it.
    let wcDead = false;
    try {
      wcDead = !mainWindow || mainWindow.webContents.isDestroyed();
    } catch {
      wcDead = true;
    }
    const unusable = !mainWindow || mainWindow.isDestroyed() || wcDead;
    if (unusable) {
      log('showStartupError: main window/webContents unusable — creating a fresh recovery window.');
      mainWindow = createRecoveryWindow();
      errorPageShown = false; // the fresh window still needs to show the page
    }
    if (errorPageShown) return;
    errorPageShown = true;
    const logPath = logFile();
    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Working My Nuts Off! — startup error</title></head>
<body style="margin:0;font-family:Segoe UI,system-ui,sans-serif;background:#2a2118;color:#f4ecdd;padding:28px;line-height:1.5">
<h1 style="margin:0 0 12px;font-size:20px">The game couldn't open its window</h1>
<p style="margin:0 0 16px;opacity:.85">The app started, but the game screen failed to load. Please share the details below so it can be fixed. This window stays open — you can close it any time.</p>
<div style="background:#1c150d;border:1px solid #4a3a24;border-radius:8px;padding:14px;font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all">
<b>Error:</b> ${escapeHtml(description)}
<b>Failed to load:</b> ${escapeHtml(failedPath)}
<b>App path:</b> ${escapeHtml(app.getAppPath())}
<b>Resources:</b> ${escapeHtml(process.resourcesPath)}
<b>Version:</b> ${escapeHtml(app.getVersion())}
<b>Log file:</b> ${escapeHtml(logPath)}
</div>
<p style="margin:18px 0 0"><button onclick="window.close()" style="font:inherit;padding:8px 18px;border-radius:8px;border:1px solid #6f5a36;background:#3a2c1c;color:#f4ecdd;cursor:pointer">Exit</button></p>
<p style="margin:14px 0 0;opacity:.7;font-size:12px">A full log was written to the file above.</p>
</body></html>`;
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    if (mainWindow && !mainWindow.isDestroyed()) {
      void mainWindow.loadURL(dataUrl).catch((e) => log(`error page load failed: ${String(e)}`));
      if (!mainWindow.isVisible()) mainWindow.show();
    }
  } catch (err) {
    log(`showStartupError failed (non-fatal): ${err instanceof Error ? err.stack : String(err)}`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
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
  // stuck hidden even if 'ready-to-show' doesn't fire.
  let shown = false;
  const reveal = () => {
    if (shown || !mainWindow || mainWindow.isDestroyed()) return;
    shown = true;
    mainWindow.show();
    log('mainWindow shown.');
  };
  // The tray is created ONLY after a successful renderer load (below), never
  // during a failed startup, so close-to-tray / hidden-window behaviour can
  // never hide or kill the app before the game is on screen.
  let trayCreated = false;
  const createTrayOnce = () => {
    if (trayCreated) return;
    trayCreated = true;
    try {
      createTray();
    } catch (err) {
      log(`createTray threw (continuing): ${String(err)}`);
    }
  };
  mainWindow.once('ready-to-show', reveal);
  setTimeout(reveal, 2500); // fallback reveal only — NOT tray

  // Verbose lifecycle logging so any packaged-only startup problem is fully
  // explained in startup.log. `winDestroyed` pinpoints if/when the window dies.
  const wc = mainWindow.webContents;
  const winDestroyed = () => (mainWindow ? String(mainWindow.isDestroyed()) : 'null');
  wc.on('did-start-loading', () => log(`renderer did-start-loading. winDestroyed=${winDestroyed()}`));
  wc.on('dom-ready', () => log(`renderer dom-ready (url=${wc.getURL()}).`));
  wc.on('did-finish-load', () => {
    log(`renderer did-finish-load (url=${wc.getURL()}).`);
    reveal();
    if (!errorPageShown) {
      startupSucceeded = true; // renderer is alive — disable the GPU auto-fallback
      // The real game loaded — now it is safe to enable the tray.
      createTrayOnce();
      log('STARTUP SUCCESS: renderer loaded and window shown.');
    }
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    log(
      `did-fail-load: errorCode=${code} errorDescription=${desc} validatedURL=${url} ` +
        `isMainFrame=${isMainFrame} winDestroyed=${winDestroyed()}`,
    );
    // Only the main document failing is fatal to the UI; a sub-resource miss
    // must not replace the whole game with an error. ERR_ABORTED (-3) is a
    // normal replacement (e.g. loading the error page itself).
    if (isMainFrame && code !== -3) {
      // A renderer that dies before ever loading is almost always a GPU/renderer
      // process crash — try one relaunch with hardware acceleration off before
      // giving up to the recovery window.
      if (maybeGpuFallback(`did-fail-load ${code}`)) return;
      showStartupError(`${desc} (${code})`, url);
    } else {
      reveal();
    }
  });
  wc.on('render-process-gone', (_e, details) => {
    log(
      `render-process-gone: reason=${details.reason} exitCode=${details.exitCode} ` +
        `winDestroyed=${winDestroyed()}`,
    );
    if (maybeGpuFallback(`render-process-gone ${details.reason}`)) return;
    if (!startupSucceeded) showStartupError(`Renderer process gone: ${details.reason}`, wc.getURL());
  });
  wc.on('unresponsive', () => log('renderer unresponsive.'));
  wc.on('responsive', () => log('renderer responsive.'));
  // `render-view-deleted` isn't in the current Electron type defs; register it
  // via a loosely-typed handle purely for diagnostics.
  (wc as unknown as { on: (e: string, cb: () => void) => void }).on('render-view-deleted', () =>
    log(`render-view-deleted. winDestroyed=${winDestroyed()} startupSucceeded=${startupSucceeded}`),
  );
  wc.on('destroyed', () => {
    log(`webContents destroyed. startupSucceeded=${startupSucceeded}`);
    // The window can outlive a destroyed webContents (seen on Windows). If this
    // happened before a successful load, surface the recovery window.
    if (!startupSucceeded) {
      showStartupError('Renderer webContents was destroyed before load finished.', 'about:blank');
    }
  });
  wc.on('preload-error', (_e, p, err) => log(`preload-error: ${p} — ${String(err)}`));
  // Surface renderer console errors/warnings into the startup log.
  wc.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) log(`renderer console [${level}] ${message} (${sourceId}:${line})`);
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
    void mainWindow.loadURL(process.env.WMNO_DEV_SERVER as string).catch((e) => {
      log(`loadURL(dev) failed: ${String(e)}`);
      showStartupError(String(e), process.env.WMNO_DEV_SERVER as string);
    });
  } else {
    loadRenderer();
  }

  mainWindow.on('focus', () => mainWindow?.webContents.send(IPC_EVENTS.focusChanged, true));
  mainWindow.on('blur', () => mainWindow?.webContents.send(IPC_EVENTS.focusChanged, false));

  const thisWindow = mainWindow;
  mainWindow.on('close', () => {
    log('window close event.');
    saveSettings();
  });

  mainWindow.on('closed', () => {
    log('window closed event.');
    // Only clear the reference if a newer window (e.g. a recovery window) hasn't
    // already taken its place.
    if (mainWindow === thisWindow) mainWindow = null;
  });

  mainWindow.on('hide', () => log('window hide event.'));
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
  // Belt-and-suspenders CSP header — ONLY for http(s) responses (the web build).
  // The packaged app loads over file:// and carries its CSP in the index.html
  // <meta> tag; intercepting file:// response headers here was breaking the
  // renderer load (ERR_FAILED), so local schemes are left completely untouched.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!/^https?:\/\//i.test(details.url)) {
      callback({}); // file:// / data: — do not touch, use the original response
      return;
    }
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
      // In the packaged app the renderer is served from file:// (and the inline
      // startup-error page from data:). Allow the app to navigate within itself;
      // only block navigations that would take the window to an external site.
      if (!isDev && (url.startsWith('file://') || url.startsWith('data:'))) return;
      log(`blocked navigation to: ${url}`);
      event.preventDefault();
    });
  });
}

// A second launch pings the instance that holds the lock — restore + surface
// the existing window instead of starting another game process/window.
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
});

// Surface GPU/renderer/utility child-process failures instead of dying quietly.
app.on('child-process-gone', (_e, details) =>
  log(
    `child-process-gone: type=${details.type} reason=${details.reason} ` +
      `exitCode=${details.exitCode} name=${details.name ?? ''} serviceName=${details.serviceName ?? ''}`,
  ),
);
app.on('render-process-gone', (_e, _wc, details) =>
  log(`render-process-gone (app): reason=${details.reason} exitCode=${details.exitCode}`),
);
app.on('gpu-info-update', () => {
  try {
    log(`gpu-info-update: featureStatus=${JSON.stringify(app.getGPUFeatureStatus())}`);
  } catch {
    /* ignore */
  }
});

/**
 * A completely isolated Chromium-liveness probe (`--minimal-window-test`): a
 * plain framed window loading an inline data: page — no preload, tray, custom
 * frame, CSP, guards, protocols, icon or renderer files. If THIS won't show, the
 * problem is the GPU/renderer process itself, not our app.
 */
function runMinimalWindowTest(): void {
  log(`MINIMAL WINDOW TEST starting. gpuSafeMode=${gpuSafeMode}`);
  const testWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    frame: true,
    transparent: false,
    backgroundColor: '#ffffff',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  const twc = testWindow.webContents;
  twc.on('dom-ready', () => log('MINIMAL WINDOW DOM READY'));
  twc.on('did-finish-load', () => log('MINIMAL WINDOW DID FINISH LOAD'));
  twc.on('did-fail-load', (_e, code, desc) => log(`MINIMAL WINDOW did-fail-load: ${desc} (${code})`));
  twc.on('render-process-gone', (_e, d) => log(`MINIMAL WINDOW render-process-gone: ${JSON.stringify(d)}`));
  testWindow.once('ready-to-show', () => testWindow.show());
  void testWindow
    .loadURL('data:text/html,<html><body><h1>Electron renderer alive</h1></body></html>')
    .then(() => log('MINIMAL WINDOW SUCCESS'))
    .catch((e) => log(`MINIMAL WINDOW loadURL rejected: ${String(e)}`));
}

/**
 * All real application startup. Called exactly ONCE, and ONLY after winning the
 * single-instance lock (see the gated registration below).
 */
async function initializeApplication(): Promise<void> {
  log(
    `app ready. isPackaged=${app.isPackaged} version=${app.getVersion()} electron=${process.versions.electron} ` +
      `chrome=${process.versions.chrome} gpuSafeMode=${gpuSafeMode} hwAccelDisabled=${gpuSafeMode} ` +
      `resourcesPath=${process.resourcesPath} __dirname=${__dirname}`,
  );
  try {
    log(`GPU feature status: ${JSON.stringify(app.getGPUFeatureStatus())}`);
  } catch (err) {
    log(`getGPUFeatureStatus failed: ${String(err)}`);
  }

  // Isolated Chromium liveness probe — skips the entire app.
  if (process.argv.includes('--minimal-window-test')) {
    runMinimalWindowTest();
    return;
  }

  try {
    hardenSession();
    registerIpc();
    createWindow(); // create the window FIRST so a later failure can't leave us window-less
    // NOTE: the tray is intentionally NOT created here. It is created only once
    // the renderer has successfully loaded (did-finish-load in createWindow), so
    // close-to-tray / hidden-window behaviour can never interfere with startup
    // or hide a failed launch.

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
}

// Real startup runs ONLY for the instance that won the single-instance lock
// (checked at the very top). A denied second instance already called app.quit()
// and must NOT register whenReady, create a window/tray/recovery, initialise
// IPC, load the renderer, or run any async startup.
if (gotLock) {
  void app.whenReady().then(initializeApplication).catch((e) => log(`whenReady failed: ${String(e)}`));
} else {
  log('lock not held — skipping whenReady/startup registration entirely.');
}

app.on('before-quit', () => log('app before-quit.'));

app.on('window-all-closed', () => {
  log(`window-all-closed (tray=${tray ? 'present' : 'none'} startupSucceeded=${startupSucceeded}).`);
  // If startup failed (renderer crashed before load), a recovery window is being
  // shown — don't quit out from under it. errorPageShown means recovery is up.
  if (!startupSucceeded && errorPageShown) {
    log('window-all-closed: holding open for the recovery window.');
    return;
  }
  // Tray keeps the app alive; only quit explicitly.
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('will-quit', () => {
  log('app will-quit.');
  globalShortcut.unregisterAll();
});
