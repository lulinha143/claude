class_name FurnitureMeshFactory
extends RefCounted
## Builds original, code-generated visuals for furniture from primitives so the
## game never shows a plain gray box. Each mesh_kind composes proportioned,
## coloured primitives into a readable silhouette. Real artists later replace the
## visual child node with imported meshes without touching gameplay (the
## collision + grip logic lives on FurnitureController). See ASSET_REPLACEMENT_GUIDE.

## Returns a Node3D containing the visual mesh hierarchy for the given data.
static func build_visual(fd: FurnitureData) -> Node3D:
	var root := Node3D.new()
	root.name = "Visual"
	var mat := _material(fd.base_color)
	var accent := _material(fd.base_color.darkened(0.25))
	match fd.mesh_kind:
		"sofa": _build_sofa(root, fd, mat, accent)
		"fridge": _build_fridge(root, fd, mat, accent)
		"wardrobe": _build_wardrobe(root, fd, mat, accent)
		"lamp": _build_lamp(root, fd, mat, accent)
		"piano": _build_piano(root, fd, mat, accent)
		"bed": _build_bed(root, fd, mat, accent)
		"van": _build_van(root, fd, mat, accent)
		_: _build_block(root, fd, mat, accent, 0.15)
	return root


## Returns a collision shape sized to the object's dimensions.
static func build_collision(fd: FurnitureData) -> CollisionShape3D:
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = fd.dimensions
	cs.shape = box
	return cs


static func _material(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.8
	m.metallic = 0.0
	# Slight rim for the rounded, painted look.
	m.rim_enabled = true
	m.rim = 0.3
	return m


static func _mesh_instance(mesh: Mesh, mat: Material, pos: Vector3, parent: Node3D) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
	return mi


static func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


static func _build_block(root: Node3D, fd: FurnitureData, mat: Material, _accent: Material, _r: float) -> void:
	_mesh_instance(_box(fd.dimensions), mat, Vector3.ZERO, root)


static func _build_sofa(root: Node3D, fd: FurnitureData, mat: Material, accent: Material) -> void:
	var d := fd.dimensions
	# base
	_mesh_instance(_box(Vector3(d.x, d.y * 0.4, d.z)), mat, Vector3(0, -d.y * 0.3, 0), root)
	# backrest
	_mesh_instance(_box(Vector3(d.x, d.y * 0.6, d.z * 0.25)), accent, Vector3(0, d.y * 0.1, -d.z * 0.35), root)
	# armrests
	_mesh_instance(_box(Vector3(d.x * 0.15, d.y * 0.5, d.z)), accent, Vector3(-d.x * 0.42, 0, 0), root)
	_mesh_instance(_box(Vector3(d.x * 0.15, d.y * 0.5, d.z)), accent, Vector3(d.x * 0.42, 0, 0), root)
	# cushions
	_mesh_instance(_box(Vector3(d.x * 0.35, d.y * 0.25, d.z * 0.6)), mat, Vector3(-d.x * 0.2, 0, d.z * 0.05), root)
	_mesh_instance(_box(Vector3(d.x * 0.35, d.y * 0.25, d.z * 0.6)), mat, Vector3(d.x * 0.2, 0, d.z * 0.05), root)


static func _build_fridge(root: Node3D, fd: FurnitureData, mat: Material, accent: Material) -> void:
	var d := fd.dimensions
	_mesh_instance(_box(d), mat, Vector3.ZERO, root)
	# door seam
	_mesh_instance(_box(Vector3(d.x * 0.9, d.y * 0.02, 0.02)), accent, Vector3(0, d.y * 0.15, d.z * 0.5), root)
	# handle
	_mesh_instance(_box(Vector3(0.05, d.y * 0.5, 0.05)), accent, Vector3(d.x * 0.35, 0, d.z * 0.52), root)


static func _build_wardrobe(root: Node3D, fd: FurnitureData, mat: Material, accent: Material) -> void:
	var d := fd.dimensions
	_mesh_instance(_box(d), mat, Vector3.ZERO, root)
	# two doors
	_mesh_instance(_box(Vector3(0.03, d.y * 0.9, 0.03)), accent, Vector3(0, 0, d.z * 0.5), root)
	_mesh_instance(_box(Vector3(0.05, 0.2, 0.06)), accent, Vector3(-0.1, 0, d.z * 0.52), root)
	_mesh_instance(_box(Vector3(0.05, 0.2, 0.06)), accent, Vector3(0.1, 0, d.z * 0.52), root)


static func _build_lamp(root: Node3D, fd: FurnitureData, mat: Material, accent: Material) -> void:
	var d := fd.dimensions
	# pole
	var pole := CylinderMesh.new()
	pole.top_radius = 0.03
	pole.bottom_radius = 0.03
	pole.height = d.y * 0.8
	_mesh_instance(pole, accent, Vector3(0, -d.y * 0.05, 0), root)
	# base
	var base := CylinderMesh.new()
	base.top_radius = d.x * 0.4
	base.bottom_radius = d.x * 0.5
	base.height = 0.06
	_mesh_instance(base, accent, Vector3(0, -d.y * 0.48, 0), root)
	# shade (glowing)
	var shade := CylinderMesh.new()
	shade.top_radius = d.x * 0.3
	shade.bottom_radius = d.x * 0.6
	shade.height = d.y * 0.28
	var glow := _material(fd.base_color)
	glow.emission_enabled = true
	glow.emission = fd.base_color
	glow.emission_energy_multiplier = 1.5
	_mesh_instance(shade, glow, Vector3(0, d.y * 0.35, 0), root)


static func _build_piano(root: Node3D, fd: FurnitureData, mat: Material, accent: Material) -> void:
	var d := fd.dimensions
	# Upright body.
	_mesh_instance(_box(Vector3(d.x, d.y * 0.78, d.z)), mat, Vector3(0, d.y * 0.02, 0), root)
	# Overhanging lid.
	_mesh_instance(_box(Vector3(d.x * 1.05, d.y * 0.09, d.z * 1.12)), accent, Vector3(0, d.y * 0.44, 0), root)
	# White keyboard strip at the front.
	var white := _material(Color(0.95, 0.95, 0.9))
	_mesh_instance(_box(Vector3(d.x * 0.9, d.y * 0.08, d.z * 0.2)), white, Vector3(0, d.y * 0.02, d.z * 0.52), root)
	# A few black keys.
	var black := _material(Color(0.07, 0.07, 0.1))
	for i in range(-3, 4):
		_mesh_instance(_box(Vector3(0.05, d.y * 0.05, d.z * 0.11)),
			black, Vector3(i * 0.18, d.y * 0.05, d.z * 0.55), root)
	# Legs.
	for sx in [-d.x * 0.42, d.x * 0.42]:
		_mesh_instance(_box(Vector3(0.12, d.y * 0.4, 0.12)), accent, Vector3(sx, -d.y * 0.4, d.z * 0.3), root)


static func _build_bed(root: Node3D, fd: FurnitureData, mat: Material, accent: Material) -> void:
	var d := fd.dimensions
	_mesh_instance(_box(Vector3(d.x, d.y * 0.5, d.z)), mat, Vector3(0, -d.y * 0.2, 0), root)
	# headboard
	_mesh_instance(_box(Vector3(d.x, d.y, d.z * 0.1)), accent, Vector3(0, d.y * 0.1, -d.z * 0.45), root)
	# pillow
	_mesh_instance(_box(Vector3(d.x * 0.4, d.y * 0.15, d.z * 0.25)), accent, Vector3(0, d.y * 0.1, -d.z * 0.25), root)


static func _build_van(root: Node3D, fd: FurnitureData, mat: Material, accent: Material) -> void:
	var d := fd.dimensions
	# cargo box
	_mesh_instance(_box(Vector3(d.x * 0.7, d.y, d.z)), mat, Vector3(d.x * 0.12, 0, 0), root)
	# cab
	_mesh_instance(_box(Vector3(d.x * 0.3, d.y * 0.7, d.z)), accent, Vector3(-d.x * 0.42, -d.y * 0.1, 0), root)
	# wheels
	for x in [-d.x * 0.3, d.x * 0.3]:
		for z in [-d.z * 0.5, d.z * 0.5]:
			var w := CylinderMesh.new()
			w.top_radius = 0.35
			w.bottom_radius = 0.35
			w.height = 0.2
			var mi := _mesh_instance(w, accent, Vector3(x, -d.y * 0.5, z), root)
			mi.rotation_degrees = Vector3(90, 0, 0)
