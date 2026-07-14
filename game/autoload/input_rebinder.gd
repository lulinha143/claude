extends Node
## Input rebinding + serialization (autoload "InputRebinder").
##
## Persists custom bindings to user://input.cfg (separate from settings). Capture
## works for keyboard, mouse and joypad. Serialization is a pure dictionary form
## so it can be unit-tested without a scene tree.

const PATH: String = "user://input.cfg"

## Actions the player is allowed to rebind (excludes internal ui_* actions).
const REBINDABLE: Array[String] = [
	"move_forward", "move_back", "move_left", "move_right", "sprint", "crouch",
	"jump", "interact", "grab_left", "grab_right", "rotate_mod", "ping",
	"emote_wheel", "use_tool", "photo", "pause",
]

var _capturing_action: String = ""
var _capture_done: Callable = Callable()


func _ready() -> void:
	load_bindings()


func start_rebind(action: String, on_done: Callable) -> void:
	if not InputMap.has_action(action):
		return
	_capturing_action = action
	_capture_done = on_done
	set_process_input(true)


func _input(event: InputEvent) -> void:
	if _capturing_action.is_empty():
		return
	var valid: bool = false
	if event is InputEventKey and (event as InputEventKey).pressed:
		valid = true
	elif event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		valid = true
	elif event is InputEventJoypadButton and (event as InputEventJoypadButton).pressed:
		valid = true
	if not valid:
		return
	InputMap.action_erase_events(_capturing_action)
	InputMap.action_add_event(_capturing_action, event)
	save_bindings()
	var done := _capture_done
	_capturing_action = ""
	_capture_done = Callable()
	set_process_input(false)
	get_viewport().set_input_as_handled()
	if done.is_valid():
		done.call()


func binding_label(action: String) -> String:
	if not InputMap.has_action(action):
		return "—"
	var events := InputMap.action_get_events(action)
	if events.is_empty():
		return "—"
	return events[0].as_text()


# --- Serialization (pure, unit-testable) -----------------------------------
## Serializes all rebindable actions to a plain dictionary.
func serialize() -> Dictionary:
	var out: Dictionary = {}
	for action in REBINDABLE:
		if not InputMap.has_action(action):
			continue
		var arr: Array = []
		for ev in InputMap.action_get_events(action):
			var entry := _event_to_dict(ev)
			if not entry.is_empty():
				arr.append(entry)
		out[action] = arr
	return out


## Applies a serialized dictionary onto the InputMap.
func deserialize(data: Dictionary) -> void:
	for action in data.keys():
		if not InputMap.has_action(action):
			continue
		InputMap.action_erase_events(action)
		for entry in data[action]:
			var ev := _dict_to_event(entry)
			if ev != null:
				InputMap.action_add_event(action, ev)


func save_bindings() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(serialize(), "\t"))
	f.close()


func load_bindings() -> void:
	if not FileAccess.file_exists(PATH):
		return
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		return
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	f.close()
	if parsed is Dictionary:
		deserialize(parsed)


func reset_to_defaults() -> void:
	if FileAccess.file_exists(PATH):
		DirAccess.remove_absolute(PATH)
	# Reload project defaults from ProjectSettings.
	InputMap.load_from_project_settings()


func _event_to_dict(ev: InputEvent) -> Dictionary:
	if ev is InputEventKey:
		return {"t": "key", "code": ev.physical_keycode, "keycode": ev.keycode}
	if ev is InputEventMouseButton:
		return {"t": "mouse", "button": ev.button_index}
	if ev is InputEventJoypadButton:
		return {"t": "joy", "button": ev.button_index}
	return {}


func _dict_to_event(d: Dictionary) -> InputEvent:
	match str(d.get("t", "")):
		"key":
			var k := InputEventKey.new()
			k.physical_keycode = int(d.get("code", 0))
			k.keycode = int(d.get("keycode", 0))
			return k
		"mouse":
			var m := InputEventMouseButton.new()
			m.button_index = int(d.get("button", 1))
			return m
		"joy":
			var j := InputEventJoypadButton.new()
			j.button_index = int(d.get("button", 0))
			return j
	return null
