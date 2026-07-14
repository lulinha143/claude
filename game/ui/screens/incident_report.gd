extends Control
## Post-contract incident report. Reads App.session["last_result"] and presents
## the humorous card. Supports exporting the card as a PNG (no desktop capture —
## it renders only the in-game card node) for sharing.

@onready var _card: PanelContainer = $Center/Card
@onready var _vbox: VBoxContainer = $Center/Card/VBox
@onready var _buttons: HBoxContainer = $ButtonsLayer/Buttons

var _report: Dictionary


func _ready() -> void:
	_report = App.session.get("last_result", {})
	_build_card()
	_build_buttons()


func _build_card() -> void:
	_add(_vbox, Loc.t(str(_report.get("result_key", "RESULT_SUCCESS"))), 34, Color(1, 0.85, 0.4))
	_add(_vbox, Loc.t("REPORT_TITLE"), 18, Color(0.7, 0.7, 0.8))
	_add(_vbox, "\"%s\"" % str(_report.get("title", "")), 22, Color.WHITE)
	_sep(_vbox)
	_add(_vbox, "%s: %d / %d" % [Loc.t("REPORT_DELIVERED"),
		int(_report.get("delivered", 0)), int(_report.get("total_targets", 0))], 18)
	_add(_vbox, "%s: %s" % [Loc.t("CONTRACT_OPTIONAL"),
		"%d / %d" % [int(_report.get("optional_completed", 0)), int(_report.get("optional_total", 0))]], 18)
	_add(_vbox, str(_report.get("damage_line", "")), 16, Color(0.9, 0.7, 0.7))
	_add(_vbox, str(_report.get("funny_line", "")), 16, Color(0.8, 0.9, 0.8))
	var rescue := str(_report.get("rescue_line", ""))
	if not rescue.is_empty():
		_add(_vbox, rescue, 16)
	_add(_vbox, str(_report.get("mistake", "")), 16, Color(0.9, 0.8, 0.7))
	_add(_vbox, str(_report.get("commendation", "")), 16, Color(0.7, 0.9, 1.0))
	_add(_vbox, str(_report.get("insurance_line", "")), 16, Color(0.8, 0.8, 0.8))
	_sep(_vbox)
	_add(_vbox, "%s: %s" % [Loc.t("REPORT_PAYOUT"), Loc.format_money(int(_report.get("payout", 0)))], 26, Color(0.6, 1, 0.6))
	_add(_vbox, "%s: %s" % [Loc.t("CONTRACT_SEED"), str(_report.get("seed_string", ""))], 13, Color(0.6, 0.6, 0.7))


func _build_buttons() -> void:
	var cont := Button.new()
	cont.text = Loc.t("REPORT_CONTINUE")
	cont.pressed.connect(func() -> void:
		if SaveManager.current.is_empty():
			App.go_to_main_menu()
		else:
			App.go_to_warehouse())
	var export := Button.new()
	export.text = "Export Card (PNG)"
	export.pressed.connect(_export_png)
	_buttons.add_child(export)
	_buttons.add_child(cont)
	cont.grab_focus()


func _export_png() -> void:
	# Render only the card control to an image — never the desktop.
	var img := _card.get_viewport().get_texture().get_image()
	var rect := _card.get_global_rect()
	var region := img.get_region(Rect2i(rect.position, rect.size))
	var dir := "user://reports"
	if not DirAccess.dir_exists_absolute(dir):
		DirAccess.make_dir_recursive_absolute(dir)
	var path := "%s/incident_%d.png" % [dir, Time.get_unix_time_from_system()]
	region.save_png(path)
	Log.info("Report", "Exported incident card to %s" % path)


func _add(parent: VBoxContainer, text: String, size: int, color: Color = Color.WHITE) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(560, 0)
	parent.add_child(l)


func _sep(parent: VBoxContainer) -> void:
	var s := HSeparator.new()
	parent.add_child(s)
