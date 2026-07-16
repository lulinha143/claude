# Micro-games

The micro-games live in the **Focus** tab. They are short, optional, and grant a
small temporary production boost plus nuts on completion. All of them are:

- **Skill-based**, not random guessing — success depends on direct interaction.
- **Deterministic** from a seed (pure rules in `src/sim/minigames.ts`), so the
  logic is unit-tested and reproducible in the dev deterministic mode.
- **Accessible** — mouse, keyboard, and touch (pointer events); Reduced Motion
  removes belt/drag/flash animation; categories are told apart by
  **icon + shape/pattern + label**, never colour alone.
- **Reward-safe** — the shared shell (`MicroGame.tsx`) grants the reward exactly
  once per completed play (`rewarded` ref), never on exit-without-finish, and
  never twice.

## Architecture

```
src/sim/minigames.ts          pure, deterministic rules (no DOM/React)
src/ui/minigames/MicroGame.tsx shared shell: timer, exit, result, single reward
src/ui/minigames/*.tsx         one component per game (owns timing + DOM)
```

Each game component receives `SubGameProps { seed, reducedMotion, timeLeft,
onScore(absolute), onEnd(final) }`. The shell owns the countdown, the "play
again" flow, and the once-only reward.

| Mode          | Component                | Duration | Department | Core skill                        |
| ------------- | ------------------------ | -------- | ---------- | --------------------------------- |
| `shellSort`   | `ShellSort`              | 35s      | Sorting    | Fast categorisation into 3 bins   |
| `coffeeRescue`| `CoffeeRescue`           | 30s      | Kitchen    | Catch timing + combo streak       |
| `procurement` | `ProcurementConveyor`    | 45s      | Logistics  | Drag / rotate / route parcels     |
| `bugSquash`   | `BugSquash`              | 30s      | Maintenance| Reaction precision                |
| `cableUntangle`| `CableUntangle`         | 45s      | IT / Maint.| Spatial: drag nodes to un-cross   |

## Procurement Conveyor (replaces Raccoon Inventory Check)

The old **Raccoon Inventory Check** was a spot-the-swapped-object memory game
built on random item swaps — a guessing mechanic. It was removed (brief §26) and
replaced by a physical, drag-based logistics game.

**Goal:** parcels arrive on the intake belt; drag the front parcel onto the
correct **department chute**.

- Four departments — **Harvesting** (leaf), **Roasting** (flame), **Logistics**
  (arrow), **Research** (flask) — each with a distinct icon, background pattern
  (dots / rays / stripes / grid) and label.
- Each parcel is stamped with its destination department's icon.
- **Sideways parcels** arrive rotated and must be turned **upright** (the
  `Rotate` button or the `R` key) before they will fit — otherwise the chute
  shows a gentle "doesn't fit" cue and the parcel stays put (never a soft-lock).
- **Fragile** parcels show a care mark and are worth a small bonus for correct
  handling; rotated parcels also grant a small bonus for the extra skill.
- **Combos:** consecutive correct placements grow the score multiplier.
- **Gentle mistakes:** a wrong department resets the combo and moves on; it never
  subtracts score.

**Controls (all redundant for accessibility):**

- Mouse / touch: drag the parcel onto a chute (a floating ghost follows the
  pointer; the hovered chute highlights).
- Keyboard: `1`–`4` route the parcel to a department; `R` rotates it.
- The chutes are real `<button>`s, so clicking one also routes the parcel
  (screen-reader / keyboard friendly, with `aria-label`s).

**Rules (`src/sim/minigames.ts`):**

- `procurementSequence(seed, count)` → deterministic `ProcurementPackage[]`.
- `procurementResolve(pkg, dept, upright)` → `'correct' | 'wrongDept' |
  'notUpright'` (rotation is checked first).
- `procurementScoreDelta(result, combo, pkg)` → only `'correct'` scores; base 2,
  +2 fragile, +1 sideways, plus `floor(combo / 3)`.

**Tests:** `tests/minigames.test.ts` (determinism, valid parcels, rotation gate,
gentle/growing scoring, fragile/rotated bonus) and `tests/minigame-render.test.tsx`
(mounts every mode, including reduced-motion, without throwing).

## Cable Untangle Desk

A new skill-based **spatial** game (IT / Maintenance). A messy workstation's
computers are wired into a single loop of cables that start **crossed**; the
player drags each computer until **no two cables cross**.

- The graph is always a **Hamiltonian cycle**, which is mathematically
  guaranteed to be untangle-able into a convex ring — so **every board is
  solvable and can never soft-lock**.
- Clearing a board scores points (bigger tangles are worth more) and loads a
  larger, messier board; the shared countdown ends the run.
- The live **crossing count** is shown as text (non-colour feedback).
- **Controls:** drag a computer (pointer/touch), or Tab to a computer and nudge
  it with the arrow keys. Nodes are focusable buttons with `aria-label`s and a
  visible focus ring. **Reduced Motion** removes transitions.
- Positions are normalised `0..1`, so the square board scales to any window
  size.

**Rules (`src/sim/minigames.ts`):**

- `cablePuzzle(seed, nodeCount)` → deterministic loop, retried until it starts
  tangled.
- `segmentsCross(...)` → proper X-crossing only (shared endpoints excluded).
- `countCrossings(edges, positions)` / `cableSolved(...)` → win when `0`.
- `cableNodeCount(solved)` (5→9) and `cableSolveScore(nodeCount)`.

**Tests:** `tests/minigames.test.ts` covers crossing detection (X vs parallel vs
shared endpoint), a convex ring scoring `0` crossings vs a tangled bow-tie,
deterministic solvable-and-tangled generation, and board growth/scoring.
