extends Control
## Credits + privacy/attribution screen. Content is loaded from the repository's
## docs so credits never drift from the real attribution file.

@onready var _text: RichTextLabel = $Margin/VBox/Scroll/Text
@onready var _back: Button = $Margin/VBox/Back


func _ready() -> void:
	_back.text = Loc.t("MENU_BACK")
	_back.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://game/ui/screens/main_menu.tscn"))
	_text.bbcode_enabled = true
	_text.text = _build_text()
	_back.grab_focus()


func _build_text() -> String:
	var s := "[b]%s[/b]\n%s\n\n" % [GameConstants.GAME_TITLE, GameConstants.GAME_SUBTITLE]
	s += "Version %s\n\n" % GameConstants.VERSION
	s += "[b]Studio[/b]\nBuilt as a complete independent studio effort.\n\n"
	s += "[b]Audio[/b]\nAll placeholder sounds are original, generated procedurally in-engine.\n\n"
	s += "[b]Art[/b]\nAll placeholder art is original (procedural meshes, materials, and SVG UI).\n\n"
	s += "[b]Attribution & Privacy[/b]\nSee THIRD_PARTY_NOTICES.md and PRIVACY.md in the repository.\n"
	s += "This game does not collect personal information and does not require a backend for core play.\n"
	return s
