# Security Policy

## Reporting a vulnerability

Please report security issues privately by opening a
[GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories)
on this repository (Security → Report a vulnerability) rather than a public
issue. We aim to acknowledge reports within a few days.

## Security posture

ZooWorkers is a fully offline game. It requires no server for core
gameplay and makes no network requests during play.

### Electron hardening

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer talks to the main process only through a small, explicitly-typed
  preload bridge (`electron/preload.ts`) over named IPC channels
  (`electron/ipc.ts`). No `require`, `process`, or arbitrary IPC is exposed.
- A strict Content-Security-Policy is applied both as a `<meta>` tag and as a
  response header from the main process.
- External navigation and `window.open` are blocked.
- No remote code loading and no use of `eval`.
- Single-instance lock prevents multiple copies running at once.

### Data & saves

- Saves are local (browser `localStorage` / Electron userData).
- Imported saves are parsed and sanitized by a Zod schema; unknown or invalid
  fields are dropped or replaced with safe defaults — a malformed import can
  never execute code or corrupt the running game.
- No invasive DRM or anti-cheat is used.

### Privacy

The optional activity-detection feature (Focus Harvest) only reads how long the
system has been idle. It never records keystrokes, text, application content,
window titles, browser history, file names, screenshots, or clipboard data. See
[`PRIVACY.md`](PRIVACY.md).

## Dependency auditing

Run `npm audit` to review dependency advisories. CI installs with `npm ci` for
reproducible builds. Keep dependencies updated via pull requests.
