# Contributing to ZooWorkers

Thanks for helping Pip build the nut empire! This project is a data-driven idle
game designed to grow without architectural rewrites.

## Getting set up

```bash
npm install
npm run dev          # web/dev at http://localhost:5173
npm run validate     # run the full quality gate before pushing
```

## Ground rules

- **Keep the simulation framework-independent.** Code in `src/sim` and
  `src/content` must not import React, Electron, PixiJS, or the DOM. This keeps
  it unit-testable and shareable.
- **No hardcoded user-facing text.** Every string goes through i18next keys.
  Add new keys to `src/i18n/locales/en.json` and `pt-BR.json` (both must stay
  complete — `npm run check:i18n` enforces this).
- **Add content as data.** New employees, upgrades, events, nuts, decorations,
  and achievements are entries in the arrays under `src/content`. No new systems
  code should be needed for new content of an existing type.
- **Write meaningful tests**, not coverage padding. Simulation math, save
  migrations, event logic, and formatting all have unit tests — extend them.
- **No dead UI.** Every button must do something reachable through gameplay or
  the dev panel.

## Adding content

- **An employee** → add to `src/content/employees.ts`, a silhouette to
  `src/art/critterShapes.ts`, dialogue lines to the locale `dialogue.<category>`
  arrays (and bump `DIALOGUE_COUNTS`), and translations for name/role/story/outfits.
- **A random event** → add to `src/content/events.ts` with localization keys for
  the title/body/choices (and `steps` for chains).
- **A language** → see [`docs/LOCALIZATION.md`](docs/LOCALIZATION.md).

## Commit / PR conventions

- Small, focused commits with imperative messages ("Add capybara nap animation").
- Run `npm run validate` before opening a PR.
- Fill in the PR template; describe what you tested.

## Code style

ESLint + Prettier are configured. Run `npm run lint:fix` and `npm run format`.
Strict TypeScript is required (`npm run typecheck` must pass with no errors).
