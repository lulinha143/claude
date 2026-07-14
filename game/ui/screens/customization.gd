extends Control
## Character customization. Cycle each cosmetic slot among unlocked (and common)
## options; persists to the save's character block. Identity options are NOT
## gated by gender categories (per design). Includes a simple live preview.

const SLOTS: Array = [
	["body_shape", "body_shape"], ["skin_color", "skin_color"],
	["helmet", "helmet"], ["hair", "hair"], ["eyes", "eyes"], ["mouth", "mouth"],
	["uniform", "uniform"], ["gloves", "gloves"], ["boots", "boots"],
	["backpack", "backpack"], ["badge", "badge"],
	["victory_pose", "victory_pose"], ["panic_anim", "panic_anim"],
]

var _rows: VBoxContainer
var _name_edit: LineEdit


func _ready() -> void:
	_build()


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
	header.text = Loc.t("WAREHOUSE_CUSTOMIZE")
	header.add_theme_font_size_override("font_size", 32)
	vb.add_child(header)

	var name_row := HBoxContainer.new()
	var nl := Label.new()
	nl.text = "Name"
	nl.custom_minimum_size = Vector2(140, 0)
	name_row.add_child(nl)
	_name_edit = LineEdit.new()
	_name_edit.text = str(_char().get("name", "New Mover"))
	_name_edit.custom_minimum_size = Vector2(260, 0)
	_name_edit.text_changed.connect(func(t: String) -> void: _char()["name"] = t)
	name_row.add_child(_name_edit)
	vb.add_child(name_row)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vb.add_child(scroll)
	_rows = VBoxContainer.new()
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows.add_theme_constant_override("separation", 6)
	scroll.add_child(_rows)
	for slot in SLOTS:
		_build_slot(slot[0], slot[1])

	var back := Button.new()
	back.text = Loc.t("MENU_BACK")
	back.pressed.connect(func() -> void:
		SaveManager.save()
		App.go_to_warehouse())
	vb.add_child(back)


func _char() -> Dictionary:
	if not SaveManager.current.has("character"):
		SaveManager.current["character"] = SaveSchema.default_character()
	return SaveManager.current["character"]


func _options_for(category: String) -> Array:
	var unlocked: Array = SaveManager.current.get("cosmetics_unlocked", [])
	var out: Array = []
	for id in ContentDB.cosmetic_ids():
		var cos: Dictionary = ContentDB.cosmetics()[id]
		if str(cos.get("category", "")) != category:
			continue
		if str(cos.get("rarity", "common")) == "common" or unlocked.has(id):
			out.append(id)
	if out.is_empty():
		out.append(str(_char().get(category, "default")))
	return out


func _build_slot(char_key: String, category: String) -> void:
	var row := HBoxContainer.new()
	var label := Label.new()
	label.text = category.capitalize()
	label.custom_minimum_size = Vector2(140, 0)
	row.add_child(label)
	var prev := Button.new()
	prev.text = "◀"
	var value := Label.new()
	value.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var next := Button.new()
	next.text = "▶"
	row.add_child(prev)
	row.add_child(value)
	row.add_child(next)
	_rows.add_child(row)

	var options := _options_for(category)
	var refresh := func() -> void:
		var cur: String = str(_char().get(char_key, options[0]))
		var name := cur
		if ContentDB.cosmetics().has(cur):
			name = str(ContentDB.cosmetics()[cur].get("name", cur))
		value.text = name
	refresh.call()
	prev.pressed.connect(func() -> void: _cycle(char_key, options, -1); refresh.call())
	next.pressed.connect(func() -> void: _cycle(char_key, options, 1); refresh.call())


func _cycle(char_key: String, options: Array, dir: int) -> void:
	var cur: String = str(_char().get(char_key, options[0]))
	var idx := options.find(cur)
	if idx < 0:
		idx = 0
	idx = (idx + dir + options.size()) % options.size()
	_char()[char_key] = options[idx]
