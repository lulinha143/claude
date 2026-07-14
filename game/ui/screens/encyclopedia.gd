extends Control
## Furniture encyclopedia. Lists every furniture type; shows name, description,
## family, handling info and known traits. Undiscovered traits appear as "???"
## until the family's object trust reveals them (or dev mode reveals all).

var _list: VBoxContainer
var _detail: VBoxContainer


func _ready() -> void:
	_build()
	_populate()


func _build() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.08, 0.07, 0.12)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 40)
	margin.add_theme_constant_override("margin_top", 28)
	margin.add_theme_constant_override("margin_right", 40)
	margin.add_theme_constant_override("margin_bottom", 28)
	add_child(margin)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 12)
	margin.add_child(vb)
	var header := Label.new()
	header.text = Loc.t("WAREHOUSE_ENCYCLOPEDIA")
	header.add_theme_font_size_override("font_size", 32)
	vb.add_child(header)
	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 24)
	vb.add_child(body)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(320, 0)
	body.add_child(scroll)
	_list = VBoxContainer.new()
	scroll.add_child(_list)
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(panel)
	_detail = VBoxContainer.new()
	panel.add_child(_detail)
	var back := Button.new()
	back.text = Loc.t("MENU_BACK")
	back.pressed.connect(func() -> void: App.go_to_warehouse())
	vb.add_child(back)


func _populate() -> void:
	for fid in ContentDB.all_furniture_ids():
		var fd := ContentDB.furniture(fid)
		var b := Button.new()
		b.text = Loc.t(fd.name_key)
		b.pressed.connect(func() -> void: _show(fd))
		_list.add_child(b)
		if _list.get_child_count() == 1:
			b.grab_focus()
			_show(fd)


func _show(fd: FurnitureData) -> void:
	for c in _detail.get_children():
		c.queue_free()
	_lbl(Loc.t(fd.name_key), 26, Color(1, 0.85, 0.4))
	_lbl("Family: %s" % fd.family.capitalize())
	_lbl("Weight: %.0f kg   Value: %s   Carriers: %d" % [fd.weight, Loc.format_money(fd.value), fd.min_carriers])
	_lbl("Fragility: %d%%" % int(fd.fragility * 100.0))
	var discovered := _discovered_traits(fd)
	_lbl("Traits:", 18, Color(0.8, 0.9, 1.0))
	for t in fd.traits + fd.paranormal:
		if discovered or not (t in fd.paranormal):
			_lbl("• " + _trait_name(t), 14)
		else:
			_lbl("• ???", 14, Color(0.5, 0.5, 0.5))
	if not fd.calming_actions.is_empty():
		_lbl("Calms with: %s" % ", ".join(fd.calming_actions), 14, Color(0.7, 1, 0.7))
	if not fd.dislikes.is_empty():
		_lbl("Dislikes: %s" % ", ".join(fd.dislikes), 14, Color(1, 0.7, 0.7))


func _discovered_traits(fd: FurnitureData) -> bool:
	if DevTools.enabled:
		return true
	var trust: int = int(SaveManager.current.get("object_trust", {}).get(fd.family, 0))
	return trust >= 3


func _trait_name(tid: String) -> String:
	var t := ContentDB.trait_def(tid)
	return str(t.get("name", tid)) if not t.is_empty() else tid


func _lbl(text: String, size: int = 15, color: Color = Color.WHITE) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_child(l)
