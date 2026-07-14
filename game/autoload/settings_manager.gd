extends Node
## Settings & accessibility manager (autoload "Settings").
##
## Stored SEPARATELY from progression (see SaveManager) in user://settings.cfg,
## so wiping a company profile never touches accessibility preferences, and vice
## versa. All values are typed and validated on load. Emits EventBus.settings_changed.

const SETTINGS_PATH: String = "user://settings.cfg"

## Default values. Every key here is guaranteed to exist after load().
const DEFAULTS: Dictionary = {
	"display": {
		"mode": 0,               # 0 windowed, 1 borderless, 2 fullscreen
		"resolution_x": 1280,
		"resolution_y": 720,
		"vsync": true,
		"max_fps": 0,            # 0 = uncapped
		"render_scale": 1.0,
		"shadows": 2,            # 0 off,1 low,2 high
		"particles": 2,
		"post_processing": true,
		"film_grain": true,
	},
	"audio": {
		"master": 1.0,
		"music": 0.8,
		"sfx": 0.9,
		"ambience": 0.7,
		"dialogue": 1.0,
		"mono": false,
		"play_in_background": false,
	},
	"gameplay": {
		"camera_mode": 0,        # 0 first-person, 1 third-person
		"fov": 75.0,
		"sensitivity_x": 1.0,
		"sensitivity_y": 1.0,
		"invert_y": false,
		"sprint_toggle": false,
		"crouch_toggle": false,
	},
	"accessibility": {
		"reduced_motion": false,
		"head_bob": true,
		"screen_shake": true,
		"flashing": true,
		"reduced_scare": false,
		"physics_assist": false,
		"simplified_grab": false,
		"auto_hold": false,
		"one_button_carry": false,
		"subtitles": true,
		"speaker_labels": true,
		"closed_captions": true,
		"font_scale": 1.0,
		"ui_scale": 1.0,
		"high_contrast": false,
		"colorblind_mode": 0,    # 0 none,1 protanopia,2 deuteranopia,3 tritanopia
		"center_dot": false,
		"pause_in_solo": true,
	},
	"locale": {
		"language": "auto",      # "auto" = system detection
		"pseudo_localize": false,
	},
	"content": {
		"streamer_mode": false,
		"streamer_safe_names": false,
	},
}

var _data: Dictionary = {}


func _ready() -> void:
	load_settings()


func load_settings() -> void:
	_data = _deep_duplicate(DEFAULTS)
	var cfg := ConfigFile.new()
	var err := cfg.load(SETTINGS_PATH)
	if err == OK:
		for section in DEFAULTS.keys():
			for key in DEFAULTS[section].keys():
				var default_val: Variant = DEFAULTS[section][key]
				var loaded: Variant = cfg.get_value(section, key, default_val)
				_data[section][key] = _coerce(loaded, default_val)
	else:
		Log.info("Settings", "No settings file; using defaults.")
	apply_all()


func save_settings() -> void:
	var cfg := ConfigFile.new()
	for section in _data.keys():
		for key in _data[section].keys():
			cfg.set_value(section, key, _data[section][key])
	var err := cfg.save(SETTINGS_PATH)
	if err != OK:
		Log.warn("Settings", "Failed to save settings (err %d)" % err)


func get_value(section: String, key: String) -> Variant:
	if _data.has(section) and _data[section].has(key):
		return _data[section][key]
	Log.warn("Settings", "Missing setting %s/%s" % [section, key])
	return null


func set_value(section: String, key: String, value: Variant) -> void:
	if not _data.has(section):
		_data[section] = {}
	_data[section][key] = value
	save_settings()
	_apply_section(section)
	EventBus.settings_changed.emit(section)


func apply_all() -> void:
	for section in _data.keys():
		_apply_section(section)


func _apply_section(section: String) -> void:
	match section:
		"display":
			_apply_display()
		"audio":
			_apply_audio()
		"locale":
			# Localization autoload listens to settings_changed and reacts.
			pass


func _apply_display() -> void:
	var d: Dictionary = _data["display"]
	var win := get_window()
	if win == null:
		return
	match int(d["mode"]):
		0: win.mode = Window.MODE_WINDOWED
		1:
			win.mode = Window.MODE_WINDOWED
			win.borderless = true
		2: win.mode = Window.MODE_FULLSCREEN
	var vsync: bool = d["vsync"]
	DisplayServer.window_set_vsync_mode(
		DisplayServer.VSYNC_ENABLED if vsync else DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = int(d["max_fps"])


func _apply_audio() -> void:
	var a: Dictionary = _data["audio"]
	_set_bus_volume("Master", a["master"])
	_set_bus_volume("Music", a["music"])
	_set_bus_volume("SFX", a["sfx"])
	_set_bus_volume("Ambience", a["ambience"])
	_set_bus_volume("Dialogue", a["dialogue"])


func _set_bus_volume(bus_name: String, linear: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx < 0:
		return
	AudioServer.set_bus_volume_db(idx, linear_to_db(clampf(linear, 0.0, 1.0)))


# --- Helpers ---------------------------------------------------------------
func _coerce(value: Variant, like: Variant) -> Variant:
	# Guards against corrupted/invalid settings values.
	if typeof(value) == typeof(like):
		return value
	if like is float and (value is int or value is float):
		return float(value)
	if like is int and (value is int or value is float):
		return int(value)
	if like is bool:
		return bool(value)
	return like


func _deep_duplicate(src: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for k in src.keys():
		if src[k] is Dictionary:
			out[k] = _deep_duplicate(src[k])
		else:
			out[k] = src[k]
	return out
