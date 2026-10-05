# ZooWorkers state

Updated 2026-10-05 · branch `feat/zooworkers-3.0-facility-pass`.

## Workflow addendum — adopted

The kit's `templates/` (uploads `cc3f155`, `0979212`) is now in force as root `AGENTS.md`
and `DESIGN.md`, `.kiro/steering/{visual,simulation,qa}.md`, `.kiro/agents/zooworkers.json`
and the workspace skill `.kiro/skills/zooworkers-playtest/SKILL.md`. Use this kit's
chapter prompts from here on. Major visual/gameplay chapters close only through
zooworkers-playtest in actual rendered play; if it is blocked, record PLAYTEST
UNVERIFIED, not complete.

Model: the user's selection (Claude Opus 5.5) and effort; the agent sets no model, so it
never lowers them.

## Chapters

Order: 1 → 4 → 9 → 2 → 3 → 5 → 6 → 7 → 8 → 10 → final integration.

Six units closed before the addendum, each pinned by its E2E spec and docs: the shell
(`b138638`–`6189169`, "Phase 1" in code), the living office (`bfaca01`–`d81ddc2`,
"Phase 2") and gameplay chapters GC1–GC4 (the code's own labels). They stay
accepted and are not rerun. None has a six-check player-gate record, so final
integration reuses their evidence and plays affected gaps. Earlier facility-pass work
(`4ddde16`–`a4e03ad`) is kept. Kit numbers follow DESIGN.md's surface map; GC numbers
are not kit numbers.

| Kit | Existing work                                                                | Status                                         |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Shell + living office                                                        | Accepted (pre-addendum)                        |
| 4   | GC1 core loop (`67cd776`–`04b38ca`): crate, rushes, finds, goal-tag purchase | **Current — partial**                          |
| 9   | GC1 welcome-back note, GC2 balloons, GC4 room tickets and diary              | Partial                                        |
| 2   | GC2 visit and relationships (`9a853cb`–`f871211`)                            | Accepted (pre-addendum)                        |
| 3   | Living-office rooms + GC3 office playground (`0bdcbae`–`72b0db3`)            | Accepted (pre-addendum)                        |
| 5   | Pre-shell minigame fixes only                                                | Not started                                    |
| 6   | GC4 happenings (`166ed08`–`7a7ee3d`) + GC3 curiosities                       | Partial — events/discoveries largely delivered |
| 7   | GC2 stories, gift notebook, scrapbook, keepsakes                             | Partial — largely delivered                    |
| 8   | Living-office arranging rebuild; catalog unchanged since `a4e03ad`           | Partial                                        |
| 10  | Pre-shell prestige fix (`65c4f09`) only                                      | Not started                                    |

For a partial chapter, demonstrate what already meets its criteria and build only the
gaps.

## Current: chapter 4

Resume under the stronger player gate, reusing GC1's evidence. Known gaps: the Upgrades
sheet is still the pre-3.0 card list (`ShopView`, unchanged since 2026-07-25); purchase
failure feedback and resource roles have not been played against chapter-4 criteria.
Next: chapter 9 — no return view reads `happenedSince` or the diary yet.

## Environment

- Playwright is locked at 1.61.1. No dependencies are installed in this sandbox, so there
  is no local CLI; this update needed no interactive control.
- LOCAL WINDOWS VERIFICATION REQUIRED: the last recorded native run is `a4e03ad`; it
  belongs to final integration (qa.md).
