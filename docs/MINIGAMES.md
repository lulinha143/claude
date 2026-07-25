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

Each game component receives `SubGameProps { seed, reducedMotion, paused,
timeLeft, onScore(absolute), onCombo(multiplier) }`. The shell owns the
monotonic countdown, pause clock, “play again” flow, and once-only reward.
Leaving an active shift abandons it immediately without opening a result or
granted reward; only expiry of the full round enters the rewarded result state.

| Mode            | Component       | Duration | Department  | Core skill                      |
| --------------- | --------------- | -------- | ----------- | ------------------------------- |
| `coffeeRescue`  | `CoffeeRescue`  | 30s      | Kitchen     | Catch timing + combo streak     |
| `bugSquash`     | `BugSquash`     | 30s      | Maintenance | Reaction precision              |
| `cableUntangle` | `CableUntangle` | 45s      | IT / Maint. | Spatial: drag nodes to un-cross |

## Removed conveyor games (Sorting & Receiving Conveyor)

Two conveyor games were **removed** (they were not enjoyable):

- **Sorting Conveyor** (`shellSort` / "Conveyor Sort" / "Esteira de Triagem") —
  sort items into 3 bins.
- **Receiving/Procurement Conveyor** (`procurement` / "Esteira de Recebimento")
  — drag/rotate parcels to department chutes (this had itself replaced the old
  Raccoon Inventory Check).

They were deleted end-to-end: the `MicroMode` union, the `MicroGame` dispatch +
durations, the Focus menu list, `engine.rewardMicrogame` types, the component
files, their i18n keys, docs, and unit tests. No save migration was needed — the
mode id is never persisted (only a `stats.microgamesPlayed` counter and a
count-based achievement, both mode-agnostic), so old saves keep their totals and
show no dead buttons. The remaining games are `coffeeRescue`, `bugSquash`, and
`cableUntangle`.

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
