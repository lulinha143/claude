class_name DoorController
extends Node3D
## A physics door: a hinged rigid panel attached to a static frame. Reacts to
## force (furniture can shove it), can be opened by interaction, and can BREAK
## when hit hard enough — which trips the "don't break any doors" objective.
## Built entirely in code so levels can place doors procedurally.

signal door_broken(door_id: String)

@export var door_id: String = "door"
@export var width: float = 1.0
@export var height: float = 2.0

var is_open: bool = false
var is_broken: bool = false

var _panel: RigidBody3D
var _hinge: HingeJoint3D


func _ready() -> void:
	add_to_group("doors")
	_build()


func _build() -> void:
	# Static frame anchor.
	var frame := StaticBody3D.new()
	frame.name = "Frame"
	add_child(frame)
	var fmat := StandardMaterial3D.new()
	fmat.albedo_color = Color(0.35, 0.28, 0.2)
	for side in [-1.0, 1.0]:
		var post := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.08, height, 0.12)
		post.mesh = bm
		post.material_override = fmat
		post.position = Vector3(side * (width * 0.5 + 0.04), height * 0.5, 0)
		frame.add_child(post)

	# Swinging panel.
	_panel = RigidBody3D.new()
	_panel.name = "Panel"
	_panel.mass = 12.0
	_panel.position = Vector3(width * 0.5, height * 0.5, 0)
	_panel.contact_monitor = true
	_panel.max_contacts_reported = 2
	_panel.collision_layer = 1 << (GameConstants.LAYER_PROP - 1)
	add_child(_panel)
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(width, height, 0.06)
	col.shape = box
	col.position = Vector3(-width * 0.5, 0, 0)
	_panel.add_child(col)
	var mi := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3(width, height, 0.06)
	mi.mesh = pm
	var dmat := StandardMaterial3D.new()
	dmat.albedo_color = Color(0.5, 0.36, 0.24)
	mi.material_override = dmat
	mi.position = Vector3(-width * 0.5, 0, 0)
	_panel.add_child(mi)

	# Hinge on the frame side.
	_hinge = HingeJoint3D.new()
	_hinge.position = Vector3(width * 0.5, height * 0.5, 0)
	_hinge.node_a = _panel.get_path()
	_hinge.node_b = frame.get_path()
	_hinge.set_param(HingeJoint3D.PARAM_LIMIT_LOWER, -PI * 0.6)
	_hinge.set_param(HingeJoint3D.PARAM_LIMIT_UPPER, PI * 0.6)
	_hinge.set_flag(HingeJoint3D.FLAG_USE_LIMIT, true)
	add_child(_hinge)

	_panel.body_entered.connect(_on_panel_hit)


func toggle() -> void:
	if is_broken:
		return
	is_open = not is_open
	var dir := 1.0 if is_open else -1.0
	_panel.apply_torque_impulse(Vector3(0, dir * 6.0, 0))
	Audio.play_sfx("creak", randf_range(0.9, 1.1))


func _on_panel_hit(body: Node) -> void:
	if is_broken:
		return
	var speed := 0.0
	if body is RigidBody3D:
		speed = (body as RigidBody3D).linear_velocity.length()
	if speed > 7.0:
		_break()


func _break() -> void:
	is_broken = true
	_hinge.set_flag(HingeJoint3D.FLAG_USE_LIMIT, false)
	_hinge.node_a = NodePath("")
	_hinge.node_b = NodePath("")
	_panel.apply_central_impulse(Vector3(randf_range(-2, 2), 1, randf_range(-2, 2)))
	Audio.play_sfx("thud_heavy")
	door_broken.emit(door_id)
	EventBus.contract_objective_updated.emit("no_broken_doors", false)
	Log.info("Door", "Door '%s' broke." % door_id)
