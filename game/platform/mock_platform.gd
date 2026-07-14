class_name MockPlatform
extends PlatformInterface
## Deterministic, side-effect-free platform used by automated tests. Records
## calls so tests can assert on them without touching disk or Steam.

var calls: Array[Dictionary] = []
var unlocked: Dictionary = {}
var deck: bool = false
var display_name: String = "TestMover"


func initialize() -> bool:
	calls.append({"m": "initialize"})
	return true


func get_platform_name() -> String:
	return "mock"


func is_steam_deck() -> bool:
	return deck


func get_user_display_name() -> String:
	return display_name


func get_cloud_save_dir() -> String:
	return "user://test_saves"


func unlock_achievement(achievement_id: String) -> void:
	unlocked[achievement_id] = true
	calls.append({"m": "unlock", "id": achievement_id})


func is_achievement_unlocked(achievement_id: String) -> bool:
	return unlocked.get(achievement_id, false)


func set_stat_int(stat_id: String, value: int) -> void:
	calls.append({"m": "stat_int", "id": stat_id, "v": value})


func set_stat_float(stat_id: String, value: float) -> void:
	calls.append({"m": "stat_float", "id": stat_id, "v": value})
