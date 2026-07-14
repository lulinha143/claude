extends CanvasLayer
## In-contract HUD. Clean, non-overlapping, contextual layout that reads like a
## commercial game: a top-left status stack, a top-right objectives card, a
## bottom carry panel that only appears while carrying, and a contextual
## interaction prompt. No overlapping text, no broken glyph icons.

var _root: Control
var _targets_label: Label
var _instability_label: Label
var _instability_bar: ProgressBar
var _objectives_box: VBoxContainer
var _carry_panel: PanelContainer
var _carry_name: Label
var _carry_emotion: Label
var _carry_carriers: Label
var _prompt: Label
var _wheel: Control

var _player: PlayerController
var _loaded: int = 0
var _total: int = 0


func setup(player: PlayerController, total_targets: int) -> void:
	_player = player
	_total = total_targets
	_build()
	_refresh_targets()


func _panel_style(bg: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(10)
	s.set_content_margin_all(12)
	s.border_color = Color(1.0, 0.6, 0.25, 0.5)
	s.set_border_width_all(2)
	return s


func _build() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	# --- Top-left status card ---
	var tl := PanelContainer.new()
	tl.add_theme_stylebox_override("panel", _panel_style(Color(0.08, 0.07, 0.12, 0.72)))
	tl.position = Vector2(24, 20)
	tl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(tl)
	var tlv := VBoxContainer.new()
	tlv.add_theme_constant_override("separation", 4)
	tl.add_child(tlv)
	_targets_label = _mklabel(tlv, "", 24, Color(1, 0.95, 0.8))
	_instability_label = _mklabel(tlv, "", 15, Color(0.85, 0.85, 0.95))
	_instability_bar = ProgressBar.new()
	_instability_bar.custom_minimum_size = Vector2(230, 14)
	_instability_bar.max_value = 1.0
	_instability_bar.show_percentage = false
	tlv.add_child(_instability_bar)

	# --- Top-right objectives card ---
	var tr := PanelContainer.new()
	tr.add_theme_stylebox_override("panel", _panel_style(Color(0.08, 0.07, 0.12, 0.72)))
	tr.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	tr.position = Vector2(-24, 20)
	tr.offset_right = -24
	tr.offset_left = -360
	tr.offset_top = 20
	tr.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(tr)
	_objectives_box = VBoxContainer.new()
	_objectives_box.add_theme_constant_override("separation", 4)
	tr.add_child(_objectives_box)
	_mklabel(_objectives_box, "CONTRACT", 14, Color(1, 0.6, 0.25))

	# --- Bottom carry panel (hidden until carrying) ---
	_carry_panel = PanelContainer.new()
	_carry_panel.add_theme_stylebox_override("panel", _panel_style(Color(0.10, 0.09, 0.14, 0.85)))
	_carry_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_carry_panel.position = Vector2(0, -110)
	_carry_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_carry_panel.visible = false
	_carry_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_carry_panel)
	var cv := VBoxContainer.new()
	cv.alignment = BoxContainer.ALIGNMENT_CENTER
	_carry_panel.add_child(cv)
	_carry_name = _mklabel(cv, "", 20, Color(1, 0.95, 0.85))
	_carry_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_carry_emotion = _mklabel(cv, "", 16, Color(0.9, 0.8, 1.0))
	_carry_emotion.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_carry_carriers = _mklabel(cv, "", 14, Color(0.8, 0.9, 0.8))
	_carry_carriers.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	# --- Contextual interaction prompt (bottom center) ---
	_prompt = Label.new()
	_prompt.add_theme_font_size_override("font_size", 18)
	_prompt.add_theme_color_override("font_color", Color(1, 1, 1))
	_prompt.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	_prompt.add_theme_constant_override("outline_size", 6)
	_prompt.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_prompt.position = Vector2(0, -56)
	_prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_prompt)

	_wheel = _build_wheel()
	add_child(_wheel)
	_wheel.visible = false

	EventBus.furniture_loaded_into_van.connect(_on_loaded)
	EventBus.instability_changed.connect(_on_instability)
	_on_instability(0.0, 0)


func _mklabel(parent: Node, text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	parent.add_child(l)
	return l


func _build_wheel() -> Control:
	var c := CenterContainer.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(Color(0.1, 0.09, 0.14, 0.95)))
	c.add_child(panel)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	panel.add_child(grid)
	var actions := [
		["comfort", "ACTION_COMFORT"], ["scold", "ACTION_SCOLD"],
		["applaud", "ACTION_APPLAUD"], ["knock", "ACTION_KNOCK"],
	]
	for a in actions:
		var b := Button.new()
		b.text = Loc.t(a[1])
		b.custom_minimum_size = Vector2(160, 48)
		var action_id: String = a[0]
		b.pressed.connect(func() -> void:
			if _player != null:
				_player.do_calm_action(action_id)
			_toggle_wheel(false))
		grid.add_child(b)
	return c


func _process(_delta: float) -> void:
	if Input.is_action_just_pressed("emote_wheel"):
		_toggle_wheel(not _wheel.visible)
	_update_context()


func _update_context() -> void:
	if _player == null or not is_instance_valid(_player):
		return
	# Carry panel.
	var carry := _player.carried_summary()
	if carry.is_empty():
		_carry_panel.visible = false
	else:
		_carry_panel.visible = true
		_carry_name.text = str(carry.get("name", ""))
		_carry_emotion.text = str(carry.get("emotion", ""))
		var need := int(carry.get("carriers", 1))
		var have := int(carry.get("have", 1))
		_carry_carriers.text = "Carriers: %d / %d%s" % [have, need,
			"  (needs help!)" if have < need else ""]
		_carry_carriers.modulate = Color(1, 0.7, 0.5) if have < need else Color(0.8, 1, 0.8)

	# Interaction prompt.
	var txt := ""
	if not carry.is_empty():
		txt = "%s Drop   •   %s Emote" % [_key("grab_left"), _key("emote_wheel")]
	else:
		var aim := _player.aimed_furniture()
		if aim != null:
			txt = "%s Grab %s" % [_key("grab_left"), aim.display_name()]
		else:
			txt = "%s Interact   •   %s Ping" % [_key("interact"), _key("ping")]
	_prompt.text = txt


func _key(action: String) -> String:
	return "[%s]" % InputRebinder.binding_label(action)


func _toggle_wheel(show: bool) -> void:
	_wheel.visible = show
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if show else Input.MOUSE_MODE_CAPTURED


func set_objectives(objectives: Array) -> void:
	for c in _objectives_box.get_children():
		if c.name.begins_with("obj_"):
			c.queue_free()
	for o in objectives:
		var l := Label.new()
		var primary := not bool(o.get("optional", false))
		l.text = ("• " if primary else "-  ") + Loc.t(str(o.get("name_key", "")))
		l.add_theme_font_size_override("font_size", 15)
		l.add_theme_color_override("font_color", Color(1, 1, 1) if primary else Color(0.75, 0.75, 0.85))
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(330, 0)
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
