# HEAVY BAGGAGE — Paranormal Moving Company

> *Every object has issues.*

A solo and 1–4 player online co-op **physics horror-comedy** about running a
paranormal moving company. Investigate living furniture, calm their supernatural
breakdowns, carry them through impossible houses, and try to reach the van with
your team — and your insurance rating — intact.

Built in **Godot 4.4** with GDScript (static typing). Playable solo without any
online service, testable without Steam, exportable for Windows/Linux.

---

## Quick start

You need **Godot 4.4.x** (standard build — no C#/Mono required).

```bash
# 1. Open in the editor (this also builds the class cache):
godot --editor --path .

# 2. Or just run the game:
godot --path .

# 3. Run the automated tests (headless):
make test          # or: godot --headless --path . res://tools/test_runner.tscn

# 4. Validate content + localization:
make validate
```

> First run tip: if you run headless *before* opening the editor once, build the
> global class cache first with `make import` (`godot --headless --editor --quit`).
> This registers the `class_name` types used across the project.

## What works today (vertical slice)

Boot → Main Menu → **New Company** → Warehouse → Contract Board → play the
Suburban House contract **solo with AI assistants** → carry furniture into the
van → contract completes → **incident report** → rewards persist → back to the
warehouse. Save/load, settings, accessibility, localization (English + Brazilian
Portuguese), dev tools (F3), and a headless test suite all function.

Four furniture types have complete emotion + trait behaviour: the **Clingy
Sofa**, **Hungry Refrigerator**, **Shy Wardrobe**, and **Anxious Lamp**. The
other 16 are fully data-defined and spawnable. See
[`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md) for the
honest, phase-by-phase status and [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).

## Controls (default, rebindable in Settings)

| Action | Key |
|--------|-----|
| Move | WASD |
| Sprint / Crouch / Jump | Shift / Ctrl / Space |
| Grab left / right hand | Left / Right mouse |
| Interact / knock / revive | E |
| Emote & calm wheel | R |
| Ping | Q |
| Use tool | F |
| Photo | P |
| Pause | Esc |
| Dev tools overlay | F3 (dev builds) |

## Repository layout

```
game/            Source (GDScript, static typed)
  autoload/      Cross-cutting services (Log, EventBus, Platform, Save, Loc, ...)
  core/          Constants, balance, deterministic RNG
  platform/      Platform adapter boundary (Local / Mock / Steam)
  net/           Typed multiplayer messages
  save/          Save schema + migrations
  furniture/     Data-driven sentient-object system + emotion FSM
  player/        Player controller + AI assistant
  contract/      Contract generation, rewards, instability, incident reports
  world/         Level builder, van, doors, warehouse, contract runner
  ui/            Screens, HUD, widgets
  dev/           Developer overlay
content/         Data-driven content (JSON) + localization CSV
assets/          Original placeholder art (SVG UI, icons) + theme
test/            Unit + integration tests
tools/           Headless runners & validators
docs/            Architecture, design, guides, marketing, release
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Game Design](docs/GAME_DESIGN.md)
- [Multiplayer](docs/MULTIPLAYER.md) · [Physics](docs/PHYSICS.md)
- [Furniture creation guide](docs/FURNITURE_GUIDE.md)
- [Localization guide](docs/LOCALIZATION_GUIDE.md) · [Asset replacement](docs/ASSET_REPLACEMENT_GUIDE.md)
- [Steam integration](docs/STEAM_INTEGRATION.md) · [Demo guide](docs/DEMO_GUIDE.md)
- [Build guide](docs/BUILD_GUIDE.md) · [Testing guide](docs/TESTING_GUIDE.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Content roadmap](docs/CONTENT_ROADMAP.md) · [Marketing / store copy](docs/marketing/)

## Legal & privacy

The game collects **no personal information**, requires **no backend** for core
play, and contains **no ads, loot boxes, or premium currency**. Placeholder art
and audio are **original** (procedural meshes/materials, SVG UI, synthesized
SFX). See [PRIVACY.md](PRIVACY.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md),
and the licensing note in [LICENSE](LICENSE).

> **Trademark/title note:** "HEAVY BAGGAGE" is a working title. Before any
> commercial use, complete formal trademark, domain, social-media and storefront
> availability checks (tracked in the [Release Checklist](docs/RELEASE_CHECKLIST.md)).
