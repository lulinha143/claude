class_name LocalPlatform
extends PlatformInterface
## Default platform implementation used when Steam is unavailable or disabled.
## Fully functional for solo play, dev networking, and local saves. Achievements
## and stats are persisted to a local JSON file so the UI still works offline.

const LOCAL_ACHIEVEMENTS_PATH: String = "user://local_achievements.json"

var _unlocked: Dictionary = {}
var _stats: Dictionary = {}
var _deck: bool = false


func initialize() -> bool:
	_deck = _detect_steam_deck()
	_load_local_achievements()
	Log.info("Platform", "LocalPlatform initialised (deck=%s)" % _deck)
	return true


func get_platform_name() -> String:
	return "local"


func is_steam_deck() -> bool:
	return _deck


func get_user_display_name() -> String:
	var env_name := OS.get_environment("USERNAME")
	if env_name.is_empty():
		env_name = OS.get_environment("USER")
	return env_name if not env_name.is_empty() else "Mover"


func get_cloud_save_dir() -> String:
	return "user://saves"


func unlock_achievement(achievement_id: String) -> void:
	if _unlocked.get(achievement_id, false):
		return
	_unlocked[achievement_id] = true
	_save_local_achievements()
	Log.info("Platform", "Achievement unlocked (local): %s" % achievement_id)
	EventBus.achievement_unlocked.emit(achievement_id)


func clear_achievement(achievement_id: String) -> void:
	_unlocked.erase(achievement_id)
	_save_local_achievements()


func is_achievement_unlocked(achievement_id: String) -> bool:
	return _unlocked.get(achievement_id, false)


func set_stat_int(stat_id: String, value: int) -> void:
	_stats[stat_id] = value


func set_stat_float(stat_id: String, value: float) -> void:
	_stats[stat_id] = value


func store_stats() -> void:
	_save_local_achievements()


func _detect_steam_deck() -> bool:
	# Heuristic used until the real Steam API confirms; SteamPlatform overrides.
	return OS.get_environment("SteamDeck") == "1"


func _load_local_achievements() -> void:
	if not FileAccess.file_exists(LOCAL_ACHIEVEMENTS_PATH):
		return
	var f := FileAccess.open(LOCAL_ACHIEVEMENTS_PATH, FileAccess.READ)
	if f == null:
		return
	var data: Variant = JSON.parse_string(f.get_as_text())
	f.close()
	if data is Dictionary:
		_unlocked = data.get("unlocked", {})
		_stats = data.get("stats", {})


func _save_local_achievements() -> void:
	var f := FileAccess.open(LOCAL_ACHIEVEMENTS_PATH, FileAccess.WRITE)
	if f == null:
		Log.warn("Platform", "Could not persist local achievements")
		return
	f.store_string(JSON.stringify({"unlocked": _unlocked, "stats": _stats}, "\t"))
	f.close()
