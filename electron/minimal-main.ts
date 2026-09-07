/* eslint-disable no-console -- diagnostic entrypoint: console output is the point */
// Completely isolated Electron entrypoint for diagnosis.
//
// It imports NOTHING from the project — no main.ts, no ipc/platform/logging/
// tray/audio/settings/save/recovery/GPU modules, no single-instance lock, no
// command-line switches, no session/protocol/navigation handlers. It must
// behave exactly like an independent bare Electron app. If this stays open on
// Windows while `--minimal-window-test` (inside the full main.ts) does not, the
// project's top-level startup code is conclusively responsible.
import { app, BrowserWindow } from 'electron';

// Isolated app name -> isolated userData + single-instance lock namespace, so
// this diagnostic can never steal or block the real game's lock.
app.setName('wmno-minimal-test');

let win: BrowserWindow | null = null;

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    frame: true,
    transparent: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.on('closed', () => {
    win = null;
  });

  win.webContents.on('dom-ready', () => {
    console.log('ISOLATED MINIMAL DOM READY');
  });

  win.webContents.on('did-finish-load', () => {
    console.log('ISOLATED MINIMAL DID FINISH LOAD');
  });

  await win.loadURL(
    'data:text/html;charset=UTF-8,' +
      encodeURIComponent(`
        <!doctype html>
        <html>
          <body style="background:white;color:black;font-family:Arial;padding:40px">
            <h1>Isolated project Electron test</h1>
            <p>This entrypoint imports none of the real application startup.</p>
          </body>
        </html>
      `),
  );

  console.log('ISOLATED MINIMAL SUCCESS');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
