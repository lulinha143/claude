class_name SteamPlatform
extends PlatformInterface
## Real Steam implementation boundary.
##
## IMPORTANT: This file is written to PARSE and RUN in stock Godot WITHOUT the
## GodotSteam module/extension present. It accesses Steam only through
## `Engine.get_singleton("Steam")` via dynamic calls, so there is no hard
## compile-time dependency and no redistributed SDK files in the repo.
##
## To enable real Steam:
##   1. Install GodotSteam (module build or GDExtension) — see
##      docs/STEAM_INTEGRATION.md.
##   2. Place your App ID in steam_appid.txt (gitignored).
##   3. Export with the `steam` feature tag.
## If any of the above is missing, initialize() returns false and the game
## falls back to LocalPlatform automatically (handled by PlatformManager).

var _steam: Object = null
var _app_id: int = 0
var _inited: bool = false


func initialize() -> bool:
	if not Engine.has_singleton("Steam"):
		Log.warn("Platform", "Steam singleton not present; cannot use SteamPlatform.")
		return false
	_steam = Engine.get_singleton("Steam")
	_app_id = _read_app_id()
	# GodotSteam's init signature varies by version; call defensively.
	var result: Variant = _steam.call("steamInitEx") if _steam.has_method("steamInitEx") else null
	if result == null and _steam.has_method("steamInit"):
		result = _steam.call("steamInit")
	# Verify the API is actually running.
	if _steam.has_method("isSteamRunning") and not bool(_steam.call("isSteamRunning")):
		Log.warn("Platform", "Steam is not running; falling back to local.")
		return false
	_inited = true
	Log.info("Platform", "SteamPlatform initialised (app_id=%s)" % _app_id)
	return true


func shutdown() -> void:
	if _inited and _steam != null and _steam.has_method("steamShutdown"):
		_steam.call("steamShutdown")
	_inited = false


func poll() -> void:
	if _inited and _steam != null and _steam.has_method("run_callbacks"):
		_steam.call("run_callbacks")


func get_platform_name() -> String:
	return "steam"


func is_steam() -> bool:
	return _inited


func is_steam_deck() -> bool:
	if _inited and _steam != null and _steam.has_method("isSteamRunningOnSteamDeck"):
		return bool(_steam.call("isSteamRunningOnSteamDeck"))
	return false


func get_user_display_name() -> String:
	if _inited and _steam != null and _steam.has_method("getPersonaName"):
		return str(_steam.call("getPersonaName"))
	return "Mover"


func get_cloud_save_dir() -> String:
	# Steam auto-cloud maps user:// when configured in the app's cloud settings;
	# see docs/STEAM_INTEGRATION.md. We keep the same relative layout.
	return "user://saves"


func unlock_achievement(achievement_id: String) -> void:
	if not _inited or _steam == null:
		return
	if _steam.has_method("setAchievement"):
		_steam.call("setAchievement", achievement_id)
	if _steam.has_method("storeStats"):
		_steam.call("storeStats")
	EventBus.achievement_unlocked.emit(achievement_id)


func is_achievement_unlocked(achievement_id: String) -> bool:
	if _inited and _steam != null and _steam.has_method("getAchievement"):
		var res: Variant = _steam.call("getAchievement", achievement_id)
		if res is Dictionary:
			return bool(res.get("achieved", false))
	return false


func set_stat_int(stat_id: String, value: int) -> void:
	if _inited and _steam != null and _steam.has_method("setStatInt"):
		_steam.call("setStatInt", stat_id, value)


func set_stat_float(stat_id: String, value: float) -> void:
	if _inited and _steam != null and _steam.has_method("setStatFloat"):
		_steam.call("setStatFloat", stat_id, value)


func store_stats() -> void:
	if _inited and _steam != null and _steam.has_method("storeStats"):
		_steam.call("storeStats")


func set_rich_presence(key: String, value: String) -> void:
	if _inited and _steam != null and _steam.has_method("setRichPresence"):
		_steam.call("setRichPresence", key, value)


func _read_app_id() -> int:
	if FileAccess.file_exists("res://steam_appid.txt"):
		var f := FileAccess.open("res://steam_appid.txt", FileAccess.READ)
		if f != null:
			var txt := f.get_as_text().strip_edges()
			f.close()
			if txt.is_valid_int():
				return int(txt)
	return 0
