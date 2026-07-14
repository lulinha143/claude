class_name ContractData
extends RefCounted
## An immutable-ish description of one moving contract. Produced by
## ContractGenerator from a deterministic seed so a shared seed reproduces the
## exact same contract for friends/streamers.

var id: String = ""
var location_id: String = "suburban_house"
var seed_value: int = 0
var danger: int = 1
var target_ids: Array[String] = []       # furniture type ids to deliver
var decoy_ids: Array[String] = []        # non-target objects present
var objectives: Array[Dictionary] = []   # {id, name_key, optional:bool}
var modifiers: Array[String] = []        # contract modifier ids
var time_of_day: String = "day"
var payment_min: int = 100
var payment_max: int = 300
var insurance_condition: String = "standard"
var client_notes: String = ""
var hidden_secret: String = ""
var rare_event: String = ""


func seed_string() -> String:
	# Human-shareable seed, e.g. "SUBU-000512".
	var prefix := location_id.substr(0, 4).to_upper()
	return "%s-%06d" % [prefix, seed_value % 1000000]


func to_dict() -> Dictionary:
	return {
		"id": id, "location_id": location_id, "seed": seed_value, "danger": danger,
		"targets": target_ids, "decoys": decoy_ids, "objectives": objectives,
		"modifiers": modifiers, "time_of_day": time_of_day,
		"payment_min": payment_min, "payment_max": payment_max,
		"insurance_condition": insurance_condition, "client_notes": client_notes,
		"hidden_secret": hidden_secret, "rare_event": rare_event,
	}
