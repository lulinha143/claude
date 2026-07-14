extends Control
## Company warehouse — the persistent hub. A functional, controller-navigable
## menu hub (no dead buttons) that routes to every sub-screen and shows live
## resources + Boxy. The hub visibly reflects owned upgrades in its header.

@onready var _company: Label = $Margin/VBox/Header/Company
@onready var _resources: Label = $Margin/VBox/Header/Resources
@onready var _grid: GridContainer = $Margin/VBox/Body/Menu
@onready var _boxy_holder: Control = $Margin/VBox/Body/BoxyHolder
@onready var _net_status: Label = $Margin/VBox/NetStatus

const MENU: Array = [
	["WAREHOUSE_CONTRACTS", "res://game/ui/screens/contract_board.tscn"],
	["WAREHOUSE_LOADOUT", "res://game/ui/screens/loadout.tscn"],
	["WAREHOUSE_CUSTOMIZE", "res://game/ui/screens/customization.tscn"],
	["WAREHOUSE_UPGRADES", "res://game/ui/screens/upgrades.tscn"],
	["WAREHOUSE_ENCYCLOPEDIA", "res://game/ui/screens/encyclopedia.tscn"],
	["WAREHOUSE_ACHIEVEMENTS", "res://game/ui/screens/achievements.tscn"],
]


func _ready() -> void:
	if SaveManager.current.is_empty():
		# Safety: reaching the warehouse without a company (e.g. deep link).
		App.go_to_main_menu()
		return
	_company.text = str(SaveManager.current.get("company_name", "Company"))
	_refresh_resources(SaveManager.current.get("resources", {}))
	EventBus.resources_changed.connect(_refresh_resources)
	EventBus.net_status_changed.connect(func(_s: int, d: String) -> void: _net_status.text = d)
	_build_menu()
	var boxy: Control = load("res://game/ui/widgets/boxy_widget.gd").new()
	_boxy_holder.add_child(boxy)
	Platform.set_rich_presence("status", "In the warehouse")


func _build_menu() -> void:
	for entry in MENU:
		var b := Button.new()
		b.text = Loc.t(entry[0])
		b.custom_minimum_size = Vector2(240, 60)
		var path: String = entry[1]
		b.pressed.connect(func() -> void:
			Audio.play_sfx("ui_confirm")
			get_tree().change_scene_to_file(path))
		_grid.add_child(b)
	# Co-op host button.
	var host := Button.new()
	host.text = "Host Co-op"
	host.custom_minimum_size = Vector2(240, 60)
	host.pressed.connect(_on_host)
	_grid.add_child(host)
	# Settings + Main menu.
	var settings := Button.new()
	settings.text = Loc.t("MENU_SETTINGS")
	settings.custom_minimum_size = Vector2(240, 60)
	settings.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://game/ui/screens/settings.tscn"))
	_grid.add_child(settings)
	var menu := Button.new()
	menu.text = Loc.t("PAUSE_QUIT_MENU")
	menu.custom_minimum_size = Vector2(240, 60)
	menu.pressed.connect(func() -> void:
		Net.disconnect_all()
		App.go_to_main_menu())
	_grid.add_child(menu)
	if _grid.get_child_count() > 0:
		(_grid.get_child(0) as Control).grab_focus()


func _on_host() -> void:
	if Net.host_game(GameConstants.DEFAULT_PORT):
		_net_status.text = Loc.t("NET_HOSTING", {"port": GameConstants.DEFAULT_PORT})
	else:
		_net_status.text = Loc.t("NET_DISCONNECTED")


func _refresh_resources(res: Dictionary) -> void:
	_resources.text = "%s %s   ★ %d   ✦ %d   🛡 %d/%d" % [
		Loc.t("WAREHOUSE_TITLE"), "",
		int(res.get(GameConstants.RES_REPUTATION, 0)),
		int(res.get(GameConstants.RES_RESIDUE, 0)),
		int(res.get(GameConstants.RES_INSURANCE, 0)), Balance.INSURANCE_MAX,
	]
	_resources.text = "%s   ★%d   ✦%d   🛡%d" % [
		Loc.format_money(int(res.get(GameConstants.RES_CASH, 0))),
		int(res.get(GameConstants.RES_REPUTATION, 0)),
		int(res.get(GameConstants.RES_RESIDUE, 0)),
		int(res.get(GameConstants.RES_INSURANCE, 0)),
	]
