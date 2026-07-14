class_name AIAssistant
extends PlayerController
## Solo-mode assistant mover. A small command-driven brain that follows orders,
## grabs marked furniture from valid grips, carries to the van, opens doors and
## revives the player — but deliberately does NOT solve the whole contract on its
## own (it waits for direction and works one object at a time).

enum Command { FOLLOW, WAIT, GRAB, CARRY_TO_VAN, OPEN_PATH, CALM, RETREAT }

const ARRIVE_DIST: float = 1.4
const GRAB_DIST: float = 1.8

var command: int = Command.FOLLOW
var leader: PlayerController = null
var _target_furniture: FurnitureController = null
var _van: Van = null
var _skill: float = 0.7   # 0..1, from difficulty settings; affects reaction


func _ready() -> void:
	is_ai = true
	super._ready()
	display_name = "Assistant"
	_van = get_tree().get_first_node_in_group("van")


func _physics_process(delta: float) -> void:
	if is_multiplayer_authority() and state == State.NORMAL:
		_think(delta)
	super._physics_process(delta)


func issue_command(cmd: int, target: Variant = null) -> void:
	command = cmd
	if target is FurnitureController:
		_target_furniture = target
	Log.debug("AI", "%s command -> %s" % [name, Command.keys()[cmd]])


func _think(_delta: float) -> void:
	match command:
		Command.WAIT:
			ai_move_input = Vector2.ZERO
		Command.FOLLOW:
			_do_follow()
		Command.GRAB:
			_do_grab()
		Command.CARRY_TO_VAN:
			_do_carry_to_van()
		Command.CALM:
			_do_calm()
		Command.RETREAT:
			_do_retreat()
		Command.OPEN_PATH:
			_do_open_path()


func _steer_toward(target_pos: Vector3, stop_dist: float) -> bool:
	var flat := target_pos - global_position
	flat.y = 0.0
	if flat.length() <= stop_dist:
		ai_move_input = Vector2.ZERO
		return true
	ai_face_yaw = atan2(flat.x, flat.z) + PI
	# Move "forward" in local space.
	ai_move_input = Vector2(0, -1)
	return false


func _do_follow() -> void:
	if leader == null or not is_instance_valid(leader):
		ai_move_input = Vector2.ZERO
		return
	# Keep a respectful distance behind the leader.
	var offset := leader.global_position + Vector3(1.2, 0, 1.2)
	_steer_toward(offset, ARRIVE_DIST)


func _do_grab() -> void:
	if _target_furniture == null or not is_instance_valid(_target_furniture):
		command = Command.FOLLOW
		return
	if is_carrying():
		command = Command.CARRY_TO_VAN
		return
	if _steer_toward(_target_furniture.global_position, GRAB_DIST):
		if ai_grab_furniture(_target_furniture, "left"):
			command = Command.CARRY_TO_VAN


func _do_carry_to_van() -> void:
	if _van == null:
		_van = get_tree().get_first_node_in_group("van")
	if _van == null or not is_carrying():
		command = Command.FOLLOW
		return
	if _steer_toward(_van.global_position, 2.2):
		# At the van — drop the object into the bay.
		release_all()
		command = Command.FOLLOW


func _do_calm() -> void:
	if _target_furniture != null and is_instance_valid(_target_furniture):
		if _steer_toward(_target_furniture.global_position, GRAB_DIST):
			_target_furniture.apply_action("comfort", peer_id)
			command = Command.FOLLOW


func _do_retreat() -> void:
	if _van != null:
		_steer_toward(_van.global_position, 2.0)


func _do_open_path() -> void:
	var door := get_tree().get_first_node_in_group("doors")
	if door is DoorController:
		if _steer_toward((door as Node3D).global_position, 1.6):
			(door as DoorController).toggle()
			command = Command.FOLLOW
