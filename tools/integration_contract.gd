extends Node
## Headless integration test: runs a real contract end-to-end and asserts the
## vertical slice works — furniture spawns, the van detects loaded targets,
## rewards are applied, and progression is saved. Quits 0 (pass) / 1 (fail).
##
## Run: godot --headless --path . tools/integration_contract.tscn

enum Phase { SETUP, SPAWNED, LOADING, DONE }

var _phase: int = Phase.SETUP
var _runner: Node
var _van: Van
var _targets: Array[FurnitureController] = []
var _elapsed: float = 0.0
var _cash_before: int = 0
var _passed: bool = false
var _fail_reason: String = ""


func _ready() -> void:
	EventBus.contract_completed.connect(_on_completed)
	# Fresh company + offline session.
	SaveManager.new_company("Integration Test Co")
	_cash_before = SaveManager.get_resource(GameConstants.RES_CASH)
	Net.start_offline()
	# Deterministic contract with a couple of targets.
	var contract := ContractGenerator.generate("suburban_house", 424242, 999)
	App.session["selected_contract"] = contract
	# Instantiate the runner under us (so we keep control of the tree).
	_runner = load("res://game/world/contract_runner.tscn").instantiate()
	add_child(_runner)
	_phase = Phase.SPAWNED
	print("[IT] Contract %s with %d targets" % [contract.id, contract.target_ids.size()])


func _physics_process(delta: float) -> void:
	_elapsed += delta
	match _phase:
		Phase.SPAWNED:
			if _elapsed > 0.5:
				_gather()
		Phase.LOADING:
			_hold_targets_in_van()
			if _elapsed > 12.0:
				_finish(false, "timed out before all targets loaded")
		Phase.DONE:
			pass


func _gather() -> void:
	_van = get_tree().get_first_node_in_group("van")
	if _van == null:
		_finish(false, "no van spawned")
		return
	for n in get_tree().get_nodes_in_group("targets"):
		if n is FurnitureController:
			_targets.append(n)
	if _targets.is_empty():
		_finish(false, "no target furniture spawned")
		return
	print("[IT] Found van + %d target objects" % _targets.size())
	_phase = Phase.LOADING


func _hold_targets_in_van() -> void:
	# Simulate the movers dropping every target into the cargo bay.
	var i := 0
	for f in _targets:
		if not is_instance_valid(f) or f.in_van:
			continue
		var slot := Vector3(-1.0 + i * 0.8, 1.1, 0.0)
		f.global_position = _van.to_global(slot)
		f.linear_velocity = Vector3.ZERO
		f.angular_velocity = Vector3.ZERO
		i += 1


func _on_completed(report: Dictionary) -> void:
	# Assert rewards were applied and saved.
	var cash_after := SaveManager.get_resource(GameConstants.RES_CASH)
	var ok := int(report.get("payout", 0)) > 0 \
		and cash_after > _cash_before \
		and int(report.get("delivered", 0)) == int(report.get("total_targets", -1))
	if ok:
		_finish(true, "")
	else:
		_finish(false, "rewards not applied (payout=%d, cash %d->%d, delivered %s/%s)" % [
			int(report.get("payout", 0)), _cash_before, cash_after,
			str(report.get("delivered")), str(report.get("total_targets"))])


func _finish(passed: bool, reason: String) -> void:
	if _phase == Phase.DONE:
		return
	_phase = Phase.DONE
	_passed = passed
	_fail_reason = reason
	print("\n=== INTEGRATION: %s ===" % ("PASS" if passed else "FAIL"))
	if not passed:
		print("Reason: %s" % reason)
	# Clean up the test company profile.
	if SaveManager.current_slot >= 0:
		SaveManager.delete_profile(SaveManager.current_slot)
	get_tree().quit(0 if passed else 1)
