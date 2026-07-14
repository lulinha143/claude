class_name FurnitureController
extends RigidBody3D
## The one reusable script that drives every sentient object. Behaviour emerges
## from FurnitureData + EmotionMachine + trait tags; nothing about a specific
## object is hardcoded elsewhere. Handles: procedural visuals, force-based
## multi-grab carrying, physics safety, calming/escalation actions, trait
## behaviours, damage, and lightweight host-authoritative network sync.

signal grabbed(grip_index: int, by_peer: int)
signal released(grip_index: int)
signal loaded_into_van()

const SYNC_INTERVAL: float = 1.0 / 15.0

# --- Identity / data ---
var data: FurnitureData
var furniture_id: String = ""     # unique per contract instance
var is_target: bool = false
var damage: float = 0.0           # 0..1
var in_van: bool = false

# --- Emotion ---
var emotion_machine: EmotionMachine

# --- Grab state: grip_index -> {peer:int, target:Callable} ---
var _grabbers: Dictionary = {}

# --- Nodes ---
var _visual: Node3D
var _face: Node3D
var _collision: CollisionShape3D

# --- Behaviour timers ---
var _behaviour_accum: float = 0.0
var _sync_accum: float = 0.0
var _flash_accum: float = 0.0

# --- Network interpolation targets ---
var _net_target_pos: Vector3
var _net_target_basis: Basis
var _has_net_target: bool = false


func setup(fd: FurnitureData, id: String, target: bool) -> void:
	data = fd
	furniture_id = id
	is_target = target
	name = "Furniture_%s" % id

	mass = maxf(1.0, fd.weight)
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = fd.center_of_mass
	continuous_cd = true
	contact_monitor = true
	max_contacts_reported = 4
	can_sleep = true
	collision_layer = 1 << (GameConstants.LAYER_FURNITURE - 1)
	collision_mask = 0xFFFFFFFF

	_visual = FurnitureMeshFactory.build_visual(fd)
	add_child(_visual)
	_collision = FurnitureMeshFactory.build_collision(fd)
	add_child(_collision)
	_build_face()

	emotion_machine = EmotionMachine.new()
	emotion_machine.configure(fd)
	emotion_machine.emotion_changed.connect(_on_emotion_changed)

	add_to_group("furniture")
	if is_target:
		add_to_group("targets")

	body_entered.connect(_on_body_entered)
	set_multiplayer_authority(1)


func _physics_process(delta: float) -> void:
	if emotion_machine != null:
		emotion_machine.tick(delta)

	if is_multiplayer_authority():
		_apply_grab_forces(delta)
		_clamp_velocities()
		_recover_if_out_of_bounds()
		_run_behaviours(delta)
		_maybe_sync()
	else:
		_interpolate_to_net_target(delta)

	_update_flash(delta)


# --- Grab system (force-based, supports multiple grabbers) -----------------
## Registers a grabber. `target_getter` returns the desired world position for
## that grip point (the player's hand target). Returns true if the grip is free.
func grab(grip_index: int, peer: int, target_getter: Callable) -> bool:
	if _grabbers.has(grip_index):
		return false
	_grabbers[grip_index] = {"peer": peer, "target": target_getter}
	sleeping = false
	grabbed.emit(grip_index, peer)
	Audio.play_sfx("grab", randf_range(0.9, 1.1))
	return true


func release(grip_index: int) -> void:
	if _grabbers.has(grip_index):
		_grabbers.erase(grip_index)
		released.emit(grip_index)


func release_peer(peer: int) -> void:
	for gi in _grabbers.keys().duplicate():
		if _grabbers[gi]["peer"] == peer:
			release(gi)


func carrier_count() -> int:
	var peers: Dictionary = {}
	for gi in _grabbers:
		peers[_grabbers[gi]["peer"]] = true
	return peers.size()


func is_carried() -> bool:
	return not _grabbers.is_empty()


func grip_world_position(grip_index: int) -> Vector3:
	if grip_index < 0 or grip_index >= data.grip_points.size():
		return global_position
	return to_global(data.grip_points[grip_index])


func nearest_free_grip(world_pos: Vector3) -> int:
	var best := -1
	var best_d := INF
	for i in range(data.grip_points.size()):
		if _grabbers.has(i):
			continue
		var d := grip_world_position(i).distance_to(world_pos)
		if d < best_d:
			best_d = d
			best = i
	return best


func _apply_grab_forces(_delta: float) -> void:
	if _grabbers.is_empty():
		return
	for gi in _grabbers.keys():
		var getter: Callable = _grabbers[gi]["target"]
		if not getter.is_valid():
			continue
		var desired: Vector3 = getter.call()
		var grip_local: Vector3 = data.grip_points[gi] if gi < data.grip_points.size() else Vector3.ZERO
		var grip_world: Vector3 = to_global(grip_local)
		var to_target: Vector3 = desired - grip_world
		# Spring toward target minus velocity damping at the grip point.
		var point_vel: Vector3 = linear_velocity + angular_velocity.cross(grip_world - global_position)
		var assist := 1.0
		if bool(Settings.get_value("accessibility", "physics_assist")):
			assist = 1.6
		var force: Vector3 = to_target * Balance.GRAB_SPRING * mass * assist - point_vel * Balance.GRAB_DAMP * mass
		force = force.limit_length(Balance.GRAB_MAX_FORCE * assist)
		apply_force(force, grip_world - global_position)
		# Auto-release if stretched beyond breaking distance (something's stuck).
		if to_target.length() > Balance.GRAB_BREAK_DISTANCE:
			release(gi)


func _clamp_velocities() -> void:
	if linear_velocity.length() > Balance.MAX_LINEAR_VELOCITY:
		linear_velocity = linear_velocity.normalized() * Balance.MAX_LINEAR_VELOCITY
	if angular_velocity.length() > Balance.MAX_ANGULAR_VELOCITY:
		angular_velocity = angular_velocity.normalized() * Balance.MAX_ANGULAR_VELOCITY


func _recover_if_out_of_bounds() -> void:
	if global_position.y < Balance.OUT_OF_BOUNDS_Y:
		Log.warn("Furniture", "%s left level bounds; recovering." % furniture_id)
		var recovery := get_tree().get_first_node_in_group("recovery_point")
		global_position = recovery.global_position if recovery != null else Vector3(0, 2, 0)
		linear_velocity = Vector3.ZERO
		angular_velocity = Vector3.ZERO
		agitate(15.0)


# --- Player actions (calming / escalation) ---------------------------------
## Applies a player action verb. Uses data-driven calming/escalating lists plus
## trait-specific responses. Returns a short feedback string for the HUD.
func apply_action(action: String, _by_peer: int = 1) -> String:
	if data == null:
		return ""
	if action in data.calming_actions or _action_soothes(action):
		emotion_machine.soothe(18.0)
		Audio.play_sfx("chime_low")
		return "calmed"
	if action in data.escalating_actions:
		agitate(20.0)
		Audio.play_sfx("murmur_nervous", 1.2)
		return "angered"
	# Neutral acknowledgements.
	match action:
		"knock":
			if _has_trait("shy"):
				emotion_machine.soothe(25.0)
				return "reassured"
			agitate(4.0)
		"comfort":
			emotion_machine.soothe(12.0)
			return "comforted"
		"scold":
			agitate(12.0)
			return "offended"
		"applaud":
			if _has_trait("musical") or _has_trait("dramatic"):
				emotion_machine.soothe(30.0)
				return "delighted"
	return ""


func agitate(amount: float) -> void:
	if emotion_machine != null:
		emotion_machine.agitate(amount)


func _action_soothes(action: String) -> bool:
	# Map generic tool/verb actions to soothing based on likes.
	match action:
		"feed": return _has_trait("hungry")
		"cover": return _has_trait("jealous")
		"portable_lamp": return _has_trait("afraid_of_darkness")
		"promote": return _has_trait("overconfident")
		"add_water": return data.family == "bathroom"
	return false


# --- Trait behaviours (emergent, per-emotion) ------------------------------
func _run_behaviours(delta: float) -> void:
	_behaviour_accum += delta
	if _behaviour_accum < 0.25:
		return
	_behaviour_accum = 0.0

	# Universal: agitated targets raise property instability (handled by
	# PropertyInstability polling is_agitated); calm multi-carry soothes clingy.
	if _has_trait("clingy"):
		_behaviour_clingy()
	if _has_trait("hungry"):
		_behaviour_hungry()
	if _has_trait("shy"):
		_behaviour_shy()
	if _has_trait("afraid_of_darkness") or _has_trait("cowardly"):
		_behaviour_afraid_of_dark()


func _behaviour_clingy() -> void:
	# Calms as more carriers help; panics (and tugs players) when alone.
	if carrier_count() >= 2:
		emotion_machine.soothe(4.0)
		emotion_machine.positive = true
	elif carrier_count() == 0:
		agitate(2.0)
		emotion_machine.positive = false
		if emotion_machine.arousal > Balance.AROUSAL_AGITATED:
			_tug_nearest_player()


func _tug_nearest_player() -> void:
	var p := _nearest_in_group("player", 2.5)
	if p != null and p is Node3D:
		var dir: Vector3 = (global_position - (p as Node3D).global_position)
		if p.has_method("apply_external_pull"):
			p.call("apply_external_pull", dir.normalized() * 3.0)


func _behaviour_hungry() -> void:
	# Seeks loose equipment/props to "eat"; heavier after eating.
	if emotion_machine.arousal > Balance.AROUSAL_NERVOUS:
		var item := _nearest_in_group("equipment", 1.6)
		if item != null and item.has_method("consumed_by_furniture"):
			item.call("consumed_by_furniture")
			mass += 6.0
			emotion_machine.soothe(20.0)   # briefly satisfied
			Audio.play_sfx("thud_heavy")


func _behaviour_shy() -> void:
	# Freezes while watched by any player camera; sluggish otherwise.
	var watched := _is_watched()
	freeze = watched and not is_carried()
	if watched:
		emotion_machine.soothe(1.0)   # feels safe hiding
	else:
		emotion_machine.positive = false


func _behaviour_afraid_of_dark() -> void:
	var lit := _is_lit()
	if not lit:
		agitate(3.0)
	else:
		emotion_machine.soothe(2.0)


# --- Perception helpers ----------------------------------------------------
func _nearest_in_group(group: String, radius: float) -> Node:
	var best: Node = null
	var best_d := radius
	for n in get_tree().get_nodes_in_group(group):
		if n is Node3D:
			var d := (n as Node3D).global_position.distance_to(global_position)
			if d < best_d:
				best_d = d
				best = n
	return best


func _is_watched() -> bool:
	for n in get_tree().get_nodes_in_group("player"):
		if n is Node3D and n.has_method("is_looking_at"):
			if n.call("is_looking_at", global_position):
				return true
	return false


func _is_lit() -> bool:
	# "lights_off" group is populated by the instability system / blackout modifier.
	var globally_dark := not get_tree().get_nodes_in_group("lights_off").is_empty()
	if not globally_dark:
		return true
	# In the dark, only a nearby light source (portable lamp, another lamp) counts.
	return _nearest_in_group("light_source", 6.0) != null


# --- Damage ----------------------------------------------------------------
func _on_body_entered(_body: Node) -> void:
	var speed := linear_velocity.length()
	if speed > 6.0:
		var amt: float = data.fragility * (speed - 6.0) * 0.04
		if amt > 0.01:
			apply_damage(amt)
			Audio.play_sfx("thud", randf_range(0.8, 1.1))


func apply_damage(amount: float) -> void:
	damage = clampf(damage + amount, 0.0, 1.0)
	agitate(amount * 40.0)
	EventBus.furniture_damaged.emit(furniture_id, amount)


func current_value() -> int:
	return int(round(data.value * (1.0 - damage * Balance.REWARD_DAMAGE_PENALTY)))


# --- Face (procedural expression) ------------------------------------------
func _build_face() -> void:
	_face = Node3D.new()
	_face.name = "Face"
	# Place near the top-front of the object.
	_face.position = Vector3(0, data.dimensions.y * 0.25, data.dimensions.z * 0.5 + 0.01)
	add_child(_face)
	var eye_mat := StandardMaterial3D.new()
	eye_mat.albedo_color = Color.WHITE
	for sx in [-0.12, 0.12]:
		var eye := MeshInstance3D.new()
		var sphere := SphereMesh.new()
		sphere.radius = 0.06
		sphere.height = 0.12
		eye.mesh = sphere
		eye.material_override = eye_mat
		eye.position = Vector3(sx, 0, 0)
		_face.add_child(eye)
	_face.visible = false


func _on_emotion_changed(emotion: int, arousal: float) -> void:
	# Faces appear as emotional intensity rises (per art direction).
	if _face != null:
		_face.visible = arousal > Balance.AROUSAL_NERVOUS
	EventBus.furniture_emotion_changed.emit(furniture_id, emotion, arousal)
	# Emotional vocalization.
	if Emotions.is_agitated(emotion):
		Audio.play_sfx("murmur_panic" if emotion == Emotions.E.PANICKED else "murmur_nervous",
			randf_range(0.9, 1.15))


func _update_flash(delta: float) -> void:
	# Anxious lamp panic flash — respects the accessibility "flashing" toggle.
	if not _has_trait("panic_flash"):
		return
	if not bool(Settings.get_value("accessibility", "flashing")):
		return
	if emotion_machine == null or emotion_machine.arousal < Balance.AROUSAL_PANIC:
		return
	_flash_accum += delta


# --- Van ---
func mark_loaded() -> void:
	in_van = true
	loaded_into_van.emit()
	EventBus.furniture_loaded_into_van.emit(furniture_id)


# --- Networking (lightweight host-authoritative sync) ----------------------
func _maybe_sync() -> void:
	if multiplayer.multiplayer_peer == null or Net.peer_count() <= 1:
		return
	_sync_accum += get_physics_process_delta_time()
	if _sync_accum < SYNC_INTERVAL:
		return
	_sync_accum = 0.0
	_sync_state.rpc(global_position, global_transform.basis.get_rotation_quaternion(),
		linear_velocity, emotion_machine.emotion, emotion_machine.arousal)


@rpc("authority", "unreliable_ordered", "call_remote")
func _sync_state(pos: Vector3, rot: Quaternion, vel: Vector3, emo: int, arousal: float) -> void:
	_net_target_pos = pos
	_net_target_basis = Basis(rot)
	linear_velocity = vel
	_has_net_target = true
	if emotion_machine != null:
		emotion_machine.arousal = arousal
		emotion_machine.force_emotion(emo)


func _interpolate_to_net_target(delta: float) -> void:
	if not _has_net_target:
		return
	global_position = global_position.lerp(_net_target_pos, clampf(delta * 12.0, 0.0, 1.0))
	global_transform.basis = global_transform.basis.slerp(_net_target_basis, clampf(delta * 12.0, 0.0, 1.0))


# --- Utility ---------------------------------------------------------------
func _has_trait(tag: String) -> bool:
	return data != null and (tag in data.traits or tag in data.paranormal or tag in data.hidden_traits)


func display_name() -> String:
	return Loc.t(data.name_key) if data != null else "Object"
