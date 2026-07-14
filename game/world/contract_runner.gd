extends Node3D
## Runs one contract end-to-end: builds the level, spawns furniture + van +
## players (+ solo AI assistants), tracks objectives and instability, and on
## completion computes rewards, persists progression, and shows the incident
## report. This is the playable vertical slice's beating heart.

const SOLO_ASSISTANTS: int = 2

var contract: ContractData
var _van: Van
var _instability: Node
var _hud: CanvasLayer
var _player: PlayerController
var _assistants: Array[AIAssistant] = []
var _finished: bool = false
var _pause_menu: CanvasLayer

# Run tally.
var _controllers: Dictionary = {}   # furniture_id -> FurnitureController
var _damage_value: float = 0.0
var _damage_events: int = 0
var _rescues: int = 0
var _residue_events: int = 0
var _optional_failed: Dictionary = {}


func _ready() -> void:
	contract = App.session.get("selected_contract")
	if contract == null:
		# Dev/standalone entry: fabricate a contract so the scene is runnable.
		var seed_value := int(Time.get_unix_time_from_system())
		contract = ContractGenerator.generate("suburban_house", seed_value,
			SaveManager.get_resource(GameConstants.RES_REPUTATION))
		App.session["selected_contract"] = contract

	Log.info("Contract", "Starting %s (seed %d)" % [contract.id, contract.seed_value])
	var layout := LevelBuilder.build(contract, self)
	_spawn_van(layout["van_pos"])
	_spawn_furniture(layout["spawn_points"])
	_spawn_instability()
	_spawn_players(layout["player_start"])
	_spawn_hud()
	_connect_signals()
	EventBus.contract_started.emit(contract.id, contract.seed_value)
	Platform.set_rich_presence("status", "On a contract")


func _spawn_van(pos: Vector3) -> void:
	_van = Van.new()
	_van.position = pos
	# Rotate so the open back faces the house (-Z).
	_van.rotation.y = PI
	add_child(_van)
	_van.set_targets(contract.target_ids.size())


func _spawn_furniture(spawns: Array) -> void:
	var idx := 0
	# Targets.
	for tid in contract.target_ids:
		_spawn_one(tid, spawns[idx % spawns.size()], true, "t%d" % idx)
		idx += 1
	# Decoys.
	for did in contract.decoy_ids:
		_spawn_one(did, spawns[idx % spawns.size()], false, "d%d" % idx)
		idx += 1


func _spawn_one(type_id: String, pos: Vector3, is_target: bool, suffix: String) -> void:
	var fd := ContentDB.furniture(type_id)
	if fd == null:
		Log.warn("Contract", "Unknown furniture '%s'" % type_id)
		return
	var f := FurnitureController.new()
	add_child(f)
	f.global_position = pos + Vector3(0, fd.dimensions.y * 0.5, 0)
	f.setup(fd, "%s_%s" % [type_id, suffix], is_target)
	_controllers[f.furniture_id] = f


func _spawn_instability() -> void:
	_instability = load("res://game/contract/property_instability.gd").new()
	_instability.name = "PropertyInstability"
	# Apply instability-speed modifiers.
	for m in contract.modifiers:
		var eff: Dictionary = ContentDB.modifier(m).get("effects", {})
		if eff.has("instability_rate"):
			_instability.rate_multiplier *= float(eff["instability_rate"])
	add_child(_instability)


func _spawn_players(start: Vector3) -> void:
	_player = PlayerController.new()
	_player.peer_id = Net.local_id()
	_player.display_name = Platform.display_name()
	add_child(_player)
	_player.global_position = start

	# Solo mode: add AI assistants that follow and can be directed via pings.
	if Net.peer_count() <= 1:
		for i in range(SOLO_ASSISTANTS):
			var a := AIAssistant.new()
			a.peer_id = Net.local_id()   # same authority; brains are local
			add_child(a)
			a.global_position = start + Vector3(1.5 * (i + 1), 0, 0)
			a.leader = _player
			a.issue_command(AIAssistant.Command.FOLLOW)
			_assistants.append(a)


func _spawn_hud() -> void:
	_hud = load("res://game/ui/hud/hud.gd").new()
	add_child(_hud)
	_hud.setup(_player, contract.target_ids.size())
	_hud.set_objectives(contract.objectives)


func _connect_signals() -> void:
	_van.target_loaded.connect(_on_target_loaded)
	_van.all_targets_loaded.connect(func() -> void: _finish(true, false))
	EventBus.furniture_damaged.connect(_on_furniture_damaged)
	EventBus.contract_objective_updated.connect(_on_objective_updated)
	EventBus.player_incapacitated.connect(func(_p: int, _r: String) -> void: pass)
	EventBus.player_revived.connect(func(_p: int) -> void: _rescues += 1)
	EventBus.ping_placed.connect(_on_ping)


func _on_target_loaded(_fid: String, loaded: int, total: int) -> void:
	if loaded >= total:
		_hud.mark_objective("load_targets", true)


func _on_furniture_damaged(fid: String, amount: float) -> void:
	_damage_events += 1
	var f: FurnitureController = _controllers.get(fid, null)
	if f != null:
		_damage_value += amount * f.data.value
	# Fails the "no broken doors" style objectives if a valuable breaks badly.


func _on_objective_updated(objective_id: String, complete: bool) -> void:
	if objective_id == "no_broken_doors" and not complete:
		_optional_failed["no_broken_doors"] = true
		_hud.mark_objective("no_broken_doors", false)


func _on_ping(_peer: int, position: Vector3, _kind: String) -> void:
	# Direct an idle assistant to grab the nearest target near the ping.
	var target := _nearest_target(position)
	if target == null:
		return
	for a in _assistants:
		if a.command == AIAssistant.Command.FOLLOW and not a.is_carrying():
			a.issue_command(AIAssistant.Command.GRAB, target)
			return


func _nearest_target(pos: Vector3) -> FurnitureController:
	var best: FurnitureController = null
	var best_d := 6.0
	for id in _controllers.keys():
		var f: FurnitureController = _controllers[id]
		if f.is_target and not f.in_van:
			var d := f.global_position.distance_to(pos)
			if d < best_d:
				best_d = d
				best = f
	return best


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		_toggle_pause()


# --- Pause ---
func _toggle_pause() -> void:
	if _pause_menu != null and is_instance_valid(_pause_menu):
		_pause_menu.queue_free()
		_pause_menu = null
		get_tree().paused = false
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		return
	get_tree().paused = bool(Settings.get_value("accessibility", "pause_in_solo")) and Net.peer_count() <= 1
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_pause_menu = _build_pause_menu()
	add_child(_pause_menu)


func _build_pause_menu() -> CanvasLayer:
	var layer := CanvasLayer.new()
	layer.layer = 50
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.7)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	center.add_child(vb)
	_pause_button(vb, "PAUSE_RESUME", _toggle_pause)
	_pause_button(vb, "PAUSE_ABANDON", func() -> void: _finish(false, true))
	_pause_button(vb, "PAUSE_QUIT_MENU", func() -> void:
		get_tree().paused = false
		Net.disconnect_all()
		App.go_to_main_menu())
	return layer


func _pause_button(parent: VBoxContainer, key: String, handler: Callable) -> void:
	var b := Button.new()
	b.text = Loc.t(key)
	b.custom_minimum_size = Vector2(280, 0)
	b.pressed.connect(handler)
	parent.add_child(b)


# --- Completion ---
func _finish(success: bool, abandoned: bool) -> void:
	if _finished:
		return
	_finished = true
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

	var delivered := _van.loaded_count()
	var total := contract.target_ids.size()
	var optional := contract.objectives.filter(func(o: Dictionary) -> bool: return bool(o.get("optional", false)))
	var optional_done := 0
	for o in optional:
		if not _optional_failed.has(str(o.get("id", ""))):
			optional_done += 1

	var perfect := success and delivered >= total and _damage_events == 0 \
		and optional_done == optional.size() and total > 0

	var run := {
		"success": success and not abandoned,
		"abandoned": abandoned,
		"delivered": delivered,
		"total_targets": total,
		"damage_value": int(_damage_value),
		"damage_events": _damage_events,
		"optional_completed": optional_done,
		"optional_total": optional.size(),
		"perfect": perfect,
		"rescues": _rescues,
		"residue_events": _residue_events,
		"highlight_player": _player.display_name if _player != null else "An employee",
		"seed_string": contract.seed_string(),
	}

	var reward := RewardCalculator.compute(contract, run)
	run["payout"] = reward["payout"]
	_apply_rewards(reward, run)

	var report := IncidentReport.generate(run, contract.seed_value)
	report["reward"] = reward
	App.session["last_result"] = report
	EventBus.contract_completed.emit(report)
	SaveManager.save()
	App.change_scene("incident_report")


func _apply_rewards(reward: Dictionary, run: Dictionary) -> void:
	if SaveManager.current.is_empty():
		return
	SaveManager.add_resource(GameConstants.RES_CASH, int(reward["payout"]))
	SaveManager.add_resource(GameConstants.RES_REPUTATION, int(reward["reputation"]))
	SaveManager.add_resource(GameConstants.RES_RESIDUE, int(reward["residue"]))
	SaveManager.add_resource(GameConstants.RES_INSURANCE, int(reward["insurance_delta"]))
	var stats: Dictionary = SaveManager.current["stats"]
	if run["success"]:
		stats["contracts_completed"] = int(stats.get("contracts_completed", 0)) + 1
	else:
		stats["contracts_failed"] = int(stats.get("contracts_failed", 0)) + 1
	stats["furniture_delivered"] = int(stats.get("furniture_delivered", 0)) + int(run["delivered"])
	stats["total_earnings"] = int(stats.get("total_earnings", 0)) + int(reward["payout"])
	if run["perfect"]:
		stats["perfect_moves"] = int(stats.get("perfect_moves", 0)) + 1
	_check_achievements(run)
	_unlock_by_reputation()


func _check_achievements(run: Dictionary) -> void:
	Platform.unlock_achievement("ach_first_day_on_the_job")
	if run["delivered"] > 0:
		Platform.unlock_achievement("ach_packed_and_loaded")
	if run["perfect"]:
		Platform.unlock_achievement("ach_perfect_move")
	if "sofa" in contract.target_ids and run["success"]:
		Platform.unlock_achievement("ach_sofa_so_good")


func _unlock_by_reputation() -> void:
	var rep := SaveManager.get_resource(GameConstants.RES_REPUTATION)
	var unlocked: Array = SaveManager.current["unlocked_locations"]
	for lid in ContentDB.location_ids():
		var loc := ContentDB.location(lid)
		var need := int(loc.get("danger", 1)) * 40
		if rep >= need and not unlocked.has(lid):
			unlocked.append(lid)
			Log.info("Progress", "Unlocked location: %s" % lid)
