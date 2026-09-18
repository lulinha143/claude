# Developer Secrets Reference (spoilers)

_Internal maintainer doc so hidden content stays maintainable. Players shouldn't
read this._

Secrets are tracked in `state.collections.secrets` as string ids and surfaced in
Collections → Secret Discoveries. Hidden achievements test for these via
`computeFlags` in `src/sim/achievements.ts`.

## Secret ids and how to obtain them

| Secret id           | How to unlock                                               | Related achievement                      |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `chair`             | Event "The Chair Has Been Promoted" → approve               | `chair-promoted` (The Chair Deserved It) |
| `nutcoin`           | Event "Corvus Launched NutCoin" → refuse, or ride the crash | `crypto-skeptic`                         |
| `basement-basement` | Event "Mina Found the Basement's Basement" → follow → dig   | —                                        |
| `spreadsheet`       | Event "The Spreadsheet Knows Too Much" → ask → accept       | `spreadsheet-knows`                      |

## Flag-only hidden achievements (no secret id)

- `nice` — hold **exactly** 69,420 nuts (`exactNuts`).
- `extremely-normal-basement` — build the `room-basement` upgrade.
- `touch-grass` — reach 200 reputation (unlocks the rooftop).

## Hidden interactions

- **Pet Pip** (click Pip in the office) grants a small temporary boost and
  friendship, and triggers `interaction` dialogue.
- **Give coffee** raises an employee's friendship and office morale.
- Decoration ownership is stored as `deco:<id>` inside the same `secrets` array
  but filtered out of the Secret Discoveries view.

## Adding a new secret

1. Emit `{ type: 'unlockSecret', secretId: '<id>' }` from an event choice in
   `src/content/events.ts`.
2. (Optional) add a hidden achievement in `src/content/achievements.ts` with
   `{ kind: 'flag', flag: 'secret:<id>' }` and `hidden: true`.
3. Add display/localization if you want a friendly name in Collections.
