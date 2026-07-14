extends Node
## CLI content validator. Verifies content resources cross-reference correctly
## and meet the declared 1.0 minimums. Exits 0 on success, 1 on failure.
##
## Run: godot --headless --path . tools/validate_content.tscn

const MINIMUMS: Dictionary = {
	"furniture": 20, "traits": 60, "equipment": 30, "achievements": 40,
	"cosmetics": 80, "modifiers": 50, "locations": 8,
}


func _ready() -> void:
	await get_tree().process_frame
	var report: Dictionary = ContentDB.validate()
	var counts: Dictionary = report["counts"]
	var ok := bool(report["ok"])

	print("=== CONTENT VALIDATION ===")
	for key in MINIMUMS.keys():
		var have := int(counts.get(key, 0))
		var need := int(MINIMUMS[key])
		var pass_min := have >= need
		if not pass_min:
			ok = false
		print("  %-14s %d (min %d) %s" % [key, have, need, "OK" if pass_min else "TOO FEW"])

	for e in report["errors"]:
		print("  ERROR: %s" % e)
	for w in report["warnings"]:
		print("  warn:  %s" % w)

	print("RESULT: %s" % ("PASS" if ok else "FAIL"))
	get_tree().quit(0 if ok else 1)
