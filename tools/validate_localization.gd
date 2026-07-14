extends Node
## CLI localization validator. Confirms English and Brazilian Portuguese are
## fully authored and reports completeness for every other locale. Exits 0 if
## the required locales are complete, 1 otherwise.
##
## Run: godot --headless --path . tools/validate_localization.tscn

const REQUIRED_COMPLETE: Array[String] = ["en", "pt_BR"]


func _ready() -> void:
	await get_tree().process_frame
	var comp: Dictionary = Loc.completeness()
	var ok := true
	print("=== LOCALIZATION VALIDATION ===")
	for locale in comp.keys():
		var pct := int(float(comp[locale]) * 100.0)
		var required: bool = str(locale) in REQUIRED_COMPLETE
		if required and pct < 100:
			ok = false
		print("  %-6s %3d%%%s" % [str(locale), pct, "  (required)" if required else ""])
	print("RESULT: %s" % ("PASS" if ok else "FAIL"))
	get_tree().quit(0 if ok else 1)
