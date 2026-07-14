extends Node
## Content database (autoload "ContentDB").
##
## Loads all data-driven game content from JSON under content/ at boot and
## exposes typed accessors. Keeping content in structured data files (rather
## than hardcoded across scripts) is what lets designers add furniture, traits,
## cosmetics, achievements, etc. without touching gameplay code.

const PATHS: Dictionary = {
	"furniture": "res://content/furniture/furniture.json",
	"traits": "res://content/traits/traits.json",
	"equipment": "res://content/equipment/equipment.json",
	"achievements": "res://content/achievements/achievements.json",
	"incidents": "res://content/incidents/incident_lines.json",
	"cosmetics": "res://content/cosmetics/cosmetics.json",
	"modifiers": "res://content/contracts/modifiers.json",
	"relationships": "res://content/relationships/relationships.json",
	"locations": "res://content/locations/locations.json",
	"upgrades": "res://content/upgrades/warehouse_upgrades.json",
}

var _furniture: Dictionary = {}       # id -> FurnitureData
var _traits: Dictionary = {}          # id -> Dictionary
var _equipment: Dictionary = {}       # id -> Dictionary
var _achievements: Array = []         # Array[Dictionary]
var _incidents: Dictionary = {}       # category -> Array[String]
var _cosmetics: Dictionary = {}       # id -> Dictionary
var _modifiers: Dictionary = {}       # id -> Dictionary
var _relationships: Array = []        # Array[Dictionary]
var _locations: Dictionary = {}       # id -> Dictionary
var _upgrades: Dictionary = {}        # id -> Dictionary


func _ready() -> void:
	_load_all()


func _load_all() -> void:
	_load_furniture()
	_traits = _index_by_id(_load_array("traits"))
	_equipment = _index_by_id(_load_array("equipment"))
	_achievements = _load_array("achievements")
	_incidents = _load_dict("incidents")
	_cosmetics = _index_by_id(_load_array("cosmetics"))
	_modifiers = _index_by_id(_load_array("modifiers"))
	_relationships = _load_array("relationships")
	_locations = _index_by_id(_load_array("locations"))
	_upgrades = _index_by_id(_load_array("upgrades"))
	Log.info("ContentDB", "Loaded: %d furniture, %d traits, %d equipment, %d achievements, %d cosmetics, %d modifiers, %d locations." % [
		_furniture.size(), _traits.size(), _equipment.size(),
		_achievements.size(), _cosmetics.size(), _modifiers.size(), _locations.size()])


# --- Loading helpers -------------------------------------------------------
func _load_json(key: String) -> Variant:
	var path: String = PATHS[key]
	if not FileAccess.file_exists(path):
		Log.error("ContentDB", "Missing content file: %s" % path)
		return null
	var f := FileAccess.open(path, FileAccess.READ)
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	if parsed == null:
		Log.error("ContentDB", "Invalid JSON in %s" % path)
	return parsed


func _load_array(key: String) -> Array:
	var v: Variant = _load_json(key)
	return v if v is Array else []


func _load_dict(key: String) -> Dictionary:
	var v: Variant = _load_json(key)
	return v if v is Dictionary else {}


func _index_by_id(arr: Array) -> Dictionary:
	var out: Dictionary = {}
	for e in arr:
		if e is Dictionary and e.has("id"):
			out[e["id"]] = e
	return out


func _load_furniture() -> void:
	_furniture.clear()
	for d in _load_array("furniture"):
		if d is Dictionary and d.has("id"):
			_furniture[d["id"]] = FurnitureData.from_dict(d)


# --- Accessors -------------------------------------------------------------
func furniture(id: String) -> FurnitureData:
	return _furniture.get(id, null)


func all_furniture_ids() -> Array:
	return _furniture.keys()


func trait_def(id: String) -> Dictionary:
	return _traits.get(id, {})


func all_trait_ids() -> Array:
	return _traits.keys()


func equipment(id: String) -> Dictionary:
	return _equipment.get(id, {})


func equipment_ids() -> Array:
	return _equipment.keys()


func achievements() -> Array:
	return _achievements


func incident_lines(category: String) -> Array:
	return _incidents.get(category, [])


func cosmetics() -> Dictionary:
	return _cosmetics


func cosmetic_ids() -> Array:
	return _cosmetics.keys()


func modifier(id: String) -> Dictionary:
	return _modifiers.get(id, {})


func modifier_ids() -> Array:
	return _modifiers.keys()


func relationships() -> Array:
	return _relationships


func location(id: String) -> Dictionary:
	return _locations.get(id, {})


func location_ids() -> Array:
	return _locations.keys()


func upgrade(id: String) -> Dictionary:
	return _upgrades.get(id, {})


func upgrade_ids() -> Array:
	return _upgrades.keys()


## Returns relationship modifier between two families, or {} if none.
func relationship_between(family_a: String, family_b: String) -> Dictionary:
	for r in _relationships:
		var a := str(r.get("a", ""))
		var b := str(r.get("b", ""))
		if (a == family_a and b == family_b) or (a == family_b and b == family_a):
			return r
	return {}


# --- Validation (used by dev tools + CI) -----------------------------------
## Cross-checks that referenced ids/keys exist. Returns a report dictionary.
func validate() -> Dictionary:
	var errors: Array[String] = []
	var warnings: Array[String] = []
	for fid in _furniture.keys():
		var fd: FurnitureData = _furniture[fid]
		if fd.name_key.is_empty():
			warnings.append("Furniture '%s' has no name_key" % fid)
		for tid in fd.traits + fd.paranormal + fd.hidden_traits:
			if not _traits.has(tid):
				errors.append("Furniture '%s' references unknown trait '%s'" % [fid, tid])
	for ach in _achievements:
		if not ach.has("id") or not ach.has("name_key"):
			warnings.append("Achievement missing id/name_key: %s" % ach)
	var report := {
		"ok": errors.is_empty(),
		"errors": errors,
		"warnings": warnings,
		"counts": {
			"furniture": _furniture.size(),
			"traits": _traits.size(),
			"equipment": _equipment.size(),
			"achievements": _achievements.size(),
			"cosmetics": _cosmetics.size(),
			"modifiers": _modifiers.size(),
			"locations": _locations.size(),
		},
	}
	return report
