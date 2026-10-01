# Game Design — ZooWorkers

## Pitch

A cozy desktop idle game in a tiny transparent window. Pip the squirrel builds a
nut-processing company inside a tree trunk. It combines a desktop pet, a
satisfying incremental game, an animated diorama, a workplace comedy, and a
collectible decoration game. Understandable in seconds; hours of depth.

## Core loop

1. Employees automatically generate **Nuts**. Half goes straight to the vault;
   the team packs the other half into **the founder's crate** (10 minutes of
   packing fills it). Tapping the crate collects it. A full crate's share still
   reaches the vault at the offline efficiency, and automation raises that until
   nothing waits on the player (`src/sim/crate.ts`).
2. **Stations** in every room pay per tap and build a combo. Keep the rhythm for
   10 taps (8 on charge stations) and the room **rushes**: the people working in
   it produce double for 30 s, renewed by every tap that keeps the streak. A
   short burst of attention therefore scales with the company, and who works in
   which room matters.
3. Now and then a teammate **finds** something in their room (more often when
   they are in a good mood) and holds it out beside their sticker. A find waits,
   pays 45 s of production, and leaves the finder happy and a little friendlier.
4. Nuts buy machines, rooms, employees and improvements. The office always shows
   the **next goal** (the cheapest purchase, with what it will change) and buys
   it with one tap; the top of the tower shows the **next floor** being built.
5. **Random events** create short, funny decisions.
6. Milestones unlock new systems (rooms, employees, prestige).
7. **Go Completely Nuts** (prestige) grants Permanent Kernels for a skill tree
   and alternate company branches.

Keeping the game open is never worse than closing it: open time is credited in
full however rarely a hidden window ticks, and a gap long enough to mean the
computer slept is settled like time away (offline rules, crate filled, finds
waiting). There are no arbitrary waiting walls.

## Resources

- **Nuts** — main currency (upgrades, furniture, rooms, employees, common cosmetics).
- **Golden Nuts** — rare, earned only through play (achievements, rare events,
  collections, daily challenges, milestones); buy rare cosmetics and conveniences.
- **Morale** — company modifier; low morale is a gentle inconvenience, never harsh.
- **Reputation** — unlocks applicants, rooms, events, milestones.
- **Permanent Kernels** — prestige currency for the permanent skill tree.

No real-money purchases, ads, loot boxes, crypto, NFTs, energy timers, or
manipulative monetization.

## Characters

Pip (founder, balanced), Marlow (capybara, HR, morale + calm), Rizzo (raccoon,
procurement, finds resources), Bea (beaver, construction, cost reduction), Corvus
(crow, marketing, rare-event chance), Mina (mole, research, reputation). Each has
a distinct silhouette, personality, animations, a passive, friendship, dialogue,
a personal story, a favorite item, a rare event, outfits, and a profile.

Animation is driven by a reusable state machine (`src/art/animation.ts`), not
hardcoded switches.

## Progression targets

- Fast first upgrades; first hireable employee ~10 min; first new room ~20–30 min;
  first automation milestone within the first hour; first prestige after several
  hours; continued unlocks across prestige cycles.

## Prestige — "Go Completely Nuts"

Resets company progress; grants Permanent Kernels; preserves collections,
cosmetics, achievements, employee memories (friendship), and the skill tree.
Five branches (Industrial, Cooperative, Questionable Science, Aggressive
Marketing, Underground Operations) alter bonuses, morale, and rare-event odds.

## Long-term systems

- **Collections:** Nut Encyclopedia (24 fictional nuts), Moment Cards, outfits,
  logos, secret discoveries, achievement-linked decorations.
- **Daily challenges:** deterministic, date-seeded, offline, server-free.
- **Focus Harvest:** opt-in, supportive productivity companion; never blocks the
  computer; never punishes cancellation.
- **Micro-games:** Conveyor Sort, Coffee Rescue, Procurement Conveyor, Bug Squash
  — short, optional, skill-based, rewarding small boosts. See
  [`MINIGAMES.md`](MINIGAMES.md).

## Writing style

Clever, warm, slightly absurd, character-driven, shareable, never cruel, never
reliant on copyrighted references. Nut puns used strategically, not constantly.
All humor authored through localization keys so it survives translation.

## Viral hook

Rare/funny events generate shareable **Moment Cards** (illustration, employee,
caption, date, company name, rarity, clean layout) exportable as PNG — never a
screenshot of the user's desktop. Photo Mode hides menus for posed shots.
