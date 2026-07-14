extends Control
## Settings screen. Builds controls in code from the Settings schema and binds
## every control to the Settings autoload, so changes apply and persist
## immediately. Controller/keyboard navigable. No placeholder toggles.

const OPTION_LABELS: Dictionary = {
	"display/mode": ["Windowed", "Borderless", "Fullscreen"],
	"display/shadows": ["Off", "Low", "High"],
	"display/particles": ["Off", "Low", "High"],
	"gameplay/camera_mode": ["First Person", "Third Person"],
	"accessibility/colorblind_mode": ["None", "Protanopia", "Deuteranopia", "Tritanopia"],
}

## Section -> ordered list of (key, loc_key, control_type)
const SCHEMA: Dictionary = {
	"display": [
		["mode", "SETTINGS_DISPLAY", "option"],
		["vsync", "V-Sync", "bool"],
		["shadows", "Shadows", "option"],
		["particles", "Particles", "option"],
		["post_processing", "Post Processing", "bool"],
		["film_grain", "Film Grain", "bool"],
	],
	"audio": [
		["master", "SETTINGS_MASTER_VOL", "slider"],
		["music", "SETTINGS_MUSIC_VOL", "slider"],
		["sfx", "SETTINGS_SFX_VOL", "slider"],
		["ambience", "Ambience Volume", "slider"],
		["dialogue", "Dialogue Volume", "slider"],
		["mono", "Mono Audio", "bool"],
		["play_in_background", "Play In Background", "bool"],
	],
	"gameplay": [
		["camera_mode", "Camera", "option"],
		["fov", "SETTINGS_FOV", "slider_fov"],
		["sensitivity_x", "Sensitivity X", "slider_sens"],
		["sensitivity_y", "Sensitivity Y", "slider_sens"],
		["invert_y", "Invert Y", "bool"],
		["sprint_toggle", "Sprint Toggle", "bool"],
		["crouch_toggle", "Crouch Toggle", "bool"],
	],
	"accessibility": [
		["reduced_motion", "ACC_REDUCED_MOTION", "bool"],
		["head_bob", "Head Bob", "bool"],
		["screen_shake", "ACC_SCREEN_SHAKE", "bool"],
		["flashing", "ACC_FLASHING", "bool"],
		["reduced_scare", "ACC_REDUCED_SCARE", "bool"],
		["physics_assist", "ACC_PHYSICS_ASSIST", "bool"],
		["simplified_grab", "Simplified Grabbing", "bool"],
		["auto_hold", "Auto-Hold", "bool"],
		["one_button_carry", "One-Button Two-Hand Carry", "bool"],
		["subtitles", "ACC_SUBTITLES", "bool"],
		["speaker_labels", "Speaker Labels", "bool"],
		["closed_captions", "Closed Captions", "bool"],
		["high_contrast", "High Contrast", "bool"],
		["colorblind_mode", "Colorblind Mode", "option"],
		["center_dot", "Center Dot", "bool"],
		["font_scale", "ACC_FONT_SCALE", "slider_scale"],
		["ui_scale", "UI Scale", "slider_scale"],
		["pause_in_solo", "Pause In Solo", "bool"],
	],
}

@onready var _tabs: TabContainer = $Margin/VBox/Tabs
@onready var _back: Button = $Margin/VBox/Back


func _ready() -> void:
	_back.text = Loc.t("MENU_BACK")
	_back.pressed.connect(_on_back)
	for section in SCHEMA.keys():
		_build_section(section)
	_build_language_tab()
	_build_controls_tab()
	_back.grab_focus()


func _build_section(section: String) -> void:
	var scroll := ScrollContainer.new()
	scroll.name = _section_title(section)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var vb := VBoxContainer.new()
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.add_theme_constant_override("separation", 6)
	scroll.add_child(vb)
	_tabs.add_child(scroll)
	for entry in SCHEMA[section]:
		_add_row(vb, section, entry[0], entry[1], entry[2])


func _add_row(parent: VBoxContainer, section: String, key: String, label_key: String, ctype: String) -> void:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(560, 0)
	var label := Label.new()
	label.text = _maybe_loc(label_key)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	var value: Variant = Settings.get_value(section, key)
	match ctype:
		"bool":
			var cb := CheckButton.new()
			cb.button_pressed = bool(value)
			cb.toggled.connect(func(v: bool) -> void: Settings.set_value(section, key, v))
			row.add_child(cb)
		"slider":
			row.add_child(_make_slider(section, key, 0.0, 1.0, 0.05, float(value)))
		"slider_fov":
			row.add_child(_make_slider(section, key, 60.0, 110.0, 1.0, float(value)))
		"slider_sens":
			row.add_child(_make_slider(section, key, 0.1, 3.0, 0.05, float(value)))
		"slider_scale":
			row.add_child(_make_slider(section, key, 0.8, 1.6, 0.05, float(value)))
		"option":
			row.add_child(_make_option(section, key, int(value)))
	parent.add_child(row)


func _make_slider(section: String, key: String, mn: float, mx: float, step: float, value: float) -> Control:
	var box := HBoxContainer.new()
	var slider := HSlider.new()
	slider.min_value = mn
	slider.max_value = mx
	slider.step = step
	slider.value = value
	slider.custom_minimum_size = Vector2(220, 0)
	var readout := Label.new()
	readout.custom_minimum_size = Vector2(52, 0)
	readout.text = "%.2f" % value
	slider.value_changed.connect(func(v: float) -> void:
		readout.text = "%.2f" % v
		Settings.set_value(section, key, v)
	)
	box.add_child(slider)
	box.add_child(readout)
	return box


func _make_option(section: String, key: String, value: int) -> OptionButton:
	var ob := OptionButton.new()
	var labels: Array = OPTION_LABELS.get("%s/%s" % [section, key], [])
	for i in range(labels.size()):
		ob.add_item(str(labels[i]), i)
	ob.selected = clampi(value, 0, maxi(0, labels.size() - 1))
	ob.item_selected.connect(func(idx: int) -> void: Settings.set_value(section, key, idx))
	return ob


func _build_language_tab() -> void:
	var vb := VBoxContainer.new()
	vb.name = Loc.t("SETTINGS_LANGUAGE")
	vb.add_theme_constant_override("separation", 8)
	_tabs.add_child(vb)
	var ob := OptionButton.new()
	ob.add_item("Auto (System)", 0)
	var locales := Loc.get_supported_locales()
	for i in range(locales.size()):
		ob.add_item(locales[i], i + 1)
	var current := str(Settings.get_value("locale", "language"))
	if current == "auto":
		ob.selected = 0
	else:
		ob.selected = maxi(0, locales.find(current) + 1)
	ob.item_selected.connect(func(idx: int) -> void:
		var lang := "auto" if idx == 0 else locales[idx - 1]
		Settings.set_value("locale", "language", lang)
	)
	vb.add_child(ob)
	var pseudo := CheckButton.new()
	pseudo.text = "Pseudo-localization (layout test)"
	pseudo.button_pressed = bool(Settings.get_value("locale", "pseudo_localize"))
	pseudo.toggled.connect(func(v: bool) -> void: Settings.set_value("locale", "pseudo_localize", v))
	vb.add_child(pseudo)
	# Completeness readout for QA.
	var comp := Loc.completeness()
	var lbl := Label.new()
	var parts: Array[String] = []
	for loc in comp.keys():
		parts.append("%s %d%%" % [loc, int(comp[loc] * 100.0)])
	lbl.text = "Translation completeness:\n" + ", ".join(parts)
	vb.add_child(lbl)


func _build_controls_tab() -> void:
	var vb := VBoxContainer.new()
	vb.name = Loc.t("SETTINGS_CONTROLS")
	vb.add_theme_constant_override("separation", 6)
	_tabs.add_child(vb)
	var info := Label.new()
	info.text = "Rebindable actions (click a row, then press a key):"
	vb.add_child(info)
	var actions := [
		"move_forward", "move_back", "move_left", "move_right", "sprint",
		"crouch", "jump", "interact", "grab_left", "grab_right", "rotate_mod",
		"ping", "emote_wheel", "use_tool", "photo", "pause",
	]
	for action in actions:
		vb.add_child(_make_rebind_row(action))


func _make_rebind_row(action: String) -> Control:
	var row := HBoxContainer.new()
	var label := Label.new()
	label.text = action
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	var btn := Button.new()
	btn.text = _binding_text(action)
	btn.custom_minimum_size = Vector2(200, 0)
	btn.pressed.connect(func() -> void:
		btn.text = "Press a key..."
		InputRebinder.start_rebind(action, func() -> void:
			btn.text = _binding_text(action)
		)
	)
	row.add_child(btn)
	return row


func _binding_text(action: String) -> String:
	return InputRebinder.binding_label(action)


func _maybe_loc(key: String) -> String:
	# Some labels are raw English (no key yet); localized keys are UPPER_SNAKE.
	if key == key.to_upper() and key.find(" ") == -1:
		return Loc.t(key)
	return key


func _section_title(section: String) -> String:
	match section:
		"display": return Loc.t("SETTINGS_DISPLAY")
		"audio": return Loc.t("SETTINGS_AUDIO")
		"gameplay": return Loc.t("SETTINGS_GAMEPLAY")
		"accessibility": return Loc.t("SETTINGS_ACCESSIBILITY")
	return section.capitalize()


func _on_back() -> void:
	Settings.save_settings()
	get_tree().change_scene_to_file("res://game/ui/screens/main_menu.tscn")
