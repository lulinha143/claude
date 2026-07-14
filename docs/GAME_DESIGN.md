# Game Design Document (living)

## Pitch

Solo & 1–4 player co-op physics horror-comedy. You are underpaid movers for a
paranormal moving company. The furniture is alive, emotionally unstable, and
supernaturally gifted. Investigate each object, calm it, carry it through a
dangerous property, load the van, and escape before the property rejects you.

**Tone:** cooperative physics chaos × supernatural workplace comedy × light
horror × creature-care (the creatures are furniture). Funnier on failure.

## Core loop

Warehouse → review contracts → pick loadout → travel → explore → identify
targets → investigate emotions/traits → calm/negotiate/restrain → carry through
hazards → load correct objects into the van → escape before instability peaks →
payment → incident report → upgrade → unlock harder contracts & secrets.

Contract lengths: short 8–12 min, normal 15–25 min, major 30–40 min.

## Pillars

1. **Every object is a different mechanical problem.** Behaviour emerges from
   identity + emotional state + physical form + surroundings + player actions —
   never a reskinned generic enemy.
2. **Physical, readable consequences.** Humor comes from understandable physics,
   not input failure. Physics-assist and simplified-grab options exist.
3. **Failure is participation.** Downed movers are flattened/boxed/ghosted, not
   removed; teammates rescue them; ghosts still help.
4. **Emergent moments over scripted jokes.** Systems (emotions, relationships,
   instability) generate shareable chaos.

## Emotions & traits

Objects carry a continuous `arousal` resolved into a discrete emotion (Calm →
Unhinged) biased by their personality (`mood_bias`). Traits (personality,
paranormal, fears) add behaviours and change what agitates or calms them.
Relationships between families create cross-object reactions (a bed makes a sofa
sleepy; a mirror fears a wardrobe). See `content/traits/`, `content/relationships/`.

## Property Instability (tension)

A single 0–120 meter with five levels (Uneasy → Property Rejection). Rises from
agitated furniture, damage, noise, and lingering; escalation cuts lights, shifts
mood, and eventually the property fights your departure. Reduced-scare mode
softens effects. Jump scares are rare and earned.

## Progression

Cash (standard upgrades), Reputation (unlocks locations/difficulty), Paranormal
Residue (unusual gear), Insurance Rating (performance), Object Trust (per family,
reveals weaknesses/lore/cosmetics). No pay-to-win, no loot boxes, no premium
currency, no energy timers.

## Content targets (1.0)

20 furniture, 60+ traits, 50+ contract modifiers, 30+ equipment, 40+
achievements, 80+ cosmetics, 25+ warehouse upgrades, 100+ incident lines, 8
location families, daily/weekly challenges, full EN + PT-BR. Current authored
counts: see `content/CONTENT_STATUS.md`.

## Difficulty

Presets: Gentle Move, Standard Shift, Overtime, Insurance Nightmare, Custom.
Custom knobs (aggression, instability speed, fragility, timers, AI skill, etc.)
are separate from accessibility — difficulty never overrides accessibility.
