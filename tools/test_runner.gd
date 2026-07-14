extends Node
## Headless test runner. Discovers every `test/**/test_*.gd`, runs their test_*
## methods, prints a summary, and quits with code 0 (pass) or 1 (fail).
##
## Run:  godot --headless --path . tools/test_runner.tscn
## (or)  make test

const DIRS: Array[String] = ["res://test/unit", "res://test/integration"]


func _ready() -> void:
	# Give autoloads a frame to finish initialising.
	await get_tree().process_frame
	await get_tree().process_frame
	var total := 0
	var failed := 0
	var all_failures: Array[String] = []
	for dir_path in DIRS:
		for file in _list_tests(dir_path):
			var script: GDScript = load(file)
			if script == null:
				continue
			var instance: Object = script.new()
			if not (instance is HBTest):
				continue
			var failures: Array = (instance as HBTest).run()
			total += 1
			if failures.is_empty():
				print("  PASS  %s" % file.get_file())
			else:
				failed += 1
				print("  FAIL  %s" % file.get_file())
				for f in failures:
					print("        - %s" % f)
					all_failures.append(f)

	print("\n=== TEST SUMMARY ===")
	print("Files: %d   Failed files: %d   Assertion failures: %d" % [total, failed, all_failures.size()])
	if failed == 0:
		print("RESULT: ALL TESTS PASSED")
		get_tree().quit(0)
	else:
		print("RESULT: FAILURES DETECTED")
		get_tree().quit(1)


func _list_tests(dir_path: String) -> Array[String]:
	var out: Array[String] = []
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return out
	dir.list_dir_begin()
	var f := dir.get_next()
	while f != "":
		if f.begins_with("test_") and f.ends_with(".gd"):
			out.append(dir_path + "/" + f)
		f = dir.get_next()
	dir.list_dir_end()
	out.sort()
	return out
