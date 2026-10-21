# ZooWorkers state

Handoff only: design is in `DESIGN.md`, commands and matrix in `.kiro/steering/qa.md`.

## Branch

`feat/zooworkers-3.0-facility-pass`: final integration is the commit that records this entry,
on top of Chapter 10 (`f2c5b90`), Chapter 8 (`60fdd3c`), Chapter 7 (`4639fa2`), Chapter 6
(`25ba899`), Chapter 5 (`f4ae64c`), Chapter 3 (`8cbf590`), Chapter 2 (`d6c4d28`), Chapter 9
(`d9fab09`), Chapter 4 (`e7bac62`), Chapter 1 (`80264a8`) and the setup commit `c55d356`; clean.
`7a7ee3d` (architect's snapshot) is an ancestor; never roll back to it.

`feat/zooworkers-observation-log`: Feature A (the observation report), one commit on the final
integration `9f5ef83`, with a PR into `feat/zooworkers-3.0-facility-pass`. PR #9 stays open,
unmerged and unchanged.

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
- Chapter 6, 7, 8 and 10 sessions: the same (Node on `PATH`, `npm ci`, locked rev 1228 fetched,
  stock E2E config); rendered play by throwaway scripts in the ignored `visual-artifacts/play/`.
  Chapter 10: files written by one shell call can take a few seconds to appear to the file
  viewer, and it may show an earlier image for a reused path; give each screenshot a new name.
- Final integration session: the same; `/tmp` is not kept between shell calls either, so raw
  logs went to the ignored `visual-artifacts/logs/`. CI artifacts (the Playwright report)
  cannot be downloaded from here (HTTP 403), so CI evidence is the job log.

## Validation

`npm run validate` (typecheck, lint, check:i18n, verify:assets, Vitest, build) and
`npm run test:e2e` (build + preview on :4173); desktop and Windows scripts per `qa.md`.

## Chapters

Order: 1 → 4 → 9 → 2 → 3 → 5 → 6 → 7 → 8 → 10 → final integration.

Accepted kit chapters: 1, 4, 9, 2, 3, 5, 6, 7, 8, 10, then final integration (record after
Chapter 10's). Accepted pre-kit units: shell (`b138638`–`6189169`), living office
(`bfaca01`–`d81ddc2`) and GC1–GC4 (`67cd776`–`7a7ee3d`), pinned by E2E specs but with no
six-check record. Kit chapters reuse them as evidence and change only what fails the gate.
GC numbers are not kit numbers.

| Kit | Entry points                                                                                                              | Baseline / known gaps                 |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | `App`, `ui/GameHud`, `GameDock`, `Sheet`, `modals/OpeningSequence`, `Onboarding`, `art/OfficeScene`, `views/SettingsView` | Accepted (record below)               |
| 4   | `sim/goals`, `crate`, `economy`, `ui/GoalTag`, `views/ShopView`                                                           | Accepted (record below)               |
| 9   | `engine.catchUp`, `sim/offline`, `sim/timeline`, `state/returns`, `ui/ReturnNote`, `ui/Notifications`                     | Accepted; diary now read by Feature A |
| 2   | `views/EmployeesView`, `modals/EmployeeTalk`, `sim/bonds`                                                                 | Accepted (record below)               |
| 3   | `art/RoomDressing`, `RoomPlay`, `content/rooms`, `roomPlay`                                                               | Accepted (record below)               |
| 5   | `ui/minigames/*`, `sim/minigames`                                                                                         | Accepted (record below)               |
| 6   | `modals/IncidentScene`, `EventModal`, `content/incidents`, `ui/CuriosityLog`                                              | Accepted (record below)               |
| 7   | `modals/EmployeeTalk`, `VisitScrapbook`, `content/stories`, `employeeKeepsakes`                                           | Accepted (record below)               |
| 8   | `views/DecorateView`, `ui/DecorationTray`, `sim/placement`, `depth`                                                       | Accepted (record below)               |
| 10  | `views/PrestigeView`, `CollectionsView`, `sim/prestige`, `collections`, `nextStep`                                        | Accepted (record below)               |

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

### Chapter 8 record — decoration catalogue, placement and world depth

Baseline: the arranging rebuild (`4243259`, sides from `bfaca01`) and the catalogue from
`a4e03ad`, audited in play and kept where good: the die-cut pick, the ghost at real size,
stack picking, tap-to-place, Move To…, undo/redo, surface locks, load repair. No save field,
currency or inventory added; balance unchanged. `docs/DECORATION_EDITOR_UI.md` is current.

Broken or weak before (reproduced in pt-BR at 380×460 and 1280×720), fixed:

- Floor furniture painted over every teammate wherever it stood: a billboard or an aquarium
  behind Pip's desk covered his face. It now stands among the team, sorted with them by how
  far back its base is (`decorationRenderZ`, with `STAGE_HEIGHT_PX`/`standingDepthPx` in
  `content/roomLayout.ts`, the units teammates stand in); a teammate wins a tie. Hanging
  pieces (a chandelier over a desk) moved behind the team, with wall art and rugs. "Pôr
  atrás" still sends a floor piece behind everyone; brought back, it rejoins the team where it
  stands. Saved depth and layer are unchanged (no migration).
- A drag from the storage strip often failed. On the way up it crossed the tower's bottom
  edge, which scrolled the rooms ~24 px under the pointer; the release then landed on the
  room's action bar, which counted as "put away" and did nothing for a stored piece. Now:
  - edge scroll waits for the pointer to be held at the edge (350 ms);
  - only the strip puts a piece away, and the landing is worked out again when the window
    resizes or the tower scrolls under a still pointer;
  - off the rooms the ghost hangs from the pointer at its grab offset (it used to freeze).
- Leaving arranging mid-drag (the switch, by keys) still committed the release; it cancels.
- With a piece in the paw the strip says, in place, what letting go there does ("Solte aqui
  para guardar no depósito" / "…deixar no depósito"), green when over it. A piece held off its
  surface says where it belongs ("Isto vai na parede."), not "Mova mais para dentro da sala.",
  and an engine refusal on release says so too.
- The catalogue was five rows of pills (21 room chips with every room open) before the first
  object; its section tabs were unstyled, an owned card's four controls spilled out, a short
  buy button was grey with no reason, "Bloqueado" named no room, and every card said "+N
  ânimo" though a placed piece gives no lasting morale. Now:
  - one segmented control (Disponíveis / Suas peças / Em breve, with counts), a search and one
    filter (a room or a kind);
  - each card shows the piece in a little of its room, its line, surface, room (or Guardada)
    and set, then its state: the price and "Ânimo +N ao comprar"; short, "Faltam N", and when
    pressed "Ainda faltam N castanhas." with nothing charged; owned, "Arrumar" (to the office,
    picked) and "Mover para…" (storage included); coming, "Chega com: <sala>" and the price;
  - wide cards keep the actions beside the words.
- Purchase: the store charged and the engine filed it, unsaved, with the cue played twice; an
  unknown id became owned. `engine.purchaseDecoration` checks (unknown, owned, locked room,
  short with the amount missing), charges once, owns once, places it in its room or storage,
  adds its morale and saves; the card says "Feito! Já está na sala: Mesa do Fundador."
- The room header's "+N conforto" (it changed nothing) became the room's decorations: how
  many, and its set's progress or "Conjunto completo" with what it does.
- The strip had 8–10 px names and 17 px chips. The chips went (the catalogue has the
  filters); names, rooms and "Mover para…" are ≥ 11 px (a 28 px button). Its counts no longer
  go stale (memos keyed on the mutable state). Tidy-up reads "Organizar" (it said "Arrumar",
  like the mode switch) and is offered only where the room has pieces of its own.
- Load repair gives pieces relocated together off a wrong surface their own default spots.
- 80 legacy catalogue rules (five passes in `styles.css`) went; the catalogue styles from
  `ui/game/decorate.css`.

Player gate (pt-BR, built game, Chromium 1228; a young company with four rooms and 650
castanhas; real pointer and keys):

- At 320×420, 380×460, 800×600, 1280×720, 1440×900 and 1920×1080:
  - the catalogue had no sideways scroll and no text under 11 px (the recipes' small print
    went up from 10.7 px); the first card is on the first screen at 320×420;
  - the plushie (800) answered "Ainda faltam 139 castanhas."; the poster was bought, said
    where it went and was on the wall after a reload;
  - "Arrumar" on the stored lamp opened arranging with it picked. Dragged up from the strip,
    the room moved 0 px and the lamp landed where it was let go (x 0.70);
  - Escape left the fern exactly where it was; let go over the strip it was put away, still
    owned. After a reload all three were where they had been left.
- Depth at every size: Pip 159 > fern 142 > Bento 140 > billboard 119. The billboard at the
  back stands behind both desks, the fern between them.
- 1280×720, normal motion: a wall piece moved along its wall (x 0.25 → 0.62). Pulled down to
  the floor, its ghost stayed on the wall, greyed, and the release said "Isto vai na parede."
- Keyboard at 380×460: Tab goes sheet × → recipes → sections → search → filter → each card's
  piece and actions, with a 3 px ring. Enter bought the poster (focus stayed on its card);
  "Mover para…" by keys sent the fern to Depósito; Enter on "Arrumar" opened arranging with it
  picked. High contrast with reduced motion: black on white cards and controls, no animation.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (1002 unit tests, 82 files). Full web E2E 369/369 (two
halves, exit 0). After the last change (the off-surface reason), the eleven decoration and
layout specs ran 66/66. One earlier run of that batch timed out booting `release-transformation`
at 1280 (the office not shown within its 10 s); it then passed 18/18 over three repeats.
`npm run build:desktop` exit 0; no desktop code changed. New coverage:
`tests/decorationCatalog.test.ts` (7), depth (+3), placement (+1), placement model (+1) and
`tests/e2e/decor-catalog.spec.ts` (7); `living-office` and `decoration-collision` pin the new
depth rule.

### Chapter 10 record — progression, collections and the restructure

Baseline: `65c4f09` (branch effects applied, shown as chips) was the only Chapter 10 work.
Kept: the branch cards and chips, the kernel and skill rules, the eligibility line, the
Moment Card documents, the curiosity board and the secret files. No save field, currency,
timer, registry or goal engine was added; balance unchanged (line 1M, kernels √(M/1M), +2%
production per kernel held, branch and skill numbers).

Broken or weak before (reproduced in pt-BR at 380×460), fixed:

- The restructure (`sim/prestige.ts`):
  - It regenerated the day's challenges, so one already claimed could be claimed again (golden
    nuts twice). The day now carries over: claimed stays claimed, progress stands.
  - It reset the founding date ("Fundada em" changed), marked onboarding undone and dropped the
    golden dust (the fraction of a golden nut refining) while keeping golden nuts. All three
    are kept now.
  - It accepted an unknown branch id; that is refused now, like a cycle below the line, with
    nothing changed.
- The screen was unstyled ("TERMO DE CONTINUIDADE01 – 02"). It said "recursos da empresa
  recomeçam" though golden nuts are kept, never said what a kernel does or that a skill spends
  its +2%, said "1 objetos", and confirmed with "Ficar Completamente Louco? Confirmar /
  Cancelar". It had four names (Prestígio, Ficar Completamente Louco, Pirar na Castanha,
  "Linhas do tempo"). Now:
  - one vocabulary: tab, stats and achievements say Reestruturação; the act is "Pirar na
    Castanha" (EN "Go Completely Nuts");
  - a continuity file read from `restructurePreview`, which runs the operation and reads its
    result, listing only the lines that apply: what you receive (kernels, their worth now and
    after, the Head Start), what stays (golden nuts, decorations where they stand and how many
    wait in rooms that close, collections, achievements, the people who know you, records,
    identity, kernels/skills/today's challenges/settings), and what starts over (nuts from →
    to, hires and levels with the founder staying, rooms that close, upgrades, morale and
    reputation, sets that stop counting, the crate, what was waiting, promises, boosts, a focus
    session);
  - the branch is a radio group (arrows, Home/End, one tab stop), the current one marked;
  - the confirmation restates the trade as one list ("Recomeçam: 4 contratações, 20 salas e
    2,5M castanhas."), says "Não dá para desfazer." and focuses "Ainda não"; Escape steps back
    to the file; the button locks after one press and the sim refuses a second;
  - afterwards a gold note ("Ciclo 2 começou: +2 Grãos Permanentes · Castanhas Industriais.")
    and the office with its first goal;
  - from half way to the line the file is in sight, locked, with a progress bar and what the
    line pays (the tab used to appear only once ready);
  - skills give numbers from the effect the sim reads ("Agora: … · próximo nível: …") and the
    trade-off; a short press stays pressable, as in the shop ("Ainda faltam 2 Grãos.",
    nothing charged); "moral" became "ânimo".
- The guide (`sim/nextStep.ts`, `GameDock`):
  - Past 1M, "pronta para Pirar na Castanha" outranked a waiting discovery, hires and upgrades
    for the rest of the cycle. A waiting discovery now comes first and names its room. The
    restructure is offered once per cycle: the `restructure.reviewed` flag is set when the
    file is read while open, and a restructure does not keep it.
  - "Try Focus Harvest" never retired; it does after a session.
  - The note gives a reason on a second line (golden nuts waiting, kernels offered, the room),
    unclipped at 320×420. A step in the office (a discovery on another floor) now shows its
    note there too; it was hidden.
  - The Company file's ladder says what the next rung brings.
- Collections (`sim/collections.ts`, `CollectionsView`):
  - Before: four tabs of "???" cells. Free and worn outfits showed as unknown (the Team names
    them). A nut's hint named a room before it could turn up there (the founder's acorn before
    Pip's story). The curiosity count included rooms not on the board. Hidden achievements
    showed their reward. Sets, keepsakes and masteries were absent. One bad entry wiped a whole
    list on load.
  - Now a cabinet of seven drawers (Enciclopédia, Curiosidades e segredos, Conjuntos,
    Lembranças, Maestrias, Roupas especiais, Cartões de Momento). Each shows its count, what can
    be done now and the real reward if any (the gold icon only for golden nuts). A drawer opens
    at its head under "Coleções"; Escape steps back to the cabinet.
  - Counts are derived from the record that earns each thing (nothing stored): nuts within the
    24; curiosities in open rooms (as the board); sets active as their bonus is (all pieces in
    the room); keepsakes `keepsakeFor` knows; masteries by `isMicroMastered` (the discoveries
    now read it too, so a record from before the flag opens them); the 24 outfits with a price;
    Moment Cards without a total, like secret files.
  - Unfound things stay blank: a nut names a room only when its curiosity can turn up
    (`oddityAvailable`); an unknown keepsake is "A lembrança de Beta" with what opens it.
  - The schema reads each list entry by entry: a bad entry or a repeat is dropped, not the list.
  - Decorate says when a placed piece's room is closed for this cycle.

Reset and retention, as implemented (`restructured`) and pinned (`tests/restructure.test.ts`):

- Kept: company name, logo and founding date; settings and onboarding; kernels (plus those
  earned), skills, the branch chosen, the count and the new cycle's starting line; golden nuts
  and dust; every collection list (decoration ownership included) and the decorations where
  they stand; achievements; lifetime stats; minigame records; completed focus sessions; each
  teammate's friendship, outfit, nickname and conversations; history flags (employee-prefixed,
  `favorite.`, `discovery.`, `annex.`, `microgame.`, `pair.`, `oddity.`, the anomaly thread);
  the day's challenges.
- Reset: nuts (to the Head Start), hires and levels (the founder at 1), rooms, upgrades, morale,
  reputation, the clicker record, the crate, finds, routines and waiting curiosities,
  incidents, remarks, the diary, event cooldowns, history, chains and the open card, promised
  consequences, boosts, a focus session in progress, other flags (crises, promises,
  `restructure.reviewed`).
- Refused, state untouched: below the line (this cycle's nuts) or an unknown branch. A second
  confirmation finds the new cycle at zero, also after a reload.

Player gate (pt-BR, built game, Chromium 1228; seeded companies, real clicks and keys):

- A 4.2M-nut company at 320×420, 380×460, 800×600, 1280×720, 1440×900 and 1920×1080:
  - the dot on Arquivo and "A empresa pode Pirar na Castanha. Rende +2 Grãos Permanentes.";
    reading the file saved the flag and moved the dot to Equipe;
  - the confirmation on screen at 320×420 (both 40 px buttons), focus on "Ainda não"; Escape
    went back to the file, focus on the action;
  - a double press: count 1, 2 kernels, the gold note, the first goal; after a reload still 1
    and 2, the day still claimed, the founding date, Otto's friendship and keepsake kept, the
    3 repair-set pieces waiting in their closed room.
- Early company, 380×460: "Conheça Tico…" opened Team; the goal tag bought Linha de Produção and
  showed "Nv. 2"; no Reestruturação tab yet. The acorn by Pip's desk gave "Novidade na
  Enciclopédia", and the drawer went 0 → 1 de 24 with its name, also after a reload.
- A 620K company: the tab in sight, the file locked at "620K de 1M", no action.
- Keyboard, 380×460: the arrows chose Ciência Questionável (3 px ring); Tab, Enter, Shift+Tab,
  Enter restructured on it. Vantagem Inicial bought (Nv. 1/10, "Agora: começa cada ciclo com
  500 castanhas"); Refinaria short: "Ainda faltam 2 Grãos.", kernels unchanged.
- Cabinet and drawers at all six sizes: no sideways scroll; text ≥ 11 px except the evidence
  sketch's own label (9 px, aria-hidden art); targets ≥ 29 px except the Moment Card's hover
  export shortcut (22 px; the card opens a dialog with the full button). High contrast with
  reduced motion legible; normal motion at 1280×720.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not
  heard).

Checks: `npm run validate` exit 0 (1029 unit tests, 84 files). Full web E2E 374/374 on the
final code (two halves, exit 0), as on an earlier pass of the chapter. A run between them, under
heavy host load (load average 12–17, the preview server lost), failed 24 on timeouts and refused
connections; the same code then passed 374/374. `office-play` "the nut counter stays true…" is
timing-sensitive under load: the tweened counter can trail the label across a million (6
against 7M). It failed 2 of 36 repeats here and 1 of 36 on `60fdd3c`, so it predates this
chapter. `npm run build:desktop` exit 0; no desktop code changed. New coverage:
`tests/restructure.test.ts` (12), `tests/collectionShelf.test.ts` (11), `nextstep` (+4) and
`tests/e2e/restructure.spec.ts` (5); three specs now open Collections drawers instead of tabs.

### Final integration record — the whole game

Baseline `f2c5b90` (fresh clone, `npm ci`, Chromium 1228): `npm run validate` exit 0 (1029,
84 files); full E2E 373/374 (the `office-play` counter test); `build:desktop` exit 0. CI on
PR #9 at `f2c5b90`: the validate job passed; E2E 371/374, failing `minigame-rounds:288` (90 s),
`release-transformation:201` (60 s) and `stories:273` (no keepsake tooltip). CI's E2E job was
red on 8 of the last 10 chapter commits. The report upload hit the account's artifact storage
quota: a repository-settings matter, separate from the failures, not changed here.

Journey played (pt-BR, built game, real clicks and keys; seeds only for late states):

- Fresh company, 380×460: opening by keys, the crate coach, 10 taps, the goal bought and the
  next one, the guide to Tico's Part 1 (+6 trust), the guide to Activities, a Coffee round
  (149, record, +31% for 90 s); after a reload nothing paid twice and pt-BR kept.
- One company across a cycle, 1280×720: the daily claim (+1 golden); "A Ata" → laminate
  (Moment Card, set in motion); the workshop set bought (each piece charged once, placed); its
  discovery (secret file); 4 min later the laminated minutes on the wall, its file naming the
  decision; Otto's Part 3 (keepsake on the desk); the cabinet; a reload (all kept); the
  restructure: +1 kernel, golden nuts, Moment Cards, secrets, Otto's friendship, the founding
  date and today's claimed challenge kept; only run flags reset (`minutes.*`,
  `restructure.reviewed`, a moment).
- Bug Squash first mastery (514), 380×460: +1 golden, the shelf souvenir and a Moment Card; it
  brought the incubator's discovery to the guide; masteries 1 of 3; no second nut after a reload.

Fixed, each reproduced first (new tests fail on `f2c5b90`, checked in a worktree):

1. A restructure hid what was noticed in rooms it closes: the cabinet went from "13 de 55" to
   "2 de 2", and a lead from such a room opened nothing. The board's rooms are now those open
   or holding something noticed (`sim/roomPlay.curiosityBoardRooms`), closed ones marked
   "Fechada até reabrir", counted alike by board and cabinet ("13 de 15"); the next step names
   only open rooms. This supersedes Chapter 10's "curiosities in open rooms".
2. Opening the curiosities drawer at 320×420 and 380×460 scrolled the stage (overflow hidden)
   by 79 px: the Archive's head went off the top and a dark band sat over the dock. Only the
   sheet scrolls now (stage 0 px for all 7 drawers at six sizes), and a lead's file, often far
   below, is brought into view.
3. `contain-intrinsic-size` (a content-box size) held the whole floor's height plus a size
   remembered from the provisional first frame: 10–15 of 21 floors were 72–78 px too tall at
   every size, the tower shrank under a still pointer as they were drawn (an elevator trip
   drifted 113 px; a hovered keepsake slid away 37 ms later, CI's `stories:273`). It is now the
   stage's height at the current scale: 0 floors off and 0 px drift at six sizes.
4. The HUD counter restarted a 400 ms tween at every production step, trailing by a median
   2.15 s (max 4.48 s) of production at CPU×4. Steps now move it at once; only jumps glide (on
   frame time, landing within 400 ms). Measured 0.00 s at CPU×1, ×4 and ×8.
5. pt-BR: "Tico agradeceram a ajuda". Now by count ("Quincy agradeceu", "Quincy e Nica
   agradeceram"), names joined the locale's way, also on the menu card.
6. The restructure's gold note was cut to one line ("…Castanh…"): gold notes take two lines.
7. Tests, no assertion changed: `minigame-rounds` counted a pest, then clicked through a second
   locator; React commits are not on the fake clock, so the desk changed after `runFor` in 7–10%
   of steps (measured) and the click could wait forever. Each tap is one query and dispatch.
   `release-transformation:201`'s walk (13 s untraced, 34–60 s traced in CI) is split by surface
   into three tests with the same checks. `office-play` reads label and number in one instant.

Rendered checks: the restructure note, the board, the lead's file and Escape ×2 at all six
sizes (no sideways scroll, text ≥ 11 px, lock and words, not colour, mark a closed room; high
contrast black on white); the elevator to the rooftop at 380×460 and 1280×720 holds still.
Six checks — see, understand, interact, feedback, why it matters, feel: PASS for the whole
journey and the changed flows (audio not heard).

Checks (final tree): `npm run validate` exit 0 (1035 tests, 84 files). Full web E2E 377/377,
exit 0. CI-like (1 worker) ×2 of the three CI failures' specs 46/46; the counter test under a
6-worker load 24/24 (21/24 before). `npm run build:desktop` exit 0; no desktop code changed.
`smoke:minimal` exit 1, "Process failed to launch!": this sandbox's Electron lacks
`libgtk-3.so.0` and a display, so no Electron smoke or packaging ran. Not fixed (weak, not
broken): the Team sheet's first opening with all 23 and every decoration takes ~0.85 s here
(~0.2 s after), mostly style and layout of a ~2,900-node office.

Release readiness: the browser build is integrated and green, but the release stays BLOCKED
on the human checks below (audio, physical touch, native Windows/DPI). PR #9 is not merged.

### Feature A record — the observation report

The gap: the office diary was written but never read, and nothing said who decided an incident
nobody opened. Now Nutshell's researchers keep a file on the office, read from what the game
already records (`sim/observation.ts`, derived on render, never stored):

- Data: `EventHistoryEntry` gains optional `by` (`player`/`team`) and `roomId`, written by
  the engine when a decision is taken (the team only inside `autoResolveActiveEvent`, through
  a private flag); conversations are the player's. No save version bump: older entries load
  as they are and read "Arquivado / Decisão arquivada", with no who and no way there. The
  history now parses entry by entry (`listOf`, newest `EVENT_HISTORY_SIZE` = 50, shared with
  the engine): a bad field or record is dropped, not the list. No timestamp matching.
- Rows: decisions from the history (a card's steps are one row, joined by the content's own
  `next`; the same card twice is two rows; talks stay in the Album); rare/legendary incidents
  that passed and small moments from the diary; what waits from the incidents. The diary's
  started/opened/handled/landed/remark lines are never rows, so each incident is told once.
  Newest first, at most 40, by day (Hoje, Ontem, a date). An unseen incident has no event id
  in its row: a black bar, "Nome não registrado" for screen readers; no row shows rewards,
  effects or secrets. Each row's "Ir até lá" goes to its room while that room is open (the
  welcome back's way there; a waiting incident's ticket takes the keyboard). A restructure
  resets history and diary, so the file starts over.
- UI: a `PopupShell` document (letterhead, "Uso interno" stamp, worded stamps Equipe, Você,
  Arquivado, Não observado, Momento, Esperando), opened from Arquivo → Empresa (the timeline
  also marks rows Equipe/Você) and from the welcome back when the file has something. It opens
  at its letterhead (`initialFocus="dialog"`; Tab and Shift+Tab enter it). Reuses the paper cue.
- Files: `sim/observation.ts`, `ui/ObservationReport.tsx`, `ui/game/observation.css` (new);
  `sim/types`, `config`, `engine`, `format`, `save/schema`, `state/store`, `ui/ReturnNote`,
  `views/CompanyView`, `modals/PopupShell`, `useFmt`, `App`, `main`, en/pt-BR locales; tests
  `observationReport.test.ts` (21), `observationReport.test.tsx` (7), `e2e/observation.spec.ts`
  (5); a note each in `HOW_TO_PLAY_THE_GAME.md` and `GAME_DESIGN.md`.

Rendered play (pt-BR, built game, real clicks and keys; a seeded company):

- 380×460: the elevator to the lab, its ticket, "Puxar da tomada"; the meeting room's incident,
  left alone, handled by the team; the timeline's Equipe and Você; the report with both; at
  all six sizes the file inside the window, no sideways scroll, ways there 34 px, Close on
  screen, no text under 11 px; Escape back to the button; "Ir até lá" closed the Archive with
  the meeting floor in view; a reload kept who and where.
- 320×420, closed 2 h: the note's crate line, one waiting line and "Ler o relatório de
  observação" (35 px, above the dock); the file's unseen rare row with no name anywhere; high
  contrast black words and frames; reduced motion without animation.
- Fixed during play: the tape over the letterhead, a 1 px sideways scroll (the tilted stamp),
  the file opening scrolled to its first button at 320×420, the waiting stamp's contrast
  (3.69 → 5.22:1; every text role ≥ 5.22, 21 in high contrast), an arrow glyph the bundled
  fonts lack (a card's next step is a "Depois:" line now), a truncated note link.
- Six checks — see, understand, interact, feedback, why it matters, feel: PASS (audio not heard).

Checks: `npm run validate` exit 0 (1063 tests, 86 files); full web E2E 382/382, exit 0 (an
earlier full run had two `event-setting` boots time out under load; 4/4 alone). The Coffee
"fills the order" round is a load flake on both trees: 2 failures in 63 repeated runs here, 1
in 63 on a `9f5ef83` worktree; no minigame code changed. `npm run build:desktop` exit 0; no
desktop code changed, and Electron still cannot start here.

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
  answer's paper cue as the only sound when a keepsake goes on the desk. Chapter 8: the one
  upgrade cue on a catalogue purchase (it played twice), the error cue on a short press and on
  a release off a piece's surface, and the place and click cues on landing and putting away.
  Chapter 10: the prestige cue on a restructure (once, then the office), the error cue on a
  refused restructure and on a short skill press, the upgrade cue on a skill bought, and the
  paper cue on opening a keepsake's album from the Collections. Final integration changed no
  sound; all of the above is still unheard. Feature A: the paper cue on opening the
  observation report, from the timeline and from the welcome back (right after its own cue).
- Touch was driven through Chromium's touch emulation, not a physical touchscreen. Chapter 6:
  a tap takes an answer at once, so on touch the effect line is the explanation (the scene's
  preview needs a pointer or keys); check that it reads well on a physical screen. Chapter 7:
  on touch the office keepsake has no tooltip and a tap opens the Album; check that a tap on it
  (26×23 px in the smallest windows) lands on it and not on its owner. Chapter 8: with a
  finger, drag a piece up from the storage strip into a room (the tower must not scroll on the
  way), hold it at an edge to scroll, and let it go over the strip to put it away. Chapter 10: tap a
  branch card, the restructure action and both confirmation buttons, and a Collections drawer
  and its way back. Final integration: tap a lead on the curiosity board (its file comes into
  view), and scroll the tower with a finger right after the elevator lands (it must not drift).
  Feature A: tap "Relatório de observação" in Arquivo → Empresa and on the welcome back, scroll
  the file with a finger at 320×420 (it scrolls inside its paper, Fechar stays put), and tap a
  row's "Ir até lá" (34 px) without hitting the row below.
- LOCAL WINDOWS VERIFICATION REQUIRED: the last recorded native run is `a4e03ad`. In the final
  integration session the Electron binary downloaded but cannot start (`libgtk-3.so.0` missing,
  no display; `smoke:minimal` exit 1, "Process failed to launch!"), so no smoke, packaging or
  DPI check ran. On Windows: `npm run build:windows:folder`,
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
      Chapter 8 (no desktop code changed):
  13. At 320×420 and 125/150/200% DPI, open Decorar. Expect the sections, search and filter in
      two rows and a card on the first screen; buy a piece and see where it went.
  14. Press Arrumar on a stored piece and drag it up from the strip into its room. Expect the
      room to stay still and the piece to land where you let go. Resize the window mid-drag:
      expect the ghost to follow what is under the pointer. Let a placed piece go over the
      strip: expect it in storage.
      Chapter 10 (no desktop code changed):
  15. At 320×420 and 125/150/200% DPI, open Arquivo → Reestruturação on a company past 1M.
      Expect the file, the branch cards and "Pirar na Castanha…"; pressed, the confirmation
      with both buttons on screen; confirmed, the gold note and the office with its first goal.
  16. Arquivo → Coleções: expect the drawers in one column, a drawer opening at its head,
      Escape back to the cabinet and Escape again closing the Archive.
      Final integration (no desktop code changed):
  17. At 320×420 and 125/150/200% DPI, open Arquivo → Coleções → Curiosidades e segredos.
      Expect the Archive's title and tabs to stay on screen with no dark band above the dock;
      press a lead under "Pistas em aberto" and expect its file in view.
  18. In a company with every room open, ride the elevator to the rooftop and back home, then
      point at a teammate's keepsake. Expect the view to stay where it landed and the tooltip
      to stay up while pointed at.
  19. With a heavy program running alongside (a build, a video export), watch the HUD counter
      for a minute. Expect it to keep pace with its tooltip value; collecting the crate glides
      up and lands within half a second.
  20. Restructure a company past 1M and expect the gold note to read in full on two lines;
      in Arquivo → Coleções, a room that closed reads "Fechada até reabrir" with what was
      noticed in it.
      Feature A (no desktop code changed):
  21. With the window always on top in a corner, leave a **!** ticket unopened for 25 min
      while working in another app. Expect it handled by the team, and Arquivo → Empresa to
      mark the row "Equipe"; minimizing instead must leave it waiting.
  22. At 320×420 and 125/150/200% DPI, open the report from Arquivo → Empresa and from the
      welcome back after a night closed. Expect the letterhead on screen first, no sideways
      scroll, Fechar in the window, and "Ir até lá" bringing the room's floor up.

## Next prompt

Release verification on this branch: the human checks under Blockers (audio, a physical
touchscreen, native Windows packaging and 100–200% DPI), then the merge of PR #9 when the user
decides. Read CI's E2E job on the pushed commit first; `main` has none of this configuration.
Feature A's PR targets `feat/zooworkers-3.0-facility-pass`: review and merge it when the user
decides (after PR #9, or retarget it if PR #9 merges first).
