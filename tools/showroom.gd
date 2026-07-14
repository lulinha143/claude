extends Node3D
## Dev-only furniture showroom for visual verification: lines up the hero
## furniture with varied emotions so their faces/silhouettes can be inspected.

func _ready() -> void:
	# Environment.
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.32, 0.30, 0.38)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.6, 0.58, 0.56)
	env.ambient_light_energy = 0.9
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.9
	add_child(we)
	we.environment = env

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, 25, 0)
	sun.light_energy = 0.9
	add_child(sun)

	var floor := StaticBody3D.new()
	floor.collision_layer = 1
	add_child(floor)
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(40, 0.4, 20)
	cs.shape = box
	cs.position = Vector3(0, -0.2, 0)
	floor.add_child(cs)
	var mi := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = box.size
	mi.mesh = pm
	var fmat := StandardMaterial3D.new()
	fmat.albedo_color = Color(0.4, 0.3, 0.22)
	mi.material_override = fmat
	mi.position = Vector3(0, -0.2, 0)
	floor.add_child(mi)

	var cam := Camera3D.new()
	cam.position = Vector3(0, 2.4, 9.5)
	cam.rotation_degrees = Vector3(-9, 0, 0)
	cam.fov = 60
	cam.current = true
	add_child(cam)

	var ids := ["sofa", "fridge", "wardrobe", "lamp", "piano"]
	var moods := [Emotions.E.LONELY, Emotions.E.ANGRY, Emotions.E.CALM, Emotions.E.PANICKED, Emotions.E.EXCITED]
	var x := -7.0
	for i in range(ids.size()):
		var fd := ContentDB.furniture(ids[i])
		if fd == null:
			continue
		var f := FurnitureController.new()
		add_child(f)
		f.global_position = Vector3(x, fd.dimensions.y * 0.5 + 0.1, 0)
		f.setup(fd, ids[i], true)
		f.freeze = true
		# Drive an emotion so the face reads.
		var target := int(moods[i])
		var arousal := 90.0 if target == Emotions.E.PANICKED else (60.0 if target == Emotions.E.ANGRY else 30.0)
		f.emotion_machine.agitate(arousal)
		f.emotion_machine.force_emotion(target)
		f._on_emotion_changed(target, arousal)
		x += 3.6
