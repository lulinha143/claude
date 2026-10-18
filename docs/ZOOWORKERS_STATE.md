# ZooWorkers state

Handoff only: design is in `DESIGN.md`, commands and matrix in `.kiro/steering/qa.md`.

## Branch

`feat/zooworkers-3.0-facility-pass`: Chapter 7 is the commit that records this entry, on top
of Chapter 6 (`25ba899`), Chapter 5 (`f4ae64c`), Chapter 3 (`8cbf590`), Chapter 2 (`d6c4d28`),
Chapter 9 (`d9fab09`), Chapter 4 (`e7bac62`), Chapter 1 (`80264a8`) and the setup commit
`c55d356`; clean.
`7a7ee3d` (architect's snapshot) is an ancestor; never roll back to it.

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
- Chapter 5 session: Node was on `PATH`, and `npx playwright install chromium` fetched the
  locked rev 1228, so E2E ran on the stock config. Background processes still end with each
  shell call, so rendered play used throwaway scripts (kept in the ignored `visual-artifacts/`)
  that serve `dist/` and drive Chromium in one process. A seeded save's own
  `settings.language` wins over `wmno.lang` at boot: seed pt-BR in the save.
- Chapter 6 and 7 sessions: the same (Node on `PATH`, `npm ci`, locked rev 1228 fetched, stock
  E2E config); rendered play by throwaway scripts in the ignored `visual-artifacts/play/`.

## Validation

`npm run validate` (typecheck, lint, check:i18n, verify:assets, Vitest, build) and
`npm run test:e2e` (build + preview on :4173); desktop and Windows scripts per `qa.md`.

## Chapters

Order: 1 → 4 → 9 → 2 → 3 → 5 → 6 → 7 → 8 → 10 → final integration.

Accepted kit chapters: 1, 4, 9, 2, 3, 5, 6, 7. Accepted pre-kit units: shell (`b138638`–`6189169`), living office
(`bfaca01`–`d81ddc2`) and GC1–GC4 (`67cd776`–`7a7ee3d`), pinned by E2E specs but with no
six-check record. Kit chapters reuse them as evidence and change only what fails the gate.
GC numbers are not kit numbers.

| Kit | Entry points                                                                                                              | Baseline / known gaps                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | `App`, `ui/GameHud`, `GameDock`, `Sheet`, `modals/OpeningSequence`, `Onboarding`, `art/OfficeScene`, `views/SettingsView` | Accepted (record below)                   |
| 4   | `sim/goals`, `crate`, `economy`, `ui/GoalTag`, `views/ShopView`                                                           | Accepted (record below)                   |
| 9   | `engine.catchUp`, `sim/offline`, `sim/timeline`, `state/returns`, `ui/ReturnNote`, `ui/Notifications`                     | Accepted (record below); diary unread     |
| 2   | `views/EmployeesView`, `modals/EmployeeTalk`, `sim/bonds`                                                                 | Accepted (record below)                   |
| 3   | `art/RoomDressing`, `RoomPlay`, `content/rooms`, `roomPlay`                                                               | Accepted (record below)                   |
| 5   | `ui/minigames/*`, `sim/minigames`                                                                                         | Accepted (record below)                   |
| 6   | `modals/IncidentScene`, `EventModal`, `content/incidents`, `ui/CuriosityLog`                                              | Accepted (record below)                   |
| 7   | `modals/EmployeeTalk`, `VisitScrapbook`, `content/stories`, `employeeKeepsakes`                                           | Accepted (record below)                   |
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

### Chapter 9 record — ambient play, time accounting and the return

One rule, `engine.catchUp()`, settles every interval once. Forward ≤ 300 s since the last
settlement is open play, however rarely a hidden window is woken (Chromium wakes one about
once a minute). Longer means the game was not running (asleep, frozen) and uses the away
rules. Closed time (boot, `settleClosedTime`) always uses the away rules. A backwards clock
pays nothing. `lastSaved` records the settled boundary, not the moment of writing. Hide and
unload count the open time first. No save field was added.

Fixed (measured before → after):

- Sparse ticks valued boosts, rushes and Focus Harvest at the tick's end. A ×2 boost or a
  rush ending inside a minute-long tick lost up to 20%, Focus 12%; every case is now within
  0.13% of 10 Hz ticks. Each slice reads its own moment, Focus completes when it ended, and a
  call is at most 120 slices (worst tick 507 → 108 ms on the 23-employee save).
- Happenings rolled once per tick (a hidden minute rolled once, not 1.33 times): now once per
  45 s of company time, bounded.
- A turned-back clock stretched a 30 s boost and Focus by the hour, refused minigame rewards
  and coffee, and stalled the golden pod. The whole timeline now moves back with the clock
  (`sim/timeline.ts`), so timers keep what they had left. An import resumes as filed, pays
  nothing for the days since, and pays nothing again when repeated.
- An incident waiting at close was decided by the team at the first tick back ("handled:
  nut-audit → comply"). Waiting incidents and curiosities now hold while closed, asleep or
  minimized; in view they run as before.
- Absences over 60 days paid nothing and showed nothing. They now pay up to the cap, with
  the cap stated (only corrupt timestamps, over 5 years, are refused).
- The crate's size followed boosts and rushes. It is now 10 minutes at the company's own
  pace.
- A floor trip ("go there", the elevator) ended floors short. Unrendered floors use an
  estimated height (`content-visibility`); the trip now re-measures once the scroll settles.
- The blocking "Enquanto Você Estava Fora" popup is replaced by a paper note heading the
  notices column, for closed, asleep or minimized returns of 2 min or more. It shows:
  - the time away and the measured vault gain (gold);
  - the rule ("Com o jogo fechado, a equipe rende 60% (até 8h). Aberto no canto, rende
    tudo.", or the asleep, capped or open wording);
  - up to 3 lines that go to the room: the crate, an incident with its presenter, someone
    with a story, a find, a discovery, a routine done or a delivery (never a jam).

  It does not dim the office. × or Escape dismisses it, a glance away does not, and one soft
  paper cue plays on a live return. `sim/waiting.ts` reads the same state the floors mark.

Player gate (pt-BR, browser, QA save):

- 2 h closed, at all six sizes: the note sits between the HUD and the dock with nothing
  clipped and lines 36–40 px tall (306×191 at 320×420). Payoff: +747M castanhas, 54,5M in
  the crate, two incidents with presenters. The full crate, find and incident markers have
  no looping animation.
- A short return (4 min minimized, page clock) at six sizes: "Aberto no canto, o escritório
  rendeu tudo." A real 151 s leave-open cycle earned 182,200/s against the HUD's 182K/s.
  Also seen: asleep 45 min (60% wording) and 3 days ("contamos só 8h, o limite").
- Input: Enter on a line opens its room centred, showing "! Tem algo acontecendo". The
  crate line goes home; tapping the crate collected +54,6M (754M → 809M). × and Escape
  close the note. High contrast with reduced motion is legible.
- Audio, measured not heard: active master 0.80, music 0.25, ambience 0.31; hidden, the
  context is suspended; quiet master 0.20 with motion at rest, still producing 182K/s;
  mute, every bus 0. Left alone, 5–11 voices at once.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (860 unit tests). Full web E2E 332/332; after the slice
bound, 8 affected specs 50/50. `npm run build:desktop` exit 0. New coverage:
`tests/timeAccounting.test.ts`, `tests/returns.test.ts`, `tests/e2e/returns.spec.ts`. The
diary is still not shown anywhere: moments that played while minimized are recorded, not
told.

### Chapter 2 record — the cast and the one-on-one visit

Broken or weak before, fixed (no save field, no new meter; balance unchanged):

- "Uma palavrinha" (the check-in every teammate has) was word for word the same from all 23.
  Each now has 16 authored lines in EN and pt-BR (`checkin.<id>.*`): their hello, their own
  small problem and its fix, how they take praise and being pushed. Same nodes, costs and
  effects as before (a test compares them).
- How they open reads the moment, picked once on arrival (`activeTalk.promptKey`, so a mood
  change cannot swap the words mid-read): what happened since the last check-in (praised,
  pushed, the fix, a lapsed promise, stamped per teammate as re-set flags), then a low mood,
  then the room (their own department, or one that clashes), then their hello. The variants
  are data (`TalkVariant`), read by `nodePrompt`; stories keep their flag variants unchanged.
- pt-BR agreement: `CharacterProfile.gender` is passed to i18next as the context, so Beta is
  "Empolgada" and Bento "Empolgado" on the visit, the office sticker and the Team card.
- The visit's art size depended on each teammate's own build. One cast scale
  (`castScaleFor`) now fits the tallest canvas and never enlarges anyone's densest build;
  visible figures across all 23 differ by 5.8% (126–134 px at 320×420), the registry's own.
- The visit was a card with a speech box on a side panel. Now, at ≥760 px wide, the teammate
  stands left in their room with their words in a bubble by their head (tail toward them);
  answers wait on the notepad under "Você responde", and what changed lands by the bond
  meter. In a corner window the notepad holds their line, its tail pointing up at them. The
  plate names the room and whether it suits them; the mood sticker (with its word) sits on
  the head anchor from the registry geometry. A teammate in another room can be taken home
  from the visit (`assignEmployee`; a full room says so).
- Focus: the first open answer takes focus and keeps it after each answer; Tab and Shift+Tab
  cycle inside; arrows, Home and End move between the tabs; Escape closes an open menu first,
  then the visit only (the Team sheet stays), and focus returns to that teammate's Visit
  button or critter. Escape used to close the Team sheet too and leave focus on `<body>`.
- Office: a line the player asked for carries "Bater um papo →" on its name row (stays 6 s,
  held while pointed at), opening on whatever they want to share or the check-in.

Player gate (pt-BR, browser, dev server and local Chromium 1232):

- All 23 through the Team sheet at 380×460 and 320×420: each opened its own check-in (23 of
  23 distinct lines), art loaded and never enlarged, no notepad scroll, no sideways scroll,
  Escape back to their own card. Bea, Mina and Corvus seated in clashing rooms said their
  "away" line; Otto, Hazel and Nino (awkward pairs) their "down" line.
- Otto at 1280×720, 380×460 and 320×420: opening, listen, the fix (+6 trust shown in the
  scene). At 320×420 the three answers fit; only the long listen step scrolls, with the fade.
  Bea in the lab: "Não curte esta sala", praise (+3 trust, +3 ânimo), "Levar à sala favorita"
  → "Beta voltou à sala favorita: Ala de Construção", scene and plate change, saved on
  reload. 800×600, 1440×900 and 1920×1080 measured: no overflow.
- Office at 320×420 and 380×460: poking Bento showed his line with "Bater um papo", which
  opened the check-in; Escape returned focus to his critter. Reduced motion with high
  contrast: poster art, no animation, legible.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (873 unit tests); `build:electron` exit 0 (no desktop code
changed). E2E: 14 affected specs 119/120, then 53/53 after the last change. The failure,
`incidents.spec` "a promise lands in the world", is pre-existing: on `d9fab09` it failed 2
of 6 repeats, here 1 of 3. New coverage: `tests/checkIns.test.ts` (13), three `visit.spec` tests.

### Chapter 3 record — office rooms as a playable world

Broken or weak before, fixed (no save field, meter or economy change; balance unchanged):

- The radio studio, repair workshop and conservatory drew as the default beige room: their
  styles, and the discovery card's evidence tile, left with the release stylesheet in
  `b138638`. Rebuilt on the room layers (`rd--broadcast/repair/conservatory`) plus
  `AnnexArchitecture`, drawn behind window, props and light. The studio has cork bays, a door
  and a lit ON AIR lamp (HTML, so it never squashes; at least 7 px). The workshop has a crane
  rail and trolley, a half-raised bay door with a hazard-striped foot, and a breaker panel. The
  conservatory has an iron-and-glass roof, ribs, hanging planters and a seedling shelf. Each
  room has its own light and one living detail, paused by reduced motion, quiet mode and when
  off screen. Each also plays quiet one-shot sounds on the ambience bus while in view
  (`audio.setRoomInView`).
- The routine tag covered up to 79% of a seated teammate's face and 61% of the wall fixture.
  It is now a 24 px badge on the machine (glyph, ring, pips). Its words slide out when the
  player points at the room or the machine, or focuses it by keyboard. In rooms at least
  560 px wide the words stay out, opening toward the wall. Quiet rooms show no badge; the
  station tooltip ends with what the routine does and who helps.
- A full room's outer desk stood on the machine. `characterSlots` now takes the machine's x:
  a group slides away from it and keeps its gaps. A full room closes its gaps to no less than
  0.19 against the far wall. Order and depth stay as authored. The studio and conservatory
  machines moved to x 0.18; the workshop bench (middle of its bay) and the furnace valve moved
  to 0.82. At every count in every room, desks now stay 0.14 from the machine and inside the
  room.
- The slip and the reaction arrived together, and the speech note covered the slip at every
  size. The reaction, or the pair exchange, now waits for the slip to go.
- Legacy overflow (more than four in a room) was rehomed silently. Each move is now announced:
  "Cabem quatro por sala: Téo para Toca de Marketing · Mina para Cantina de Nozes."; three or
  more moves list names only. Auto-arrange, which the player asks for, stays silent.
- A facility room's secret was a worded pill across the nearest teammate: 47–74% of a face at
  380×460, 57% of a mood sticker at 1280×720. It is now a sparkle pinned to the fixture's
  corner; its words open on pointer or keyboard focus. Curiosities pin to the same corner;
  their compact rule never applied, because `play.css` outranked it.
- The annex rooms' header action was cut to "Consertar a con…" at 320 px, because the header
  kept a 44 px elevator reserve that only arranging needs. In English, "Bring coffee to the
  garden" became "Coffee to the garden".
- HUD counter (pre-existing): when production retargeted every frame, the counter drifted as
  low as −2,53T. `AnimatedNumber` now drops stale tweens, clamps between start and target,
  and lands exactly on the target.

Player gate (pt-BR, browser, dev server and local Chromium 1232; a late-company save with every
room open, then each annex room filled to four):

- Real clicks:
  - Tend, workshop: 3 taps gave +3 ânimo and a 30 s Pique; Beta spoke after the slip.
  - Brew, conservatory: "Colher" gave +4,2M and +6 ânimo; Axel spoke; the next brew was
    still offered after a reload.
  - Tune, studio: Hora calma → Animado (combos last 15% longer); Eco spoke; the mode survived
    a reload.
  - Watch, security: +2,1M and +2 reputation.
  - Deliver: "Para Bento" gave +2,6M, then his line.
  - Curiosity: "O quadro de empréstimos" gave +2,1M and was gone after a reload.
  - Workshop secret, by Tab and Enter: "Não conserte este arranhão" → "Preservar a parte de
    baixo" gave +7 reputation; the marker went and the flag was saved.
- 23 teammates, four to a room, with every routine live, across all 21 rooms at all six sizes.
  From 380×460 up, no badge covers more than 12% of a face or fixture, no desk leaves its
  room, and desks overlap by at most 6 px. At 320×420 only, these remain:
  - the rooftop's watch badge covers a fifth of the skyline prop's box;
  - with the widest desks, the studio badge touches up to 14% of the nearest face box;
  - a curiosity can touch 14–15% of the nearest mood sticker.
- Keyboard: focusing a machine shows its badge's words; Tab reaches the badge and Enter acts.
  Tab reaches the secret, which then reads in full.
- Reduced motion and quiet mode stop every room animation. Quiet mode takes master volume to a
  quarter (0.85 → 0.21); mute takes every bus to 0. The room sound follows the floor in view
  and goes to null under a sheet.
- Contrast is 4.6:1 or better with and without high contrast. Glyph shapes, not colours, tell
  the badge, curiosity and secret apart.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (885 unit tests, 75 files). E2E on local Chromium: 344/344
across all 45 specs; `office-play` 22/22, and `incidents.spec` passed this run. The new
full-room test fails on the old layout ("a face behind the machine", 0.37). New coverage:
`roomLayout` (clearance, slide and ease, untouched when clear), `roomCapacity` (2), `art` (4),
`animatedNumber` (1). `office-play` gained 8 tests: annex rooms, the badge at two sizes, a full
room at two sizes, the secret, the header action, the slip before the reaction, and the
counter.

### Chapter 5 record — the three minigames

The previous session's Chapter 5 work was never committed or pushed, and this sandbox was a
fresh clone with no stash, reflog entry, dangling object or remote branch holding it, so the
chapter was rebuilt from `8cbf590`. The only save change is an optional `boosts[].source`;
there is no new currency. Rules live in `sim/minigames.ts`, the economy in `engine`; see
`docs/MINIGAMES.md`.

Broken or weak before (reproduced in pt-BR at 380×460 and 1280×720), fixed:

- The live score was dark ink on the walnut bar, and the pause button's label was 0 px.
  Bug Squash's bottom row of drawers was cut off. Holding → moved the mug one 5% step in half
  a second, because it waited for key repeat. The result's buttons sat 71 px below a 460 px
  window. Esc mid-round closed the sheet and silently dropped the round. Cable said
  "Embolados: 3" with nothing on the desk to show where.
- One mastery line (30) for all three: steady Coffee play passed it easily, while Cable
  needed about four clean desks. Pay grew with the raw score, so Coffee paid several times
  what Cable did. Bug's combo badge (×2 at 6) did not match its scoring (+1 per two
  squashes). Boosts from different games stacked: three rounds gave up to +150%.
- Now each game has its own bands (`MICRO_CALIBRATION`, set by bots that play the real
  rules), and the badge and the score read one table. Pay reads the score as a share of that
  game's mastery. Minigame boosts share one slot: a stronger round takes it, and a weaker one
  adds only its own worth as time. A round is paid once, on a ticket taken at the whistle;
  leaving spends the ticket. A mastery from the old line is kept and never paid again.
- Coffee: the mug follows pointer or finger at once. Keys glide while held and let go on blur
  or pause. Rounds open on one of four days, in turn, and run three beats: a warm-up without
  decaf, service, then a rush of pairs too far apart for one mug. The ticket is a real order
  (2 → 4 drinks, +3 a drink). Drinks differ by shape; the decaf is grey, dashed, ringed and
  crossed out. Reduced motion: five numbered cups, tapped or keyed 1–5.
- Bug: up to three pests over three stages, each announced over the status row, never over a
  drawer. Runners hop once, armour takes two taps, the golden bug comes once at closing, and a
  sticky-note "feature" costs 4 and the streak, so mashing loses. Taps count on press, a
  vacated drawer stays empty 320 ms, and a late tap is forgiven. Keys 1–9 tap a drawer.
- Cable: `cableConflictMap` marks each conflict where it is (a knot on a crossing, a dashed
  ring on a plug in the way), and the count is that list's length. A plug on a cable counts
  once per cable; it used to read 3 with two knots. A desk cleared inside par earns a speed
  bonus. Esc puts a held plug back, and Shift+arrows stride.
- The cabinet: walnut around paper screens. The intro shows the host in their own artwork with
  their own line (EN and pt-BR, 7 hosts × 6 lines), three illustrated rules, the day, the
  record and the mastery line, with Start pinned. The bar is paper chips. The result stamps
  the grade, and "Novo recorde" beside the score; it shows a mastery bar, the slip, the
  first-mastery prize and the host reacting, with Play again, the souvenir and Other games
  pinned. Esc or a lost window focus pauses; a frozen countdown gets Continuar. Toasts rise
  above the pinned buttons. The menu leads with the games: host, record and mastery bar.
- 403 legacy minigame selectors and 41 keyframes left `styles.css` and `recordsDesk.css`
  (audited: no other selector removed or changed). The games now style from `game/minigames.css`.

Player gate (pt-BR, browser, built game, Chromium 1228; QA save):

- Coffee 380×460: holding ← took the mug from 50% to 12% in 400 ms, and it stopped on
  release. A scripted player made 20 with ×2 in 9 s while the order ticked. A caught decaf
  stamped "Descaf. -3" on the mug and reset the streak. Reduced motion: five still,
  numbered cups.
- Bug 380×460: 24 taps made 160, at "Horário de pico · Etapa 2 de 3". A feature tap showed
  −4 "Feature!" and cleared the combo. A fast player reached a first mastery (594): +1 golden
  nut, the Estante de Amostras, Quincy's line, "Novo recorde". All three buttons fit without
  scrolling at 380×460 and 320×420. After a reload: 1 play, no second golden nut, and the
  card says "Maestria registrada".
- Cable 380×460: two desks by real drags, 3 → 1 → 0 and 4 → … → 0 tangles, with marks equal
  to the count at every step; "+6 pontos · Bônus de rapidez +2". Esc mid-drag put the plug
  back without pausing.
- Every phase of all three at 320×420, 380×460, 800×600, 1280×720, 1440×900 and 1920×1080:
  no sideways scroll, no control off screen or under 30 px, no text under 11 px, and no toast
  over a pinned button. Boards from smallest to largest: Coffee 286×185 to 1140×756, Bug grid
  187×174 to 560×519, Cable 286×210 to 1140×761.
- Resized mid-round (1280×720 → 380×460; 1920 → 320 wide): the mug stayed on the counter and
  kept scoring (2 → 20), every plug stayed on the desk, and the grid stayed in the desk.
- Touch, via Chromium's touch emulation: a finger steered the mug, also off the counter; a tap
  squashed a pest; a drag landed a plug within 1 px.
- Keyboard: Start, the board and Play again take focus in turn; Esc pauses and resumes. High
  contrast with reduced motion is legible. Quiet mode: master 0.20 (0.80 normal) and the round
  plays in full. Mute: every bus is 0 during a round. English fits at 800×600.
- Images inspected one at a time (local only).
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (943 unit tests, 77 files). Full web E2E: 351/352 before the
last fixes, the failure being the pre-existing `incidents.spec` test (Blockers). On the final
tree, one run hit two reload timeouts at the same moment (`economy`, `decoration`), which then
passed 36/36 (3 repeats, 4 workers); the next full run was 352/352. No desktop code changed.
New coverage: `tests/minigameRounds.test.ts` (30), `tests/minigameRewards.test.ts` (21),
`minigame-shell` (+7) and `tests/e2e/minigame-rounds.spec.ts` (8; 24/24 over three repeats).
`product-pass` now reads each game's own mastery line.

### Chapter 6 record — incidents, events and discoveries

Baseline: GC4 (incidents, moments, remembered choices) and GC3's curiosities, kept where good.
No new currency, clock, queue or registry; the only save change is an optional place on
`eventInProgress` (`roomId`, `employeeId`). Balance unchanged, except one gate (below).

Broken or weak before (reproduced in pt-BR at 380×460 and 1280×720), fixed:

- `incidents.spec` "a promise lands in the world" had two real causes:
  1. The boot's trip home kept correcting for about 1.2 s and pulled back a view already
     moved to the lab (logged: `scrollTo` from the lab to the Founder's Desk 58 ms after the
     test's scroll). Only wheel, touch and press counted as taking over. Now the trip lets go
     once another floor is in view than the one it left, and scroll keys and focus moving
     into the tower take over too.
  2. A small moment whose room was out of view was paid, put in the diary and never shown.
     Run after the file's other tests, the file-level `NOW` was ~40 s old, so the bet came due
     at the first tick, with the Founder's Desk in view. The earlier timestamp fix could not
     help while cause 1 remained. Now a moment out of view, or while the window is hidden,
     waits (three at most) and plays out when the player looks there.

  Before: 1/1 serial and 3/3 alone failed here. After: the unchanged HEAD spec 8/8, three
  serial runs; the updated spec 11/11 in four serial runs, 10/10 alone (×5) and 27/27 (×3, four
  workers). It now takes timestamps per test and pins the out-of-view case.

- Answers were green bars with words only: no cost, reward or risk (the forged signature that
  comes back was invisible). Each is now a line on the incident report: a box to tick (green),
  its words, and what it will do, from `previewEventChoice` (the engine's own rules).
  - Costs come first, then rewards in gold.
  - Who changes and how: sticker, name, mood word, heart ±. A room's mode, a Moment Card and
    who will remember are named too.
  - "Pode voltar depois" marks anything set in motion; "Tem mais" a next part.
  - Secrets and new nuts stay unsaid.
  - At ≤520 px tall or ≤340 px wide the line keeps to marks and numbers (the words stay in the
    tooltip and for screen readers), and the report scrolls above the answers with a fade.
  - A test takes every authored answer (every event and step, 200+ enabled) and checks the
    preview against the measured outcome: resources, everyone's friendship, moods, modes,
    souvenir, set in motion, remembered and "there's more".
- The card's people never reacted. Pointing at an answer (or reaching it by keys) puts each
  affected teammate's sticker and heart ± at their side in the scene, and the outcome shows the
  same marks, as measured.
- A reload reopened an open card through `eventPlace()`, sometimes with another presenter. The
  place is now saved; older saves work it out again.
- A promise due while minimized spent its notice (toasts expire while hidden), or its moment,
  on nobody. Promises settle on the first tick in view (Chapter 9's hold, extended); remarks and
  office news wait while hidden.
- On a narrow window a speech note already up stayed over the sheet that covered the office
  (Nino's line over the Archive's tabs at 380×460). Notes now drop while the office is covered.
- The Archive's log was rows of "?" and text. Its lead arrow drew as a tofu box (U+2192 in CSS),
  a lead into an incident (the soup) never closed, and the basement's pipes led nowhere. It is
  now an investigation board:
  - Open leads come first: the lead's words and where it was found.
  - Each find is a card that opens a file: the hint and the thing, where (spot or routine),
    when it was noticed, what made it possible and where it led.
  - Origins: a find, a decision (its title and answer), a story, a decoration or the night.
    Leads: a find, something waiting, or an incident happening or decided (with the answer).
  - A blank a lead points at reads "Uma pista aponta para cá", never a name. An aftermath stays
    absent until it turns up. Secret files say which decision filed them.
  - The night shift's tape now needs the knocking pipes (`flag: 'oddity.pipe-jingle'`), so every
    lead leads somewhere (tested).
- pt-BR said "nozes" where the currency was meant. Now "castanha(s)": 8 event strings, 3
  discovery lines, 2 secret files, the vault and incubator profiles and the golden-chance label.
  Walnuts, the pecan and Fenn's jokes keep "noz". Two labels lost a typed cost (the line says
  it now).

Player gate (pt-BR, built game, Chromium 1228; a seeded company, real clicks and keys):

- The whole path at 380×460 and 1280×720:
  - The elevator marked the meeting floor; Hazel said her hook; a second click opened "A Ata"
    with Hazel and Nino.
  - Pointing at "A Avelã pode assinar por ele" showed Hazel worried. Tab, Tab, Enter took
    "Plastificar a ata".
  - The outcome showed Nino's sticker in the scene, Ânimo +5, the card saved, "Alguma coisa foi
    posta em movimento" and "Avelã vai lembrar disso".
  - 243 s later the laminated minutes were on the wall and Nino said so. The slip said
    "Bônus", and the Archive's file read "Uma decisão em 'A Ata': Plastificar a ata…".
  - After a reload the find, its flag, the decision and Hazel's waiting remark were all kept.
- The rebrand and minutes cards at 320×420, 380×460, 800×600, 1280×720, 1440×900 and
  1920×1080: inside the window, every answer and the report fully inside the card (it never
  scrolls), no text under 11 px (the scene's label and stamp went up from 10–10.5 px), no
  sideways scroll. The board at the same sizes: no sideways scroll, targets ≥ 30 px.
- High contrast with reduced motion at 380×460: black ink and borders; signs and stickers carry
  the meaning without colour; no animation or transition.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (961 unit tests, 79 files). Full web E2E 355/355 on the first
run. `npm run build:desktop` exit 0; no desktop code changed. New coverage:
`tests/incidentScenes.test.ts` (15), `tests/curiosityLog.test.tsx` (3), three `incidents.spec`
tests.

### Chapter 7 record — stories, keepsakes and personal history

Baseline: GC2's three-part stories, keepsake talks and scrapbook, kept where good (all 23 play
through; the Part 3 prompt opens on the Part 1 answer). No new save field, currency, clock,
meter or registry: `sim/bonds` reads the durable flags already written (`storyNamed`,
`keepsakeFor`, `talkAftermath`, `talkChoiceCost`). The only new saved item is one remark in
Chapter 6's queue. Balance unchanged.

Broken or weak before (reproduced in pt-BR at 380×460 and 1280×720), fixed:

- A story part ended in silence. Part 3 put the keepsake on the desk unseen, Part 2's payoff
  was invisible and the next step lived only in the Album. When a conversation ends, the
  notepad now says, under the reply:
  - where the story stands ("A próxima parte, quando vocês chegarem no nível Amizade
    próxima.", "Você conhece a história inteira.");
  - "Alguma coisa foi posta em movimento." and "Bento vai lembrar disso." as they apply,
    never what (Chapter 6's rule); and "Virou um Cartão de Momento, guardado nas Coleções.";
  - when the keepsake has just gone on the desk, its art, its name, "Agora fica na mesa
    dele/dela." and "Ver no álbum". The engine gathers this per conversation
    (`ActiveTalk.aftermath`), and it is read from the content's own marks.
- Looking after a keepsake (50–240 castanhas) showed its price only after. The answer now
  carries a gold nut tag with the number ("Custa 180 castanhas" to screen readers); the free
  answer has none. The measured change still follows.
- Part 1's answer came back only on 50% of pokes, forever, sometimes twice running. Now it
  comes back once on its own about 5 min later (a `remark`, said when their floor is in
  view). A line they bring back then rests 10 min (per session, unsaved).
- The Album named a new face's story. Until Part 1 is ready it reads "A história de Nino" and
  "Tem uma história pra te contar quando vocês chegarem no nível Conhecido." A keepsake is
  named nowhere until you have talked about it or heard the whole story.
- Album entries kept only their reply. Each now files "Você: …" above it. The keepsake talk is
  its own entry, and a keepsake card heads the Album once known: art, name, its line, where it
  is ("Na mesa dela desde 18 de out. de 2026." or in the drawer) and how it got there. Under a
  long pt-BR date the words ran in a narrow column; they now take the full width.
- The keepsake on display was inert and mostly hidden behind its owner's desk. It now leans
  against the front of the desk (one step nearer than its owner; anyone nearer still covers
  it). Pointed at, it reads "Lembrança de Beta. Clique para ver no álbum."; a click opens the
  Album on its card. In the visit it is a button to the same card (the keyboard path).
- The pt-BR stage lines read "quando vocês forem Amizade próxima" (and EN "once you are Close
  friend"); now "chegarem no nível …" and "once you reach …". The topics pill that leads to
  the keepsake talk answers to 38×30 px instead of its drawn 30×20, with nothing moved.

Player gate (pt-BR, built game, Chromium 1228; seeded companies, real clicks and keys):

- Otto's Part 3 at 320×420 and 380×460 (from his Team card) and at 800×600, 1280×720,
  1440×900 and 1920×1080 (poked twice in the office):
  - "Aqui também é sua casa, sabia?" brought the reveal "Livro-caixa impecável · Agora fica na
    mesa dele" and both notes, with Confiança +5 and Castanhas Douradas +2.
  - "Ver no álbum" opened the Album with focus on the card. After a reload the ledger is by
    him, and the card says since when and "Foi pra mesa no fim de “A Pedra do Rio”".
- Beta's plank at all six sizes: "180" on "Fazer um degrau para os menores." only. Taking it
  measured Castanhas −180, Confiança +6 and Ânimo +4, and the reveal said "na mesa dela". In
  the office, the plank stood by her desk; pointed at, its tooltip showed inside the window;
  clicked, the Album opened on it.
- Otto at Part 1, his line due: with his floor in view he said "A pedrinha está na caixa. A
  etiqueta diz 'Casa, portátil'." once. Six pokes over 30 s did not repeat it, and the queue
  emptied. Nino's Album named no story and no cushion.
- All six sizes: no sideways scroll, no text under 11 px, and the reveal's button and the way
  out on screen once scrolled to. In the visit the new targets are ≥ 30 px (the keepsake by
  them 40×34). The office keepsake is 26×23 px up to 460 px wide and 36×32 above: scene scale,
  larger than the waving balloons (20×20). The visit tabs stay 27–29 px.
- Keyboard at 380×460:
  - Enter on his Team card focused the first answer; Tab and Enter took Part 3, and focus went
    to the way out.
  - Tab reached "Ver no álbum" (3 px ring); Enter focused the card. Back on Conversar (arrow
    keys), Tab and Enter on the keepsake by him focused the card too.
  - Escape returned focus to his card. High contrast with reduced motion: black on white, no
    animation.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (990 unit tests, 81 files). Full web E2E 362/362 (two runs
of half the specs each, exit 0). `npm run build:desktop` exit 0; no desktop code changed. New
coverage: `tests/personalHistory.test.ts` (26), `tests/visitScrapbook.test.tsx` (3) and
`tests/e2e/stories.spec.ts` (7).

## Blockers

- Kiro Web listed no skills this session; `zooworkers-playtest/SKILL.md` was followed by hand.
- `templates/AGENTS.md` may load as a nested second AGENTS.md (Kiro docs); kept as instructed.
- AUDIO LISTENING REQUIRED: no playback here. Unheard: the purchase, claim and tap cues; the
  error cue on every short press (the button used to be disabled); the celebrate cue on a
  room bought in the shop; the golden cue when the pod mints a whole nut; the paper cue of a
  live welcome back. Also unheard: whether the ambient one-shots (every 2.6–7.8 s) and the
  music grow repetitive over an unattended hour, in active, quiet and mute play. Chapter 2:
  each teammate's babble on every check-in line, the error cue on a locked answer, the
  upgrade cue on taking someone home. Chapter 3: the annex rooms' one-shots (studio tape hiss,
  needle and meter; workshop ratchet, dropped screw and motor; conservatory drip, leaf and pane
  tick), their volume against the office's usual sounds, and repetition over a long stay.
  Chapter 5: the catch and squash cues rising in pitch with the combo, the chime as a Bug
  stage starts, the reward cue for a served order, celebrate (record or mastery) versus reward
  on the result, and how they sit over a 30–45 s round and repeated rounds. Chapter 6: the
  paper cue on taking an answer right after the card's event cue, and the error cue on a
  locked answer. Chapter 7: the paper cue on picking up a keepsake in the office, and the
  answer's paper cue as the only sound when a keepsake goes on the desk.
- Touch was driven through Chromium's touch emulation, not a physical touchscreen. Chapter 6:
  a tap takes an answer at once, so on touch the effect line is the explanation (the scene's
  preview needs a pointer or keys); check that it reads well on a physical screen. Chapter 7:
  on touch the office keepsake has no tooltip and a tap opens the Album; check that a tap on it
  (26×23 px in the smallest windows) lands on it and not on its owner.
- LOCAL WINDOWS VERIFICATION REQUIRED: the last recorded native run is `a4e03ad`. This sandbox
  has no Electron binary or display, so no smoke ran. On Windows: `npm run build:windows:folder`,
  `npm run verify:windows:packaged`, then `smoke:window`, `smoke:focus` and `smoke:mute`.
  Expect the HUD shelf to drag the window everywhere except buttons (masthead included), the
  masthead to show only at ≥760px beside the window controls and never collide with them, and
  320×420 to keep the meadow strip, the goal tag and the scene controls usable at 100–200% DPI.
  Chapter 9, in `release\win-unpacked\ZooWorkers.exe` (pt-BR):
  1. Minimize 10 min, restore. Expect "Aberto no canto, o escritório rendeu tudo." with vault
     plus crate gain ≈ HUD rate × 600. Same for a tray hide and a window fully covered by
     another.
  2. Sleep the PC 15 min with the game visible, wake. Expect "O computador dormiu 15 min:
     esse tempo rende 60%…" and a fuller crate. Repeat while minimized: one note on restore.
  3. Quit, wait 2 h (or move the clock forward), reopen. Expect "Com o jogo fechado, a equipe
     rende 60% (até 8h)…". Move the clock back 1 h with a boost running: no note, and the
     boost keeps its time.
  4. With click-through on and quiet mode from the tray: production continues and audio is
     at a quarter. With click-through off, the note's × and its lines work.
  5. At 320×420 and 100/125/150/200% DPI, the note sits under the HUD and above the dock,
     with lines ≥ 30 px tall.
     Chapter 3 (no desktop code changed):
  6. At 320×420 and 125/150/200% DPI, scroll to the studio, workshop and conservatory. Expect
     each room's action to read in full, the ON AIR lamp to read as a word, the routine badge on
     its machine with no face under it, and a waiting secret's sparkle at the fixture corner.
     Chapter 5 (no desktop code changed):
  7. At 320×420 and 125/150/200% DPI, open Atividades and play each game. Expect the cabinet
     between HUD and dock, Iniciar turno and Jogar de novo on screen without scrolling, and a
     held arrow key gliding the mug.
  8. Click another window mid-round. Expect the round to pause and Continuar to resume it.
     Also try it with always-on-top on, and with click-through off.
     Chapter 6 (no desktop code changed):
  9. At 320×420 and 125/150/200% DPI, click a teammate's **!** ticket. Expect the card inside
     the window, each answer with its line of marks and numbers on one row, a long report
     scrolling with a fade above the answers, and Tab moving the tick between answers.
  10. Right after launch, press Page Down or Tab into the office. Expect the view to stay where
      you moved it. In the lab's bug bounty pick "Vira aposta", minimize for 10 min, restore
      and go to the lab: the bet plays out then, once.
      Chapter 7 (no desktop code changed):
  11. At 320×420 and 125/150/200% DPI, answer a story part in a visit. Expect the notes under
      the reply and Voltar à equipe on screen. At Part 3, expect the keepsake reveal, with
      "Ver no álbum" opening the Album on its card.
  12. In the office, point at a keepsake by its owner's desk. Expect its tooltip inside the
      window; a click opens their Album on it, and clicking the owner still pokes them.

## Next prompt

Chapter 8. Start its session on this branch; `main` has none of this configuration.
