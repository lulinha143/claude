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

### People worth coming back for

Every one of the 23 teammates has a profile in `src/content/characters.ts` (voice,
gift tastes, story flavour and moods, a partner in their story) and words of their
own in the locales. Relationships are read from durable flags (`src/sim/bonds.ts`),
so they survive saves, old saves and prestige.

- **Stages:** new face → familiar (15) → trusted (40) → close (70). Each new stage
  is celebrated once, on the next visit; a close friend works 10% better.
- **Stories** (`src/content/stories.ts`): three parts per teammate, opening at
  familiar, trusted and close, at least 8 minutes apart. Part 1's answer comes
  back in office chatter and opens Part 3; Part 2's kind answer returns later as a
  find with their own note; the other pulls in their story partner. Part 3 ends in
  a moment card and a keepsake on display by their desk.
- **Gifts:** six presents; each teammate loves one, likes one, is baffled by one
  and politely thanks the rest. Only what was actually given is learned; once
  trusted and two misses in, they drop a hint.
- **Coworkers** (`src/content/pairs.ts`): twelve pairs (friends, rivals, awkward,
  mentor). Sharing a room changes their mood, and they talk to each other.
- **Moments they start:** at most three teammates at a time wave the player over
  (a balloon on their sticker), never a popup.
- **Scrapbook:** derived entirely from what happened; nothing extra is stored.

## The office is the playground

Every room keeps its tap station (the clicker's core verb), and the station also
carries the room's own routine, shown on the machine as a small tag
(`src/content/roomPlay.ts`, `src/sim/roomPlay.ts`). Five verbs, each used by a
handful of rooms with their own words, timing and payoff:

| Verb    | What the player does                                     | Rooms                                                    |
| ------- | -------------------------------------------------------- | -------------------------------------------------------- |
| brew    | start it, come back when it is ready, share it out       | Break Room, Cafeteria, Lab, Incubator, Conservatory, Nap |
| tend    | the machine acts up; three taps free it, the room rushes | Sorting, Construction, Repair, Basement                  |
| watch   | something shows on the screen for ~35 s; catch it        | Security, Research, Rooftop, Archive                     |
| deliver | a letter, parcel or order arrives; hand it over          | Founder's Desk, Mailroom, Procurement                    |
| tune    | set the room's mode; each mode is one steady bonus       | Broadcast, Meeting, Marketing, Vault                     |

Payouts only use existing systems: production-scaled nuts, golden nuts, morale,
reputation, short boosts, rushes, moods and friendship. Modes feed the company
modifiers while someone works in the room (and say so on the Company screen).

**Helpers** make a routine better, and the tooltip says who: the room's
specialists and the player's close friends working there brew faster (20% each,
up to two), free a stuck machine on their own after a minute, and keep a blip on
screen 50% longer; a complete decoration set in the room counts too.

**Curiosities** (55) are the rooms' small surprises: funny, wholesome, strange,
absurd and now and then paranormal. About half turn up on their own at a wall
fixture, a corner or the ceiling (one at a time, every ~7 minutes on average,
fading after 20); a teammate in the room usually notices first. The rest only come
out of a routine: dreams from the nap room's log, footage from the cameras, pages
from the archive scanner, nuts from the sorting chute. Some need a decoration
placed in the room, a story told, or the night. Twenty-one of them are the Nut
Encyclopedia's previously unobtainable nuts. Each is noticed once, logged in the
Archive's Secrets tab, and noticing two in a facility room brings its discovery
forward, in the room itself. Every curiosity in a room completes its file
(+2 golden).

The office produces its moments while it runs, with restraint: one stuck machine,
one blip and one curiosity at a time, at most two deliveries waiting, nothing in a
brand-new founder's first two minutes. The elevator's floor list marks floors with
something waiting.

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
