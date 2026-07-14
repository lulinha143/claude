# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
semantic versioning.

## [Unreleased] — production polish pass

### Changed / Added

- **Design-token system** (`src/ui/tokens.css`): semantic colour, department
  accents, elevation, spacing, radius, and motion tokens; high-contrast mode now
  overrides tokens only. No more scattered hardcoded colours in new components.
- **Character redesign:** the reusable `Critter` now renders six genuinely
  distinct species (squirrel, capybara, raccoon, beaver, crow, mole) with bespoke
  silhouettes, expressive blinking eyes, mood-driven mouths, eyebrows, buck
  teeth, masks, wings, and per-species tails — plus contact shadows and
  staggered idle timing. (Props changed from ear/tail/beak flags to `species`.)
- **Unified icon set** (`src/art/UiIcon.tsx`): original `currentColor` line icons
  replacing the emoji/text symbols in the header, nav, and prestige view.
- **Office diorama redesign:** organic tree-trunk SVG frame (bark, knots, roots,
  moss), per-department accent colours and labels, ambient room animations
  (coffee steam, conveyor, bubbling beaker, vault glint, swaying plant, etc.),
  and an "under construction" hint for the next unlockable room.
- **Feedback polish:** animated (tweened) nut counter, crate glow + press
  feedback, tabular figures so counters don't shift.
- **Tests:** added art render tests (all species × states, all icons) and an App
  mount smoke test.

### Save compatibility

- No save-schema change; `SAVE_VERSION` is unchanged and existing saves load
  unmodified.

## [1.0.0] — 2026-07-14

The initial stable foundation / vertical slice.

### Added

- Framework-independent deterministic simulation core (economy, production,
  offline, prestige, events, achievements, daily challenges, dialogue).
- Six employees (Pip, Marlow, Rizzo, Bea, Corvus, Mina) with passives, outfits,
  friendship, nicknames, per-character dialogue, and silhouettes.
- 51 upgrades across production, automation, furniture, coffee, quality, and rooms.
- 13 rooms/floors that unlock and stack the office vertically.
- 26 random events including 5 multi-step chains, with shareable Moment Cards.
- 41 local achievements with a Steam achievement adapter boundary.
- 24 collectible fictional nuts, 32 decorations, 12 employee outfits.
- Prestige ("Go Completely Nuts") with 5 company branches and a 5-node skill tree.
- Focus Harvest (opt-in, supportive), 3 micro-games, deterministic daily challenges.
- Offline progression with clamping and tamper protection.
- Robust save system: Zod schema validation, versioned migrations, rotating
  backups, corruption recovery, export/import.
- Localization: complete English and Brazilian Portuguese, plus 10 draft locales
  with English fallback; completeness checker and missing-key tooling.
- Full accessibility and settings menus.
- Web Audio synthesized sound effects and ambience (no copyrighted assets).
- Electron desktop shell: frameless/transparent window, system tray, always-on-top,
  click-through, corner docking, scale presets, global hotkey, single-instance
  lock, remembered window position, strict CSP, context isolation.
- Original SVG art and a reusable animation state machine.
- GitHub Actions: CI (lint/typecheck/test/build), tagged desktop releases, and a
  GitHub Pages web demo deploy.
- Vitest unit tests (72) and a Playwright end-to-end suite.
- Documentation: implementation plan, game design, balancing, localization,
  Steam preparation, release checklist, asset replacement, privacy, security.

### Known limitations

- Rendering uses SVG + CSS behind a renderer boundary (PixiJS is a documented
  future upgrade path).
- Draft locales fall back to English for untranslated keys.
