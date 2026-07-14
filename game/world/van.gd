class_name Van
extends Node3D
## The company moving van + its loading zone. An Area3D detects target furniture
## that comes to rest inside the cargo bay and marks it loaded. When all targets
## are loaded, the escape is available. Also the seed of the "possessed van"
## late-game arc (van_mood rises with agitated cargo).

signal target_loaded(furniture_id: String, loaded: int, total: int)
signal all_targets_loaded()

var total_targets: int = 0
var loaded_ids: Dictionary = {}
var van_mood: float = 0.0

var _zone: Area3D
var _dwell: Dictionary = {}   # furniture -> seconds inside


func _ready() -> void:
	add_to_group("van")
	_build()


func _build() -> void:
	var fd := ContentDB.furniture("moving_van")
	if fd != null:
		var visual := FurnitureMeshFactory.build_visual(fd)
		visual.position = Vector3(0, 1.3, 0)
		add_child(visual)
	# Static collision floor + walls of the cargo bay (open at the back).
	var body := StaticBody3D.new()
	add_child(body)
	_add_box(body, Vector3(3.4, 0.2, 2.0), Vector3(0, 0.3, 0))       # floor
	_add_box(body, Vector3(0.2, 1.8, 2.0), Vector3(-1.7, 1.2, 0))    # front wall
	_add_box(body, Vector3(3.4, 1.8, 0.2), Vector3(0, 1.2, -1.0))    # left wall
	_add_box(body, Vector3(3.4, 1.8, 0.2), Vector3(0, 1.2, 1.0))     # right wall

	# Loading detection zone.
	_zone = Area3D.new()
	_zone.name = "LoadZone"
	_zone.collision_mask = 1 << (GameConstants.LAYER_FURNITURE - 1)
	add_child(_zone)
	var zc := CollisionShape3D.new()
	var zb := BoxShape3D.new()
	zb.size = Vector3(3.2, 1.6, 1.8)
	zc.shape = zb
	zc.position = Vector3(0, 1.1, 0)
	_zone.add_child(zc)


func _add_box(parent: StaticBody3D, size: Vector3, pos: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new()
	b.size = size
	cs.shape = b
	cs.position = pos
	parent.add_child(cs)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.4, 0.3)
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)


func set_targets(count: int) -> void:
	total_targets = count


func _physics_process(delta: float) -> void:
	# A target counts as loaded once it rests inside the zone for a moment.
	var inside := _zone.get_overlapping_bodies()
	for body in inside:
		if body is FurnitureController:
			var f: FurnitureController = body
			if not f.is_target or f.in_van:
				continue
			if f.linear_velocity.length() < 1.2:
				_dwell[f] = float(_dwell.get(f, 0.0)) + delta
				if _dwell[f] > 0.6:
					_load(f)
			else:
				_dwell[f] = 0.0
			van_mood += f.emotion_machine.arousal * 0.0001 if f.emotion_machine != null else 0.0


func _load(f: FurnitureController) -> void:
	f.mark_loaded()
	loaded_ids[f.furniture_id] = true
	Audio.play_sfx("chime")
	target_loaded.emit(f.furniture_id, loaded_ids.size(), total_targets)
	if loaded_ids.size() >= total_targets and total_targets > 0:
		all_targets_loaded.emit()


func loaded_count() -> int:
	return loaded_ids.size()
