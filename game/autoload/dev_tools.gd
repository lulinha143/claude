extends Node
## Developer tools controller (autoload "DevTools").
##
## Hidden in normal release builds. Enabled when: this is a debug build, OR the
## game is launched with `--dev` / the "devtools" feature. Toggled in-game with
## F3 (opens the dev overlay scene). Provides cheats, simulation, and content
## validation entry points — all reachable, none faked.

var enabled: bool = false
var _overlay: CanvasLayer = null


func _ready() -> void:
	enabled = OS.is_debug_build() \
		or OS.has_feature("devtools") \
		or "--dev" in OS.get_cmdline_user_args()
	if enabled:
		Log.info("DevTools", "Developer tools ENABLED.")
	set_process_input(enabled)


func _input(event: InputEvent) -> void:
	if not enabled:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F3:
			toggle_overlay()


func toggle_overlay() -> void:
	if not enabled:
		return
	if _overlay != null and is_instance_valid(_overlay):
		_overlay.queue_free()
		_overlay = null
		return
	var scene := load("res://game/dev/dev_overlay.tscn")
	if scene == null:
		Log.warn("DevTools", "Dev overlay scene missing.")
		return
	_overlay = scene.instantiate()
	get_tree().root.add_child(_overlay)


# --- Cheat / simulation helpers (called by the overlay UI) -----------------
func add_resource(id: String, amount: int) -> void:
	SaveManager.add_resource(id, amount)


func unlock_all_locations() -> void:
	if SaveManager.current.is_empty():
		return
	SaveManager.current["unlocked_locations"] = [
		"suburban_house", "city_apartment", "abandoned_hotel", "magician_mansion",
		"furniture_store", "lakeside_cabin", "corporate_office", "impossible_house",
	]


func unlock_all_equipment() -> void:
	if SaveManager.current.is_empty():
		return
	var ids: Array = ContentDB.equipment_ids()
	SaveManager.current["unlocked_equipment"] = ids


func set_instability(points: float) -> void:
	EventBus.instability_changed.emit(points, InstabilitySystem.level_for(points))


func unlock_achievement(id: String) -> void:
	Platform.unlock_achievement(id)


func validate_localization() -> Dictionary:
	return Loc.completeness()


func validate_content() -> Dictionary:
	return ContentDB.validate()
