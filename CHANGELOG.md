# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
semantic versioning.

## [Unreleased] — audio, breakdown & start-screen pass

### Added — the cast is complete (23/23)

- **The bear (`bia`) has real artwork, closing the last gap in the photographic
  cast.** She was the only employee still rendering as the code-drawn vector
  critter: fully wired into gameplay (roster, room specialists, click-station
  synergy, dialogue, i18n) but with `assets/sources/characters/manifest.json`
  marking her master `skipImport: "AWAITING REAL ASSET"`. The master (`URSO.png`,
  960×960, 134 frames @30fps) landed and went through the **existing** pipeline
  unchanged — `import-character-assets.py` → `measure-character-figures.py` →
  `sync-character-registry.py` → `reencode-cast-display-size.py` → `sync` again,
  with `--check` confirming convergence. No second employee architecture; one
  registry entry in `src/art/characterAssets.ts` where the "NOT REGISTERED,
  DELIBERATELY" comment used to be.
- **The master carried the same alpha-collapse defect as Pip's**, which is exactly
  why that repair was moved into the importer rather than left as a manual step: 8
  of its 134 frames deviate ~8.9/255 in mean alpha against a 0.07/255 median, and
  the pipeline rebuilt 5 frames from their nearest healthy neighbours automatically.
  The result passes the halo temporal-stability guard at **3.3/255** peak-to-peak
  (Pip's raw, defective master measures 16.95). The master itself is untouched and
  recorded with its SHA-256.
- **Verified at Pip's scale, not at Pip's canvas size.** Measured `officeHeight` 100,
  `baseline` 0, `anchorX` 0.5175, `figureTop` 0.08 — all derived, none hand-tuned.
  The bear's visible figure renders **110px against Pip's 111px** with her feet
  exactly on the floor line, and DPR 1 is pixel-exact `1.000x` like the rest of the
  cast.
- **`scripts/shot-cast-scale.py`** — draws all 23 animals at their real rendered size
  on one shared floor line, with guide lines at Pip's figure top and bottom, so
  "does the roster read as one cast?" can be looked at instead of inferred from a
  table. It measures the **union** silhouette across the whole loop, because a single
  mid-loop frame misreports several animals badly (the bear looked 9.9% short and
  10px airborne purely from a contact shadow that only extends in a few frames).

### Fixed — validation that had quietly stopped validating

- **`npm run smoke:window` had been failing on its first assertion since the
  letterhead rebuild** (`f5cfa79`/`127dff4`), because it still looked for
  `.header__resources` after the resource strip became `.header__strip`. It never
  reached the resize, min-size-clamp, window-controls or bounds-persistence checks
  below it. Its navigation assertions were also describing a superseded design —
  11 visible `.nav__label`s wrapped onto 2+ rows — where the file-tab strip
  deliberately has **no** text labels and stays on **one** row at every size
  (pinned by `tests/e2e/nav-layout.spec.ts`). Now asserts the real contract:
  11 destinations, each visible with an icon and an accessible name, one row, no
  overflow menu and no horizontal scroll. Passes end-to-end in real Electron.
- **`npm run verify:packaged` never checked the character artwork** — the highest-risk
  asset class, and the one with the quietest failure mode, since a missing sprite does
  not error but silently degrades to the vector critter. It now verifies all three
  files for every registered animal, driven off the registry so it tracks the cast
  automatically. Confirmed non-vacuous: hiding one file fails the check by name.
- **`smoke:recovery` died with a bare `ERR_INVALID_ARG_TYPE`** when `PKG_USERDATA`
  was unset, which reads like a broken script rather than a missing argument. It now
  says which variable it needs.
- `scripts/shot-room.mjs` counted the mood-bubble `<svg>` as a vector critter
  (`.critter-btn svg` matched both), inventing four phantom "vector" figures in every
  full room and hiding any real fallback regression behind them. It now matches
  `svg.critter`, reports each bubble's gap to the top of the **head** rather than the
  sprite box, and takes `--staff` so 1/2/3/4-employee room layouts can each be
  photographed.

### Removed

- **Removed the two conveyor micro-games** (brief §14): **Sorting Conveyor**
  (`shellSort` / "Conveyor Sort" / "Esteira de Triagem") and **Receiving/
  Procurement Conveyor** (`procurement` / "Esteira de Recebimento"). Deleted
  end-to-end — `MicroMode` union, `MicroGame` dispatch + durations, the Focus
  menu list, `engine.rewardMicrogame` types, both component files
  (`ShellSort.tsx`, `ProcurementConveyor.tsx`), their i18n keys (EN + pt-BR),
  docs, and unit tests. No dead buttons remain and no save migration is required
  (the mode id was never persisted; the `microgamesPlayed` counter and its
  count-based achievement are mode-agnostic). Remaining games: Coffee Rescue,
  Bug Squash, Cable Untangle Desk.

### Added — room specialization

- **Employees now perform differently per room** (brief §6). New `src/sim/affinity.ts`
  gives each employee a **favourite** room (their home department, **+25%**),
  **acceptable** rooms (no change), and a few **disliked** rooms that clash with
  their role (**-15%**). Applied per-employee in `computeProduction` and the
  production breakdown via `employeeOutput()`. The Team view shows the current
  room's affinity as a colour-coded chip (with tooltip), and the "Work location"
  dropdown annotates every room with its effect (e.g. "Research Lab (+25%)"), so
  the strategy is clear **before** moving anyone. Unit-tested (`affinity.test.ts`).

### Fixed — event consequences

- **Events no longer affect locked (un-hired) employees** (brief §4). Emotion,
  friendship and "WHAT CHANGED" entries are now applied/recorded only for
  unlocked employees — `setEmployeeEmotion`, the `friendship`/`emotion` effects,
  and the consequence snapshot/diff all skip anyone not hired. Covered by a new
  test.
- **Stronger negative consequences.** Ignoring Mina's basement discovery now
  makes her **frustrated** and costs **-6 morale** (in addition to existing
  emotion swings), so thoughtless choices carry real weight (brief §4 Problem 2).

### Added — desktop window controls

- **Custom Minimize / Maximize-Restore / Close controls** in the header title bar
  (brief §1), shown only in the Electron build. New IPC channels (`minimize`,
  `toggleMaximize`, `isMaximized`, `closeWindow`) + a `maximize-changed` event so
  the button reflects the real state. **Close** flushes the game save (renderer)
  and window position/size (main), then quits — it only minimizes to tray if the
  player enables the new **"Close button minimizes to tray"** toggle in Settings
  (default off, per brief). Header stays a drag region with buttons/resources
  marked `no-drag`. Verified the app still boots cleanly headless (startup log:
  window created → renderer loaded → shown).

### Changed — UX polish

- **Popups never grow taller than the game window** (brief §7). Modals are capped
  to the viewport height and scroll internally; the WHAT CHANGED result uses a
  framed layout that pins its header and OK button while only the middle scrolls,
  so the player never has to enlarge the window to reach a button.

### Changed — office polish pass

- **Removed the free-standing workstation desks** (brief §2). Desks will become
  part of the character sprites in a future skin update; for now employees stand
  naturally on the room floor. Deleted the `RoomFurniture` component + its
  desk/`floor__furniture` CSS and positioning logic — no floating desk objects,
  no workstation placement/collision code. The `characterSlots` layout + built-in
  room dressing keep rooms feeling furnished.
- **Restored the animated office background** (brief §3). Reduced the backdrop
  blur (7px → 2px) and darkening, lightened the scrim, and turned the rooms into
  **translucent light panels** (only when the animated background is enabled) so
  the looping office is clearly visible behind the rooms again, while walls,
  floor and the department accent stay readable.

### Added — built-in room identity

- **Every room now has built-in office dressing** (brief §3/§4), so empty rooms
  no longer look like blank cream rectangles. A new `RoomDressing` component
  draws, behind the characters, a framed **wall window**, a soft
  department-tinted **floor rug**, and one **department fixture** — a book shelf
  (Founder), coffee counter (Morale), filing cabinet (Procurement/Vault), lab
  bench (Lab/Research), campaign board (Marketing/Meeting), pegboard tool wall
  (Construction), pipes (Basement), or a leafy plant (Nap/Rooftop). Pure SVG/CSS
  in the cohesive style, tinted by the room's `--dept` accent; these do not
  consume the player's decoration inventory. Screenshot-inspected across rooms.

### Changed — Office diorama redesign

- **Rebuilt the central Office scene into cohesive illustrated dioramas** (brief
  §2–§5). The old presentation layered flat dark translucent "room bands" over a
  detailed pre-rendered isometric video, so two art styles competed and
  characters looked like sprites floating on a photo. Now each room is an
  **opaque, warm, illustrated diorama**: a department-tinted back wall, a real
  **wood-plank floor plane** grounding the room, a subtle wainscot line, and a
  small **pinned department plaque** label instead of a dark header bar. The
  animated background video is demoted to a **soft, blurred, dimmed ambient
  backdrop** (seen only in the margins) so it complements rather than fights the
  rooms. Characters now render with **soft contact shadows** so they clearly
  stand ON the floor. Removed the crude coloured "ambient blob" shapes (which
  produced a stray green sliver at the room edge — the artifact called out in
  review); room identity now comes from real furniture, decorations and
  characters. Validated at 420–2560px and populated/empty states via the
  Playwright visual harness (screenshots inspected). See `docs/OFFICE_DIORAMA.md`.

### Fixed

- **Packaged Windows executable no longer opens and closes within a second.**
  Root cause: the repo shipped **no icon files at all** and electron-builder had
  **no `win.icon`**, so `iconPath()` never resolved and `createTray()` fell back
  to `new Tray(nativeImage.createEmpty())`. An empty NativeImage triggers the
  `electron_api_native_image.cc … "Argument must be a file path or a NativeImage"`
  warning and, on Windows, throws during Tray construction inside the
  `whenReady().then()` chain — an unhandled rejection that tore the process down
  on launch. Fixes:
  - Added real, on-brand acorn icons: `build/icon.ico` (multi-size, embedded in
    the exe via `win.icon`), `build/icon.png` (app) and `build/tray.png` (tray),
    shipped to the packaged app via electron-builder `extraResources`.
  - Rewrote icon resolution to be dev/packaged-aware (`process.resourcesPath`
    when packaged, `build/` in dev), verifying the path exists and is a real file
    and only ever handing Electron a **validated non-empty `NativeImage`** (never
    undefined/''/a dir/SVG/URL). The window `icon` is omitted if none is usable.
  - `createTray()` now skips (never crashes) when no valid icon exists, wrapped
    in try/catch.
  - Added `uncaughtException` / `unhandledRejection` / `render-process-gone` /
    `child-process-gone` / `did-fail-load` / `preload-error` handlers and a
    startup log at `<userData>/startup.log` (+ stdout), so the app can never quit
    silently on a startup error.
  - Window is created with `show:false` and revealed on `ready-to-show` (with a
    2.5s safety fallback); `whenReady` startup is wrapped in try/catch.
  - Verified by running the built main **and a packaged build** headlessly under
    Xvfb: the app stays alive and the log shows `BrowserWindow created (icon=set)`
    → renderer `did-finish-load` → `mainWindow shown`. Packaged asar contains
    `dist/index.html`; `resources/icon.png` + `tray.png` are present.

- **The visible header speaker button is now a real Master Mute** (brief §18/§19).
  Root cause: that button was wired to **Quiet Mode**, which only attenuates the
  master to 25% — so it never actually silenced the game. It now toggles
  `masterMuted` (authoritative: every bus hard-cut to 0, and `play()` refuses new
  sounds), applies instantly, persists immediately, and shows a distinct
  **muted** icon (speaker-with-slash, red) vs **unmuted** (speaker), with
  localized "Mute all audio" / "Unmute audio" tooltip + `aria-pressed`. Quiet
  Mode remains as a separate button. Proven by a rendered-interface E2E
  (`tests/e2e/mute.spec.ts`): clicks the actual button, asserts every effective
  bus reaches 0, a sound started while muted stays silent, the state persists
  across reload, and unmute restores the buses.
- **Employee room assignments now persist immediately.** `assignEmployee` only
  emitted before, relying on the 20s autosave, so a room move could be lost if
  the app closed first. It now saves right away (brief §33 "save the new
  assignment"). Verified by a real rendered drag-and-drop E2E test that moves a
  teammate and confirms the placement survives a reload.
- **Team (Employees) view no longer crashes on older saves.** It mapped over
  every employee definition and read `state.employees[id].level`; a save written
  before an employee was added (e.g. the second-wave animals) left that entry
  `undefined`, throwing `Cannot read properties of undefined (reading 'level')`
  and blanking the whole app. The load path now backfills any missing employee
  as un-hired (`repairEmployees`, run in the engine constructor). Found via a new
  Playwright visual capture (the view rendered as a black frame) and covered by a
  regression test. Progress is never fabricated — backfilled employees start
  un-hired; the founder stays hired.
- **The "While You Were Away" modal no longer interrupts trivial absences.** It
  fired for even a 0–6 second reload; it now requires a real absence
  (`BALANCE.offline.minModalSeconds`, default 120s) while still banking the nuts
  silently for shorter gaps. Pure `shouldShowOfflineModal()` helper + test.
- **Removed the ignored `frame-ancestors` directive from the `<meta>` CSP** (it
  is only honored as an HTTP header), eliminating a console warning on every load.

### Changed

- **Event choices now change specific employees' emotions, with a real "WHAT
  CHANGED" summary** (brief §17). Emotions are persisted per employee
  (`employee.emotion = { id, until }`, save schema **v5** + v4→v5 migration
  defaulting to `null`) and set by a new `emotion` event effect (temporary via
  `durationSeconds`, or persistent); temporary ones expire on tick. The full
  15-emotion set is supported (happy/proud/relaxed/focused/inspired/curious/
  tired/frustrated/worried/angry/embarrassed/overcaffeinated/suspicious/excited/
  sad), each with a localized name, tone colour, positivity flag and ±5%
  productivity factor. Seeded examples: Bea proud/sad, Mina inspired + Bea
  worried, Corvus excited + Marlow embarrassed. The consequence panel now diffs
  real before/after state and lists **per-employee** emotion + productivity `±%`
  + friendship delta + duration, alongside currency/morale/reputation deltas.
  Covered by `tests/eventEmotions.test.ts` (report matches real sim state,
  temporary-expiry, persistent emotions, migration). See
  `docs/CHARACTER_EMOTIONS.md`. (Reopening a past report from event history
  remains future work.)

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
