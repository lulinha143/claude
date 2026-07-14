# Third-Party Notices & Attribution

This project aims to be **free of third-party marketplace or copyrighted assets**.
Everything visible/audible in the repository is original and generated for the
project.

## Engine

- **Godot Engine** — MIT License, © 2014-present Godot Engine contributors and
  © 2007-2014 Juan Linietsky, Ariel Manzur. <https://godotengine.org/license>
  Godot is a dependency (the runtime), not redistributed source in this repo.

## Assets in this repository

| Asset | Type | Source | License |
|-------|------|--------|---------|
| Furniture / player / van visuals | Procedural mesh (code) | Original (`game/furniture/furniture_mesh_factory.gd`) | Project license |
| Sound effects | Procedurally synthesized (code) | Original (`game/audio/procedural_sfx.gd`) | Project license |
| UI theme & icons | SVG / `.tres` | Original (`assets/`) | Project license |
| Boxy mascot | Code-drawn (`game/ui/widgets/boxy_widget.gd`) | Original | Project license |

No fonts, textures, models, or audio from external marketplaces are bundled.

## Optional future dependencies (NOT bundled)

- **GodotSteam** (for Steam builds) — MIT License. Vendored by the developer at
  integration time; see `docs/STEAM_INTEGRATION.md`. Not present in this repo.

## When you add third-party content

Add a row above with the exact source and license, keep the license text in a
`licenses/` folder, and ensure the license permits your intended (commercial)
use. Do not add "found online" assets without clear licensing.
