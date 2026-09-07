/* eslint-disable no-console -- diagnostic entrypoint: console output is the point */
// Staged bisection entrypoint. Imports NOTHING from electron/main.ts. Each
// stage (--stage=a … n) adds exactly one concern on top of the previous, so the
// first stage that shows `render-view-deleted / webContents destroyed /
// ERR_FAILED` (or quits) pinpoints the culprit. Runnable per stage via the
// electron:stage-* npm scripts.
//
//   a data: URL, default window            h + a couple of IPC handlers
//   b local minimal HTML file              i + single-instance lock
//   c real dist/index.html, no preload     j + navigation guards
//   d + preload                            k + session/webRequest CSP
//   e + production webPreferences          l + Tray
//     (sandbox:true, webSecurity:true)     m + GPU self-heal + recovery
//   f + frameless / custom-frame options   n  (defer to the real main.cjs)
//   g + saved window bounds
import { app, BrowserWindow, ipcMain, session, Tray, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Isolated app name -> isolated userData + single-instance lock namespace, so
// the staged diagnostics can never steal or block the real game's lock (even
// the stage-i single-instance test runs in its own namespace).
app.setName('wmno-diagnostic');

const STAGES = 'abcdefghijklmn';
const stageArg = (process.argv.find((a) => a.startsWith('--stage=')) ?? '--stage=a').split('=')[1].toLowerCase();
const stageIdx = Math.max(0, STAGES.indexOf(stageArg));
const upTo = (letter: string) => stageIdx >= STAGES.indexOf(letter);

function diagLog(msg: string): void {
  const line = `[stage ${stageArg}] ${msg}`;
  // Own logger — not the project's — so this stays self-contained.
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.appendFileSync(path.join(app.getPath('userData'), 'diagnostic.log'), line + '\n');
  } catch {
    /* ignore */
  }
  console.log(line);
}

process.on('uncaughtException', (e) => diagLog(`uncaughtException: ${e.stack ?? e}`));
process.on('unhandledRejection', (r) => diagLog(`unhandledRejection: ${r instanceof Error ? r.stack : String(r)}`));

// --- i: single-instance lock (must run before whenReady) ---
if (upTo('i')) {
  const got = app.requestSingleInstanceLock();
  diagLog(`requestSingleInstanceLock -> ${got} (pid=${process.pid})`);
  if (!got) {
    diagLog('single-instance lock DENIED — another instance holds it — quitting.');
    app.quit();
  }
}

let tray: Tray | null = null;

function rendererPath(): string {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html'),
        path.join(__dirname, '..', 'dist', 'index.html'),
      ]
    : [path.join(__dirname, '..', 'dist', 'index.html')];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return candidates[0];
}

function buildWebPreferences(): Electron.WebPreferences {
  const wp: Electron.WebPreferences = { contextIsolation: true, nodeIntegration: false, sandbox: false };
  if (upTo('d')) wp.preload = path.join(__dirname, 'preload.cjs');
  if (upTo('e')) {
    wp.sandbox = true; // production webPreferences
    wp.webSecurity = true;
    wp.spellcheck = false;
  }
  return wp;
}

function savedBounds(): { width: number; height: number } {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'window-settings.json'), 'utf-8'));
    return { width: raw.width ?? 800, height: raw.height ?? 600 };
  } catch {
    return { width: 800, height: 600 };
  }
}

function addNavigationGuards(): void {
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
      if (url.startsWith('file://') || url.startsWith('data:')) return;
      event.preventDefault();
    });
  });
}

function addCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!/^https?:\/\//i.test(details.url)) {
      callback({});
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"],
      },
    });
  });
}

function addTray(win: BrowserWindow): void {
  try {
    const iconPath = path.join(process.resourcesPath, 'icon.png');
    const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
    if (img.isEmpty()) {
      diagLog('tray icon empty — skipping tray.');
      return;
    }
    tray = new Tray(img);
    tray.setToolTip('diagnostic');
    tray.on('click', () => win.show());
    diagLog('tray created.');
  } catch (e) {
    diagLog(`tray creation failed: ${String(e)}`);
  }
}

function attachLifecycle(win: BrowserWindow): void {
  const wc = win.webContents;
  wc.on('did-start-loading', () => diagLog('did-start-loading'));
  wc.on('dom-ready', () => diagLog('dom-ready'));
  wc.on('did-finish-load', () => diagLog('did-finish-load'));
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) =>
    diagLog(`did-fail-load code=${code} desc=${desc} url=${url} mainFrame=${isMainFrame}`),
  );
  wc.on('render-process-gone', (_e, d) => diagLog(`render-process-gone reason=${d.reason} exitCode=${d.exitCode}`));
  wc.on('destroyed', () => diagLog('webContents destroyed'));
  (wc as unknown as { on: (e: string, cb: () => void) => void }).on('render-view-deleted', () =>
    diagLog('render-view-deleted'),
  );
  win.on('closed', () => diagLog('window closed'));
}

app.whenReady().then(async () => {
  diagLog(`app ready. isPackaged=${app.isPackaged} electron=${process.versions.electron} chrome=${process.versions.chrome}`);

  if (upTo('h')) {
    // A couple of harmless IPC handlers (should never affect renderer startup).
    ipcMain.handle('diag:ping', () => 'pong');
    ipcMain.handle('diag:info', () => ({ pid: process.pid }));
    diagLog('registered diagnostic IPC handlers.');
  }
  if (upTo('j')) addNavigationGuards();
  if (upTo('k')) addCsp();

  // Window options accumulate by stage.
  const opts: Electron.BrowserWindowConstructorOptions = {
    width: 800,
    height: 600,
    show: true,
    frame: true,
    transparent: false,
    backgroundColor: '#ffffff',
    webPreferences: buildWebPreferences(),
  };
  if (upTo('f')) {
    opts.frame = false; // frameless / custom-frame like production
    opts.transparent = false;
    opts.backgroundColor = '#2a2118';
  }
  if (upTo('g')) {
    const b = savedBounds();
    opts.width = b.width;
    opts.height = b.height;
  }

  const win = new BrowserWindow(opts);
  attachLifecycle(win);
  diagLog(`BrowserWindow created. webPreferences=${JSON.stringify(opts.webPreferences)} frame=${opts.frame}`);

  if (upTo('l')) addTray(win);
  if (upTo('m')) {
    // GPU self-heal / recovery: for the bisect we only LOG (no relaunch) so it
    // can't mask the underlying failure.
    win.webContents.on('render-process-gone', (_e, d) =>
      diagLog(`[self-heal would trigger] render-process-gone reason=${d.reason}`),
    );
  }

  try {
    if (!upTo('b')) {
      await win.loadURL(
        'data:text/html;charset=UTF-8,' +
          encodeURIComponent('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>Stage A — data URL</h1></body></html>'),
      );
    } else if (!upTo('c')) {
      const tmp = path.join(app.getPath('temp'), 'wmno-diag-stage-b.html');
      fs.writeFileSync(tmp, '<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>Stage B — local file</h1></body></html>');
      await win.loadFile(tmp);
    } else {
      const rp = rendererPath();
      diagLog(`loading real renderer: ${rp} exists=${fs.existsSync(rp)} url=${pathToFileURL(rp).href}`);
      await win.loadFile(rp);
    }
    diagLog('STAGE LOAD RESOLVED');
  } catch (e) {
    diagLog(`load rejected: ${String(e)}`);
  }
});

app.on('render-process-gone', (_e, _wc, d) => diagLog(`app render-process-gone reason=${d.reason} exitCode=${d.exitCode}`));
app.on('child-process-gone', (_e, d) => diagLog(`child-process-gone type=${d.type} reason=${d.reason} exitCode=${d.exitCode}`));

app.on('window-all-closed', () => {
  diagLog('window-all-closed');
  if (process.platform !== 'darwin' && !tray) app.quit();
});
