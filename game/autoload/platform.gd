extends Node
## Platform manager (autoload "Platform").
##
## Selects and owns the active PlatformInterface implementation, with graceful
## fallback: if the `steam` feature is present AND Steam initialises, use Steam;
## otherwise use LocalPlatform. Tests can inject a MockPlatform via `override`.

var _impl: PlatformInterface


func _ready() -> void:
	_select_implementation()


func _process(_delta: float) -> void:
	if _impl != null:
		_impl.poll()


func _select_implementation() -> void:
	var chosen: PlatformInterface = null
	if OS.has_feature(GameConstants.FEATURE_STEAM) or Engine.has_singleton("Steam"):
		var steam := SteamPlatform.new()
		if steam.initialize():
			chosen = steam
		else:
			Log.warn("Platform", "Steam requested but unavailable; using local.")
	if chosen == null:
		chosen = LocalPlatform.new()
		chosen.initialize()
	_impl = chosen
	Log.info("Platform", "Active platform: %s" % _impl.get_platform_name())


## Test hook: replace the active implementation (e.g. with MockPlatform).
func override(impl: PlatformInterface) -> void:
	if _impl != null:
		_impl.shutdown()
	_impl = impl
	if _impl != null:
		_impl.initialize()


func current() -> PlatformInterface:
	return _impl


# --- Convenience pass-throughs (so callers don't reach into .current()) ----
func is_steam() -> bool:
	return _impl != null and _impl.is_steam()


func is_steam_deck() -> bool:
	return _impl != null and _impl.is_steam_deck()


func display_name() -> String:
	return _impl.get_user_display_name() if _impl != null else "Mover"


func save_dir() -> String:
	return _impl.get_cloud_save_dir() if _impl != null else "user://saves"


func unlock_achievement(achievement_id: String) -> void:
	# Demo builds never award achievements directly (design requirement).
	if OS.has_feature(GameConstants.FEATURE_DEMO):
		Log.debug("Platform", "Achievement suppressed in demo: %s" % achievement_id)
		return
	if _impl != null:
		_impl.unlock_achievement(achievement_id)


func set_stat_int(stat_id: String, value: int) -> void:
	if _impl != null:
		_impl.set_stat_int(stat_id, value)


func set_rich_presence(key: String, value: String) -> void:
	if _impl != null:
		_impl.set_rich_presence(key, value)


func _exit_tree() -> void:
	if _impl != null:
		_impl.shutdown()
