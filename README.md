# Working My Nuts Off!

**A Tiny Desktop Idle Game** — _One squirrel. One startup. Way too many nuts._

A cozy, humorous desktop idle game that lives in a small window in the corner of
your screen. Inside a tree-trunk office, **Pip** the squirrel and a growing team
of animal employees build the world's largest nut-processing company while you
work, study, or relax.

It runs three ways from one codebase:

- **Web demo** — plays in any modern browser.
- **Development mode** — hot-reloading Vite dev server.
- **Native desktop app** — a frameless, transparent, always-on-top companion
  packaged with Electron for Windows, Linux, and macOS.

---

## Quick start

```bash
npm install        # install dependencies
npm run dev        # run the web/dev version at http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (web + renderer). |
| `npm run build` | Production web build into `dist/` (also the GitHub Pages demo). |
| `npm run preview` | Serve the production build locally. |
| `npm run build:electron` | Bundle the Electron main + preload into `dist-electron/`. |
| `npm run dev:electron` | Build the shell and launch Electron against the dev server. |
| `npm run package` | Build everything and produce native installers via electron-builder. |
| `npm run package:win` / `:linux` / `:mac` | Package for a specific platform. |
| `npm run test` | Vitest unit tests (72 tests). |
| `npm run test:e2e` | Playwright end-to-end tests. |
| `npm run lint` / `lint:fix` | ESLint. |
| `npm run typecheck` | TypeScript (renderer + electron). |
| `npm run format` | Prettier. |
| `npm run check:i18n` | Localization completeness report. |
| `npm run validate` | typecheck → lint → i18n → test → build (the full gate). |

### Try the desktop companion

```bash
npm run dev            # terminal 1: start the renderer dev server
npm run dev:electron   # terminal 2: launch the transparent desktop window
```

### Enable the developer balance panel

Run the web build with `?dev=1` (e.g. `http://localhost:5173/?dev=1`) or any dev
build. A **DEV** button appears bottom-left with tools to add currency, trigger
events, simulate offline time, use a deterministic seed, unlock employees, and
reset the save.

---

## What's implemented (honest status)

This repository is a **stable, runnable v1.0 foundation / vertical slice**. The
opening ~30 minutes of gameplay are polished; every visible control works; there
are no dead buttons or `TODO` placeholders in core systems.

| Area | Status |
| --- | --- |
| Deterministic simulation core (framework-independent) | ✅ Complete, unit-tested |
| Nuts, morale, reputation, golden nuts, permanent kernels | ✅ |
| Clicking, crate collection, automation, trickle production | ✅ |
| 51 upgrades across 6 categories | ✅ |
| 6 employees with passives, outfits, friendship, nicknames, dialogue | ✅ |
| 13 rooms / floors that unlock and stack visually | ✅ |
| 26 random events incl. 5 multi-step chains | ✅ |
| 41 achievements (local, with Steam adapter boundary) | ✅ |
| 24 collectible fictional nuts | ✅ |
| 32 decorations | ✅ |
| Prestige ("Go Completely Nuts") with 5 branches + 5-skill tree | ✅ |
| Focus Harvest (opt-in, supportive, never blocking) | ✅ |
| 3 micro-games | ✅ |
| Daily challenges (deterministic, offline, server-free) | ✅ |
| Moment Cards → save as PNG; Photo Mode | ✅ |
| Offline progression (clamped, tamper-safe) | ✅ |
| Save system: Zod schema, migrations, rotating backups, recovery, export/import | ✅ |
| Localization: **English + Brazilian Portuguese complete**, 10 draft locales | ✅ |
| Accessibility: reduced motion, high contrast, dyslexia font, colorblind, scaling, etc. | ✅ |
| Web Audio synthesized SFX + ambience (no copyrighted assets) | ✅ |
| Electron shell: frameless/transparent, tray, always-on-top, click-through, corners, scale, hotkey, single-instance, strict CSP | ✅ |
| Platform adapters with browser-safe fallbacks | ✅ |
| Original SVG art + reusable animation state machine | ✅ |
| CI (lint/typecheck/test/build), release, and Pages workflows | ✅ |

### Documented tradeoffs & limitations

- **Rendering uses inline SVG + CSS animation** behind a renderer boundary rather
  than PixiJS. SVG art is itself a brief requirement, and this keeps the vertical
  slice reliably buildable and hackable. The boundary (`src/art`) is designed so a
  PixiJS/sprite renderer can be dropped in without touching gameplay. See
  [`docs/ASSET_REPLACEMENT.md`](docs/ASSET_REPLACEMENT.md).
- **Draft locales** (es, fr, de, it, pl, ru, ja, ko, zh-CN, zh-TW) ship translated
  metadata + key UI strings and **fall back to English** for the rest, exactly as
  the brief allows. Every user-facing string is a localization key — nothing is
  hardcoded. `npm run check:i18n` reports coverage.
- **Playwright** runs in CI (`ubuntu-latest` with `--with-deps`). Some minimal
  sandboxes lack the system libraries Chromium needs (`libnspr4.so`, …); install
  them via your package manager or run the e2e suite in CI.
- **Steam** is prepared behind an adapter boundary (`src/platform/achievements.ts`,
  [`docs/STEAM.md`](docs/STEAM.md)) and is **not required** to build or play.

---

## Architecture

```
electron/        Desktop main process + secure preload (context-isolated, typed IPC)
src/
  sim/           Deterministic simulation (no React/Electron/Pixi imports)
  content/       Pure data: employees, upgrades, events, nuts, dialogue, …
  save/          Zod schema, versioned migrations, robust save manager
  platform/      Adapter boundary: browser fallback + desktop bridge + achievements
  audio/         Web Audio synthesized SFX/ambience
  i18n/          i18next setup + locale JSON
  state/         Zustand store bridging the engine to React + the game loop
  art/           Original SVG characters/scene + animation state machine
  ui/            React views, modals, components
tests/           Vitest unit tests + Playwright e2e
docs/            Design, balancing, localization, Steam, release, asset docs
.github/         CI / release / Pages workflows, issue + PR templates
```

The **simulation layer is framework-independent** and shared by the browser demo
and the desktop app. Security: `contextIsolation` on, `nodeIntegration` off,
`sandbox` on, strict CSP (meta tag + response header), no remote code, no `eval`,
external navigation/window-open blocked, imported saves sanitized by schema.

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the full plan
and [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) for the design.

---

## Packaging native builds

```bash
npm run package:win     # NSIS installer + portable .exe  -> release/
npm run package:linux   # AppImage                        -> release/
npm run package:mac     # dmg                             -> release/
```

Development packages are **unsigned**. Public commercial releases must add proper
code signing — see [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) and
[`docs/STEAM.md`](docs/STEAM.md). No signing secrets are needed for local or CI
development builds.

## Screenshots

There is no bundled binary screenshot (to keep the repo clean). To capture the
game: run `npm run dev`, then use **Photo Mode** (Collections → Photo Mode) to
frame the office, or save a **Moment Card** as a PNG from the Collections tab.
Moment Cards render entirely from game content and never capture your desktop.

## License

MIT — see [`LICENSE`](LICENSE). Bundled fonts fall back to safe system fonts; no
third-party art or audio is shipped. See [`docs/STEAM.md`](docs/STEAM.md) for the
EULA template (marked for legal review) and [`PRIVACY.md`](PRIVACY.md).
