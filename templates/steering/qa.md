---
inclusion: manual
---
# Chapter-close QA

Use existing npm scripts from the CURRENT package.json; refresh this mapping only
if they changed. npm run validate currently includes typecheck, lint, check:i18n,
verify:assets, Vitest and Vite production build. It does not include E2E, Electron
build, Windows packaging or manual play. During implementation choose relevant
existing tests; close each major chapter with validate and relevant E2E. Reserve
the entire E2E/release/platform matrix for final integration or an actual broad
regression. Check exit codes, not just shortened logs.

Activate zooworkers-playtest for the six player-facing acceptance checks and
brief evidence. Use DESIGN.md's surface map for chapter scope/final coverage.
A green suite does not override a failed player gate. If rendered inspection
cannot run, mark PLAYTEST UNVERIFIED; never record the chapter as complete.

Play first-run and progressed saves in pt-BR through the actual player path.
Developer seeds/time controls help reach late states but do not replace normal
progression testing. For changed layouts resize through 320×420, 380×460, 800×600,
1280×720, 1440×900 and 1920×1080 CSS pixels. Cover the chapter's worst-case state
at each size; exhaustive combinations of unchanged screens are unnecessary.
Use existing Playwright tests and a sufficient current browser controller.
Prefer the local Playwright CLI when its help confirms availability; otherwise
use the official agent CLI. Never add a second controller just for this gate.
Normally inspect 1–3 targeted viewport images, one at a time; capture more only
to resolve a concrete remaining defect. Six-size checks do not require six images.
Inspect a screenshot only when it answers a visual question.
For large displays, an overview may be downsampled below the model's image limit;
use a separate native-resolution crop when judging tiny text. Keep raw images and
verbose test artifacts out of the model's persistent context.

Check clipping, overlap, readable dialogs, usable hit targets, scene/employee
presence and compact minigame boards. Verify focus, keyboard/undo where applicable,
reduced motion, high contrast and color-blind cues for affected flows. Confirm
reward and save state after reload. Add focused tests only for meaningful new
behavior or regression risk, reusing existing coverage.

Desktop changes: npm run build:desktop and relevant existing smoke scripts when
the runtime supports them. Final Windows work uses build:windows:folder or
build:windows, verify:windows:packaged and pertinent smoke:window, smoke:mute,
smoke:focus, smoke:spacedpath, smoke:packaged, smoke:recovery and
smoke:singleinstance scripts. Inspect each script's prerequisites before running;
these names are not proof they work on the present host.

Native Windows verification covers content-window sizing and 100/125/150/200% DPI,
resize/multi-monitor snapping, topmost/frameless/tray, click-through escape,
sleep/resume, focus/audio/quiet behavior, saves after restart, recovery, upgrades,
paths with spaces and a packaged app offline. Preserve Electron contextIsolation,
preload/CSP and typed platform boundaries. If not executed on Windows, mark
LOCAL WINDOWS VERIFICATION REQUIRED with exact steps and expected outcomes.

Write only concise evidence and outstanding environment blockers in
docs/ZOOWORKERS_STATE.md. Product defects in the chapter must be fixed before
completion; genuine platform/credential blockers remain explicit. A green build
is one gate, not a verdict that the game is fun or release-ready.
