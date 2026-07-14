extends Control
## Boot / splash screen. Shows the studio + photosensitivity notice, verifies
## core services came up, then routes to the main menu. Auto-advances but also
## accepts input to skip.

@onready var _status: Label = $Center/VBox/Status

var _advanced: bool = false


func _ready() -> void:
	# Confirm autoloads are alive (defensive; helps catch boot regressions).
	var ok := Log != null and EventBus != null and ContentDB != null and Loc != null
	_status.text = "Loading..." if ok else "Boot error — check logs"
	Platform.set_rich_presence("status", "In menus")
	# Developer multiplayer entry points (see docs/MULTIPLAYER.md):
	#   godot --path . --host
	#   godot --path . --join 127.0.0.1
	var args := OS.get_cmdline_user_args()
	if "--host" in args or "--join" in args:
		_dev_network_boot(args)
		return

	# Auto-advance after a short beat.
	await get_tree().create_timer(1.6).timeout
	_advance()


func _dev_network_boot(args: Array) -> void:
	if SaveManager.list_profiles().is_empty():
		SaveManager.new_company("Dev Session")
	else:
		SaveManager.load_company(0)
	if "--host" in args:
		Net.host_game(GameConstants.DEFAULT_PORT)
		App.go_to_warehouse()
	elif "--join" in args:
		var idx := args.find("--join")
		var ip := "127.0.0.1"
		if idx >= 0 and idx + 1 < args.size():
			ip = str(args[idx + 1])
		Net.join_game(ip, GameConstants.DEFAULT_PORT)
		EventBus.net_status_changed.connect(func(s: int, _d: String) -> void:
			if s == Net.Status.CONNECTED:
				App.go_to_warehouse(), CONNECT_ONE_SHOT)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		_advance()
	elif event is InputEventMouseButton and event.pressed:
		_advance()


func _advance() -> void:
	if _advanced:
		return
	_advanced = true
	App.change_scene("main_menu")
