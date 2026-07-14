class_name IncidentReport
extends RefCounted
## Generates the post-contract incident report: a mix of tallied facts and
## randomly-selected comedic lines drawn from ContentDB. Deterministic when a
## seed is supplied so the same run yields the same jokes (nice for clips).

## `run` is the raw result dictionary assembled by ContractRunner.
static func generate(run: Dictionary, seed_value: int = 0) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value if seed_value != 0 else int(Time.get_unix_time_from_system())

	var success: bool = run.get("success", false)
	var report := {
		"success": success,
		"result_key": _result_key(run),
		"title": _pick(rng, ContentDB.incident_lines("titles")),
		"delivered": run.get("delivered", 0),
		"total_targets": run.get("total_targets", 0),
		"damage_line": _pick(rng, ContentDB.incident_lines("damage")) if run.get("damage_events", 0) > 0 else "No structural surprises.",
		"funny_line": _fill(_pick(rng, ContentDB.incident_lines("funny")), run),
		"insurance_line": _pick(rng, ContentDB.incident_lines("insurance")),
		"commendation": _pick(rng, ContentDB.incident_lines("commendation")),
		"mistake": _pick(rng, ContentDB.incident_lines("mistake")) if run.get("damage_events", 0) > 0 else "No expensive mistakes today.",
		"rescues": run.get("rescues", 0),
		"rescue_line": _fill(_pick(rng, ContentDB.incident_lines("rescue")), run) if run.get("rescues", 0) > 0 else "",
		"payout": run.get("payout", 0),
		"optional_completed": run.get("optional_completed", 0),
		"optional_total": run.get("optional_total", 0),
		"seed_string": run.get("seed_string", ""),
	}
	return report


static func _result_key(run: Dictionary) -> String:
	if run.get("abandoned", false):
		return "RESULT_ABANDONED"
	return "RESULT_SUCCESS" if run.get("success", false) else "RESULT_FAILED"


static func _pick(rng: RandomNumberGenerator, arr: Array) -> String:
	if arr.is_empty():
		return ""
	return str(arr[rng.randi_range(0, arr.size() - 1)])


static func _fill(line: String, run: Dictionary) -> String:
	var name := str(run.get("highlight_player", "An employee"))
	return line.replace("{name}", name)
