class_name PlayerController
extends CharacterBody3D
## Mover (player) controller. First/third-person, stamina, two-hand force-based
## grabbing, calming actions, and non-lethal incapacitation states. Each player
## is authoritative over their own body; remote players are interpolated.

enum State { NORMAL, INCAPACITATED, GHOST }

const HOLD_DISTANCE: float = 1.6
const MOUSE_SENS_BASE: float = 0.0025
const SYNC_HZ: float = 20.0

@export var peer_id: int = 1
@export var is_ai: bool = false

var state: int = State.NORMAL
var stamina: float = Balance.PLAYER_MAX_STAMINA
var display_name: String = "Mover"

# Grab: hand -> {furniture:FurnitureController, grip:int}
var _hands: Dictionary = {"left": null, "right": null}
var _external_pull: Vector3 = Vector3.ZERO

# Nodes
var _cam_pivot: Node3D
var _cam_arm: SpringArm3D
var _camera: Camera3D
var _body_mesh: Node3D          # the visible chunky mover character
var _arm_l: Node3D
var _arm_r: Node3D
var _look_ray: RayCast3D
var _anim_time: float = 0.0

var _yaw: float = 0.0
var _pitch: float = 0.0
var _sync_accum: float = 0.0
var _net_pos: Vector3
var _net_yaw: float = 0.0
var _has_net: bool = false
var _incap_reason: String = ""

# AI drive inputs (set by an AIAssistant brain when is_ai == true).
var ai_move_input: Vector2 = Vector2.ZERO
var ai_face_yaw: float = 0.0


func _ready() -> void:
	_build_nodes()
	add_to_group("player")
	collision_layer = 1 << (GameConstants.LAYER_PLAYER - 1)
	collision_mask = (1 << (GameConstants.LAYER_WORLD - 1)) | (1 << (GameConstants.LAYER_FURNITURE - 1)) | (1 << (GameConstants.LAYER_PROP - 1))
	set_multiplayer_authority(peer_id)
	var mine := is_multiplayer_authority() and not is_ai
	_camera.current = mine
	if mine:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _build_nodes() -> void:
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.35
	capsule.height = 1.4
	var cs := CollisionShape3D.new()
	cs.shape = capsule
	cs.position = Vector3(0, 0.7, 0)
	add_child(cs)

	_build_character(_character_color())

	# Camera rig: pivot -> spring arm (collision) -> camera.
	_cam_pivot = Node3D.new()
	_cam_pivot.position = Vector3(0, 1.35, 0)
	add_child(_cam_pivot)
	_cam_arm = SpringArm3D.new()
	_cam_arm.spring_length = 4.2
	_cam_arm.margin = 0.4
	_cam_arm.collision_mask = 1 << (GameConstants.LAYER_WORLD - 1)
	_cam_pivot.add_child(_cam_arm)
	_camera = Camera3D.new()
	_camera.fov = float(Settings.get_value("gameplay", "fov"))
	_cam_arm.add_child(_camera)
	_apply_camera_mode()

	# Grab aim ray originates at the character and points forward.
	_look_ray = RayCast3D.new()
	_look_ray.position = Vector3(0, 1.0, 0)
	_look_ray.target_position = Vector3(0, 0, -Balance.GRAB_REACH)
	_look_ray.collision_mask = 1 << (GameConstants.LAYER_FURNITURE - 1)
	add_child(_look_ray)


func _character_color() -> Color:
	# Uniform colour from the saved character, if any.
	var default := Color(0.92, 0.46, 0.13)
	if SaveManager.current == null or SaveManager.current.is_empty():
		return default
	var raw: Variant = SaveManager.current.get("character", {}).get("uniform_color", "")
	if raw is String and not (raw as String).is_empty():
		return Color(raw)
	return default


## Builds a stylised, chunky mover: boots, body in a company uniform, oversized
## gloves, a helmet and a simple face. Arms are separate so they can raise into a
## carry pose. All primitives — replaceable later with an imported model.
func _build_character(uniform: Color) -> void:
	_body_mesh = Node3D.new()
	_body_mesh.name = "Character"
	add_child(_body_mesh)
	var skin := _std(Color(0.86, 0.66, 0.5))
	var uni := _std(uniform)
	var dark := _std(Color(0.18, 0.16, 0.2))
	var glove := _std(Color(0.95, 0.82, 0.35))
	var helmet := _std(Color(0.95, 0.78, 0.2), 0.5)

	# Boots.
	for sx in [-0.16, 0.16]:
		_part(_body_mesh, _boxmesh(Vector3(0.22, 0.22, 0.34)), dark, Vector3(sx, 0.11, 0.02))
	# Legs.
	for sx in [-0.14, 0.14]:
		_part(_body_mesh, _boxmesh(Vector3(0.2, 0.5, 0.24)), dark, Vector3(sx, 0.42, 0))
	# Torso (rounded-ish body).
	_part(_body_mesh, _boxmesh(Vector3(0.62, 0.7, 0.42)), uni, Vector3(0, 1.02, 0))
	# Company badge stripe.
	_part(_body_mesh, _boxmesh(Vector3(0.64, 0.14, 0.02)), glove, Vector3(0, 1.0, 0.22))
	# Head + helmet + face.
	var head := _part(_body_mesh, _sphere(0.2), skin, Vector3(0, 1.55, 0))
	_part(head, _hemisphere(0.24), helmet, Vector3(0, 0.06, 0))
	_part(head, _boxmesh(Vector3(0.42, 0.08, 0.02)), helmet, Vector3(0, 0.02, 0.19))  # visor brim
	var eyes := _std(Color(0.1, 0.1, 0.12))
	for ex in [-0.07, 0.07]:
		_part(head, _sphere(0.03), eyes, Vector3(ex, 0.0, 0.19))
	# Arms (pivot at shoulder so we can raise them).
	_arm_l = Node3D.new()
	_arm_l.position = Vector3(-0.38, 1.25, 0)
	_body_mesh.add_child(_arm_l)
	_part(_arm_l, _boxmesh(Vector3(0.18, 0.5, 0.2)), uni, Vector3(0, -0.22, 0))
	_part(_arm_l, _boxmesh(Vector3(0.22, 0.2, 0.24)), glove, Vector3(0, -0.5, 0.02))
	_arm_r = Node3D.new()
	_arm_r.position = Vector3(0.38, 1.25, 0)
	_body_mesh.add_child(_arm_r)
	_part(_arm_r, _boxmesh(Vector3(0.18, 0.5, 0.2)), uni, Vector3(0, -0.22, 0))
	_part(_arm_r, _boxmesh(Vector3(0.22, 0.2, 0.24)), glove, Vector3(0, -0.5, 0.02))


func _apply_camera_mode() -> void:
	var third := int(Settings.get_value("gameplay", "camera_mode")) == 1
	_cam_arm.spring_length = 4.2 if third else 0.0
	_camera.position = Vector3(0.4, 0.1, 0) if third else Vector3(0, 0, 0)
	_body_mesh.visible = third
	_camera.fov = float(Settings.get_value("gameplay", "fov"))


# --- Small mesh helpers ----------------------------------------------------
func _std(c: Color, rough: float = 0.85) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	return m


func _boxmesh(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


func _sphere(r: float) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	return s


func _hemisphere(r: float) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.is_hemisphere = true
	return s


func _part(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
	return mi


func _unhandled_input(event: InputEvent) -> void:
	if is_ai or not is_multiplayer_authority() or state == State.INCAPACITATED:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var sx := float(Settings.get_value("gameplay", "sensitivity_x"))
		var sy := float(Settings.get_value("gameplay", "sensitivity_y"))
		var inv := -1.0 if bool(Settings.get_value("gameplay", "invert_y")) else 1.0
		_yaw -= event.relative.x * MOUSE_SENS_BASE * sx
		_pitch = clampf(_pitch - event.relative.y * MOUSE_SENS_BASE * sy * inv, -1.4, 1.4)


func _physics_process(delta: float) -> void:
	if not is_multiplayer_authority():
		_interpolate_remote(delta)
		return
	if state == State.GHOST:
		_process_ghost(delta)
		return
	if state == State.INCAPACITATED:
		velocity = Vector3.ZERO
		return
	_process_movement(delta)
	if not is_ai:
		_process_actions()
	_maybe_sync()


func _process_movement(delta: float) -> void:
	if is_ai:
		_yaw = ai_face_yaw
	rotation.y = _yaw
	_cam_pivot.rotation.x = _pitch

	var input := Vector2.ZERO
	if is_ai:
		input = ai_move_input
	else:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := (transform.basis * Vector3(input.x, 0, input.y)).normalized()

	var sprinting := Input.is_action_pressed("sprint") and stamina > 0.0 and not is_ai
	var crouching := Input.is_action_pressed("crouch") and not is_ai
	var speed := Balance.PLAYER_WALK_SPEED
	if sprinting:
		speed = Balance.PLAYER_SPRINT_SPEED
	elif crouching:
		speed = Balance.PLAYER_CROUCH_SPEED
	# Heavy carrying slows you down.
	if _carrying_count() > 0:
		speed *= 0.7

	var target := dir * speed
	velocity.x = move_toward(velocity.x, target.x, Balance.PLAYER_ACCEL * delta)
	velocity.z = move_toward(velocity.z, target.z, Balance.PLAYER_ACCEL * delta)
	velocity += _external_pull
	_external_pull = _external_pull.move_toward(Vector3.ZERO, 20.0 * delta)

	if not is_on_floor():
		velocity.y -= 9.8 * delta
	elif Input.is_action_just_pressed("jump") and not is_ai:
		velocity.y = Balance.PLAYER_JUMP_VELOCITY

	# Stamina.
	if sprinting and input != Vector2.ZERO:
		stamina = maxf(0.0, stamina - Balance.PLAYER_STAMINA_DRAIN * delta)
	else:
		stamina = minf(Balance.PLAYER_MAX_STAMINA, stamina + Balance.PLAYER_STAMINA_REGEN * delta)

	move_and_slide()
	_animate(delta)


func _process_actions() -> void:
	if Input.is_action_just_pressed("grab_left"):
		_toggle_grab("left")
	if Input.is_action_just_pressed("grab_right"):
		_toggle_grab("right")
	if Input.is_action_just_pressed("interact"):
		_interact()
	if Input.is_action_just_pressed("ping"):
		_place_ping()


# --- Grabbing --------------------------------------------------------------
func _toggle_grab(hand: String) -> void:
	if _hands[hand] != null:
		_release(hand)
		return
	var f := _look_furniture()
	if f == null:
		return
	var target_pos := _hand_target(hand)
	var grip := f.nearest_free_grip(target_pos)
	if grip < 0:
		return
	if f.grab(grip, peer_id, func() -> Vector3: return _hand_target(hand)):
		_hands[hand] = {"furniture": f, "grip": grip}


func _release(hand: String) -> void:
	var h: Variant = _hands[hand]
	if h != null:
		var f: FurnitureController = h["furniture"]
		if is_instance_valid(f):
			f.release(h["grip"])
	_hands[hand] = null


func release_all() -> void:
	_release("left")
	_release("right")


## AI-facing grab: grabs the nearest free grip of `f` with the given hand.
func ai_grab_furniture(f: FurnitureController, hand: String = "left") -> bool:
	if _hands[hand] != null or not is_instance_valid(f):
		return false
	var target_pos := _hand_target(hand)
	var grip := f.nearest_free_grip(target_pos)
	if grip < 0:
		return false
	if f.grab(grip, peer_id, func() -> Vector3: return _hand_target(hand)):
		_hands[hand] = {"furniture": f, "grip": grip}
		return true
	return false


func is_carrying() -> bool:
	return _carrying_count() > 0


## HUD helper: the furniture currently aimed at (or nearby), if any.
func aimed_furniture() -> FurnitureController:
	return _look_furniture()


## HUD helper: summary of the first carried object (name/emotion/carriers).
func carried_summary() -> Dictionary:
	for h in _hands.values():
		if h != null and is_instance_valid(h["furniture"]):
			var f: FurnitureController = h["furniture"]
			var emo := ""
			if f.emotion_machine != null:
				emo = Emotions.display_name(f.emotion_machine.emotion)
			return {
				"name": f.display_name(),
				"emotion": emo,
				"carriers": f.data.min_carriers,
				"have": f.carrier_count(),
			}
	return {}


func _hand_target(hand: String) -> Vector3:
	# Hold the object in front of the MOVER (keeps it in frame in third person).
	var side := -0.38 if hand == "left" else 0.38
	var forward := -global_transform.basis.z
	var origin := global_position + Vector3(0, 1.15, 0)
	return origin + forward * HOLD_DISTANCE + global_transform.basis.x * side


## Procedural mover animation: a subtle walk bob and a raised "carry" arm pose.
func _animate(delta: float) -> void:
	if _body_mesh == null:
		return
	var reduced := bool(Settings.get_value("accessibility", "reduced_motion"))
	var speed := Vector2(velocity.x, velocity.z).length()
	_anim_time += delta * (6.0 + speed * 2.0)
	var bob := 0.0
	if not reduced and speed > 0.2:
		bob = sin(_anim_time) * 0.035
	_body_mesh.position.y = bob
	# Carry pose: raise arms forward when holding something.
	var carrying := _carrying_count() > 0
	var target := -1.25 if carrying else 0.0
	if _arm_l != null:
		_arm_l.rotation.x = lerp_angle(_arm_l.rotation.x, target, clampf(delta * 10.0, 0.0, 1.0))
	if _arm_r != null:
		_arm_r.rotation.x = lerp_angle(_arm_r.rotation.x, target, clampf(delta * 10.0, 0.0, 1.0))


func _look_furniture() -> FurnitureController:
	_look_ray.force_raycast_update()
	if _look_ray.is_colliding():
		var c := _look_ray.get_collider()
		if c is FurnitureController:
			return c
	# Fallback: nearest furniture within reach in front of us.
	var best: FurnitureController = null
	var best_d := Balance.GRAB_REACH
	for n in get_tree().get_nodes_in_group("furniture"):
		if n is FurnitureController:
			var d := (n as Node3D).global_position.distance_to(global_position)
			if d < best_d:
				best_d = d
				best = n
	return best


func _carrying_count() -> int:
	var c := 0
	for h in _hands.values():
		if h != null:
			c += 1
	return c


# --- Interact / actions ----------------------------------------------------
func _interact() -> void:
	# Revive a downed teammate, or open a door.
	var mate := _nearest_incapacitated(1.8)
	if mate != null:
		mate.revive()
		return
	var f := _look_furniture()
	if f != null:
		f.apply_action("knock", peer_id)


## Applies a calming/emote action to the object we are looking at.
func do_calm_action(action: String) -> void:
	var f := _look_furniture()
	if f != null:
		var result := f.apply_action(action, peer_id)
		if not result.is_empty():
			EventBus.contract_objective_updated.emit("action_" + action, true)


func _place_ping() -> void:
	EventBus.ping_placed.emit(peer_id, global_position - transform.basis.z * 3.0, "look")


# --- Perception (used by furniture) ---------------------------------------
func is_looking_at(world_pos: Vector3) -> bool:
	if state != State.NORMAL:
		return false
	var to_obj := (world_pos - _camera.global_position).normalized()
	var forward := -_camera.global_transform.basis.z
	return forward.dot(to_obj) > 0.85


func apply_external_pull(vec: Vector3) -> void:
	_external_pull += vec


# --- Incapacitation (non-lethal, comedic) ----------------------------------
func incapacitate(reason: String) -> void:
	if state == State.INCAPACITATED:
		return
	state = State.INCAPACITATED
	_incap_reason = reason
	release_all()
	# Squash the body mesh for the "flattened/folded/boxed" gag.
	_body_mesh.scale = Vector3(1.4, 0.3, 1.4)
	EventBus.player_incapacitated.emit(peer_id, reason)
	Log.info("Player", "%s incapacitated (%s)" % [display_name, reason])


func revive() -> void:
	if state != State.INCAPACITATED:
		return
	state = State.NORMAL
	_body_mesh.scale = Vector3.ONE
	stamina = Balance.PLAYER_MAX_STAMINA * 0.5
	EventBus.player_revived.emit(peer_id)


func become_ghost() -> void:
	state = State.GHOST
	_body_mesh.transparency = 0.6
	collision_layer = 0
	collision_mask = 0


func _process_ghost(delta: float) -> void:
	# Ghosts drift slowly and can still ping to help teammates.
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back") if not is_ai else Vector2.ZERO
	var dir := (transform.basis * Vector3(input.x, 0, input.y)).normalized()
	global_position += dir * 2.0 * delta
	rotation.y = _yaw
	_cam_pivot.rotation.x = _pitch
	if Input.is_action_just_pressed("ping") and not is_ai:
		_place_ping()


func _nearest_incapacitated(radius: float) -> PlayerController:
	for n in get_tree().get_nodes_in_group("player"):
		if n is PlayerController and n != self and n.state == State.INCAPACITATED:
			if (n as Node3D).global_position.distance_to(global_position) < radius:
				return n
	return null


# --- Networking ------------------------------------------------------------
func _maybe_sync() -> void:
	if multiplayer.multiplayer_peer == null or Net.peer_count() <= 1:
		return
	_sync_accum += get_physics_process_delta_time()
	if _sync_accum < 1.0 / SYNC_HZ:
		return
	_sync_accum = 0.0
	_sync_player.rpc(global_position, _yaw, _pitch, state)


@rpc("authority", "unreliable_ordered", "call_remote")
func _sync_player(pos: Vector3, yaw: float, pitch: float, st: int) -> void:
	_net_pos = pos
	_net_yaw = yaw
	_pitch = pitch
	state = st
	_has_net = true


func _interpolate_remote(delta: float) -> void:
	if not _has_net:
		return
	global_position = global_position.lerp(_net_pos, clampf(delta * 15.0, 0.0, 1.0))
	rotation.y = lerp_angle(rotation.y, _net_yaw, clampf(delta * 15.0, 0.0, 1.0))
	_cam_pivot.rotation.x = _pitch
