extends CanvasLayer
## In-contract heads-up display. Shows targets loaded, instability, stamina,
## the nearest object's emotion, an emote/calm wheel, and objective status.
## Built in code and driven by EventBus signals; respects accessibility toggles.

var _targets_label: Label
var _instability_bar: ProgressBar
var _instability_label: Label
var _emotion_label: Label
var _objectives_box: VBoxContainer
var _center_dot: Panel
var _wheel: Control

var _player: PlayerController
var _loaded: int = 0
var _total: int = 0


func setup(player: PlayerController, total_targets: int) -> void:
	_player = player
	_total = total_targets
	_build()
	_refresh_targets()


func _build() -> void:
	var root := MarginContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("margin_left", 24)
	root.add_theme_constant_override("margin_top", 18)
	root.add_theme_constant_override("margin_right", 24)
	root.add_theme_constant_override("margin_bottom", 18)
	add_child(root)

	# Top-left: targets + instability.
	var top_left := VBoxContainer.new()
	top_left.set_anchors_preset(Control.PRESET_TOP_LEFT)
	root.add_child(top_left)
	_targets_label = Label.new()
	_targets_label.add_theme_font_size_override("font_size", 22)
	top_left.add_child(_targets_label)

	_instability_label = Label.new()
	top_left.add_child(_instability_label)
	_instability_bar = ProgressBar.new()
	_instability_bar.custom_minimum_size = Vector2(240, 18)
	_instability_bar.max_value = 1.0
	_instability_bar.show_percentage = false
	top_left.add_child(_instability_bar)

	_emotion_label = Label.new()
	_emotion_label.add_theme_font_size_override("font_size", 16)
	top_left.add_child(_emotion_label)

	# Objectives (top-right).
	_objectives_box = VBoxContainer.new()
	_objectives_box.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_objectives_box.alignment = BoxContainer.ALIGNMENT_BEGIN
	root.add_child(_objectives_box)

	# Center dot (accessibility).
	if bool(Settings.get_value("accessibility", "center_dot")):
		_center_dot = Panel.new()
		_center_dot.custom_minimum_size = Vector2(6, 6)
		_center_dot.set_anchors_preset(Control.PRESET_CENTER)
		add_child(_center_dot)

	# Emote / calm wheel (hidden until held).
	_wheel = _build_wheel()
	add_child(_wheel)
	_wheel.visible = false

	# Signals.
	EventBus.furniture_loaded_into_van.connect(_on_loaded)
	EventBus.instability_changed.connect(_on_instability)
	EventBus.furniture_emotion_changed.connect(_on_emotion)


func _build_wheel() -> Control:
	var c := CenterContainer.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	var panel := PanelContainer.new()
	c.add_child(panel)
	var grid := GridContainer.new()
	grid.columns = 4
	panel.add_child(grid)
	var actions := [
		["comfort", "ACTION_COMFORT"], ["scold", "ACTION_SCOLD"],
		["applaud", "ACTION_APPLAUD"], ["knock", "ACTION_KNOCK"],
	]
	for a in actions:
		var b := Button.new()
		b.text = Loc.t(a[1])
		var action_id: String = a[0]
		b.pressed.connect(func() -> void:
			if _player != null:
				_player.do_calm_action(action_id)
			_toggle_wheel(false)
		)
		grid.add_child(b)
	return c


func _process(_delta: float) -> void:
	if Input.is_action_just_pressed("emote_wheel"):
		_toggle_wheel(not _wheel.visible)


func _toggle_wheel(show: bool) -> void:
	_wheel.visible = show
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if show else Input.MOUSE_MODE_CAPTURED


func set_objectives(objectives: Array) -> void:
	for c in _objectives_box.get_children():
		c.queue_free()
	for o in objectives:
		var l := Label.new()
		var prefix := "○ "
		if not bool(o.get("optional", false)):
			prefix = "★ "
		l.text = prefix + Loc.t(str(o.get("name_key", "")))
		l.name = "obj_" + str(o.get("id", ""))
		_objectives_box.add_child(l)


func mark_objective(objective_id: String, complete: bool) -> void:
	var node := _objectives_box.get_node_or_null("obj_" + objective_id)
	if node is Label:
		(node as Label).modulate = Color(0.5, 1, 0.5) if complete else Color(1, 0.5, 0.5)


func _on_loaded(_id: String) -> void:
	_loaded += 1
	_refresh_targets()


func _refresh_targets() -> void:
	_targets_label.text = Loc.t("HUD_TARGETS_LOADED", {"loaded": _loaded, "total": _total})


func _on_instability(points: float, level: int) -> void:
	_instability_bar.value = InstabilitySystem.normalized(points)
	_instability_label.text = "%s: %s" % [Loc.t("HUD_INSTABILITY"), InstabilitySystem.level_name(level)]


func _on_emotion(_fid: String, emotion: int, _arousal: float) -> void:
	_emotion_label.text = Emotions.display_name(emotion)
