extends Node
## Application flow / scene router + session state holder (autoload "App").
##
## Owns the top-level scene transitions and the transient "session" data that
## survives between screens (selected contract, run results). Keeps scene paths
## in one registry so no screen hardcodes another screen's path.

const SCENES: Dictionary = {
	"boot": "res://game/ui/screens/boot.tscn",
	"main_menu": "res://game/ui/screens/main_menu.tscn",
	"warehouse": "res://game/world/warehouse/warehouse.tscn",
	"contract": "res://game/world/contract_runner.tscn",
	"incident_report": "res://game/ui/screens/incident_report.tscn",
}

## Transient per-session state (not persisted directly).
var session: Dictionary = {
	"selected_contract": null,   # ContractData
	"last_result": {},           # incident report result
	"is_demo": false,
}

var _current_scene_id: String = ""


func _ready() -> void:
	session["is_demo"] = OS.has_feature(GameConstants.FEATURE_DEMO)
	EventBus.scene_change_requested.connect(_on_scene_change_requested)


func _on_scene_change_requested(scene_id: String, params: Dictionary) -> void:
	change_scene(scene_id, params)


func change_scene(scene_id: String, params: Dictionary = {}) -> void:
	if not SCENES.has(scene_id):
		Log.error("App", "Unknown scene id '%s'" % scene_id)
		return
	var path: String = SCENES[scene_id]
	if not ResourceLoader.exists(path):
		Log.error("App", "Scene file missing: %s" % path)
		return
	for key in params.keys():
		session[key] = params[key]
	_current_scene_id = scene_id
	Log.info("App", "Changing scene -> %s" % scene_id)
	var err := get_tree().change_scene_to_file(path)
	if err != OK:
		Log.error("App", "change_scene_to_file failed (%d) for %s" % [err, path])
		return
	EventBus.scene_changed.emit(scene_id)


func current_scene_id() -> String:
	return _current_scene_id


func is_demo() -> bool:
	return bool(session.get("is_demo", false))


## Locations playable in the demo build (per docs/DEMO_GUIDE.md).
const DEMO_LOCATIONS: Array[String] = ["suburban_house", "city_apartment"]

func demo_allows_location(location_id: String) -> bool:
	return not is_demo() or location_id in DEMO_LOCATIONS


## Convenience used by the "Continue"/"New Company" flow.
func go_to_warehouse() -> void:
	change_scene("warehouse")


func go_to_main_menu() -> void:
	change_scene("main_menu")
