# ZooWorkers state

Handoff only: design is in `DESIGN.md`, commands and matrix in `.kiro/steering/qa.md`.

## Branch

`feat/zooworkers-3.0-facility-pass` at the setup commit on `a3889d5`; clean. `7a7ee3d`
(architect's snapshot) is an ancestor; never roll back to it.

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

## Validation

`npm run validate` (typecheck, lint, check:i18n, verify:assets, Vitest, build) and
`npm run test:e2e` (build + preview on :4173); desktop and Windows scripts per `qa.md`.

## Chapters

Order: 1 → 4 → 9 → 2 → 3 → 5 → 6 → 7 → 8 → 10 → final integration.

Accepted kit chapters: none yet. Accepted pre-kit units: shell (`b138638`–`6189169`),
living office (`bfaca01`–`d81ddc2`) and GC1–GC4 (`67cd776`–`7a7ee3d`), pinned by E2E specs
but with no six-check record. Kit chapters reuse them as evidence and change only what fails
the gate. GC numbers are not kit numbers.

| Kit | Entry points                                                                                                              | Baseline / known gaps                           |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `App`, `ui/GameHud`, `GameDock`, `Sheet`, `modals/OpeningSequence`, `Onboarding`, `art/OfficeScene`, `views/SettingsView` | Shell + living office                           |
| 4   | `sim/goals`, `crate`, `economy`, `ui/GoalTag`, `views/ShopView`                                                           | GC1; Upgrades sheet still the pre-3.0 card list |
| 9   | `ui/Notifications`, `modals/OfflineModal`, `sim/offline`, `happenings`                                                    | No view reads the diary yet                     |
| 2   | `views/EmployeesView`, `modals/EmployeeTalk`, `sim/bonds`                                                                 | GC2                                             |
| 3   | `art/RoomDressing`, `RoomPlay`, `content/rooms`, `roomPlay`                                                               | Living-office rooms + GC3                       |
| 5   | `ui/minigames/*`, `sim/minigames`                                                                                         | Pre-shell fixes only                            |
| 6   | `modals/IncidentScene`, `EventModal`, `content/incidents`, `ui/CuriosityLog`                                              | GC4 + GC3 curiosities                           |
| 7   | `modals/EmployeeTalk`, `content/stories`, `employeeKeepsakes`                                                             | GC2 stories and scrapbook                       |
| 8   | `views/DecorateView`, `ui/DecorationTray`, `sim/placement`, `depth`                                                       | Arranging rebuilt; catalog from `a4e03ad`       |
| 10  | `views/PrestigeView`, `CollectionsView`, `sim/prestige`, `nextStep`                                                       | Prestige fix `65c4f09` only                     |

## Blockers

- Skills panel and `/zooworkers-playtest` not observable from the setup session; confirm in a
  new one.
- `templates/AGENTS.md` may load as a nested second AGENTS.md (Kiro docs); kept as instructed.
- AUDIO LISTENING REQUIRED: no playback here.
- LOCAL WINDOWS VERIFICATION REQUIRED: the last recorded native run is `a4e03ad`.

## Next prompt

Chapter 1. Start its session on this branch; `main` has none of this configuration.
