extends Control
## Warehouse & company upgrades. Purchase levels with cash; gated by reputation.
## Uses UpgradeCalculator for cost math (unit-tested). Persists to the save.

var _list: VBoxContainer
var _cash_label: Label


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
	vb.add_theme_constant_override("separation", 10)
	margin.add_child(vb)
	var header := Label.new()
	header.text = Loc.t("WAREHOUSE_UPGRADES")
	header.add_theme_font_size_override("font_size", 32)
	vb.add_child(header)
	_cash_label = Label.new()
	vb.add_child(_cash_label)
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
	EventBus.resources_changed.connect(func(_r: Dictionary) -> void: _refresh_cash())


func _refresh_cash() -> void:
	_cash_label.text = "%s: %s" % [Loc.t("CONTRACT_PAYMENT"),
		Loc.format_money(SaveManager.get_resource(GameConstants.RES_CASH))]


func _populate() -> void:
	_refresh_cash()
	var rep := SaveManager.get_resource(GameConstants.RES_REPUTATION)
	for uid in ContentDB.upgrade_ids():
		var u := ContentDB.upgrade(uid)
		var row := HBoxContainer.new()
		var level: int = int(SaveManager.current.get("upgrades", {}).get(uid, 0))
		var info := Label.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.text = "%s  (Lv %d/%d)\n%s" % [str(u.get("name", uid)), level, int(u.get("max_level", 3)), str(u.get("description", ""))]
		info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.add_child(info)
		var buy := Button.new()
		var locked := rep < int(u.get("unlock_reputation", 0))
		var maxed := level >= int(u.get("max_level", 3))
		var cost := UpgradeCalculator.cost(u, level)
		if maxed:
			buy.text = "MAX"
			buy.disabled = true
		elif locked:
			buy.text = "★%d" % int(u.get("unlock_reputation", 0))
			buy.disabled = true
		else:
			buy.text = Loc.format_money(cost)
		buy.custom_minimum_size = Vector2(140, 0)
		var id: String = uid
		buy.pressed.connect(func() -> void: _buy(id))
		row.add_child(buy)
		_list.add_child(row)
		if _list.get_child_count() == 1:
			buy.grab_focus()


func _buy(uid: String) -> void:
	var u := ContentDB.upgrade(uid)
	var level: int = int(SaveManager.current.get("upgrades", {}).get(uid, 0))
	if level >= int(u.get("max_level", 3)):
		return
	var cost := UpgradeCalculator.cost(u, level)
	if not SaveManager.can_afford(GameConstants.RES_CASH, cost):
		Audio.play_sfx("murmur_nervous")
		return
	SaveManager.add_resource(GameConstants.RES_CASH, -cost)
	if not SaveManager.current.has("upgrades"):
		SaveManager.current["upgrades"] = {}
	SaveManager.current["upgrades"][uid] = level + 1
	Audio.play_sfx("chime")
	for c in _list.get_children():
		c.queue_free()
	call_deferred("_populate")
