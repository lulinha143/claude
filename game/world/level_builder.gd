class_name LevelBuilder
extends RefCounted
## Controlled assembly of a warm, dressed, readable house interior. A handcrafted
## base layout (living room + hallway + back bedroom, a kitchen counter, a rug,
## framed pictures, cardboard boxes and shelves) is lit with warm domestic
## lighting so the space reads as a real home rather than an empty dark box.
## Deterministic clutter placement comes from the contract seed.

# Shared materials (built once per level; reused across props for performance).
static var _mats: Dictionary = {}


static func build(contract: ContractData, parent: Node3D) -> Dictionary:
	_mats.clear()
	var rng := DeterministicRNG.new(contract.seed_value)
	var night := contract.time_of_day == "night"
	var size := Vector2(16.0, 15.0)

	var root := Node3D.new()
	root.name = "Level"
	parent.add_child(root)

	_build_environment(root, night)
	_build_floor(root, size)
	_build_ceiling(root, size, night)
	_build_perimeter(root, size)
	_build_partition(root, size)          # hallway wall + door to bedroom
	_build_kitchen(root, size)
	_dress_living_room(root, size, rng)
	_dress_bedroom(root, size, rng)
	_scatter_boxes(root, size, rng)

	# Recovery point (where out-of-bounds objects reappear) — in the living room.
	var recovery := Node3D.new()
	recovery.name = "RecoveryPoint"
	recovery.add_to_group("recovery_point")
	recovery.position = Vector3(0, 1.0, 2.0)
	root.add_child(recovery)

	# Furniture spawn points, placed in believable spots across the rooms.
	var spawns: Array[Vector3] = [
		Vector3(-4.5, 1.0, 2.5),   # living room left
		Vector3(4.5, 1.0, 2.5),    # living room right
		Vector3(-4.0, 1.0, -3.5),  # bedroom left
		Vector3(3.8, 1.0, -3.8),   # bedroom right
		Vector3(0.0, 1.0, -1.0),   # hallway
		Vector3(5.5, 1.0, -1.5),   # near kitchen
		Vector3(-5.5, 1.0, 4.5),   # front corner
		Vector3(2.0, 1.0, 4.8),    # near entrance
	]
	spawns = _shuffle_vec(rng, spawns)

	# Van sits at the driveway edge (+Z), opening facing the house entrance.
	var van_pos := Vector3(0, 0, size.y * 0.5 + 3.0)
	var player_start := Vector3(0, 1.0, size.y * 0.5 - 1.5)

	return {
		"root": root,
		"spawn_points": spawns,
		"van_pos": van_pos,
		"recovery": recovery.position,
		"player_start": player_start,
		"size": size,
	}


# --- Materials -------------------------------------------------------------
static func _mat(key: String, color: Color, rough: float = 0.9, metal: float = 0.0) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	# Disable specular: large surfaces (floor/walls) were blowing out to white at
	# grazing angles. Flat diffuse suits the clean stylised look.
	m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	_mats[key] = m
	return m


static func _emissive(color: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = energy
	return m


# --- Environment & lighting ------------------------------------------------
static func _build_environment(root: Node3D, night: bool) -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.02, 0.04) if night else Color(0.36, 0.42, 0.52)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.30, 0.30, 0.42) if night else Color(0.60, 0.58, 0.56)
	env.ambient_light_energy = 0.7 if night else 0.85
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_white = 8.0
	env.tonemap_exposure = 0.9
	# Gentle glow so warm lamps bloom a little (not overpowering).
	env.glow_enabled = true
	env.glow_intensity = 0.2
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 1.4
	we.environment = env
	root.add_child(we)

	# Key "window sun" light for shape and warmth.
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42, 38, 0)
	sun.light_energy = 0.25 if night else 0.7
	sun.light_color = Color(0.6, 0.65, 0.9) if night else Color(1.0, 0.94, 0.82)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 40.0
	root.add_child(sun)


static func _room_light(root: Node3D, pos: Vector3, energy: float, color: Color, shadows: bool) -> void:
	var lamp := OmniLight3D.new()
	lamp.position = pos
	lamp.light_energy = energy
	lamp.omni_range = 10.0
	lamp.omni_attenuation = 1.8
	lamp.light_color = color
	lamp.shadow_enabled = shadows
	lamp.add_to_group("light_source")
	root.add_child(lamp)


# --- Shell -----------------------------------------------------------------
static func _build_floor(root: Node3D, size: Vector2) -> void:
	var body := StaticBody3D.new()
	body.name = "Floor"
	body.collision_layer = 1 << (GameConstants.LAYER_WORLD - 1)
	root.add_child(body)
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(size.x + 6.0, 0.4, size.y + 10.0)
	cs.shape = box
	cs.position = Vector3(0, -0.2, 0)
	body.add_child(cs)
	# Warm wood floor.
	_quad(body, Vector2(size.x, size.y), Vector3(0, 0.001, 0), Vector3(-90, 0, 0),
		_mat("floor", Color(0.42, 0.28, 0.17)))
	# Driveway slab outside the entrance (where the van parks).
	_quad(body, Vector2(size.x * 0.6, 6.0), Vector3(0, 0.002, size.y * 0.5 + 3.0),
		Vector3(-90, 0, 0), _mat("drive", Color(0.32, 0.32, 0.34)))


static func _build_ceiling(root: Node3D, size: Vector2, night: bool) -> void:
	var h := 3.0
	# Ceiling plane.
	_box(root, Vector3(size.x, 0.2, size.y), Vector3(0, h, 0), _mat("ceil", Color(0.55, 0.52, 0.5)))
	# Two glowing ceiling light panels + matching omni lights.
	var panel := _emissive(Color(1.0, 0.93, 0.78), 2.2 if not night else 1.4)
	for zx in [Vector3(0, h - 0.11, 3.5), Vector3(0, h - 0.11, -3.5)]:
		_box(root, Vector3(1.6, 0.06, 1.0), zx, panel)
	_room_light(root, Vector3(0, h - 0.4, 3.5), 1.7 if not night else 2.4, Color(1.0, 0.9, 0.75), true)
	_room_light(root, Vector3(0, h - 0.4, -3.5), 1.4 if not night else 2.0, Color(1.0, 0.88, 0.72), true)
	_room_light(root, Vector3(5.5, h - 0.6, -1.0), 1.2 if not night else 1.5, Color(1.0, 0.85, 0.7), false)


static func _build_perimeter(root: Node3D, size: Vector2) -> void:
	var half := size * 0.5
	var wallmat := _mat("wall", Color(0.80, 0.74, 0.64))
	var trimmat := _mat("trim", Color(0.30, 0.24, 0.20))
	# Back + sides. Front (+Z) is left mostly open as the entrance, with two stubs.
	_wall(root, Vector3(0, 1.5, -half.y), Vector3(size.x, 3.0, 0.3), wallmat, trimmat)
	_wall(root, Vector3(-half.x, 1.5, 0), Vector3(0.3, 3.0, size.y), wallmat, trimmat)
	_wall(root, Vector3(half.x, 1.5, 0), Vector3(0.3, 3.0, size.y), wallmat, trimmat)
	# Front entrance stubs (leave a doorway gap in the middle).
	_wall(root, Vector3(-half.x + 2.5, 1.5, half.y), Vector3(5.0, 3.0, 0.3), wallmat, trimmat)
	_wall(root, Vector3(half.x - 2.5, 1.5, half.y), Vector3(5.0, 3.0, 0.3), wallmat, trimmat)
	# A bright "window" on the back wall to motivate the sunlight.
	_box(root, Vector3(2.4, 1.4, 0.06), Vector3(-3.5, 1.7, -half.y + 0.16),
		_emissive(Color(0.75, 0.85, 1.0), 1.6))
	# Framed pictures on the walls (environmental character).
	_frame(root, Vector3(3.5, 1.9, -half.y + 0.2), Color(0.7, 0.5, 0.3))
	_frame(root, Vector3(-half.x + 0.2, 1.9, 1.5), Color(0.4, 0.55, 0.6), true)


static func _build_partition(root: Node3D, size: Vector2) -> void:
	var wallmat := _mat("wall", Color(0.80, 0.74, 0.64))
	var trimmat := _mat("trim", Color(0.30, 0.24, 0.20))
	var z := -1.5
	var seg := (size.x - 2.4) * 0.5
	_wall(root, Vector3(-(seg * 0.5 + 1.2), 1.5, z), Vector3(seg, 3.0, 0.3), wallmat, trimmat)
	_wall(root, Vector3(seg * 0.5 + 1.2, 1.5, z), Vector3(seg, 3.0, 0.3), wallmat, trimmat)
	# Doorway header.
	_box(root, Vector3(2.4, 0.6, 0.3), Vector3(0, 2.7, z), wallmat)
	var door := DoorController.new()
	door.door_id = "hallway_door"
	door.width = 1.1
	door.position = Vector3(-0.55, 0, z)
	root.add_child(door)


static func _build_kitchen(root: Node3D, size: Vector2) -> void:
	var half := size * 0.5
	# An L of kitchen counters along the right wall.
	var counter := _mat("counter", Color(0.55, 0.42, 0.30))
	var top := _mat("countertop", Color(0.2, 0.22, 0.24), 0.4)
	var x := half.x - 0.8
	_box(root, Vector3(1.2, 0.9, 4.0), Vector3(x, 0.45, 1.5), counter)
	_box(root, Vector3(1.3, 0.08, 4.1), Vector3(x, 0.92, 1.5), top)
	# A little sink cube + faucet.
	_box(root, Vector3(0.5, 0.1, 0.5), Vector3(x, 0.9, 1.0), _mat("sink", Color(0.7, 0.72, 0.75), 0.3, 0.6))


# --- Dressing --------------------------------------------------------------
static func _dress_living_room(root: Node3D, size: Vector2, rng: DeterministicRNG) -> void:
	# Area rug defines the living-room zone.
	_quad(root, Vector2(6.0, 4.0), Vector3(0, 0.01, 3.0), Vector3(-90, 0, 0),
		_mat("rug", Color(0.55, 0.20, 0.20)))
	_quad(root, Vector2(5.4, 3.4), Vector3(0, 0.012, 3.0), Vector3(-90, 0, 0),
		_mat("rug2", Color(0.68, 0.28, 0.26)))
	# A bookshelf against the left wall with colourful "books".
	var shelf := _mat("shelf", Color(0.35, 0.24, 0.15))
	var sx := -size.x * 0.5 + 0.6
	_box(root, Vector3(0.5, 2.2, 1.8), Vector3(sx, 1.1, 4.0), shelf)
	var book_cols := [Color(0.7, 0.2, 0.2), Color(0.2, 0.4, 0.7), Color(0.8, 0.7, 0.2), Color(0.3, 0.6, 0.3)]
	for i in range(4):
		var c: Color = book_cols[i % book_cols.size()]
		_box(root, Vector3(0.3, 0.35, 0.14), Vector3(sx + 0.15, 0.5 + i * 0.45, 3.4 + (i % 3) * 0.25), _mat("bk%d" % i, c))
	# A potted plant near the entrance.
	_box(root, Vector3(0.4, 0.4, 0.4), Vector3(size.x * 0.5 - 1.0, 0.2, 4.5), _mat("pot", Color(0.5, 0.3, 0.2)))
	_box(root, Vector3(0.6, 0.9, 0.6), Vector3(size.x * 0.5 - 1.0, 0.85, 4.5), _mat("leaf", Color(0.25, 0.5, 0.25)))


static func _dress_bedroom(root: Node3D, size: Vector2, rng: DeterministicRNG) -> void:
	# Small rug + a wardrobe-side lamp stand (unlit prop) for room identity.
	_quad(root, Vector2(4.0, 3.0), Vector3(0, 0.01, -4.0), Vector3(-90, 0, 0),
		_mat("brug", Color(0.25, 0.30, 0.45)))
	_box(root, Vector3(0.5, 1.0, 0.5), Vector3(size.x * 0.5 - 1.0, 0.5, -5.0), _mat("nstand", Color(0.4, 0.28, 0.18)))
	_frame(root, Vector3(0, 1.9, -size.y * 0.5 + 0.2), Color(0.55, 0.4, 0.6))


static func _scatter_boxes(root: Node3D, size: Vector2, rng: DeterministicRNG) -> void:
	# Cardboard moving boxes — reinforces the company theme.
	var cardboard := _mat("box", Color(0.72, 0.52, 0.30))
	var tape := _mat("tape", Color(0.85, 0.78, 0.55))
	var count := rng.int_range("boxcount", 4, 6)
	for i in range(count):
		var bx := rng.float_range("bx%d" % i, -size.x * 0.4, size.x * 0.4)
		var bz := rng.float_range("bz%d" % i, -size.y * 0.4, size.y * 0.45)
		var s := rng.float_range("bs%d" % i, 0.45, 0.7)
		_box(root, Vector3(s, s, s), Vector3(bx, s * 0.5, bz), cardboard)
		_box(root, Vector3(s * 1.02, 0.02, s * 0.2), Vector3(bx, s + 0.01, bz), tape)


# --- Primitive helpers -----------------------------------------------------
static func _wall(root: Node3D, pos: Vector3, size: Vector3, mat: Material, trim: Material = null) -> void:
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
	mi.material_override = mat
	body.add_child(mi)
	# Baseboard trim along the longer horizontal axis.
	if trim != null:
		var along_x := size.x >= size.z
		var tsize := Vector3(size.x + 0.02, 0.18, 0.05) if along_x else Vector3(0.05, 0.18, size.z + 0.02)
		var toff := Vector3(0, -size.y * 0.5 + 0.09, (size.z * 0.5 + 0.03) if along_x else 0.0)
		if not along_x:
			toff = Vector3(size.x * 0.5 + 0.03, -size.y * 0.5 + 0.09, 0)
		var tm := MeshInstance3D.new()
		var tb := BoxMesh.new()
		tb.size = tsize
		tm.mesh = tb
		tm.material_override = trim
		tm.position = toff
		body.add_child(tm)


static func _box(root: Node3D, size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = size
	mi.mesh = pm
	mi.material_override = mat
	mi.position = pos
	root.add_child(mi)
	return mi


static func _quad(root: Node3D, size: Vector2, pos: Vector3, _rot_deg: Vector3, mat: Material) -> void:
	# Horizontal floor/rug slab. (A thin box is unambiguous about orientation,
	# unlike a rotated PlaneMesh.) rot_deg kept for call-site compatibility.
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(size.x, 0.03, size.y)
	mi.mesh = bm
	mi.material_override = mat
	mi.position = Vector3(pos.x, maxf(pos.y, 0.015), pos.z)
	root.add_child(mi)


static func _frame(root: Node3D, pos: Vector3, color: Color, on_side: bool = false) -> void:
	var frame := _box(root, Vector3(0.9, 0.7, 0.06), pos, _mat("frm", Color(0.2, 0.15, 0.1)))
	var art := _box(root, Vector3(0.72, 0.54, 0.02), pos + Vector3(0, 0, 0.04), _mat("art_%s" % color.to_html(), color))
	if on_side:
		frame.rotation_degrees = Vector3(0, 90, 0)
		art.rotation_degrees = Vector3(0, 90, 0)
		art.position = pos + Vector3(0.04, 0, 0)


static func _shuffle_vec(rng: DeterministicRNG, arr: Array[Vector3]) -> Array[Vector3]:
	var copy := arr.duplicate()
	for i in range(copy.size() - 1, 0, -1):
		var j := rng.int_range("shuf_%d" % i, 0, i)
		var t: Vector3 = copy[i]
		copy[i] = copy[j]
		copy[j] = t
	return copy
