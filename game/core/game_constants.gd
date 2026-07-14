class_name GameConstants
extends RefCounted
## Centralised, engine-wide constants. Pure data — no state, no side effects.
## Accessed statically, e.g. `GameConstants.VERSION`.

const GAME_TITLE: String = "HEAVY BAGGAGE"
const GAME_SUBTITLE: String = "Paranormal Moving Company"

## Semantic version of the game build. Bumped in RELEASE_CHECKLIST.
const VERSION: String = "0.1.0-vertical-slice"

## Save schema version. Increment when the save layout changes; add a migration.
const SAVE_SCHEMA_VERSION: int = 3

## Network protocol version. Peers with mismatched values are rejected.
const NET_PROTOCOL_VERSION: int = 1

const MAX_PLAYERS: int = 4
const DEFAULT_PORT: int = 27015

## Feature tag set by the demo export preset (see export_presets.cfg).
const FEATURE_DEMO: String = "demo"
const FEATURE_STEAM: String = "steam"

## Wishlist / store URLs used by demo call-to-action buttons. Configurable so a
## real store URL can be dropped in without touching UI code.
const URL_STORE: String = "https://store.steampowered.com/app/000000/HEAVY_BAGGAGE/"
const URL_WISHLIST: String = "https://store.steampowered.com/app/000000/HEAVY_BAGGAGE/"

## Persistent resource identifiers used across the progression system.
const RES_CASH: String = "cash"
const RES_REPUTATION: String = "reputation"
const RES_RESIDUE: String = "residue"
const RES_INSURANCE: String = "insurance"

## Physics layer bit indices (kept in one place to avoid magic numbers).
const LAYER_WORLD: int = 1
const LAYER_PLAYER: int = 2
const LAYER_FURNITURE: int = 3
const LAYER_PROP: int = 4
const LAYER_TRIGGER: int = 5
const LAYER_VAN: int = 6
