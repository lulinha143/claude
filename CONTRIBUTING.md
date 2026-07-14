# Contributing to HEAVY BAGGAGE

Thanks for helping move the furniture (carefully).

## Getting set up

1. Install **Godot 4.4.x** (standard, no C#).
2. Clone the repo and run `make import` once to build the class cache.
3. `make test` and `make validate` should pass before you start.

## Coding standards

- **GDScript with static typing.** Annotate variables, parameters, and return
  types. Avoid untyped `Variant` where a concrete type is known.
- **Composition over inheritance.** Prefer small components and data resources.
- **No giant managers, no global-state abuse.** Cross-cutting concerns go through
  autoload services or `EventBus` signals; unit-testable logic stays free of
  hidden singleton dependencies (see `game/contract/*` for pure classes).
- **Data-driven content.** New furniture/equipment/cosmetics/etc. go in
  `content/**.json`, not hardcoded in scripts. See `docs/FURNITURE_GUIDE.md`.
- **Localize everything user-facing.** No hardcoded UI strings — use `Loc.t()`
  with keys added to `content/localization/strings.csv`.
- **Comment non-obvious logic.** Explain *why*, not *what*.

## Before opening a PR

Run and make sure these pass:

```bash
make test
make integration
make validate
```

- No script parse errors (`make import` prints them).
- No broken/placeholder buttons — every visible control must do something.
- Update `docs/IMPLEMENTATION_PROGRESS.md` and `CHANGELOG.md` if relevant.
- Add tests for new pure logic (emotions, generation, rewards, saves, etc.).

## Commit & PR style

- Small, focused commits with imperative messages ("Add shy wardrobe behaviour").
- Fill in the pull-request template. Describe what you tested.

## Formatting

`gdformat`/`gdlint` (gdtoolkit) run in CI as **informational**. Keeping code
`gdformat`-clean is appreciated but not currently a merge gate.
