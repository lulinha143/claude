extends CanvasLayer
## Developer overlay (F3). Only instantiated when DevTools.enabled. Provides
## cheats, simulation toggles, and validation — every button does real work.

func _ready() -> void:
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS
	var panel := PanelContainer.new()
	panel.position = Vector2(20, 20)
	add_child(panel)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 4)
	panel.add_child(vb)
	_title(vb, "DEV TOOLS")
	_btn(vb, "+1000 Cash", func() -> void: DevTools.add_resource(GameConstants.RES_CASH, 1000))
	_btn(vb, "+50 Reputation", func() -> void: DevTools.add_resource(GameConstants.RES_REPUTATION, 50))
	_btn(vb, "Unlock all locations", DevTools.unlock_all_locations)
	_btn(vb, "Unlock all equipment", DevTools.unlock_all_equipment)
	_btn(vb, "Instability +30", func() -> void:
		var p := get_tree().get_first_node_in_group("recovery_point")
		_bump_instability(30.0))
	_btn(vb, "Complete contract", func() -> void:
		var runner := get_tree().current_scene
		if runner != null and runner.has_method("_finish"):
			runner.call("_finish", true, false))
	_btn(vb, "Validate content", func() -> void:
		var r := DevTools.validate_content()
		Log.info("DevTools", "Content valid=%s errors=%d" % [r.get("ok", false), (r.get("errors", []) as Array).size()]))
	_btn(vb, "Validate localization", func() -> void:
		Log.info("DevTools", "Loc completeness: %s" % str(DevTools.validate_localization())))
	_btn(vb, "Reset save (danger)", func() -> void:
		if SaveManager.current_slot >= 0:
			SaveManager.delete_profile(SaveManager.current_slot))
	_btn(vb, "Close (F3)", func() -> void: DevTools.toggle_overlay())


func _bump_instability(amount: float) -> void:
	for n in get_tree().get_nodes_in_group("furniture"):
		if n is FurnitureController:
			(n as FurnitureController).agitate(amount)


func _title(parent: VBoxContainer, text: String) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 18)
	parent.add_child(l)


func _btn(parent: VBoxContainer, text: String, cb: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.pressed.connect(cb)
	parent.add_child(b)
