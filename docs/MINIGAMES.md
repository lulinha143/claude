# Micro-games

Three short shifts in the Activities sheet, each hosted by a teammate (the first of
its team on staff, else Pip), with its own record and a first-mastery prize. All of
them are:

- **Skill-based** — success depends on reading the board and acting, never on luck.
- **Deterministic** from a seed: the rules are pure functions in `src/sim/minigames.ts`.
- **Accessible** — pointer, touch and keyboard; reduced motion gives a still board
  (Coffee becomes tap mode); kinds are told apart by shape and label, not colour alone.
- **Reward-safe** — a completed round is paid once, on its own ticket (see Rewards).

## Architecture

```
src/sim/minigames.ts             rules: calibration, combos, coffee days/beats/orders,
                                 the bug desk state machine, cable desks + conflict map
src/sim/engine.ts                beginMicrogameRound, abandonMicrogameRound, rewardMicrogame
src/ui/minigames/MicroGame.tsx   the cabinet: intro, countdown, bar, pause, result
src/ui/minigames/MinigameArt.tsx hosts, emblems and the drawn board pieces
src/ui/minigames/*.tsx           one board per game
src/ui/game/minigames.css        all minigame styling (game layer)
```

| Mode            | Round | Team          | ok / great / mastery | Combo ×2 / ×3    |
| --------------- | ----- | ------------- | -------------------- | ---------------- |
| `coffeeRescue`  | 30 s  | Marlow, Pip   | 55 / 115 / 170       | 6 / 12 catches   |
| `bugSquash`     | 30 s  | Quincy, Nixie | 40 / 115 / 200       | 4 / 9 squashes   |
| `cableUntangle` | 45 s  | Nixie, Bea    | 10 / 20 / 32         | none (par bonus) |

`MICRO_CALIBRATION` holds this table. The bands come from bots that play the real rules
(`tests/minigameRounds.test.ts`): idle play stays under "ok", steady play lands "great",
mastery asks for a good round. The combo on screen and the combo in the score are the
same table (`microComboMultiplier`).

## Rewards

- The cabinet takes a ticket at the whistle (`beginMicrogameRound`).
  `rewardMicrogame(mode, score, ticket)` pays only a ticket on file, once. Leaving the
  round (Leave shift, or closing the sheet) spends the ticket with no pay. Tickets live
  in memory, so after a reload nothing is open; a second completion of one game within
  25 s is refused even across a reload (`lastRewardAt`). Scores cap at 5,000.
- Pay reads the score as a share of the game's own mastery (`microPayout`): nuts =
  unboosted crate value × (0.5 + 1.5 × share, share capped at 1.6), and a production
  boost for 90 s (+35% at mastery, at most +50%).
- Minigame boosts share one slot (`source: 'microgame'`). A stronger round takes it; a
  weaker one adds its own seconds × bonus as extra time at the stronger rate, never past
  90 s from now. Event and pet boosts never merge with it.
- At the game's "great" line its team gets +3 trust and a proud mood. First mastery
  (flag `microgame.<mode>.mastered`): +1 golden nut, a moment card and the game's
  souvenir decoration. The flag, or a record at or above today's line, counts as
  mastered, so a mastery from the old shared line of 30 is kept and never paid twice.
- Save: `microgames` is unchanged; `boosts[].source` is optional, so old saves load as before.

## Coffee Rescue

- Drops: mug; carafe (slower, ×2); espresso (faster, ×2.5); decaf (catching it costs 3
  points and the streak; letting it fall costs nothing).
- Each round opens on one of four days, in turn: morning rush, espresso hour, catering
  run, decaf audit. A day leans the mix and the tempo and never removes a kind.
- Three beats: warm-up with no decaf (0–8 s), service, then a rush from 20 s whose
  pairs land too far apart for one mug.
- The ticket is an order of 2, then 3, then 4 drinks from the day's mix; filling it pays
  3 points per drink.
- Controls: the mug follows the pointer or a finger (captured, so a finger may slide off
  the counter). Left/Right or A/D move it at once and glide while held; keys let go on
  blur and pause. Reduced motion: cups wait in five numbered places; tap one or press 1–5.

## Bug Squash

- A desk is one value: `createBugBoard`, `advanceBugBoard`, `whackBugBoard`.
- Species: worker; runner (×2, hops once to a free drawer mid-window); armoured (×2,
  two taps, a crack always leaves at least 300 ms); golden (×5, sent once in the last
  stage); feature, a sticky note (squashing it costs 4 points and the streak).
- Three stages: triage (one at a time), peak hour from 9 s (two, armour and features),
  closing time from 20 s (three).
- Fairness: a tap counts on press; the opener is always a worker; one feature at a time;
  a vacated drawer stays empty 320 ms; a late tap within 180 ms of a pest leaving is
  forgiven, never charged.
- Controls: pointer or touch; 1–9 tap a drawer; arrows move between drawers, Enter taps.

## Cable Untangle Desk

- Desks wire 5 to 9 plugs as a loop, a wheel, two loops or a loop with shortcuts; the
  last three desks are never repeated, and every authored solution is conflict-free
  (checked for the whole catalogue).
- `cableConflictMap` places every conflict: a crossing (knot at the crossing point), a
  plug resting on a cable (counted once per cable it blocks), cables doubled back on each
  other, stacked plugs. `countCableConflicts` is its length, so the count and the marks
  on the desk always agree.
- Score: `cableSolveScore` per desk, plus a speed bonus for a desk cleared inside par
  (2.2 s per plug).
- Controls: drag with pointer capture (window fallbacks; blur cancels a drag), Esc puts a
  held plug back; Tab to a plug, arrows nudge it 3.5%, Shift+arrows 10%.

## Pausing

Esc pauses a live round and resumes it; the sheet stays open. Losing window focus
pauses too, and a hidden window freezes the clock. Leaving from the pause card pays
nothing.

## Tests

- `tests/minigames.test.ts`: species, drop kinds, cable generation and solvability.
- `tests/minigameRounds.test.ts`: combos as shown, days, beats, orders, bug desks
  (stages, hops, armour, feature, respawn guard, mashing), the conflict map, the bots.
- `tests/minigameRewards.test.ts`: tickets, per-game mastery and legacy saves, the boost
  slot, save round-trips.
- `tests/minigame-shell.test.tsx`: the cabinet lifecycle.
- E2E: `minigame-rounds.spec.ts`, `minigame-polish.spec.ts`, `cable-progression.spec.ts`.

## Removed conveyor games

Sorting Conveyor (`shellSort`) and Receiving Conveyor (`procurement`) were removed end to
end. The mode id was never persisted, so old saves keep their totals and show no dead
buttons.
