# Architecture

HEAVY BAGGAGE is organised into cross-cutting **autoload services**, pure
**logic classes** (unit-testable, no scene deps), **content data** (JSON), and
**scene-bound controllers** (nodes). Systems communicate through their own
signals or the global `EventBus`; they avoid reaching into each other directly.

## Module map

```
game/autoload/     Singletons registered in project.godot [autoload]
  log.gd           Log        — levelled, ring-buffered structured logging
  event_bus.gd     EventBus   — global typed signals (decoupling hub)
  services.gd      Services   — service locator / DI for testable logic
  platform.gd      Platform   — selects PlatformInterface impl (local/steam)
  settings_manager Settings   — display/audio/gameplay/accessibility/locale
  input_rebinder   InputRebinder — rebinding + serialization
  content_db.gd    ContentDB  — loads all content/*.json, typed accessors
  save_manager.gd  SaveManager— profiles, migration, backups, atomic writes
  localization.gd  Loc        — runtime CSV translations, t(), pluralization
  audio_director   Audio      — buses, bounded SFX pool, adaptive music
  net_manager.gd   Net        — ENet transport, handshake, typed messages
  app.gd           App        — scene router + transient session state
  dev_tools.gd     DevTools   — dev overlay + cheats (dev builds only)

game/core/         GameConstants, Balance, DeterministicRNG (class_name, pure)
game/platform/     PlatformInterface + Local/Mock/Steam implementations
game/net/          NetMessages (typed message catalogue + validation)
game/save/         SaveSchema, SaveMigrations (pure)
game/furniture/    Emotions, EmotionMachine, FurnitureData, FurnitureController,
                   FurnitureMeshFactory
game/player/       PlayerController, AIAssistant
game/contract/     InstabilitySystem, PropertyInstability, ContractData,
                   ContractGenerator, RewardCalculator, UpgradeCalculator,
                   IncidentReport
game/world/        LevelBuilder, Van, DoorController, ContractRunner, Warehouse
game/ui/           screens/*, hud/*, widgets/*
game/dev/          dev_overlay
```

## Key design rules

- **Autoloads are thin.** Heavy/branching logic lives in `class_name` classes
  under `game/core`, `game/contract`, `game/save`, etc., so it can be tested
  without a scene tree (see `test/unit`).
- **Determinism.** All contract/daily/layout randomness flows through
  `DeterministicRNG` seeded from the contract seed, so a shared seed reproduces
  an identical contract. `DeterministicRNG` uses named sub-streams so unrelated
  systems don't perturb each other.
- **Data-driven content.** `ContentDB` builds typed objects (`FurnitureData`)
  from JSON. Behaviour emerges from data + shared controllers + trait tags — no
  per-object hardcoding scattered across scripts.
- **Explicit network authority.** The host (peer 1) is authoritative. Clients
  send typed requests validated by `NetMessages.validate()` before the host
  applies them. Furniture/players sync transform via lightweight RPC and
  interpolate on remotes.
- **Interface boundaries for platforms.** Game code depends on
  `PlatformInterface`, never on Steam. Steam is one implementation behind that
  boundary, with a working local fallback.

## Data flow: one contract

```
Contract Board → ContractGenerator.generate(seed) → ContractData
   → App.change_scene("contract", {selected_contract})
   → ContractRunner._ready: LevelBuilder.build → Van + FurnitureControllers
        + PropertyInstability + PlayerController (+ AIAssistants) + HUD
   → play: grabs apply forces; emotions tick; instability escalates
   → Van detects target dwell → all_targets_loaded
   → ContractRunner._finish → RewardCalculator + IncidentReport
        → SaveManager (rewards persist) → App.change_scene("incident_report")
```

See `docs/GAME_DESIGN.md`, `docs/MULTIPLAYER.md`, and `docs/PHYSICS.md` for
subsystem detail.
