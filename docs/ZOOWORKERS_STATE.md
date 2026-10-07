# ZooWorkers state

Handoff only: design is in `DESIGN.md`, commands and matrix in `.kiro/steering/qa.md`.

## Branch

`feat/zooworkers-3.0-facility-pass`: Chapter 1 is the commit that records this entry, on top
of the setup commit `c55d356`; clean. `7a7ee3d` (architect's snapshot) is an ancestor; never
roll back to it.

## Active configuration

- Always loaded: root `AGENTS.md`. On matching files: `visual.md` (`src/art`, `src/ui`,
  `src/styles.css`) and `simulation.md` (`src/sim`, `src/save`, `src/content`, `src/state`).
  On request: `qa.md`. `DESIGN.md` is read by section, never always loaded.
- Agent `zooworkers` (IDE 1.x / CLI 3.x schema): read/write/shell, `includeMcpJson: false`,
  only the `skill://` playtest skill; `AGENTS.md` and steering come by default inheritance.
  Kiro Web runs project agents only as sub-agents.
- Skill `zooworkers-playtest`: workspace, metadata-first.
- Model: Claude Opus 5.5 (this session); fallback Claude Opus 5. No model ID is observable, so
  none is pinned, and profiles have no effort field. Pick Opus 5.5 (not Auto) at max effort in
  each session; Web keeps both per session only.
- Controller: the locked Playwright 1.61.1 CLI. After `npm ci` and
  `npx playwright install chromium`, run `npm run dev`, then
  `npx --no-install playwright cli open http://localhost:5173/ --browser=chromium`. For pt-BR:
  `localstorage-set wmno.lang pt-BR`, then `reload`. Screenshots: `visual-artifacts/` (ignored).
- Sandbox drift seen in Chapter 1: Node was not on `PATH` (use
  `/root/.nvm/versions/node/v22.23.3/bin`), sandbox processes end with each shell call, and
  `/opt/playwright` held Chromium rev 1232 instead of the locked 1228. Nothing was installed:
  the CLI ran with `open --config` setting `launchOptions.executablePath` to rev 1232 and
  `chromiumSandbox: false` (root), and E2E used a scratch config that spreads
  `playwright.config.ts` and overrides only `launchOptions.executablePath`.

## Validation

`npm run validate` (typecheck, lint, check:i18n, verify:assets, Vitest, build) and
`npm run test:e2e` (build + preview on :4173); desktop and Windows scripts per `qa.md`.

## Chapters

Order: 1 → 4 → 9 → 2 → 3 → 5 → 6 → 7 → 8 → 10 → final integration.

Accepted kit chapters: 1. Accepted pre-kit units: shell (`b138638`–`6189169`), living office
(`bfaca01`–`d81ddc2`) and GC1–GC4 (`67cd776`–`7a7ee3d`), pinned by E2E specs but with no
six-check record. Kit chapters reuse them as evidence and change only what fails the gate.
GC numbers are not kit numbers.

| Kit | Entry points                                                                                                              | Baseline / known gaps                           |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `App`, `ui/GameHud`, `GameDock`, `Sheet`, `modals/OpeningSequence`, `Onboarding`, `art/OfficeScene`, `views/SettingsView` | Accepted (record below)                         |
| 4   | `sim/goals`, `crate`, `economy`, `ui/GoalTag`, `views/ShopView`                                                           | GC1; Upgrades sheet still the pre-3.0 card list |
| 9   | `ui/Notifications`, `modals/OfflineModal`, `sim/offline`, `happenings`                                                    | No view reads the diary yet                     |
| 2   | `views/EmployeesView`, `modals/EmployeeTalk`, `sim/bonds`                                                                 | GC2                                             |
| 3   | `art/RoomDressing`, `RoomPlay`, `content/rooms`, `roomPlay`                                                               | Living-office rooms + GC3                       |
| 5   | `ui/minigames/*`, `sim/minigames`                                                                                         | Pre-shell fixes only                            |
| 6   | `modals/IncidentScene`, `EventModal`, `content/incidents`, `ui/CuriosityLog`                                              | GC4 + GC3 curiosities                           |
| 7   | `modals/EmployeeTalk`, `content/stories`, `employeeKeepsakes`                                                             | GC2 stories and scrapbook                       |
| 8   | `views/DecorateView`, `ui/DecorationTray`, `sim/placement`, `depth`                                                       | Arranging rebuilt; catalog from `a4e03ad`       |
| 10  | `views/PrestigeView`, `CollectionsView`, `sim/prestige`, `nextStep`                                                       | Prestige fix `65c4f09` only                     |

### Chapter 1 record — core loop and desktop presentation

Surfaces (DESIGN.md map rows owned by 1):

- Opening: an observation file on the company's letterhead (player's name, department,
  "Confidencial" stamp), the real Pip, and a gold claim button.
- HUD, masthead and resource strip: stickers with role wells (gold reward, green morale, gray
  standing, purple kernels), a gold counter flash on gains, and a masthead opening the Company
  file at ≥640px. The tree's rooftop sign carries the name at every size.
- Navigation: sheets get a walnut destination label, a named "Escritório" way back and
  Archive folder tabs; dock icon wells.
- Office: branches grow from the trunk; wide windows gain sun, an observation balloon and a
  far tree line. A fixed meadow strip below the tower holds the goal/suggestion notes and the
  compact scene controls; the tower's scroller and speech notes stop above it. Each room's
  header row clears the back-row mood stickers. A "has news" balloon sits beside its sticker
  and waits behind a find. Station hit areas are wider, the crate coach says "Toque aqui!",
  and the build-to-buy floor shows progress. A purchase from the goal tag leaves a slip on the
  room and the team cheers; the tag names the next level.
- Dialog foundations: frames never scroll; content scrolls and actions stay pinned (320×420).
- Settings, save/export/import: five folder tabs (Geral, Som, Acessibilidade, Janela,
  Arquivo) with arrow/Home/End keys, switch rows, named options, and a save-file card.
- Notifications, tooltips, empty states: tone roles; under a full-window sheet, toasts rise
  above the dock; company empty rows say what to do.
- Tokens: green = action, gold = reward, purple = rare only, plus soft grays; cream text on
  action green at 4.9:1. A new company adopts the detected language (pt-BR systems open in
  pt-BR), and `<html lang>` follows it.

Player gate (pt-BR, browser):

- 30-second visit, fresh save at 380×460: keyboard through the opening, Enter taps the crate,
  a tap 6px outside the art pays, the goal is ready after 8 taps (4s) with Pique ×2, one click
  buys +0.2/s ("Feito!" slip clear of the plaque, Tico celebrates), and the next goal shows
  Nv. 2. Escape returns focus to the dock.
- 2–5-minute goal: 29 office purchases, then the goal tag built Departamento de Triagem at
  2:04 and a find was taken.
- Density check: the 23-employee QA save at 380×460 and 1440×900.
- Sizes: 320×420, 380×460, 800×600, 1280×720, 1440×900 and 1920×1080, measured with no
  sideways scroll, and no note/control over a room at home and scrolled-up positions on both
  saves. No sticker under a plaque, no overlapping click targets with four finds or three
  nudges. Images inspected one at a time (local only).
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS.

Checks: `npm run validate` exit 0 (821 unit tests). Full web E2E 319/320; the failure (a find
covered by a "has news" balloon) was fixed and its 11 affected specs re-run 98/98.
`npm run build:desktop` passed. Added coverage: language adoption, purchase slip, popup
pinned actions, masthead/sign, Settings tabs, trunk branches and sign.

## Blockers

- Kiro Web listed no skills this session; `zooworkers-playtest/SKILL.md` was followed by hand.
- `templates/AGENTS.md` may load as a nested second AGENTS.md (Kiro docs); kept as instructed.
- AUDIO LISTENING REQUIRED: no playback here (purchase/claim/tap cues are unchanged code).
- LOCAL WINDOWS VERIFICATION REQUIRED: the last recorded native run is `a4e03ad`. This sandbox
  has no Electron binary or display, so no smoke ran. On Windows: `npm run build:windows:folder`,
  `npm run verify:windows:packaged`, then `smoke:window`, `smoke:focus` and `smoke:mute`.
  Expect the HUD shelf to drag the window everywhere except buttons (masthead included), the
  masthead to show only at ≥760px beside the window controls and never collide with them, and
  320×420 to keep the meadow strip, the goal tag and the scene controls usable at 100–200% DPI.

## Next prompt

Chapter 4. Start its session on this branch; `main` has none of this configuration.
