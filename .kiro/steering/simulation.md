---
inclusion: fileMatch
fileMatchPattern: ["src/sim/**", "src/save/**", "src/content/**", "src/state/**"]
---
# ZooWorkers simulation contract

Keep rules deterministic and framework-independent, authored content data-driven
and state changes inside existing engine/store entry points. React displays state
and sends commands. Reuse the existing RNG, modifiers, timers, resources and flags.

Nuts fund the core loop; golden nuts are scarce play-earned rewards; reputation
unlocks possibilities; morale is a gentle modifier; permanent kernels belong to
prestige. Do not introduce another currency or duplicate these roles. Direct
clicking and optional skill play stay useful without becoming compulsory work.
Progression should expose a close goal and medium/long-term desires through the
world, using the existing next-step/reputation/collection systems.

Production is driven by elapsed time, not by how many timer callbacks the browser
allows. Distinguish an open but throttled window from actual sleep/offline time.
Settle each interval/reward once, including crate overflow, temporary modifiers,
reload, suspend/resume and import. Handle invalid/backwards clocks safely and
show caps honestly. Bound catch-up work instead of replaying every missed frame.
Use the existing offline/crate/event policies unless evidence justifies tuning.

Relationships use existing friendship tiers, gifts, story flags, callbacks and
keepsakes; do not create parallel trust/affection meters. Consequences must survive
save/load and remain visible later in normal play. Pending events wait calmly
with bounded queues; no modal storms, fabricated huge offline histories or
coercive punishment for absence. Prestige preservation follows the existing
player-facing contract.

Keep room capacity at four consistently across assignment, routines, save and
scene composition. Preserve every hired employee and use the existing safe
reassignment/unassigned path for legacy overflow; never just clamp the renderer.

For persisted fields, inspect schema/migrations and real old-save fixtures,
add defaults/migrations where needed, and preserve unknown legacy state as the
existing policy requires. Derived state should stay derived. Verify exactly-once
claims, collection counters and branch effects with meaningful regression tests.
Do not add servers, telemetry or cloud services to solve local gameplay needs.
