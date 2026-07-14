# Steam Integration Guide

The game runs **fully without Steam**. Steam is one implementation behind the
`PlatformInterface` boundary (`game/platform/`). If Steam is unavailable or fails
to initialise, the game automatically falls back to `LocalPlatform`.

## The boundary

- `PlatformInterface` — abstract API (achievements, stats, rich presence, cloud
  save dir, display name, deck detection, lobby hooks). Safe defaults everywhere.
- `LocalPlatform` — default. Achievements/stats persisted to a local JSON file so
  the UI works offline.
- `MockPlatform` — records calls for automated tests.
- `SteamPlatform` — talks to Steam **only** via `Engine.get_singleton("Steam")`
  through dynamic calls, so this file compiles and runs in stock Godot **without**
  GodotSteam present. If the singleton is missing or Steam isn't running,
  `initialize()` returns false and `PlatformManager` falls back to local.

## Enabling real Steam (developer steps)

1. **Vendor GodotSteam** (module build or GDExtension) matching Godot 4.4.x.
   GodotSteam is MIT-licensed; it is *not* bundled here. Do **not** commit the
   Steamworks SDK into this repository.
2. Create `steam_appid.txt` in the project root containing your App ID. This file
   is **git-ignored** — never commit it.
3. Export with the `steam` feature (add a Steam export preset or custom feature).
   `PlatformManager` selects `SteamPlatform` when the `steam` feature is present
   or the `Steam` singleton exists.
4. Configure Steam Cloud in the App Admin to sync Godot's `user://` directory
   (auto-cloud). Saves already live there via `Platform.save_dir()`.

## Achievements & stats

40 achievement definitions live in `content/achievements/achievements.json` and
must be mirrored in Steamworks with the **same IDs**. See
`content/steam/achievements.md` for the ready-to-enter list. `Platform.unlock_
achievement(id)` routes to Steam in Steam builds and to the local store
otherwise. **Demo builds never award achievements** (enforced in
`PlatformManager.unlock_achievement`).

## Lobbies & P2P

Lobby creation/invite/join-through-friends and Steam P2P transport are declared
on the interface and are the integration point for the Steam networking adapter.
Until GodotSteam is vendored, development uses ENet (see `docs/MULTIPLAYER.md`).
This is a documented stub, not a claim that Steam networking is complete.

## Steam Deck

`is_steam_deck()` is heuristic in local builds and authoritative in Steam builds.
Verify controller layout, default graphics preset, and text scale on Deck before
claiming Deck Verified.

## Do not

- Do not commit secrets, the SDK, or `steam_appid.txt`.
- Do not claim macOS builds are distributable without signing + notarization
  (see `docs/RELEASE_CHECKLIST.md`).
