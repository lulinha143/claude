# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
semantic versioning.

## [Unreleased] — audio, breakdown & start-screen pass

### Changed

- **Replaced the Raccoon Inventory Check micro-game with the Procurement
  Conveyor** (brief §26). The old game was a random spot-the-swap memory test;
  the new Logistics game is physical and skill-based: parcels ride the intake
  belt and the player drags each onto the correct department chute (Harvesting /
  Roasting / Logistics / Research), rotating the sideways ones so they fit.
  Departments are distinguished by icon + shape/pattern + label (colour-blind
  safe). Combos reward accurate sorting; fragile and rotated parcels grant a
  small bonus; mistakes are gentle and never soft-lock. Full keyboard (`1`–`4`
  route, `R` rotate) and pointer/touch drag support, Reduced-Motion aware.
  Deterministic rules (`procurementSequence` / `procurementResolve` /
  `procurementScoreDelta`) are unit-tested. See `docs/MINIGAMES.md`.

- **Added a second new minigame, Cable Untangle Desk** (brief §27 "Cable Untangle
  Desk"; IT / Maintenance). A messy workstation's computers are wired into a
  single loop of cables that start crossed; the player drags each computer until
  no cables cross. The loop is always a Hamiltonian cycle, so every board is
  guaranteed solvable and can never soft-lock. Bigger tangles score more and load
  a larger board until the timer ends. Live crossing count (non-colour feedback),
  pointer/touch drag plus keyboard (Tab + arrow-key nudge, focus ring), Reduced
  Motion aware, and a fully window-scalable board. Deterministic rules
  (`cablePuzzle` / `segmentsCross` / `countCrossings` / `cableSolved`) are
  unit-tested.

- **Centralized the audio bus graph and made Master Mute instant** (brief §13).
  UI and SFX now flow through dedicated `uiGain` / `sfxGain` bus nodes (like the
  music/ambience beds) instead of connecting straight to master and scaling gain
  per-note — so channel volume and per-channel mute are enforced at the bus node.
  Master Mute now **hard-cuts** every bus (`cancelScheduledValues` +
  `setValueAtTime(0)`) instead of fading, so it silences anything already ringing
  out immediately; unmuting ramps back and never erases stored volumes. Added
  live developer diagnostics via `audio.getDiagnostics()` (AudioContext state,
  per-bus effective gain, and a live active-source count tracked on
  `start`/`ended`), surfaced in the Dev Panel. Documented in `docs/AUDIO_SYSTEM.md`
  and covered by new headless `AudioManager` tests.

- **Employee emotions now affect production** (brief §18). Each employee's derived
  emotion (`inspired` / `focused` / `proud` / `relaxed` / `curious` / `tired` /
  `frustrated`) applies a small, understandable productivity factor (within ±5%,
  `curious` = neutral). A production-weighted **team mood multiplier** feeds both
  `computeProduction()` and the itemised `productionBreakdown()` consistently, and
  shows as a green/red **"Team mood"** line in the breakdown. The Employees tab
  now shows a **mood chip** per employee (coloured dot + emotion + `±%` effect)
  with an explanatory tooltip. Modest, never punishing; returns neutral when
  nobody is working. Documented in `docs/CHARACTER_EMOTIONS.md`; covered by
  `tests/mood.test.ts`. (Per-employee event consequences / "WHAT CHANGED" — §17 —
  remain a separate future task.)

### Added

- **Copyright-free procedural music + office ambience** (`src/audio/audio.ts`):
  a warm, slow synthesized progression (pad chords + soft melody via a lookahead
  scheduler) and a living ambience layer (brown-noise room tone + randomized,
  cooldowned one-shots: typing, paper, coffee, wood creak, drip). All generated
  at runtime — no audio files bundled (see `assets/audio/LICENSES.md`). Wired to
  the existing Master/Music/Ambience/UI/SFX volume channels; dips in Focus Mode,
  respects Quiet Mode & mute, and suspends when the tab/window is hidden.
- **Production breakdown UI** (Company tab): itemises base + each employee, then
  every multiplier (upgrades, passives, morale, prestige, Focus Mode, active
  boosts) so players understand exactly why nuts/second changes. Backed by a
  pure, unit-tested `productionBreakdown()`.
- **Illustrated animated start-screen backdrop**: the opening/title screen now
  shows the cozy tree-trunk office diorama with all employees idling, warm room
  lights (with a gentle flicker), and the title card layered on top. Simplified
  and reduced-motion aware.

### Save compatibility

- No schema change in this pass; all prior saves load unchanged.

## [Unreleased] — repair + expansion pass

### Fixed

- **Disappearing characters:** hired employees whose department wasn't unlocked
  (or had invalid saved placement) could render in no room and vanish. Employees
  now resolve to a guaranteed-valid room (their department if unlocked, else the
  Founder's Desk) and invalid placement data is auto-repaired on load, import,
  and prestige. Added placement/persistence tests.

### Changed / Added

- **Minigames rebuilt** as three genuinely distinct, playable games with a
  shared shell (countdown, safe exit, reward-once guard, result + play-again):
  Shell Sort (colourblind-safe bins, combo, keyboard), Coffee Rescue (mouse/arrow
  catch with a motion-free tap variant), Raccoon Inventory (deterministic
  spot-the-change memory). Pure logic in `src/sim/minigames.ts` is unit-tested.
- **Employee identities:** creative full names (e.g. *Pip Acornsworth*,
  *Rizzo "Receipts" Ringtail*) + personal goals, shown on the profile. Stable
  ids unchanged.
- **Event decisions announce consequences:** a result panel spells out every
  effect (+/- with icons) plus team reactions; gated choices are disabled with a
  reason. *The Office Is Technically On Fire* now offers four strategic choices.
  A persisted event history feeds a "Recent decisions" timeline.
- **Notifications:** centralized toast system (reduced-motion + `aria-live`) for
  hires, room unlocks, and achievements.
- **Interactive decorations:** owned decorations appear in their room as
  clickable props (lamps toggle, plants wiggle, aquariums bubble); a decoration
  mode shows/hides each (persisted); rooms show a comfort score.
- **Company overview:** the office scene shows per-room status chips (workers,
  comfort); employees can be reassigned between unlocked rooms from the Team
  panel.
- **Depth & UX:** lightweight derived employee mood (indicator + label), and a
  gentle, dismissible "recommended next step" hint (toggle in Settings).

### Save compatibility

- **Save schema v4** with a v3→v4 migration (adds `employee.room` and
  `eventHistory`); new optional fields (`settings.showHints`, decoration
  hide-flags) use schema defaults, so older saves load unchanged.

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
