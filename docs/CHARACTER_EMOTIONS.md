# Character Emotions

Every hired employee has a visible **emotion** that now gently affects how well
they work. Emotions are a warm character + light-strategy layer — never a
punishing micromanagement system (brief §16 / §18).

## Where an emotion comes from

`employeeMood(state, id)` in `src/sim/mood.ts` derives the emotion
**deterministically** from the current company state (no extra save fields):

| Condition (checked in order)        | Emotion       |
| ----------------------------------- | ------------- |
| A Focus Harvest session is active   | `focused`     |
| Morale < 30                         | `frustrated`  |
| Morale < 45                         | `tired`       |
| Friendship ≥ 70 **and** morale ≥ 70 | `proud`       |
| Morale ≥ 85                         | `inspired`    |
| Friendship ≥ 40                     | `relaxed`     |
| otherwise                           | `curious`     |

## Effect on work (modest, understandable)

`moodProductivityMultiplier(mood)` returns a small factor, always within **±5%**:

| Emotion    | Multiplier |
| ---------- | ---------- |
| inspired   | 1.05       |
| focused    | 1.05       |
| proud      | 1.04       |
| relaxed    | 1.02       |
| curious    | 1.00 (baseline) |
| tired      | 0.97       |
| frustrated | 0.95       |

The **team mood multiplier** (`moodMultiplier(state)` → `teamMoodMultiplier`) is
the **production-weighted average** of each hired employee's factor (weighted by
that employee's nuts/second contribution), so a happy workforce produces a little
more and a struggling one a little less. It returns exactly `1` when nobody is
working, so it can never divide by zero or surprise a new player.

It is applied as a single multiplier in the global stack of both
`computeProduction()` and `productionBreakdown()` — consistently, so the itemised
breakdown total always matches the live nuts/second.

## Where the player sees it

- **Production breakdown** (Company tab): a **"Team mood ×N.NN"** line appears
  whenever the team mood is off-neutral (green when boosting, red when dipping).
- **Employees tab**: each hired employee shows a **mood chip** (coloured dot +
  emotion name + the `+/-%` effect) with a tooltip explaining the emotion and its
  effect. Colours come from `MOOD_TONE`.
- **Office scene**: the existing small mood dot on each working critter.

## Tests

`tests/mood.test.ts`:

- every emotion stays within ±5% and is never zero; `curious` is the neutral 1.0;
- moods derive correctly from morale / friendship / focus;
- team mood is `1` with nobody working, `>1` for a proud team, `<1` for a
  frustrated one;
- at identical morale, a proud workforce out-produces a neutral one in
  `computeProduction()`.

`tests/productionBreakdown.test.ts` still confirms the breakdown total equals
`computeProduction()` (mood is applied identically in both).

## Honest scope note

This delivers §18 ("emotions affect work") with clear, tested modifiers and UI.
It does **not** yet implement §17 (event choices changing *specific* employees'
emotions with a per-employee "WHAT CHANGED" summary) — events still adjust global
morale/resources via the existing consequence system. That per-employee event
rework is a separate, larger task.
