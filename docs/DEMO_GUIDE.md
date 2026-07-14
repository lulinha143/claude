# Demo Guide

The demo is a separate export configuration, not a separate codebase. It is
produced by the **"Demo (Windows)"** export preset which sets the `demo` custom
feature. `App.is_demo()` (`OS.has_feature("demo")`) gates behaviour.

## What the demo includes

- Tutorial + warehouse introduction + Boxy.
- **Suburban House** and **Narrow City Apartment** locations
  (`App.DEMO_LOCATIONS`). Other locations are hidden on the contract board.
- The four fully-behaved furniture types (Sofa, Fridge, Wardrobe, Lamp) plus any
  data-defined objects that appear in those two locations.
- Solo mode with AI assistants; online co-op works if stable on your build.
- A subset of character customization (common cosmetics).
- A **daily demo challenge** (deterministic by date, works offline) and seed
  sharing.
- Wishlist / full-game buttons using `GameConstants.URL_STORE` / `URL_WISHLIST`
  (configurable — drop in the real store URL before release).

## Demo restrictions (enforced in code)

- **No achievements are awarded** (`PlatformManager.unlock_achievement` returns
  early when the `demo` feature is set).
- Locked locations are filtered out of the contract board.
- Saves are **compatible** with the full game (same schema); progress carries
  over.
- The end screen is informational (`DEMO_END_TITLE`) and does not abruptly block
  continued play.

## Building the demo

```bash
make export-demo   # build/demo/HeavyBaggage_Demo.exe
```

## Design intent

The demo must be genuinely fun and replayable (target 45–60 min of content via
randomized contracts + daily challenge), not merely a tutorial.
