# ZooWorkers — permanent execution contract

ZooWorkers is a cute, cozy, funny, slightly strange clicker/idle PC GAME built
around a SMALL RESIZABLE DESKTOP WINDOW. It must be enjoyable in the corner of
the screen. The living office, its 23 employees and direct interactions lead the
experience. Extra space reveals more world and atmosphere; UI stays restrained.
Nutshell Inc. is a warm, suspicious, absurd behavioral-research company.
DESIGN.md owns visual/interaction decisions; read relevant sections on demand.
Preserve all 23 employees, natural proportions and a maximum of four per room.
Support satisfying 30-second, 2–5-minute and 10–20-minute visits, active play and
quiet ambient play. Leaving it open must remain a rewarding intended use case.

## Continue the real project

Repository: contatoleonardoorrutia-oss/claude.
Delivery branch: feat/zooworkers-3.0-facility-pass.
Use the current checkout and current branch history, not an older snapshot.
Read git status, branch, recent relevant commits and docs/ZOOWORKERS_STATE.md
once. Preserve uncommitted user changes; never reset, force-push, discard,
revert existing good work or rebuild the project from scratch. Use an isolated
worktree if branch switching would disturb existing work. Keep dependencies and
the lockfile unless a concrete implementation need justifies a change.

Current boundaries: deterministic rules in src/sim; authored data in
src/content; versioned state in src/save; orchestration in src/state; React UI
in src/ui; scene and asset registries in src/art; desktop APIs in electron and
src/platform. Reuse these boundaries. Do not create a second economy, clock,
relationship store, event queue or save system. Prefer derived state.

## Preserve identity and working features

Preserve all 23 authored employee APNGs, posters, employee IDs, registry geometry,
authored office art and good illustrations. Pip's registered ORIGINAL build is
already repaired: reimporting its raw master can restore the halo defect.
Do not casually replace assets, flatten animations, change aspect ratios,
upscale source bitmaps, remove posters or switch the renderer/framework.
Use uniform presentation scale with registry geometry and DESIGN.md's Pip reference.

Retain relationships, individual stories, gifts, memories, keepsakes,
discoveries, incidents/consequences, room routines, stations, decorations,
collections, minigames, save/load/migrations/backups/recovery, undo, accessibility,
Photo Mode, Moment Cards, Focus Harvest, company/archive/prestige systems and
browser fallbacks. Preserve frameless/resizable window, always-on-top, corner
snapping, quiet/mute, click-through, reduced motion, high contrast and color-blind
support. Improve weak implementations within these capabilities.

For the current chapter, distinguish broken, weak, missing, visually poor and
already good using code and a short playable reproduction. Preserve good work;
fix broken behavior; redesign poor presentation; rebuild weak internals when
patching would cost more; implement genuine gaps. Historical complaints are
reproduction targets, not evidence that today's code is broken.

## Execute to the chapter boundary

UNDERSTAND → IMPLEMENT → PLAYTEST → FIX → VALIDATE → COMMIT → PUSH → STOP.
Make a short plan of at most five outcomes, then implement. Finish every
in-scope outcome; passing tests alone is not completion. Do not stop after one
useful change with a list of remaining improvements. No placeholder interactions,
fake rewards, replacement audits, speculative rewrites or report-only delivery.
If a chapter already meets its criteria, demonstrate that briefly and advance
its state without manufacturing changes or an empty commit. Stop at this chapter;
the user starts the next prompt.

Use focused source reads, rg and existing tests. Never preload the entire repo,
all locale files, every previous report or the whole prompt pack. Default to one
primary agent; delegate at most one bounded independent task only when its full
cost is lower than doing it directly. Do not silently lower the primary model,
reduce product scope, compress authored dialogue or install tools speculatively.
Keep raw logs locally; expose concise results with failing diagnostics intact.

pt-BR is the primary QA language: natural Brazilian phrasing, individual voices,
humor, interpolation, plurals and UI fit. Use the existing localization system;
update required English parity and preserve other supported locales/fallbacks.

During implementation run relevant tests. Near the end run npm run validate
once, then relevant E2E and affected desktop checks. This aggregate already
includes typecheck, lint, i18n, assets, unit tests and web build. Re-run affected
checks after fixes; repeat the full gate only when cross-cutting changes warrant
it. Never disable assertions, lower acceptance criteria or refresh visual
baselines just to hide failures. Load qa steering for the chapter close.

Every major visual/gameplay chapter must pass zooworkers-playtest using actual
rendered play: the player sees, understands, acts, receives clear feedback,
understands the benefit and experiences an authored polished PC game. Tests,
data/assets or a render trigger alone cannot pass. Fix player-facing failures;
if actual rendered inspection is blocked, checkpoint as unverified, not complete.
Play the changed flow before declaring success. Use viewport screenshots one at
a time, never full-page images or screenshot batches. Verify relevant flows at
320×420, 380×460, 800×600, 1280×720, 1440×900 and 1920×1080. Readable text and
useful hit targets must survive compact sizes. Test keyboard/reduced motion
where the change affects them. Browser QA cannot certify Windows shell behavior.

Commit coherent chapter changes, including a concise state update, and push to
the named branch without force. Stage only task-owned changes. If upstream
advanced, integrate safely and revalidate affected work; preserve user changes.
If permissions, a missing credential, exhausted credits or an unavailable runtime
truly block progress, checkpoint exact state and report the blocker honestly.
Never label blocked playtests or Windows-only checks as passed.

Final response: implemented player-facing outcome, checks/playtest evidence,
commit SHA and push status, material blockers/local Windows checks. Keep it short.
