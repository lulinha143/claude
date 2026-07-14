class_name LevelBuilder
extends RefCounted
## Controlled procedural assembly of a contract location. Deterministic from the
## contract seed: builds a floor, perimeter walls, interior partitions with a
## door, ceiling lights, furniture spawn points, a recovery point and the van
## drop-off. Not "fully random" — sizes/layout derive from the location data.

static func build(contract: ContractData, parent: Node3D) -> Dictionary:
	var rng := DeterministicRNG.new(contract.seed_value)
	var loc := ContentDB.location(contract.location_id)
	var room_count: int = maxi(2, (loc.get("rooms", []) as Array).size())
	var size := Vector2(10.0 + room_count * 1.5, 9.0 + room_count * 1.2)

	var root := Node3D.new()
	root.name = "Level"
	parent.add_child(root)

	_build_floor(root, size)
	_build_perimeter(root, size)
	_build_lights(root, size, contract.time_of_day == "night")

	# Interior partition wall with a doorway near the middle.
	var partition_x := rng.float_range("partition", -size.x * 0.15, size.x * 0.15)
	_build_partition(root, size, partition_x)

	# Recovery point (where out-of-bounds objects reappear).
	var recovery := Node3D.new()
	recovery.name = "RecoveryPoint"
	recovery.add_to_group("recovery_point")
	recovery.position = Vector3(0, 1.0, 0)
	root.add_child(recovery)

	# Spawn points spread across the floor (deterministic jitter).
	var spawns: Array[Vector3] = []
	var cols := 4
	var rows := 3
	for i in range(cols):
		for j in range(rows):
			var x := lerpf(-size.x * 0.35, size.x * 0.35, float(i) / float(cols - 1))
			var z := lerpf(-size.y * 0.30, size.y * 0.10, float(j) / float(rows - 1))
			x += rng.float_range("sx_%d_%d" % [i, j], -0.6, 0.6)
			z += rng.float_range("sz_%d_%d" % [i, j], -0.6, 0.6)
			spawns.append(Vector3(x, 1.0, z))
	spawns = _shuffle_vec(rng, spawns)

	# Van sits at the "driveway" edge (+Z), opening facing the house.
	var van_pos := Vector3(0, 0, size.y * 0.5 + 2.5)

	# Player start near the van entrance.
	var player_start := Vector3(0, 1.0, size.y * 0.45)

	return {
		"root": root,
		"spawn_points": spawns,
		"van_pos": van_pos,
		"recovery": recovery.position,
		"player_start": player_start,
		"size": size,
	}


static func _build_floor(root: Node3D, size: Vector2) -> void:
	var body := StaticBody3D.new()
	body.name = "Floor"
	body.collision_layer = 1 << (GameConstants.LAYER_WORLD - 1)
	root.add_child(body)
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(size.x + 4.0, 0.4, size.y + 8.0)
	cs.shape = box
	cs.position = Vector3(0, -0.2, 0)
	body.add_child(cs)
	var mi := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = box.size
	mi.mesh = pm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.28, 0.24, 0.22)
	mi.material_override = mat
	mi.position = Vector3(0, -0.2, 0)
	body.add_child(mi)


static func _build_perimeter(root: Node3D, size: Vector2) -> void:
	var half := size * 0.5
	var walls := [
		[Vector3(0, 1.5, -half.y), Vector3(size.x, 3.0, 0.3)],
		[Vector3(-half.x, 1.5, 0), Vector3(0.3, 3.0, size.y)],
		[Vector3(half.x, 1.5, 0), Vector3(0.3, 3.0, size.y)],
		# Front wall split for the entrance handled implicitly (open +Z side).
	]
	for w in walls:
		_wall(root, w[0], w[1])


static func _build_partition(root: Node3D, size: Vector2, x: float) -> void:
	var seg := size.y * 0.35
	_wall(root, Vector3(x, 1.5, -size.y * 0.15 - seg * 0.5), Vector3(0.3, 3.0, seg))
	var door := DoorController.new()
	door.door_id = "interior_door"
	door.width = 1.2
	door.position = Vector3(x, 0, size.y * 0.05)
	root.add_child(door)


static func _wall(root: Node3D, pos: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 1 << (GameConstants.LAYER_WORLD - 1)
	root.add_child(body)
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	body.add_child(cs)
	body.position = pos
	var mi := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = size
	mi.mesh = pm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.42, 0.38, 0.45)
	mi.material_override = mat
	body.add_child(mi)


static func _build_lights(root: Node3D, size: Vector2, night: bool) -> void:
	# Warm ceiling lights. Grouped as light_source so fearful objects feel safe.
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.03, 0.03, 0.05) if night else Color(0.5, 0.55, 0.62)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.2, 0.2, 0.25) if night else Color(0.5, 0.5, 0.55)
	e.ambient_light_energy = 0.4 if night else 0.8
	env.environment = e
	root.add_child(env)

	var positions := [Vector3(-size.x * 0.2, 2.7, 0), Vector3(size.x * 0.2, 2.7, 0), Vector3(0, 2.7, -size.y * 0.2)]
	for p in positions:
		var lamp := OmniLight3D.new()
		lamp.position = p
		lamp.light_energy = 0.6 if night else 1.2
		lamp.omni_range = 8.0
		lamp.light_color = Color(1.0, 0.9, 0.75)
		lamp.add_to_group("light_source")
		root.add_child(lamp)


static func _shuffle_vec(rng: DeterministicRNG, arr: Array[Vector3]) -> Array[Vector3]:
	var copy := arr.duplicate()
	for i in range(copy.size() - 1, 0, -1):
		var j := rng.int_range("shuf_%d" % i, 0, i)
		var t: Vector3 = copy[i]
		copy[i] = copy[j]
		copy[j] = t
	return copy
