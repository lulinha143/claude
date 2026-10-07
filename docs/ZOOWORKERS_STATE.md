# ZooWorkers state

Handoff only: design is in `DESIGN.md`, commands and matrix in `.kiro/steering/qa.md`.

## Branch

`feat/zooworkers-3.0-facility-pass`: Chapter 4 is the commit that records this entry, on top
of Chapter 1 (`80264a8`) and the setup commit `c55d356`; clean. `7a7ee3d` (architect's
snapshot) is an ancestor; never roll back to it.

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

Accepted kit chapters: 1, 4. Accepted pre-kit units: shell (`b138638`–`6189169`), living office
(`bfaca01`–`d81ddc2`) and GC1–GC4 (`67cd776`–`7a7ee3d`), pinned by E2E specs but with no
six-check record. Kit chapters reuse them as evidence and change only what fails the gate.
GC numbers are not kit numbers.

| Kit | Entry points                                                                                                              | Baseline / known gaps                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | `App`, `ui/GameHud`, `GameDock`, `Sheet`, `modals/OpeningSequence`, `Onboarding`, `art/OfficeScene`, `views/SettingsView` | Accepted (record below)                   |
| 4   | `sim/goals`, `crate`, `economy`, `ui/GoalTag`, `views/ShopView`                                                           | Accepted (record below)                   |
| 9   | `ui/Notifications`, `modals/OfflineModal`, `sim/offline`, `happenings`                                                    | No view reads the diary yet               |
| 2   | `views/EmployeesView`, `modals/EmployeeTalk`, `sim/bonds`                                                                 | GC2                                       |
| 3   | `art/RoomDressing`, `RoomPlay`, `content/rooms`, `roomPlay`                                                               | Living-office rooms + GC3                 |
| 5   | `ui/minigames/*`, `sim/minigames`                                                                                         | Pre-shell fixes only                      |
| 6   | `modals/IncidentScene`, `EventModal`, `content/incidents`, `ui/CuriosityLog`                                              | GC4 + GC3 curiosities                     |
| 7   | `modals/EmployeeTalk`, `content/stories`, `employeeKeepsakes`                                                             | GC2 stories and scrapbook                 |
| 8   | `views/DecorateView`, `ui/DecorationTray`, `sim/placement`, `depth`                                                       | Arranging rebuilt; catalog from `a4e03ad` |
| 10  | `views/PrestigeView`, `CollectionsView`, `sim/prestige`, `nextStep`                                                       | Prestige fix `65c4f09` only               |

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

### Chapter 4 record — clicker economy and useful active play

Broken or weak before, fixed (save v13; no new currency; formulas stay in `src/sim`):

- Late taps were worth ~2 nuts against tens of thousands a second. A tap is now the hand
  combined (`Math.hypot`) with a slice of unboosted production (0.035 s, ~0.04 s with the
  founder desk), paced so taps beyond ~8/s add none. The opening is unchanged; room tap
  bonuses (founder desk, Marketing on Buzz) now scale the whole tap.
- Mashing the incubation pod minted ~40 golden nuts a minute. Premium stations now refine
  gold over time (full share 10 s after that station's last tap; the clock is saved, so a
  reload is no shortcut), paid as whole nuts plus saved dust. Golden drops on nut taps roll
  per second of tapping. v12→v13 floors fractional balances into dust.
- Dead or misleading purchases: Muscle Memory/Shift Rhythm/room combo bonus widened only the
  readout (now the real streak); morale above 100 counted for nothing (Morale Ceiling pays);
  Reputation Engine added 20× the base pace (0.4 → 0.02/s per level); auto-collection at
  100% and the 24 h offline cap kept selling levels (now "Completo", never a goal).
- Goals: cheapest-first kept; saturated levels and hand levels worth <1% of a tap are
  skipped, but a first hand level that opens the next tier says "Libera novas melhorias".
- Resource strip: balances round down in the locale's decimal mark ("49,9", not "50");
  the breakdown total includes a rush, so it equals the HUD rate. Finds and routine rewards
  use unboosted production; NaN/negative rewards are ignored; a daily claim saves at once.
- Upgrades sheet rebuilt as purchase slips: measured gain, price, a "Faltam …" button that
  stays pressable and says what is missing live, "Feito! +X/s" on the row plus the office
  slip, gold dots on tabs with something affordable, an "Em breve" line. The Team sheet
  shares it. Gold for golden prices, green for gains; pt-BR economy text says "castanhas".

Player gate (pt-BR, browser):

- Fresh save, a real 12-minute session at 380×460: second floor 1:38, first hire after 4 min,
  1,22K/s at 10 min and 2,79K/s at 12 min; 149 goal-tag and 8 shop purchases, 6 finds, idle
  minutes 3 and 7–8, no stuck goal.
- Active vs passive, 20 s each with the crate emptied in both: a 35-minute save 12,2K/s →
  37,6K/s tapping 5/s (×3.1 with its rush); the 23-employee QA save 186K/s → 380K/s (×2.05).
  The pod pays "+0,1%" mashed, "+3%" after a pause, its tooltip explains refining.
- Upgrades sheet at all six sizes, no clipped text, buy targets ≥86×40; short presses,
  keyboard Enter/Space with reduced motion (focus stays, no motion), high contrast, the Team
  short note, the gateway goal flow and purchases persisting after reload.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).
- Seen outside this chapter: at ≤380px long pt-BR room plaques are cut ("Incubadora
  Comportamenta…"); event texts still say "nozes" (Chapter 6 content).

Checks: `npm run validate` exit 0 (840 unit tests). Full web E2E 324/324, then the added pod
reload test: `economy.spec.ts` 5/5, three repeats. No desktop code changed. New coverage:
`tests/clickerEconomy.test.ts`, `tests/e2e/economy.spec.ts`.

## Blockers

- Kiro Web listed no skills this session; `zooworkers-playtest/SKILL.md` was followed by hand.
- `templates/AGENTS.md` may load as a nested second AGENTS.md (Kiro docs); kept as instructed.
- AUDIO LISTENING REQUIRED: no playback here. Unheard: the purchase, claim and tap cues; the
  error cue on every short press (the button used to be disabled); the celebrate cue on a
  room bought in the shop; the golden cue when the pod mints a whole nut.
- LOCAL WINDOWS VERIFICATION REQUIRED: the last recorded native run is `a4e03ad`. This sandbox
  has no Electron binary or display, so no smoke ran. On Windows: `npm run build:windows:folder`,
  `npm run verify:windows:packaged`, then `smoke:window`, `smoke:focus` and `smoke:mute`.
  Expect the HUD shelf to drag the window everywhere except buttons (masthead included), the
  masthead to show only at ≥760px beside the window controls and never collide with them, and
  320×420 to keep the meadow strip, the goal tag and the scene controls usable at 100–200% DPI.

## Next prompt

Chapter 9. Start its session on this branch; `main` has none of this configuration.
