class_name HBTest
extends RefCounted
## Minimal, dependency-free test-case base. Test files extend this and define
## methods named `test_*`. Assertions record failures rather than aborting so a
## single test method reports all problems. Run via tools/test_runner.gd.

var _failures: Array[String] = []
var _current: String = ""


func _fail(msg: String) -> void:
	_failures.append("[%s] %s" % [_current, msg])


func check(condition: bool, msg: String = "condition was false") -> void:
	if not condition:
		_fail(msg)


func eq(a: Variant, b: Variant, msg: String = "") -> void:
	if a != b:
		_fail("%s (expected %s == %s)" % [msg, str(a), str(b)])


func ne(a: Variant, b: Variant, msg: String = "") -> void:
	if a == b:
		_fail("%s (expected %s != %s)" % [msg, str(a), str(b)])


func almost(a: float, b: float, tol: float = 0.001, msg: String = "") -> void:
	if absf(a - b) > tol:
		_fail("%s (expected %f ~= %f)" % [msg, a, b])


func gt(a: float, b: float, msg: String = "") -> void:
	if not (a > b):
		_fail("%s (expected %f > %f)" % [msg, a, b])


## Optional setup/teardown hooks.
func setup() -> void:
	pass


func teardown() -> void:
	pass


## Runs all test_* methods; returns array of failure strings.
func run() -> Array[String]:
	_failures.clear()
	for m in get_method_list():
		var n: String = m["name"]
		if n.begins_with("test_") and int(m.get("args", []).size()) == 0:
			_current = n
			setup()
			call(n)
			teardown()
	return _failures
