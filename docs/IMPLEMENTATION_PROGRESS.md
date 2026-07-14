# HEAVY BAGGAGE — Implementation Progress & Plan

> This file is the single source of truth for what is **done**, **partial**, and
> **pending**. It is updated at the end of every working session. If a coding
> session is interrupted, the next session continues from here.

## Engine selection

- **Target engine:** Godot **4.4.1-stable** (GDScript, static typing).
- **Why not 4.7?** At the time of writing, the latest *stable* public Godot
  release is the 4.4.x line. Godot 4.7 has not been released. The brief allows
  "the latest mutually compatible stable Godot 4.x release available in the
  development environment", so we target 4.4.1. `project.godot` uses
  `config_version=5`. The project is forward-compatible with later 4.x editors;
  when 4.7 ships, bump the version reminder in `RELEASE_CHECKLIST.md`.
- **Rendering:** Forward+ primary, Compatibility fallback documented in
  `docs/BUILD_GUIDE.md`.

## Architecture summary

Everything lives under `game/` (source) and `content/` (data resources), with
`docs/` for documentation and `tools/` for dev/CI scripts. Autoloads provide
cross-cutting services; gameplay logic is composition-based and data-driven.
See `docs/ARCHITECTURE.md` for the full module map.

## Phase status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Technical foundation (config, autoloads, services, logging, adapters) | **DONE** |
| 2 | Core physics prototype (player, grabbing, furniture, doors, dolly, van) | **DONE** |
| 3 | First furniture vertical slice (Sofa, Fridge, Wardrobe, Lamp) | **DONE** |
| 4 | Complete first contract (suburban house, objectives, instability, report) | **DONE** |
| 5 | Warehouse + progression + UI screens | **DONE (core)** |
| 6 | Online co-op quality (ENet dev layer, Steam boundary) | **PARTIAL** — ENet host/join + typed messages + authority; Steam boundary is a documented stub |
| 7 | Content expansion (20 furniture defs, traits, contracts, cosmetics) | **PARTIAL** — full data infra + proven content; data files continue to fill |
| 8 | Release quality (localization, accessibility, tests, demo, CI, store) | **PARTIAL** — infra complete; polish ongoing |

## What is genuinely playable right now

- Boot → Main Menu → New Company → Warehouse → Contract Board → Briefing →
  Loadout → play the Suburban House contract solo (with AI assistants) → load
  furniture into the van → complete contract → incident report → rewards persist
  → back to warehouse.
- Four furniture types have complete emotion FSMs, traits, calming/escalation,
  audio hooks and networking sync.
- Save/load, settings, accessibility, localization (en + pt_BR), dev tools,
  and a headless automated test suite all function.

## Known limitations (transparent)

See `docs/KNOWN_LIMITATIONS.md`. Highlights:
- Steam integration is an **adapter boundary** with a working non-Steam local
  implementation. The real `SteamPlatform` requires GodotSteam and a Steam App
  ID (see `docs/STEAM_INTEGRATION.md`); it is not compiled in by default.
- Networking dev layer uses ENet (direct IP / LAN). Steam P2P is behind the
  same interface and stubbed.
- Art/audio are original **procedural placeholders** (code-generated meshes,
  materials, SVG UI, synthesized SFX). The replacement pipeline is documented
  in `docs/ASSET_REPLACEMENT_GUIDE.md`.
- Content counts: systems support the full 1.0 targets; hand-authored data is
  seeded to prove each category and continues to fill. Exact current counts are
  tracked in `content/CONTENT_STATUS.md`.

## Next up (continuation queue)

1. Expand furniture roster data from 4 fully-scripted + 16 data-defined to 20
   fully-scripted behaviours.
2. Author remaining 6 location assemblies.
3. Steam P2P adapter implementation once GodotSteam is vendored by the studio.
4. Voice/marketing capture pass for trailer.
