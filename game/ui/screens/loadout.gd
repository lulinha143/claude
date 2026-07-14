extends Control
## Equipment loadout screen. Toggle unlocked equipment in/out of the loadout
## (capacity influenced by warehouse upgrades). Persists to the save profile.

const BASE_CAPACITY: int = 4

var _list: VBoxContainer
var _capacity_label: Label


func _ready() -> void:
	_build()
	_populate()


func _capacity() -> int:
	var lvl := int(SaveManager.current.get("upgrades", {}).get("equipment_storage", 0))
	return BASE_CAPACITY + lvl


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
	header.text = Loc.t("WAREHOUSE_LOADOUT")
	header.add_theme_font_size_override("font_size", 32)
	vb.add_child(header)
	_capacity_label = Label.new()
	vb.add_child(_capacity_label)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vb.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)
	var back := Button.new()
	back.text = Loc.t("MENU_BACK")
	back.pressed.connect(func() -> void:
		SaveManager.save()
		App.go_to_warehouse())
	vb.add_child(back)


func _populate() -> void:
	var unlocked: Array = SaveManager.current.get("unlocked_equipment", [])
	var loadout: Array = SaveManager.current.get("loadout", [])
	for eid in unlocked:
		var e := ContentDB.equipment(eid)
		if e.is_empty():
			continue
		var row := CheckButton.new()
		row.text = "%s  —  %s" % [str(e.get("name", eid)), str(e.get("description", ""))]
		row.button_pressed = eid in loadout
		var id: String = eid
		row.toggled.connect(func(on: bool) -> void: _toggle(id, on))
		_list.add_child(row)
		if _list.get_child_count() == 1:
			row.grab_focus()
	_refresh_capacity()


func _toggle(eid: String, on: bool) -> void:
	var loadout: Array = SaveManager.current["loadout"]
	if on:
		if loadout.size() >= _capacity():
			# At capacity — revert (find the checkbox and untick).
			_refresh_capacity()
			_repopulate()
			return
		if not loadout.has(eid):
			loadout.append(eid)
	else:
		loadout.erase(eid)
	_refresh_capacity()


func _refresh_capacity() -> void:
	var loadout: Array = SaveManager.current.get("loadout", [])
	_capacity_label.text = "Loadout: %d / %d" % [loadout.size(), _capacity()]


func _repopulate() -> void:
	for c in _list.get_children():
		c.queue_free()
	call_deferred("_populate")
