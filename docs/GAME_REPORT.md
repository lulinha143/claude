# HEAVY BAGGAGE — Full Project Report

*Generated status report of the game as it currently exists in this repository.*

---

## 1. Overview

**HEAVY BAGGAGE — Paranormal Moving Company** is a solo and 1–4 player online
co-op **physics horror-comedy** game. You play an underpaid mover for a paranormal
moving company. The furniture is alive, emotionally unstable, and supernaturally
gifted. You investigate each object's emotional problems, calm (or restrain) it,
physically carry it through dangerous houses, load it into the van, and escape
before the property's "instability" peaks.

- **Engine:** Godot **4.4.x** (verified on 4.4.1-stable), GDScript with static typing.
- **Renderer:** Forward+ (desktop), Compatibility/GL fallback for weak GPUs.
- **Runs without any online service.** Steam is optional and behind an adapter.
- **Repository size:** 67 GDScript files, 18 scenes, 10 content JSON files,
  31 documentation files, 110 localization keys.

---

## 2. Current status — what actually runs (verified headless)

Everything below was executed on Godot 4.4.1 and confirmed working, not just written:

- **Full gameplay loop:** Boot → Main Menu → New Company → Warehouse → Contract
  Board → play the Suburban House contract **solo with AI assistants** → carry
  furniture into the van → contract completes → **incident report** → rewards are
  saved → return to warehouse.
- **Unit tests:** 5 test files pass (0 assertion failures).
- **Integration test:** full contract runs end-to-end and PASSES — 5 target
  objects spawn, the van detects all of them loaded, rewards are applied,
  achievements unlock, and progression persists to disk.
- **Content validator:** PASS (meets all declared 1.0 minimums).
- **Localization validator:** PASS (English + Brazilian Portuguese 100%).
- **Clean boot:** no parser errors, no runtime errors reaching the main menu.

Run commands:
```
make import        # build the class cache (do once on a clean clone)
make run           # play the game
make test          # unit tests
make integration   # end-to-end contract test
make validate      # content + localization validators
```

---

## 3. Project structure

```
game/            67 GDScript source files
  autoload/      14 singleton services
  core/          Constants, balance tuning, deterministic RNG
  platform/      Platform adapter boundary (Local / Mock / Steam)
  net/           Typed multiplayer messages
  save/          Save schema + migrations
  furniture/     Data-driven sentient-object system + emotion FSM + mesh factory
  player/        Player controller + AI assistant
  contract/      Generation, rewards, instability, incident reports, upgrades
  world/         Level builder, van, doors, warehouse, contract runner
  ui/            Screens, HUD, widgets (Boxy)
  dev/           Developer overlay (F3)
content/         Data-driven content (JSON) + localization CSV
assets/          Original placeholder art (SVG icon, UI theme)
test/            Unit tests + base test case
tools/           Headless test runner, integration test, validators
docs/            31 markdown docs (architecture, guides, marketing, release)
```

---

## 4. Architecture

The game uses **autoload singletons** for cross-cutting services, **pure logic
classes** (unit-testable, no scene tree), **data-driven content** (JSON), and
**scene controllers** (nodes). Systems talk through their own signals or a global
`EventBus`, so they don't reach into each other directly.

### Autoload services (14)

| Autoload | File | Purpose |
|----------|------|---------|
| `Log` | log.gd | Levelled, ring-buffered structured logging |
| `EventBus` | event_bus.gd | Global typed signals (decoupling hub) |
| `Services` | services.gd | Service locator / dependency injection for tests |
| `Platform` | platform.gd | Selects platform implementation (Local/Steam) |
| `Settings` | settings_manager.gd | Display/audio/gameplay/accessibility/locale |
| `InputRebinder` | input_rebinder.gd | Key/controller rebinding + serialization |
| `ContentDB` | content_db.gd | Loads all content JSON, typed accessors |
| `SaveManager` | save_manager.gd | Profiles, migrations, backups, atomic writes |
| `Loc` | localization.gd | Runtime CSV translations, `t()`, pluralization |
| `Audio` | audio_director.gd | Buses, bounded SFX pool, adaptive music |
| `Net` | net_manager.gd | ENet transport, handshake, typed messages |
| `App` | app.gd | Scene router + transient session state |
| `DevTools` | dev_tools.gd | Dev overlay + cheats (dev builds only) |

### Core design rules
- **Determinism:** all contract/daily/layout randomness flows through
  `DeterministicRNG` seeded by the contract seed, so a shared seed reproduces the
  same contract. Named sub-streams keep unrelated systems from perturbing each
  other's sequence.
- **Data-driven:** `ContentDB` builds typed objects from JSON. Behaviour emerges
  from data + shared controllers + trait tags — no per-object hardcoding.
- **Explicit network authority:** host (peer 1) is authoritative; clients send
  typed requests validated before the host applies them.
- **Platform behind an interface:** game code depends on `PlatformInterface`,
  never Steam directly.

---

## 5. Gameplay systems (detail)

### Sentient furniture
Every object is a `RigidBody3D` running one shared script (`FurnitureController`)
driven by a `FurnitureData` resource. It has:
- Physical properties (weight, dimensions, fragility, value, grip points, center
  of mass, min carriers).
- An **emotion state machine** (`EmotionMachine`): a continuous `arousal` (0–100)
  resolved into a discrete emotion (Calm, Nervous, Lonely, Excited, Suspicious,
  Embarrassed, Angry, Panicked, Possessive, Exhausted, Melancholic, Unhinged)
  biased by the object's personality.
- **Traits** (personality / paranormal / fear tags) that change what agitates or
  calms it and unlock special behaviours.
- A **procedural face** (eyes/mouth) that appears as emotional intensity rises.
- Emotional vocalizations (procedural murmurs) and damage tracking.

**Four objects have fully authored bespoke behaviour:**
- **Clingy Sofa** — calms when two people carry it; panics and tugs a nearby
  player when left alone.
- **Hungry Refrigerator** — eats loose equipment when agitated and gets heavier.
- **Shy Wardrobe** — freezes while a player's camera is looking at it; responds to
  knocking.
- **Anxious Lamp** — agitates in darkness, calms near a light source, strobes at
  panic (respecting the flashing accessibility toggle).

The other **16 objects are fully data-defined and spawnable** and use the generic
emotional behaviour until their special behaviours are scripted (hooks exist).

### Physics & carrying
- **Force-based multi-grab:** each hand claims the nearest free grip point and
  applies a spring-toward-target force minus velocity damping *at the grip point*
  every physics tick. Multiple hands/players sum naturally, so "two players carry
  one sofa" is emergent, not special-cased.
- **Safety systems:** force clamping, auto-release when over-stretched, velocity
  clamping, out-of-bounds recovery to a recovery point, physics sleep, continuous
  collision detection.
- **Doors** (`DoorController`): hinged rigid panel on a static frame; interaction
  swings it; a hard enough impact **breaks** it (fails the "no broken doors"
  objective).
- **Van** (`Van`): an `Area3D` cargo zone; a target that rests inside for ~0.6 s
  is marked loaded — this drives the completion check.

### Contracts & progression
- `ContractGenerator` deterministically builds a contract from a location + seed +
  reputation: targets, decoys, objectives (primary + optional), modifiers, time of
  day, payment range, client notes, hidden secrets.
- **Daily challenges** are seeded by date and work offline; seeds are shareable.
- **Property Instability** (`PropertyInstability`): a 0–120 meter with five levels
  (Uneasy → Active → Hostile → Uncontained → Property Rejection). Rises from
  agitated furniture, damage, noise; at Hostile+ it cuts the lights.
- **Rewards** (`RewardCalculator`, pure & tested): payout scales with completion,
  optional-objective bonus, damage penalty, perfect-move multiplier; also computes
  reputation, paranormal residue, and insurance rating change.
- **Incident report** (`IncidentReport`): humorous post-contract card assembled
  from data-driven line pools; exportable to PNG (renders only the card, never
  the desktop).
- **Persistent resources:** Cash, Reputation, Paranormal Residue, Insurance
  Rating, plus per-family Object Trust. Upgrades gated by reputation, cost via a
  tested `UpgradeCalculator`.

### Solo AI assistants
`AIAssistant` extends the player with a command finite-state machine (Follow,
Wait, Grab, Carry-to-van, Calm, Retreat, Open-path). Directed via pings; grabs
marked furniture from valid grips and carries it to the van, but is intentionally
limited so it doesn't solve the whole contract alone.

### Multiplayer
Host-authoritative ENet networking with a **version handshake**, optional lobby
password (hashed), typed messages validated on receipt (`NetMessages.validate`),
and lightweight transform/emotion sync (RPC + interpolation). Includes
message-channel latency/packet-loss simulation for QA. Steam P2P/lobbies are a
documented stub behind the same interface.

### Save system
Multiple local profiles; schema versioning with v1→v3 migrations; validation and
sanitisation (guards against NaN/negative values); rotating backups; atomic
writes; checksum-based corruption detection; export/import; Steam-Cloud-compatible
directory abstraction (path never hardcoded to Steam). Settings are stored
separately from progression.

### Localization
Runtime CSV loader (works headless/in exports), 110 keys, **English + Brazilian
Portuguese fully authored (100%)**, 10 more locales scaffolded (fall back to
English). Argument substitution, pluralization, locale-aware number/money
formatting, missing-key warnings (dev only), pseudo-localization mode, and a
completeness validator.

### Settings & accessibility
Display (mode, vsync, shadows, particles, post-processing, film grain), audio
(five buses + mono + background), gameplay (camera mode, FOV, separate X/Y
sensitivity, invert, hold/toggle), and a large accessibility section: reduced
motion, head-bob/screen-shake/flashing toggles, reduced-scare mode, physics
assist, simplified grabbing, auto-hold, one-button carry, subtitles, speaker
labels, closed captions, font/UI scale, high contrast, colorblind mode, center
dot, pause-in-solo. Full key/controller rebinding. Difficulty never overrides
accessibility.

---

## 6. Assets — exactly what is used

**All visible/audible assets are ORIGINAL and generated by the project. There are
no third-party marketplace assets, no copyrighted material, no fonts/models/audio
downloaded from anywhere.** They are intentionally *placeholder-quality but
cohesive*, with a documented pipeline to swap in final art without touching
gameplay code (`docs/ASSET_REPLACEMENT_GUIDE.md`).

### Files on disk in `assets/`
- `assets/icons/icon.svg` — original hand-written SVG of Boxy (the mascot ghost in
  a cardboard box), used as the app/window icon.
- `assets/ui/theme.tres` — a Godot `Theme` resource (original): button
  styleboxes, panel styles, colors, font sizes. This is the UI look.
- `assets/icons/icon.svg.import` — Godot's auto-generated import metadata.

### Everything else is generated at runtime, in code
- **3D furniture, player, and van visuals** — built procedurally from Godot
  primitives by `game/furniture/furniture_mesh_factory.gd` (boxes, cylinders,
  spheres composed into readable silhouettes: sofa with cushions/armrests, fridge
  with door seam + handle, wardrobe with doors, glowing lamp, bed, van with
  wheels, etc.). Colored and proportioned — **not** plain gray boxes.
- **Furniture faces** — small procedural eyes/mouth spawned on the object when it
  gets emotional.
- **Boxy the mascot** — drawn entirely in code with the `_draw()` API in
  `game/ui/widgets/boxy_widget.gd` (cardboard box, ghost, blinking eyes, smile,
  hides in his box when the property gets scary, speech bubble with tips).
- **Sound effects** — synthesized entirely in code by
  `game/audio/procedural_sfx.gd` (thuds, squeaks/creaks, chimes, non-verbal
  "murmur" vocalizations, UI blips). Original waveforms, zero copyright risk.
- **Music** — currently a single intensity-modulated ambience bed (hook exists for
  layered stems); driven by `Audio.set_music_intensity()`.
- **Materials/lighting** — `StandardMaterial3D` created in code with a soft,
  rounded, rim-lit "painted" look; `WorldEnvironment` + `OmniLight3D` set up
  per-level by the level builder (warmer for day, cold for night contracts).
- **Levels** — assembled procedurally by `game/world/level_builder.gd` (floor,
  perimeter walls, an interior partition with a physics door, ceiling lights,
  spawn points, recovery point, van drop-off) sized deterministically from the
  contract seed.

> In short: 3 real asset files (SVG icon, its import file, and the UI theme).
> Everything else the player sees or hears is generated by code at runtime.

---

## 7. Content inventory (exact current counts)

| Category | Count | 1.0 target | Status |
|----------|-------|-----------|--------|
| Furniture types | 20 | 20 | 4 with bespoke behaviour, 16 data-defined |
| Traits (personality/paranormal/fear) | 84 | 60+ | ✅ |
| Equipment & tool upgrades | 32 | 30+ | ✅ |
| Warehouse upgrades | 25 | 25+ | ✅ |
| Achievements | 40 | 40+ | ✅ (mirrored for Steamworks) |
| Cosmetics | 93 | 80+ | ✅ (13 slots) |
| Contract modifiers | 56 | 50+ | ✅ |
| Incident-report lines | 102 | 100+ | ✅ (7 categories) |
| Locations | 8 | 8 | ✅ (one procedural assembler for all) |
| Relationship rules | 10 | — | family-to-family reactions |
| Localization keys | 110 | grows | EN + PT-BR 100% |

---

## 8. UI screens (all functional — no dead buttons)

Boot/splash (with photosensitivity notice), Main Menu (New Company, Continue,
Join, Settings, Credits, Quit), Settings (tabs: Display, Audio, Gameplay,
Accessibility, Language, Controls with live rebinding), Credits, Warehouse hub
(with live Boxy + resources), Contract Board (offers + daily + seed entry +
briefing), Loadout, Character Customization, Furniture Encyclopedia, Upgrades,
Achievements + Statistics, in-contract HUD (targets/instability/emotion/objectives
+ emote-calm wheel), Incident Report (with PNG export), Pause menu, and a
developer overlay (F3, dev builds only).

---

## 9. Testing, tooling & CI

- **Test framework:** a minimal `HBTest` base + a headless test runner
  (`tools/test_runner.tscn`). Unit tests cover emotions, contract determinism,
  rewards/insurance, save migrations + corruption recovery, RNG, instability
  mapping, upgrades, net message validation, incident reports, localization, and
  input-rebind serialization.
- **Integration test** (`tools/integration_contract.tscn`): runs a real contract,
  loads the van, asserts rewards + save.
- **CLI validators:** `validate_content` and `validate_localization`.
- **Dev tools:** F3 overlay with cheats and simulation.
- **CI** (`.github/workflows/ci.yml`): downloads Godot 4.4.1, fails on parse
  errors, runs unit + integration tests, runs both validators; a separate
  informational lint job (gdtoolkit).
- **Release workflow** (`release.yml`): on a version tag, exports Windows/Linux/
  Demo and uploads artifacts.

---

## 10. Build, platforms & Steam

- **Export presets:** Windows Desktop, Linux, and Demo (the Demo sets a `demo`
  feature that restricts locations and suppresses achievements).
- **Platforms:** Windows 10/11 x64 (primary), Linux x64 (supported), Steam Deck
  (prepared, needs on-device verification), macOS (experimental — not
  distributable without signing + notarization).
- **Steam:** `PlatformInterface` boundary with a working `LocalPlatform`
  (offline), `MockPlatform` (tests), and a `SteamPlatform` that talks to Steam
  only via dynamic singleton calls so it compiles without GodotSteam. Steam init
  fails gracefully to local. 40 achievements are documented for Steamworks. No SDK
  or App ID committed.

---

## 11. Known limitations (transparent)

- Only **4 of 20** furniture have hand-authored bespoke supernatural behaviour;
  the rest are data-defined with generic behaviour.
- One **procedural house assembler** serves all 8 locations; unique per-location
  modules/hazards/secret rooms are data-listed but not yet uniquely built.
- **Steam P2P and lobbies are stubs**; ENet dev networking works but isn't
  hardened for adversarial clients or scale. Mid-contract rejoin isn't done.
- **Art & audio are original procedural placeholders** (not final).
- The **warehouse is a functional menu hub**, not yet a walkable 3D space.
- **Legal docs (LICENSE, PRIVACY) are templates needing professional review;**
  the title needs trademark/domain/storefront availability checks before
  commercial use.

Full detail: `docs/KNOWN_LIMITATIONS.md` and `docs/IMPLEMENTATION_PROGRESS.md`.

---

## 12. How to run

You need **Godot 4.4.x** (standard build, no C#). There is **no npm/Node** — this
is a Godot project, not a web/JavaScript project.

1. Open `project.godot` in the Godot editor and press **F5**, or:
2. Command line:
   ```
   godot --headless --editor --quit --path .     # first-time: build class cache
   godot --path .                                # run the game
   godot --headless --path . res://tools/test_runner.tscn   # tests
   ```
