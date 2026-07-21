# Windows build troubleshooting

Common issues when building the desktop app on Windows and how to fix them.

## Error: `Cannot create symbolic link ... The client does not have the required privilege`

Full symptom (during `npm run build:windows`):

```
⨯ cannot execute  cause=exit status 2
ERROR: Cannot create symbolic link : ... winCodeSign\...\darwin\10.12\lib\libcrypto.dylib
```

### Why it happens

To build the **NSIS installer**, electron-builder downloads a helper package
(`winCodeSign`) that contains macOS files stored as *symbolic links*. Creating a
symbolic link on Windows requires a special privilege. A normal (non-admin)
account without Developer Mode cannot create them, so extraction fails.

This has **nothing to do with the game code** — the app itself (`vite build` and
the Electron bundle) compiles successfully before this step.

### Good news: you may already have a runnable .exe

electron-builder creates the unpacked app **before** the failing step. Look in:

```
release\win-unpacked\ZooWorkers.exe
```

Double-click it — it runs without any installer. You can copy the whole
`win-unpacked` folder anywhere and run the game from there.

### Fastest way to get a runnable build (no admin needed)

Build only the app folder (skips the installer/signing tooling entirely):

```powershell
npm run build:windows:folder
```

Result: `release\win-unpacked\ZooWorkers.exe` (a portable folder build).

### If you want the full installer (`Setup .exe`)

Pick **one** of these, then re-run `npm run build:windows`:

**Option A — Enable Developer Mode (recommended, no admin each time)**

1. Open **Settings → Privacy & security → For developers**.
2. Turn **Developer Mode** ON.
3. Clear the broken cache, then rebuild:
   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
   npm run build:windows
   ```

**Option B — Run the terminal as Administrator**

1. Close the current terminal.
2. Right-click **PowerShell → Run as administrator**.
3. `cd` back into the project folder.
4. Clear the cache and rebuild:
   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
   npm run build:windows
   ```

## Where the outputs land

After a successful build, everything is in the `release\` folder:

| Command | Output |
| --- | --- |
| `npm run build:windows:folder` | `release\win-unpacked\ZooWorkers.exe` (portable folder) |
| `npm run build:portable` | `release\ZooWorkers-<version>-portable.exe` (single file) |
| `npm run build:windows` | `release\ZooWorkers-<version>-x64.exe` (NSIS installer) |

## Note about the "default Electron icon is used" warning

This is only a warning: no custom app icon is set yet, so the app uses the
default Electron icon. It does not stop the build. To ship a custom icon, add
`build/icon.ico` (256×256) and it will be picked up automatically.
