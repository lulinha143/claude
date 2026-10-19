# ZooWorkers — Nutshell Inc. design reference

Read only the sections relevant to the current change. This is the project's
visual and interaction authority; do not auto-load it as an always resource.
Keep existing good art, game architecture, currency roles and save identities.

## Identity

“Nutshell Inc. = uma empresa de pesquisa comportamental meio suspeita, meio
corporativa, meio absurda.” Compose a cozy animal office inside an odd research
company: corporate paperwork, warm materials, expressive people, light suspicion
and authored humor. Preserve player-defined company names and existing saves;
the fiction does not justify renaming employee/resource IDs or adding meters.
The first impression is a cute little desktop game worth keeping open.

Use cream, beige, soft gray, wood and readable dark ink as the base. Restrained
green means positive/action; yellow/gold means resources/rewards; purple belongs
only to genuinely rare/special content. Derive exact tokens from existing art
and check contrast. Avoid blank white expanses, flat dashboards, neon, repeated
pills/cards and the same large-title/tiny-label/rounded-card/buttons composition.
Use game navigation, scene staging and content-sized sheets with clear focus.
More polish means stronger intent, response and cohesion, not more UI or particles.

Paper, folders, labels, typed notes, stamps, small animal stickers, lamps, plants,
shelves, cables and room-specific props should have a reason to be there. Make
anomalies occasional and authored: a confidential memo, altered graph, handwritten
note, camera, changed background object or subtle light change. Do not generate
random clutter. Avoid rapid flashing; reduced motion provides a static equivalent.

## People and rooms

Preserve all 23 employee APNGs, posters, IDs, frame timing and registry geometry,
including repaired Pip. Improve presentation/reactions with existing assets.
Use uniform scaling only; comparable apparent base size to Pip/Squirrel means
visible character mass/foot placement, not equal transparent canvas dimensions.
Preserve natural species proportions and individual silhouettes. Separate scene
scale from per-character geometry; do not resample every asset or inflate pixels.
Emotion indicators should be larger, distinct and readable, attached to stable
sprite anchors; prevent flicker, face occlusion and screen-edge detachment.

MAXIMUM FOUR EMPLOYEES PER ROOM. Stage 1, 2, 3 and 4 people deliberately with
usable paths, actions and furniture. Capacity must agree across assignment,
simulation, save migration and rendering; do not merely hide extra employees.
Preserve everyone in old saves; use existing reassignment/unassigned policy for
overflow, clearly communicated, without deleting hires or silently losing progress.

Every employee has personality, mood, idle/context/room reactions, conversations,
memory, keepsakes, callbacks and relationship progression. One-on-one visits
are composed destinations with character presence, manageable dialogue, shared
history and choices; avoid a giant modal with giant text and a button list.

Rooms differ in architecture, composition, light, materials, props, workflow,
activity, ambience, employee reactions, decoration spaces and discoveries.
Radio studio: acoustic shapes/equipment and tuning/broadcast behavior. Repair
workshop: workbench/materials/tools and repair rhythm. Conservatory: glass,
foliage/light and tending/seasonal behavior. Preserve good existing treatments.
Backgrounds contain structural fixtures but leave desirable purchased decor
visibly valuable. Do not pre-fill them with every collectible prop.

## Decoration interaction and scene depth

Select object → drag → clean ghost/preview → release → subtle placement feedback.
One useful preview is enough. No mouse-following instructions, moving/selected/
drop-here text, giant mouse graphics, redundant hand cursors, coordinate/path/
movement lines, debug arrows, excessive outlines or duplicate indicators.
Place any necessary help once in a quiet fixed location. Keep keyboard access.

Dragging is immediate and smooth, with original grab offset, pointer capture,
one screen-to-scene transform and safe text/image-selection handling. The entire
catalog tile is a reliable grab target; preserve intentional nested buttons.
Edges, overlap and resizing/DPI must not cause jumps or fight hitboxes. Make
selection/cycling deterministic. Escape, pointer cancellation, leaving the mode
and invalid release restore prior placement/inventory/ordering cleanly. A canceled
catalog drag must not charge or consume an item. Valid placement commits once.

Use the existing coherent scene-depth model, not unrelated z-index patches:
wall props, rugs and hanging ceiling props behind people; floor furniture sorted
with people by where its base stands (in front of whoever is behind it, behind
whoever is in front, a person winning a tie); ceiling props attached to
ceiling/suspension anchors; floor props anchored at their visible base.
Respect intended surface types. Manual front/back changes work
within appropriate constraints. Selection/drag may temporarily lift the visual;
release restores stored ordering unless the player explicitly changed it.

## Play, stories and sound

Support 30-second visits, 2–5-minute goals, 10–20-minute sessions, active play,
passive production and quiet corner-window presence. Open → notice → interact
→ feedback → earn/discover/progress → small decision → another activity → return
→ something new waiting. Clicking matters without compulsory click spam.

Coffee Rescue: immediate cup response, clear goal/outcomes, escalating difficulty,
variation and satisfying reward. Bug Squash/Hunt: attractive species/variants,
different behaviors, fair readable hit/miss and replay value. Cable Untangle:
seeded varied fair solvable puzzles, reliable dragging, little obvious repetition,
compact readability and satisfying completion. Responsiveness precedes particles.

Author funny, chaotic, awkward, absurd, wholesome, strange, suspicious and lightly
paranormal events. Choices can alter existing morale, reputation, resources,
relationships, room/employee state, memories and discoveries. Use chains, delayed
consequences and recurring callbacks that survive saves and are encountered later.
Special discoveries are inspectable artifacts from the world, not only counters.

Sound reinforces click, purchase, decor pickup/drop, employee interaction,
minigames, discoveries, rewards, prestige and each room's ambience. Review timing,
volume, simultaneous voices and repetition by listening. Keep ambient/quiet/mute
pleasant; never increase noise to manufacture polish. Pair audio with visible cues.

## Compact composition

Small, medium and large windows retain readable people, furniture, actions and
feedback. More space reveals more environment rather than stretching forms.
Avoid empty gutters, oversized dialogs, tiny boards/text, clipping, horizontal
overflow and mobile-form layouts. Do not solve compact mode by hiding most
play behind menus. Preserve accessible focus, non-color cues and reduced motion.

## Whole-game surface ownership

Each row needs an actual rendered player path and the player gate. Reuse accepted
evidence for unchanged surfaces; this table is a coverage map, not a screenshot
batch or a demand to rebuild working screens. The named chapter owns improvements;
final integration confirms the coherent whole. Record brief references in state.

| Surface              | Chapter owner                       | Player-visible result                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------------ |
| Opening              | 1                                   | Authored first impression and immediate office play    |
| Main HUD             | 1                                   | Small, legible controls with office presence           |
| Company masthead     | 1                                   | Nutshell fiction and preserved custom name             |
| Resource strip       | 1, then 4                           | Clear roles, amounts and reward feedback               |
| Navigation           | 1                                   | Game destinations, clear return to the room            |
| Office               | 1                                   | Living composed scene and direct actions               |
| Rooms                | 3                                   | Distinct places with 1–4 employee compositions         |
| Decoration catalog   | 8                                   | Desirable authored objects and clear ownership         |
| Placement mode       | 8                                   | Responsive clean drag and reliable depth               |
| Employee roster      | 2                                   | All 23 recognizable individual people                  |
| One-on-one mode      | 2, then 7                           | Composed personal visit and durable history            |
| Dialogs              | 1 foundations; each owning chapter  | Readable content-sized scenes/sheets                   |
| Event screens        | 6                                   | Staged people, choices and consequences                |
| Minigames            | 5                                   | Three polished responsive playable boards              |
| Collections          | 8, then 10                          | Authored rewards connected to world/progression        |
| Discoveries          | 6                                   | Inspectable world artifacts and clues                  |
| Upgrades             | 4                                   | Understandable cost and visible benefit                |
| Progression          | 10                                  | Close, medium and long-term reasons to play            |
| Settings             | 1                                   | Compact consistent controls and clear feedback         |
| Save/export/import   | 1 presentation; release persistence | Clear readable state and safe recovery                 |
| Prestige/restructure | 10                                  | Authored anticipation and honest kept/reset choices    |
| Notifications        | 1, then 9                           | Calm world-linked notices and returns                  |
| Tooltips             | 1; each owning chapter              | Readable anchored help without clutter                 |
| Empty states         | 1; each owning chapter              | Purpose and next action instead of blank UI            |
| Purchase flows       | 4; catalog purchases 8              | Cost → confirm/action → benefit, with failure feedback |
