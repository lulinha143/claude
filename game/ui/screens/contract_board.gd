extends Control
## Contract board. Generates deterministic contract offers from unlocked
## locations (plus a daily challenge and a shareable-seed entry), shows a
## briefing, and launches the contract. Accepting sets App.session and changes
## to the contract runner.

var _list: VBoxContainer
var _detail: VBoxContainer
var _selected: ContractData


func _ready() -> void:
	_build_layout()
	_populate()


func _build_layout() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.08, 0.07, 0.12)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for m in ["margin_left", "margin_right"]:
		margin.add_theme_constant_override(m, 40)
	for m in ["margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(m, 28)
	add_child(margin)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	margin.add_child(vb)
	var header := Label.new()
	header.text = Loc.t("WAREHOUSE_CONTRACTS")
	header.add_theme_font_size_override("font_size", 32)
	vb.add_child(header)

	var seed_row := HBoxContainer.new()
	vb.add_child(seed_row)
	var seed_edit := LineEdit.new()
	seed_edit.placeholder_text = "Enter a shared seed..."
	seed_edit.custom_minimum_size = Vector2(300, 0)
	seed_row.add_child(seed_edit)
	var seed_btn := Button.new()
	seed_btn.text = "Load Seed"
	seed_btn.pressed.connect(func() -> void: _load_seed(seed_edit.text))
	seed_row.add_child(seed_btn)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 24)
	vb.add_child(body)

	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(420, 0)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 8)
	scroll.add_child(_list)

	var detail_panel := PanelContainer.new()
	detail_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(detail_panel)
	_detail = VBoxContainer.new()
	_detail.add_theme_constant_override("separation", 8)
	detail_panel.add_child(_detail)

	var back := Button.new()
	back.text = Loc.t("MENU_BACK")
	back.pressed.connect(func() -> void: App.go_to_warehouse())
	vb.add_child(back)


func _populate() -> void:
	var rep := SaveManager.get_resource(GameConstants.RES_REPUTATION)
	var unlocked: Array = SaveManager.current.get("unlocked_locations", ["suburban_house"])
	var day := Time.get_date_dict_from_system()
	var idx := 0
	for lid in unlocked:
		if not App.demo_allows_location(lid):
			continue   # demo build restricts the location roster
		var seed_value := DeterministicRNG.seed_from_date(day["year"], day["month"], day["day"], idx * 7 + 1)
		var c := ContractGenerator.generate(lid, seed_value, rep)
		_add_offer(c, false)
		idx += 1
	# Daily challenge.
	var daily := ContractGenerator.generate_daily(day["year"], day["month"], day["day"])
	_add_offer(daily, true)


func _add_offer(c: ContractData, daily: bool) -> void:
	var b := Button.new()
	var loc := ContentDB.location(c.location_id)
	var label := "%s%s\n%s %d • %s" % [
		"[DAILY] " if daily else "",
		str(loc.get("name", c.location_id)),
		Loc.t("CONTRACT_DANGER"), c.danger,
		Loc.format_money(c.payment_max),
	]
	b.text = label
	b.custom_minimum_size = Vector2(0, 60)
	b.pressed.connect(func() -> void: _show_detail(c))
	_list.add_child(b)
	if _list.get_child_count() == 1:
		b.grab_focus()
		_show_detail(c)


func _show_detail(c: ContractData) -> void:
	_selected = c
	for child in _detail.get_children():
		child.queue_free()
	var loc := ContentDB.location(c.location_id)
	_lbl(str(loc.get("name", c.location_id)), 26)
	_lbl(Loc.t("CONTRACT_BRIEFING"), 16, Color(0.7, 0.7, 0.8))
	_lbl("%s: %d" % [Loc.t("CONTRACT_DANGER"), c.danger])
	_lbl("%s: %s – %s" % [Loc.t("CONTRACT_PAYMENT"),
		Loc.format_money(c.payment_min), Loc.format_money(c.payment_max)])
	_lbl("%s: %s" % [Loc.t("CONTRACT_SEED"), c.seed_string()], 13, Color(0.6, 0.6, 0.7))
	_lbl(Loc.t("CONTRACT_TARGETS") + ":", 18, Color(1, 0.85, 0.4))
	for tid in c.target_ids:
		var fd := ContentDB.furniture(tid)
		_lbl("• " + (Loc.t(fd.name_key) if fd != null else tid), 15)
	_lbl(Loc.t("CONTRACT_OBJECTIVES") + ":", 18, Color(1, 0.85, 0.4))
	for o in c.objectives:
		var tag := "" if not bool(o.get("optional", false)) else " (%s)" % Loc.t("CONTRACT_OPTIONAL")
		_lbl("• " + Loc.t(str(o.get("name_key", ""))) + tag, 15)
	if not c.client_notes.is_empty():
		_lbl("\"%s\"" % c.client_notes, 14, Color(0.8, 0.8, 0.9))
	var accept := Button.new()
	accept.text = Loc.t("CONTRACT_ACCEPT")
	accept.pressed.connect(_accept)
	_detail.add_child(accept)


func _accept() -> void:
	if _selected == null:
		return
	if Net.status == Net.Status.OFFLINE and not Net.is_host:
		Net.start_offline()
	App.change_scene("contract", {"selected_contract": _selected})


func _load_seed(text: String) -> void:
	if text.strip_edges().is_empty():
		return
	var seed_value := DeterministicRNG.parse_seed(text)
	var loc := "suburban_house"
	var unlocked: Array = SaveManager.current.get("unlocked_locations", [loc])
	# Seed prefixes map back to a location if present.
	var c := ContractGenerator.generate(loc, seed_value,
		SaveManager.get_resource(GameConstants.RES_REPUTATION))
	_show_detail(c)


func _lbl(text: String, size: int = 15, color: Color = Color.WHITE) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_child(l)
