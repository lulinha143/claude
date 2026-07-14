extends Node
## Structured logging service (autoload singleton "Log").
##
## Provides levelled, category-tagged logging with an in-memory ring buffer that
## powers the developer overlay and incident-report debugging. Never blocks the
## main thread and never writes to disk per-frame (flushes are opt-in / bounded).

enum Level { DEBUG, INFO, WARN, ERROR }

## Maximum number of retained log entries (bounded history for performance).
const MAX_HISTORY: int = 512

## Minimum level that is actually emitted. Raised in release builds.
var min_level: int = Level.DEBUG

var _history: Array[Dictionary] = []

signal entry_added(entry: Dictionary)


func _ready() -> void:
	# Release builds are quieter by default; --verbose restores DEBUG.
	if not OS.is_debug_build() and not OS.has_feature("verbose_logs"):
		min_level = Level.INFO
	info("Log", "Logging service initialised (min_level=%s)" % _level_name(min_level))


func debug(category: String, message: String) -> void:
	_emit(Level.DEBUG, category, message)


func info(category: String, message: String) -> void:
	_emit(Level.INFO, category, message)


func warn(category: String, message: String) -> void:
	_emit(Level.WARN, category, message)


func error(category: String, message: String) -> void:
	_emit(Level.ERROR, category, message)


## Returns a shallow copy of the retained log history for the dev overlay.
func get_history() -> Array[Dictionary]:
	return _history.duplicate()


func _emit(level: int, category: String, message: String) -> void:
	if level < min_level:
		return
	var entry := {
		"t": Time.get_ticks_msec(),
		"level": level,
		"category": category,
		"message": message,
	}
	_history.append(entry)
	if _history.size() > MAX_HISTORY:
		_history.pop_front()

	var line := "[%s] %s: %s" % [_level_name(level), category, message]
	match level:
		Level.ERROR:
			push_error(line)
		Level.WARN:
			push_warning(line)
		_:
			print(line)
	entry_added.emit(entry)


func _level_name(level: int) -> String:
	match level:
		Level.DEBUG: return "DEBUG"
		Level.INFO: return "INFO"
		Level.WARN: return "WARN"
		Level.ERROR: return "ERROR"
	return "?"
