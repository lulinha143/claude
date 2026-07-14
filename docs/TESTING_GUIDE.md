# Testing Guide

## Test types

- **Unit tests** — pure logic, no scene tree. Files: `test/unit/test_*.gd`,
  extending `HBTest` (`test/test_case.gd`).
- **Integration test** — spins up a real contract scene headless and asserts the
  full loop (`tools/integration_contract.tscn`).

## Running

```bash
make test          # unit suite (godot --headless --path . res://tools/test_runner.tscn)
make integration   # end-to-end contract
```

The unit runner discovers every `test/**/test_*.gd`, runs each `test_*` method,
prints a summary, and exits non-zero on failure (CI-friendly).

> If you added new `class_name` scripts, run `make import` first so the global
> class cache registers them (otherwise you'll see "Could not find type").

## What is covered (automated)

- Emotion FSM: thresholds, decay, sensitivity, transition signalling.
- Contract generation: determinism per seed, structure, daily challenge seeds.
- Reward & insurance math; upgrade cost math.
- Save migrations (v1→v3), schema defaults, sanitisation, corruption recovery.
- Deterministic RNG streams; instability level mapping.
- Net message validation (accept/reject).
- Incident report generation (success/abandoned).
- Localization: known key, missing-key fallback, arg substitution, EN/PT-BR
  completeness.
- Input rebinding serialization round-trip.
- **Integration:** furniture spawn → van load detection → rewards applied → save.

## Manual QA (real multiplayer)

See the **test matrix** in `docs/MULTIPLAYER.md`. At minimum verify: shared
grabbing, furniture/emotion sync, door break sync, revive sync, contract
completion sync, host disconnect handling, version-mismatch rejection.

Also manually verify each release build: tutorial/first contract, solo mode,
controller navigation of every menu, accessibility toggles, language switch,
demo restrictions.

## Adding a test

```gdscript
extends HBTest
func test_my_thing() -> void:
    eq(2 + 2, 4, "math still works")
```

Prefer testing pure classes (`game/core`, `game/contract`, `game/save`,
`game/furniture/emotion_machine.gd`) which need no scene tree.
