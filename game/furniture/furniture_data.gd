class_name FurnitureData
extends Resource
## Data-driven definition of one sentient furniture type.
##
## Behaviour emerges from this data + the shared FurnitureController + trait
## scripts. Nothing about a specific object is hardcoded across unrelated
## scripts. Instances are built by ContentDB from JSON (see content/furniture/)
## OR authored as .tres — both produce this typed resource.

@export var id: String = ""
@export var name_key: String = ""            # localization key
@export var description_key: String = ""

# --- Physical ---
@export var weight: float = 20.0             # kg-ish, drives grab difficulty
@export var dimensions: Vector3 = Vector3(1, 1, 1)
@export var fragility: float = 0.3           # 0 sturdy .. 1 shatters easily
@export var value: int = 100                 # monetary value for rewards
@export var grip_points: Array[Vector3] = [] # local-space handles
@export var center_of_mass: Vector3 = Vector3.ZERO
@export var min_carriers: int = 1            # players needed to lift
@export var mesh_kind: String = "box"        # procedural mesh selector
@export var base_color: Color = Color(0.7, 0.6, 0.5)

# --- Personality / paranormal ---
@export var family: String = "generic"       # used for object_trust + relations
@export var mood_bias: int = Emotions.E.NERVOUS
@export var traits: Array[String] = []       # trait ids (data-driven)
@export var paranormal: Array[String] = []   # paranormal trait ids
@export var hidden_traits: Array[String] = []
@export var rare_mutation: String = ""

# --- Emotional tuning ---
@export var calm_rate: float = 1.0           # multiplier on decay toward calm
@export var trigger_sensitivity: float = 1.0 # multiplier on arousal gains

# --- Preferences (drive calming/escalation) ---
@export var likes: Array[String] = []
@export var dislikes: Array[String] = []
@export var calming_actions: Array[String] = []   # which player actions soothe it
@export var escalating_actions: Array[String] = [] # which actions anger it
@export var needs: Array[String] = []

# --- Audio ---
@export var audio_profile: String = "generic"     # picks murmur pitch set

## Convenience: is this object one of the contract's valid grip counts?
func requires_multiple_carriers() -> bool:
	return min_carriers > 1


## Builds a FurnitureData from a plain dictionary (JSON content pipeline).
static func from_dict(d: Dictionary) -> FurnitureData:
	var fd := FurnitureData.new()
	fd.id = str(d.get("id", ""))
	fd.name_key = str(d.get("name_key", ""))
	fd.description_key = str(d.get("description_key", ""))
	fd.weight = float(d.get("weight", 20.0))
	var dim: Variant = d.get("dimensions", [1, 1, 1])
	if dim is Array and dim.size() == 3:
		fd.dimensions = Vector3(dim[0], dim[1], dim[2])
	fd.fragility = float(d.get("fragility", 0.3))
	fd.value = int(d.get("value", 100))
	fd.center_of_mass = _to_vec3(d.get("center_of_mass", [0, 0, 0]))
	var grips: Array[Vector3] = []
	for g in d.get("grip_points", []):
		grips.append(_to_vec3(g))
	fd.grip_points = grips
	fd.min_carriers = int(d.get("min_carriers", 1))
	fd.mesh_kind = str(d.get("mesh_kind", "box"))
	fd.base_color = _to_color(d.get("base_color", "#b39980"))
	fd.family = str(d.get("family", "generic"))
	fd.mood_bias = int(d.get("mood_bias", Emotions.E.NERVOUS))
	fd.traits = _to_str_array(d.get("traits", []))
	fd.paranormal = _to_str_array(d.get("paranormal", []))
	fd.hidden_traits = _to_str_array(d.get("hidden_traits", []))
	fd.rare_mutation = str(d.get("rare_mutation", ""))
	fd.calm_rate = float(d.get("calm_rate", 1.0))
	fd.trigger_sensitivity = float(d.get("trigger_sensitivity", 1.0))
	fd.likes = _to_str_array(d.get("likes", []))
	fd.dislikes = _to_str_array(d.get("dislikes", []))
	fd.calming_actions = _to_str_array(d.get("calming_actions", []))
	fd.escalating_actions = _to_str_array(d.get("escalating_actions", []))
	fd.needs = _to_str_array(d.get("needs", []))
	fd.audio_profile = str(d.get("audio_profile", "generic"))
	return fd


static func _to_vec3(v: Variant) -> Vector3:
	if v is Array and v.size() == 3:
		return Vector3(v[0], v[1], v[2])
	return Vector3.ZERO


static func _to_color(v: Variant) -> Color:
	if v is String:
		return Color(v)
	return Color(0.7, 0.6, 0.5)


static func _to_str_array(v: Variant) -> Array[String]:
	var out: Array[String] = []
	if v is Array:
		for e in v:
			out.append(str(e))
	return out
