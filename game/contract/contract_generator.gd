class_name ContractGenerator
extends RefCounted
## Deterministic contract generation. Given a location, seed and reputation, it
## always produces the same ContractData (verified by test_contracts.gd).

const OPTIONAL_OBJECTIVES: Array = [
	{"id": "no_broken_doors", "name_key": "OBJECTIVE_NO_BROKEN_DOORS"},
	{"id": "keep_conscious", "name_key": "OBJECTIVE_KEEP_CONSCIOUS"},
	{"id": "calm_piano", "name_key": "OBJECTIVE_CALM_PIANO"},
	{"id": "no_restraints", "name_key": "OBJECTIVE_NO_RESTRAINTS"},
]


static func generate(location_id: String, seed_value: int, reputation: int = 0,
		forced_modifiers: Array = []) -> ContractData:
	var rng := DeterministicRNG.new(seed_value)
	var c := ContractData.new()
	c.location_id = location_id
	c.seed_value = seed_value
	c.id = "%s_%d" % [location_id, seed_value]

	var loc := ContentDB.location(location_id)
	c.danger = int(loc.get("danger", 1))

	# Number of targets scales gently with danger + reputation.
	var target_count: int = clampi(1 + c.danger / 2 + reputation / 200, 1, 5)
	var pool := _furniture_pool_for(location_id)
	var chosen := rng.shuffled("targets", pool)
	for i in range(mini(target_count, chosen.size())):
		c.target_ids.append(str(chosen[i]))

	# Decoys: a few non-target objects for flavour and misdirection.
	var decoy_count := rng.int_range("decoy_count", 1, 3)
	var remaining: Array = chosen.slice(target_count)
	for i in range(mini(decoy_count, remaining.size())):
		c.decoy_ids.append(str(remaining[i]))

	# Objectives: always the primary; plus 1-2 optional.
	c.objectives.append({"id": "load_targets", "name_key": "OBJECTIVE_LOAD_TARGETS", "optional": false})
	var opt_shuffled := rng.shuffled("objectives", OPTIONAL_OBJECTIVES)
	var opt_count := rng.int_range("opt_count", 1, 2)
	for i in range(mini(opt_count, opt_shuffled.size())):
		var o: Dictionary = (opt_shuffled[i] as Dictionary).duplicate()
		# Only include the piano objective if a piano is actually present.
		if o["id"] == "calm_piano" and not ("piano" in c.target_ids or "piano" in c.decoy_ids):
			continue
		o["optional"] = true
		c.objectives.append(o)

	# Modifiers.
	c.modifiers = []
	for m in forced_modifiers:
		c.modifiers.append(str(m))
	if c.danger >= 3 and rng.unit("mod_roll") > 0.5:
		var mods := ContentDB.modifier_ids()
		if not mods.is_empty():
			c.modifiers.append(str(rng.pick("mod_pick", mods)))

	# Time of day.
	c.time_of_day = "night" if rng.unit("tod") > 0.6 else "day"

	# Payment based on target value + danger.
	var base_value := 0
	for tid in c.target_ids:
		var fd := ContentDB.furniture(tid)
		if fd != null:
			base_value += fd.value
	c.payment_min = int(base_value * 0.4) + c.danger * 50
	c.payment_max = int(base_value * 0.9) + c.danger * 120
	c.insurance_condition = "strict" if c.danger >= 4 else "standard"
	c.client_notes = _client_note(rng, c)

	# Hidden secret + rare event (revealed in play, not shown in briefing).
	c.hidden_secret = "hidden_room" if rng.unit("secret") > 0.7 else ""
	c.rare_event = "rare_mutation" if rng.unit("rare") > 0.9 else ""
	return c


static func generate_daily(year: int, month: int, day: int) -> ContractData:
	var seed_value := DeterministicRNG.seed_from_date(year, month, day)
	var rng := DeterministicRNG.new(seed_value)
	var locations := ContentDB.location_ids()
	var loc := str(rng.pick("daily_loc", locations)) if not locations.is_empty() else "suburban_house"
	# Daily challenges force a modifier for spice.
	var mods := ContentDB.modifier_ids()
	var forced: Array = []
	if not mods.is_empty():
		forced.append(str(rng.pick("daily_mod", mods)))
	return generate(loc, seed_value, 0, forced)


static func _furniture_pool_for(location_id: String) -> Array:
	# Every furniture type except the van is eligible; later locations can bias.
	var pool: Array = []
	for fid in ContentDB.all_furniture_ids():
		if fid != "moving_van":
			pool.append(fid)
	return pool


static func _client_note(rng: DeterministicRNG, c: ContractData) -> String:
	var notes := [
		"Client insists the furniture is 'mostly fine'.",
		"Previous movers did not return calls.",
		"Please do not make eye contact with the mirror.",
		"The fridge is on a diet. Do not tempt it.",
		"Knock before opening anything.",
		"The piano expects professionalism.",
	]
	return str(rng.pick("note", notes))
