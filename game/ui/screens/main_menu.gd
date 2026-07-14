extends Control
## Main menu. Every button is functional (no placeholders). Builds its buttons
## in code so labels are localized and controller focus works out of the box.

@onready var _menu: VBoxContainer = $Center/Panel/VBox/Menu
@onready var _title: Label = $Center/Panel/VBox/Title
@onready var _sub: Label = $Center/Panel/VBox/Sub
@onready var _dialog_layer: CanvasLayer = $DialogLayer

var _buttons: Array[Button] = []


var _cam3d: Camera3D
var _orbit: float = 0.0


func _ready() -> void:
	_title.text = Loc.t("GAME_TITLE")
	_sub.text = Loc.t("GAME_SUBTITLE")
	_build_backdrop()
	_build_menu()
	EventBus.locale_changed.connect(func(_l: String) -> void: _rebuild())


func _process(delta: float) -> void:
	# Slow, gentle camera drift over the backdrop room.
	if _cam3d != null and not bool(Settings.get_value("accessibility", "reduced_motion")):
		_orbit += delta * 0.12
		_cam3d.position = Vector3(sin(_orbit) * 1.2, 2.0, 6.2)
		_cam3d.look_at(Vector3(0, 1.1, 0), Vector3.UP)


## Builds a small warm 3D room behind the menu with furniture "actors" and Boxy,
## so the main menu communicates the theme at a glance.
func _build_backdrop() -> void:
	# Let the 3D scene show through (drop the opaque 2D background).
	var bg := get_node_or_null("BG")
	if bg != null:
		bg.queue_free()

	var world := Node3D.new()
	world.name = "Backdrop"
	add_child(world)
	move_child(world, 0)

	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.08, 0.05, 0.10)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.45, 0.5)
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.9
	env.glow_enabled = true
	env.glow_intensity = 0.18
	we.environment = env
	world.add_child(we)

	var key := OmniLight3D.new()
	key.position = Vector3(1.5, 3.0, 3.0)
	key.light_energy = 2.2
	key.omni_range = 12.0
	key.light_color = Color(1.0, 0.85, 0.6)
	world.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-30, -140, 0)
	rim.light_energy = 0.5
	rim.light_color = Color(0.6, 0.7, 1.0)
	world.add_child(rim)

	# Enclosed warm room: floor, back wall, two side walls, ceiling.
	_backdrop_box(world, Vector3(16, 0.4, 12), Vector3(0, -0.2, 0), Color(0.4, 0.28, 0.2))
	_backdrop_box(world, Vector3(16, 6, 0.3), Vector3(0, 2, -3.2), Color(0.55, 0.30, 0.35))
	_backdrop_box(world, Vector3(0.3, 6, 12), Vector3(-7.5, 2, 0), Color(0.5, 0.28, 0.32))
	_backdrop_box(world, Vector3(0.3, 6, 12), Vector3(7.5, 2, 0), Color(0.5, 0.28, 0.32))
	_backdrop_box(world, Vector3(16, 0.3, 12), Vector3(0, 4.6, 0), Color(0.35, 0.22, 0.28))

	_cam3d = Camera3D.new()
	_cam3d.fov = 55
	_cam3d.position = Vector3(0, 2.0, 6.2)
	_cam3d.current = true
	world.add_child(_cam3d)
	_cam3d.look_at(Vector3(0, 1.1, 0), Vector3.UP)

	# Furniture "actors".
	_backdrop_actor(world, "sofa", Vector3(-2.4, 0.55, 0), Emotions.E.LONELY, 40.0)
	_backdrop_actor(world, "lamp", Vector3(1.8, 0.8, 0.4), Emotions.E.NERVOUS, 55.0)
	_backdrop_actor(world, "fridge", Vector3(3.4, 1.0, -0.8), Emotions.E.EXCITED, 30.0)

	# Boxy mascot (2D widget, bottom-left corner).
	var boxy: Control = load("res://game/ui/widgets/boxy_widget.gd").new()
	boxy.position = Vector2(40, 560)
	add_child(boxy)


func _backdrop_box(world: Node3D, size: Vector3, pos: Vector3, color: Color) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mi.material_override = m
	mi.position = pos
	world.add_child(mi)


func _backdrop_actor(world: Node3D, id: String, pos: Vector3, emotion: int, arousal: float) -> void:
	var fd := ContentDB.furniture(id)
	if fd == null:
		return
	var f := FurnitureController.new()
	world.add_child(f)
	f.global_position = pos
	f.setup(fd, "menu_" + id, false)
	f.freeze = true
	f.emotion_machine.agitate(arousal)
	f.emotion_machine.force_emotion(emotion)
	f._on_emotion_changed(emotion, arousal)
	# Hide the floating name/speech labels in the menu (keep just the faces).
	if f._name_label != null:
		f._name_label.visible = false
	if f._speech != null:
		f._speech.visible = false
	f.set_physics_process(false)   # static actor; no behaviour ticking in menu


func _rebuild() -> void:
	_title.text = Loc.t("GAME_TITLE")
	_sub.text = Loc.t("GAME_SUBTITLE")
	for b in _buttons:
		b.queue_free()
	_buttons.clear()
	_build_menu()


func _build_menu() -> void:
	var has_saves := not SaveManager.list_profiles().is_empty()
	if has_saves:
		_add_button("MENU_CONTINUE", _on_continue)
	_add_button("MENU_NEW_COMPANY", _on_new_company)
	_add_button("MENU_JOIN_GAME", _on_join)
	_add_button("MENU_SETTINGS", _on_settings)
	_add_button("MENU_CREDITS", _on_credits)
	if App.is_demo():
		_add_button("DEMO_WISHLIST", func() -> void: OS.shell_open(GameConstants.URL_WISHLIST))
	_add_button("MENU_QUIT", _on_quit)
	if not _buttons.is_empty():
		_buttons[0].grab_focus()


func _add_button(key: String, handler: Callable) -> void:
	var b := Button.new()
	b.text = Loc.t(key)
	b.custom_minimum_size = Vector2(320, 0)
	b.pressed.connect(handler)
	b.focus_entered.connect(func() -> void: Audio.play_sfx("ui_move"))
	_menu.add_child(b)
	_buttons.append(b)


# --- Handlers --------------------------------------------------------------
func _on_continue() -> void:
	Audio.play_sfx("ui_confirm")
	var profiles := SaveManager.list_profiles()
	if profiles.size() == 1:
		SaveManager.load_company(int(profiles[0]["slot"]))
		_start_solo_and_enter()
	else:
		_show_profile_picker(profiles)


func _on_new_company() -> void:
	Audio.play_sfx("ui_confirm")
	_show_name_prompt()


func _on_join() -> void:
	Audio.play_sfx("ui_confirm")
	_show_join_dialog()


func _on_settings() -> void:
	Audio.play_sfx("ui_confirm")
	get_tree().change_scene_to_file("res://game/ui/screens/settings.tscn")


func _on_credits() -> void:
	Audio.play_sfx("ui_confirm")
	get_tree().change_scene_to_file("res://game/ui/screens/credits.tscn")


func _on_quit() -> void:
	get_tree().quit()


func _start_solo_and_enter() -> void:
	Net.start_offline()
	App.go_to_warehouse()


# --- Dialogs (built in code, fully functional) -----------------------------
func _clear_dialogs() -> void:
	for c in _dialog_layer.get_children():
		c.queue_free()


func _make_dialog_panel(title_text: String) -> VBoxContainer:
	_clear_dialogs()
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dialog_layer.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dialog_layer.add_child(center)
	var panel := PanelContainer.new()
	center.add_child(panel)
	var vb := VBoxContainer.new()
	vb.custom_minimum_size = Vector2(420, 0)
	vb.add_theme_constant_override("separation", 12)
	panel.add_child(vb)
	var title := Label.new()
	title.text = title_text
	title.add_theme_font_size_override("font_size", 26)
	vb.add_child(title)
	return vb


func _show_name_prompt() -> void:
	var vb := _make_dialog_panel(Loc.t("COMPANY_NAME_PROMPT"))
	var edit := LineEdit.new()
	edit.text = Loc.t("COMPANY_DEFAULT_NAME")
	edit.select_all()
	vb.add_child(edit)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_END
	vb.add_child(row)
	var ok := Button.new()
	ok.text = Loc.t("MENU_CONFIRM")
	var cancel := Button.new()
	cancel.text = Loc.t("MENU_CANCEL")
	row.add_child(cancel)
	row.add_child(ok)
	ok.pressed.connect(func() -> void:
		var name := edit.text.strip_edges()
		if name.is_empty():
			name = Loc.t("COMPANY_DEFAULT_NAME")
		if SaveManager.new_company(name):
			SaveManager.current["seen_tutorial"] = false
			_clear_dialogs()
			_start_solo_and_enter()
	)
	cancel.pressed.connect(_clear_dialogs)
	edit.grab_focus()


func _show_join_dialog() -> void:
	var vb := _make_dialog_panel(Loc.t("MENU_JOIN_GAME"))
	var ip := LineEdit.new()
	ip.placeholder_text = "127.0.0.1"
	ip.text = "127.0.0.1"
	vb.add_child(ip)
	var pw := LineEdit.new()
	pw.placeholder_text = "password (optional)"
	pw.secret = true
	vb.add_child(pw)
	var status := Label.new()
	vb.add_child(status)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_END
	vb.add_child(row)
	var ok := Button.new()
	ok.text = Loc.t("MENU_CONFIRM")
	var cancel := Button.new()
	cancel.text = Loc.t("MENU_CANCEL")
	row.add_child(cancel)
	row.add_child(ok)
	ok.pressed.connect(func() -> void:
		status.text = Loc.t("NET_CONNECTING")
		if Net.join_game(ip.text.strip_edges(), GameConstants.DEFAULT_PORT, pw.text):
			# For the vertical slice, joining a session lands you in the warehouse
			# lobby once connected (see docs/MULTIPLAYER.md for the flow).
			var cb := func(s: int, _d: String) -> void:
				if s == Net.Status.CONNECTED:
					App.go_to_warehouse()
			EventBus.net_status_changed.connect(cb, CONNECT_ONE_SHOT)
	)
	cancel.pressed.connect(_clear_dialogs)
	ip.grab_focus()


func _show_profile_picker(profiles: Array) -> void:
	var vb := _make_dialog_panel(Loc.t("MENU_CONTINUE"))
	for p in profiles:
		var b := Button.new()
		b.text = "%s — %s • %s" % [
			p["company_name"],
			Loc.format_money(int(p["cash"])),
			Loc.t("COUNT_FURNITURE", {}) if false else str(p["contracts"]),
		]
		var slot := int(p["slot"])
		b.pressed.connect(func() -> void:
			SaveManager.load_company(slot)
			_clear_dialogs()
			_start_solo_and_enter()
		)
		vb.add_child(b)
	var cancel := Button.new()
	cancel.text = Loc.t("MENU_BACK")
	cancel.pressed.connect(_clear_dialogs)
	vb.add_child(cancel)
