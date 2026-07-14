class_name PlatformInterface
extends RefCounted
## Abstract platform integration boundary.
##
## Game logic depends ONLY on this interface, never on Steam directly. Concrete
## implementations: LocalPlatform (no Steam, default), MockPlatform (tests),
## SteamPlatform (real Steam via GodotSteam — see docs/STEAM_INTEGRATION.md).
##
## Every method has a safe default so a partial implementation still runs.

## Returns true if initialisation succeeded. Must NEVER crash if the underlying
## platform (e.g. Steam) is unavailable — return false and let the game fall
## back to local mode.
func initialize() -> bool:
	return true


func shutdown() -> void:
	pass


func poll() -> void:
	## Called each frame so callback-driven backends (Steam) can pump events.
	pass


func get_platform_name() -> String:
	return "abstract"


func is_steam() -> bool:
	return false


func is_steam_deck() -> bool:
	return false


func is_overlay_active() -> bool:
	return false


func get_user_display_name() -> String:
	return "Mover"


func get_user_id() -> String:
	return "local"


## Directory where saves should live. Steam builds return the Steam Cloud path;
## local builds return user://. Save code never hardcodes a path.
func get_cloud_save_dir() -> String:
	return "user://saves"


func unlock_achievement(_achievement_id: String) -> void:
	pass


func clear_achievement(_achievement_id: String) -> void:
	pass


func is_achievement_unlocked(_achievement_id: String) -> bool:
	return false


func set_stat_int(_stat_id: String, _value: int) -> void:
	pass


func set_stat_float(_stat_id: String, _value: float) -> void:
	pass


func store_stats() -> void:
	pass


func set_rich_presence(_key: String, _value: String) -> void:
	pass


# --- Lobby / networking discovery -----------------------------------------
## These return sentinel values in non-Steam builds; the ENet dev transport is
## used for actual connectivity. See game/net/.
func create_lobby(_mode: int, _max_players: int) -> void:
	pass


func join_lobby(_lobby_id: String) -> void:
	pass


func leave_lobby() -> void:
	pass


func invite_friend() -> void:
	pass


func get_lobby_members() -> Array:
	return []
