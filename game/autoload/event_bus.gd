extends Node
## Global signal hub (autoload "EventBus").
##
## Decouples systems that shouldn't hold direct references to each other (e.g.
## UI reacting to gameplay). Keep signals coarse-grained and typed. Systems that
## have a natural owner should still use their own local signals; the bus is for
## genuinely cross-cutting notifications.

# --- Application / flow ----------------------------------------------------
signal scene_change_requested(scene_id: String, params: Dictionary)
signal scene_changed(scene_id: String)

# --- Contract lifecycle ----------------------------------------------------
signal contract_started(contract_id: String, seed_value: int)
signal contract_objective_updated(objective_id: String, complete: bool)
signal contract_completed(result: Dictionary)
signal contract_abandoned()

# --- Furniture -------------------------------------------------------------
signal furniture_emotion_changed(furniture_id: String, emotion: int, arousal: float)
signal furniture_loaded_into_van(furniture_id: String)
signal furniture_damaged(furniture_id: String, amount: float)

# --- Instability -----------------------------------------------------------
signal instability_changed(points: float, level: int)
signal instability_level_changed(level: int)

# --- Players ---------------------------------------------------------------
signal player_state_changed(peer_id: int, state: int)
signal player_incapacitated(peer_id: int, reason: String)
signal player_revived(peer_id: int)
signal ping_placed(peer_id: int, position: Vector3, kind: String)

# --- Progression / economy -------------------------------------------------
signal resources_changed(resources: Dictionary)
signal achievement_unlocked(achievement_id: String)

# --- Networking ------------------------------------------------------------
signal net_status_changed(status: int, detail: String)
signal net_peer_joined(peer_id: int)
signal net_peer_left(peer_id: int)

# --- Settings / localization ----------------------------------------------
signal settings_changed(section: String)
signal locale_changed(locale: String)
