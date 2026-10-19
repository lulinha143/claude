---
name: zooworkers-playtest
description: Run actual rendered ZooWorkers player inspection before accepting a visual or gameplay chapter, or when reproducing a player-facing defect. Check visibility, clarity, input, feedback, benefit and polished desktop-game feel with focused evidence.
---
# ZooWorkers player acceptance

Read .kiro/steering/qa.md for commands, size/platform matrix and evidence rules.
Read only relevant DESIGN.md sections and surface-map rows for the changed flow.
Use the current chapter's criteria and existing tests; do not audit the whole repo.

1. Reach a representative state through the normal player path in pt-BR. Use
   existing fixtures/dev controls only to reach late conditions, then interact
   normally. A developer trigger or DOM/data assertion is not a playable proof.
2. Inspect the actual rendered scene, normally with 1–3 targeted viewport images
   read one at a time. Use a sufficient existing controller or Playwright CLI;
   discover the installed commands with help. Never install tools from this skill.
   DOM/accessibility snapshots can locate actions but cannot judge visual quality.
3. Physically exercise input, cancellation/exit and outcome. For drag/minigames,
   include a continuous pointer sequence, edges/overlaps or relevant failures,
   a resize and keyboard path where supported. Observe response while playing;
   screenshots alone cannot prove latency, timing or sound.
4. Answer all six checks with observed evidence:

   | Check | Required observation |
   | --- | --- |
   | See | Feature, target and character/prop remain legible in compact play |
   | Understand | Purpose, available action and cost/risk are clear |
   | Interact | Input responds reliably through the normal player path |
   | Feedback | Action/failure/success has readable timely visual feedback; audio fits when present |
   | Why it matters | Reward, consequence, memory or world change is apparent |
   | Feel | Composition, motion and behavior belong to authored Nutshell PC play |

   Reject generic dashboard/card/form staging, stiff or lagging controls,
   unreadable bubbles, oversized empty dialogs and editor-like drag overlays.
   Inspect the relevant authored details and room/character integration; colors
   or extra particles alone do not establish polish.
5. Listen to affected cues/ambience if playback is available; check timing,
   volume/repetition and quiet/mute. If unavailable, record AUDIO LISTENING
   REQUIRED and do not claim audio quality passed. Browser evidence does not
   certify native Windows behavior.
6. Fix any in-scope failed check and replay the affected path. Verify reward and
   persistence after reload where relevant; then run the qa checks appropriate
   to the change. Keep raw logs/screenshots local and the evidence summary small.

Record save/state, normal actions, observed outcome, visual evidence reference,
six-check verdict and material blockers concisely in docs/ZOOWORKERS_STATE.md.
If rendered play is unavailable, record PLAYTEST UNVERIFIED and checkpoint the
chapter as pending verification. Do not replace missing play with passing tests,
lower the bar or claim the chapter/release complete.
