# Character Emotions

Every hired employee has a visible **emotion** that now gently affects how well
they work. Emotions are a warm character + light-strategy layer — never a
punishing micromanagement system (brief §16 / §18).

## Where an emotion comes from

`employeeMood(state, id)` in `src/sim/mood.ts` derives the emotion
**deterministically** from the current company state (no extra save fields):

| Condition (checked in order)        | Emotion      |
| ----------------------------------- | ------------ |
| A Focus Harvest session is active   | `focused`    |
| Morale < 30                         | `frustrated` |
| Morale < 45                         | `tired`      |
| Friendship ≥ 70 **and** morale ≥ 70 | `proud`      |
| Morale ≥ 85                         | `inspired`   |
| Friendship ≥ 40                     | `relaxed`    |
| otherwise                           | `curious`    |

## Effect on work (modest, understandable)

`moodProductivityMultiplier(mood)` returns a small factor, always within **±5%**:

| Emotion    | Multiplier      |
| ---------- | --------------- |
| inspired   | 1.05            |
| focused    | 1.05            |
| proud      | 1.04            |
| relaxed    | 1.02            |
| curious    | 1.00 (baseline) |
| tired      | 0.97            |
| frustrated | 0.95            |

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

## Event-driven individual emotions (§17)

Emotions are now **persisted per employee** (`EmployeeRuntimeState.emotion =
{ id, until }`, save schema v5 with a v4→v5 migration defaulting to `null`) and
can be set by **event choices**. A new `emotion` `EventEffect`
(`{ type: 'emotion', employeeId, emotion, durationSeconds? }`) applies an emotion
to a specific employee — temporary (`until = now + durationSeconds*1000`) or
persistent (`until = null`). Temporary emotions are dropped during the engine
tick (`expireEmotions`). `employeeMood()` returns an active override first, then
falls back to the derived ambient mood.

The full 15-emotion set is supported: `happy, proud, relaxed, focused, inspired,
curious, tired, frustrated, worried, angry, embarrassed, overcaffeinated,
suspicious, excited, sad` — each with a localized name (`mood.<id>`), a tone
colour (`MOOD_TONE`), a positivity flag (`MOOD_POSITIVE`) and a productivity
factor (`MOOD_PRODUCTIVITY`, ±5%).

Seeded examples (brief's cases): approving Bea's request → **Bea proud**;
declining → **Bea sad**; Mina's deep-basement dig → **Mina inspired, Bea
worried**; investing in Corvus's coin → **Corvus excited, Marlow embarrassed**.

## "WHAT CHANGED" result panel (§17)

`resolveEventChoice()` snapshots state **before** applying effects and diffs it
**after**, producing a `ConsequenceReport` of the _real, measured_ change:
currency/morale/reputation deltas, a temporary-boost line, moment-card creation,
and a **per-employee list** — each showing the new emotion, its productivity
`±%`, friendship delta, and remaining minutes for temporary emotions. The
`ConsequenceModal` renders this (localized, responsive, wrap-safe, compact-mode
friendly). Because the report is diffed from the simulation rather than read from
the raw effect list, `tests/eventEmotions.test.ts` asserts the displayed numbers
match the actual post-choice state.

## Remaining (honest)

- The consequence report is shown once; **reopening a past report from the event
  history is not yet implemented** (individual emotions and the decision timeline
  _are_ persisted, but the full formatted report is transient).
- Per-emotion body-pose/idle animation variants are minimal (the office shows the
  mood dot + colour); distinct art per emotion is future work.
