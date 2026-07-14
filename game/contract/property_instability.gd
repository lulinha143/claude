extends Node
## Runtime accumulator for the Property Instability tension system (a node placed
## in the contract scene). Rises from agitated furniture, damage, and noise;
## decays slightly when things are calm. Drives escalation effects and emits
## EventBus signals for the HUD. Uses InstabilitySystem for pure level mapping.

@export var rate_multiplier: float = 1.0

var points: float = 0.0
var level: int = InstabilitySystem.Level.UNEASY

var _tick_accum: float = 0.0


func _process(delta: float) -> void:
	_tick_accum += delta
	if _tick_accum < 0.5:
		return
	var dt := _tick_accum
	_tick_accum = 0.0

	var agitated := 0
	for n in get_tree().get_nodes_in_group("furniture"):
		if n is FurnitureController and n.emotion_machine != null and n.emotion_machine.is_agitated():
			agitated += 1

	var delta_points := Balance.INSTABILITY_PASSIVE_RATE * dt * rate_multiplier
	delta_points += float(agitated) * 1.5 * dt * rate_multiplier
	if agitated == 0:
		delta_points -= 1.0 * dt   # calm properties settle a little

	_set_points(clampf(points + delta_points, 0.0, float(Balance.INSTABILITY_MAX)))


func add(amount: float) -> void:
	_set_points(clampf(points + amount * rate_multiplier, 0.0, float(Balance.INSTABILITY_MAX)))


func _set_points(value: float) -> void:
	if is_equal_approx(value, points):
		return
	points = value
	EventBus.instability_changed.emit(points, InstabilitySystem.level_for(points))
	var new_level := InstabilitySystem.level_for(points)
	if new_level != level:
		level = new_level
		EventBus.instability_level_changed.emit(level)
		_apply_level_effects(level)


func _apply_level_effects(lvl: int) -> void:
	Log.info("Instability", "Property instability -> %s" % InstabilitySystem.level_name(lvl))
	Audio.set_music_intensity(float(lvl) / float(InstabilitySystem.Level.REJECTION))
	# Escalation: at HOSTILE+, cut the lights (feeds fearful objects).
	var dark := get_tree().get_first_node_in_group("lights_off")
	if lvl >= InstabilitySystem.Level.HOSTILE and dark == null:
		var marker := Node.new()
		marker.name = "LightsOff"
		marker.add_to_group("lights_off")
		get_tree().current_scene.add_child(marker)
	elif lvl < InstabilitySystem.Level.HOSTILE and dark != null:
		dark.queue_free()
