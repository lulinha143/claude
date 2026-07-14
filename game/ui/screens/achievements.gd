extends Control
## Achievements + statistics screen. Lists all 40+ achievements with unlock
## state (from the platform layer) and shows lifetime stats from the save.

func _ready() -> void:
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
	header.text = Loc.t("WAREHOUSE_ACHIEVEMENTS")
	header.add_theme_font_size_override("font_size", 32)
	vb.add_child(header)

	# Stats summary.
	var stats: Dictionary = SaveManager.current.get("stats", {})
	var summary := Label.new()
	summary.text = "Contracts: %d   Delivered: %d   Perfect: %d   Earnings: %s" % [
		int(stats.get("contracts_completed", 0)),
		int(stats.get("furniture_delivered", 0)),
		int(stats.get("perfect_moves", 0)),
		Loc.format_money(int(stats.get("total_earnings", 0))),
	]
	vb.add_child(summary)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vb.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(list)
	var unlocked_count := 0
	for ach in ContentDB.achievements():
		var id := str(ach.get("id", ""))
		var got := Platform.current().is_achievement_unlocked(id)
		if got:
			unlocked_count += 1
		var row := Label.new()
		var hidden := bool(ach.get("hidden", false)) and not got
		var name := "???" if hidden else str(ach.get("name", id))
		var desc := "Hidden achievement" if hidden else str(ach.get("description", ""))
		row.text = "%s %s — %s" % ["✔" if got else "✘", name, desc]
		row.modulate = Color(0.6, 1, 0.6) if got else Color(0.8, 0.8, 0.8)
		list.add_child(row)
	header.text = "%s (%d/%d)" % [Loc.t("WAREHOUSE_ACHIEVEMENTS"), unlocked_count, ContentDB.achievements().size()]

	var back := Button.new()
	back.text = Loc.t("MENU_BACK")
	back.pressed.connect(func() -> void: App.go_to_warehouse())
	vb.add_child(back)
	back.grab_focus()
