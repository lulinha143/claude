# Implementation Plan — Working My Nuts Off!

_A Tiny Desktop Idle Game — One squirrel. One startup. Way too many nuts._

This document is the living build plan. It records the architecture, the phased
delivery order, and — honestly — what is fully implemented in this repository
versus what is scaffolded with a clear extension path.

## Guiding principles

1. **The simulation is framework-independent.** All game rules (economy,
   production, offline, prestige, events, achievements) live in `src/sim` and
   `src/content` as plain, deterministic TypeScript. They import nothing from
   React, Electron, or the renderer. This makes them unit-testable and reusable
   by the browser demo and the desktop app alike.
2. **Everything reachable is real.** No dead buttons, no fake loading screens,
   no `TODO` in core systems. Where a platform feature cannot exist in the
   browser (tray, always-on-top), an adapter provides a working fallback.
3. **Data-driven content.** Employees, upgrades, events, achievements,
   decorations, nuts, and dialogue are declared in data files so content can be
   added without touching systems code.
4. **Runnable after every phase.** `npm run dev`, `npm run typecheck`,
   `npm run test`, and `npm run build` are expected to pass throughout.

## Architecture

```
electron/            Desktop main process + secure preload (context isolated)
src/
  sim/               Deterministic simulation core (no framework imports)
    rng.ts           Seedable PRNG (mulberry32) for deterministic tests/daily
    format.ts        Compact number + locale formatting helpers
    config.ts        Central tunable balance constants + formulas
    economy.ts       Production, upgrade cost, modifier math
    engine.ts        The GameEngine: ticks, buys, collects, events
    offline.ts       Offline progression calculation (clamped, tamper-safe)
    prestige.ts      "Go Completely Nuts" reward math + branches
    events.ts        Data-driven random-event evaluation
    dailyChallenges.ts Deterministic date-seeded daily challenges
    achievements.ts  Achievement condition evaluation
    types.ts         Shared simulation types
  content/           Pure data: employees, upgrades, events, nuts, dialogue...
  save/              Zod schema, versioned migrations, robust save manager
  platform/          Adapter boundary: browser fallback + desktop bridge
  audio/             Web Audio synthesized SFX (no copyrighted assets)
  i18n/              i18next setup + locale JSON (EN + PT-BR complete)
  state/             Zustand store bridging the engine to React
  art/               Original SVG illustrations (Pip, employees, office)
  ui/                React views and components
tests/               Vitest unit tests + Playwright e2e
docs/                Design, balancing, localization, Steam, release docs
.github/             CI (lint/typecheck/test/build), release, Pages workflows
```

The renderer never gets raw Node access. `contextIsolation` is on,
`nodeIntegration` is off, and the preload exposes only a small typed API over
`contextBridge`. A strict CSP is set on the renderer HTML.

## Rendering choice (honest note)

The brief suggests PixiJS for the diorama. For a single-session vertical slice
that must reliably build in CI and stay readable/hackable, the office is
rendered with **original inline SVG + CSS/`requestAnimationFrame` animation**
behind a `SceneRenderer` boundary (`src/art`). SVG art is itself a brief
requirement ("Create all initial art assets ... using original SVG
illustrations"). The renderer boundary means a PixiJS `SceneRenderer`
implementation can be dropped in later without touching gameplay code. This
tradeoff is documented in `docs/ASSET_REPLACEMENT.md`.

## Phased delivery

- **Phase 1 — Foundation:** tooling, Electron shell, preload, adapters, CI,
  localization skeleton, this plan. ✅
- **Phase 2 — Playable core:** sim clock, nuts, upgrades, save, offline. ✅
- **Phase 3 — Presentation:** SVG art, office scene, animation states, UI,
  desktop-window controls. ✅
- **Phase 4 — Content:** employees, rooms, events, dialogue, decorations,
  collections, achievements, micro-games. ✅
- **Phase 5 — Long-term:** Focus Harvest, prestige, daily challenges, Moment
  Cards, photo mode, statistics. ✅
- **Phase 6 — Release quality:** accessibility, settings, localization
  validation, tests, perf, builds, Steam docs. ✅

## Status matrix

See `README.md` → "What's implemented" for the honest, current feature matrix.
