# Balancing Guide

All tunable numbers live in **`src/sim/config.ts`** (`BALANCE`) and the content
data files in **`src/content/`**. Formulas that consume them are in
`src/sim/economy.ts`, `offline.ts`, and `prestige.ts`. Nothing gameplay-affecting
should be a scattered magic number.

## Where to tune what

| Want to change…                              | Edit                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Base production, click power, starting nuts  | `BALANCE.baseProductionPerSecond`, `baseClickPower`, `startingNuts` |
| Morale range and its production effect       | `BALANCE.morale`                                                    |
| Crate value                                  | `BALANCE.crate`                                                     |
| Offline efficiency and caps                  | `BALANCE.offline`                                                   |
| Prestige unlock threshold and kernel formula | `BALANCE.prestige`                                                  |
| Focus bonus and reward                       | `BALANCE.focus`                                                     |
| Event frequency / base chance                | `BALANCE.eventRollIntervalSeconds`, `eventBaseChance`               |
| Autosave cadence                             | `BALANCE.autosaveIntervalSeconds`                                   |
| An upgrade's cost/curve/effect               | its entry in `src/content/upgrades.ts`                              |
| An employee's rate/cost/passive              | its entry in `src/content/employees.ts`                             |

## Key formulas

- **Upgrade cost:** `ceil(baseCost * costMult^ownedLevels) * (1 - costReduction)`,
  floored at 1.
- **Employee level cost:** first level = hire cost; then geometric growth by
  `levelCostMult`.
- **Production:** `(base + Σ employee rate·level) × globalMult`, where
  `globalMult = (1 + Σupgrade% + Σpassive%) × moraleMult × prestigeMult × focusMult`.
- **Morale multiplier:** linear from `minMultiplier` (0 morale) to `maxMultiplier`
  (full morale).
- **Offline nuts:** `rate × min(elapsed, cap) × efficiency`, with negative or
  absurd elapsed times ignored.
- **Prestige kernels:** `floor((totalNuts / kernelDivisor)^kernelExponent)`,
  boosted by the Kernel Refinery skill; minimum 1 once unlocked.

## Retuning workflow

1. Change values in `config.ts` / content files.
2. `npm run test` — economy, offline, and prestige tests guard against
   regressions and document expected relationships.
3. Use the **dev balance panel** (`?dev=1`) to add currency, simulate offline
   time, trigger events, and set a deterministic seed for reproducible checks.

## Deterministic testing

All randomness flows through the seedable PRNG in `src/sim/rng.ts`. Construct an
engine with `{ deterministic: true, seed }` to reproduce event rolls and
resource-find outcomes in tests.
