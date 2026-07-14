class_name SaveSchema
extends RefCounted
## Defines the canonical company-profile save structure and validation.
## Progression only (settings live elsewhere). Missing optional fields are
## recovered against this template so old/partial saves never crash the game.

## Returns a fresh, valid company profile with the current schema version.
static func new_profile(company_name: String) -> Dictionary:
	return {
		"schema_version": GameConstants.SAVE_SCHEMA_VERSION,
		"company_name": company_name,
		"created_unix": int(Time.get_unix_time_from_system()),
		"playtime_seconds": 0.0,
		"seen_tutorial": false,
		"resources": {
			GameConstants.RES_CASH: 500,
			GameConstants.RES_REPUTATION: 0,
			GameConstants.RES_RESIDUE: 0,
			GameConstants.RES_INSURANCE: 3,
		},
		"upgrades": {},                # upgrade_id -> level
		"unlocked_locations": ["suburban_house"],
		"unlocked_equipment": ["basic_straps", "hand_truck", "emotional_scanner"],
		"loadout": ["basic_straps", "emotional_scanner"],
		"cosmetics_unlocked": ["uniform_default", "helmet_default"],
		"character": default_character(),
		"object_trust": {},            # furniture_family -> trust points
		"encyclopedia": {},            # furniture_id -> {discovered:[traits]}
		"campaign_milestones": [],
		"stats": {
			"contracts_completed": 0,
			"contracts_failed": 0,
			"furniture_delivered": 0,
			"furniture_broken": 0,
			"players_rescued": 0,
			"doors_broken": 0,
			"perfect_moves": 0,
			"total_earnings": 0,
		},
		"achievements_progress": {},
		"incident_reports": [],        # bounded ring, newest last
		"daily_completed": {},         # "YYYY-MM-DD" -> bool
	}


static func default_character() -> Dictionary:
	return {
		"name": "New Mover",
		"body_shape": 0,
		"skin_color": Color(0.9, 0.75, 0.62).to_html(),
		"helmet": "helmet_default",
		"hair": "hair_none",
		"eyes": "eyes_default",
		"mouth": "mouth_default",
		"uniform": "uniform_default",
		"uniform_color": Color(0.90, 0.45, 0.15).to_html(),
		"gloves": "gloves_default",
		"boots": "boots_default",
		"backpack": "backpack_none",
		"badge": "badge_trainee",
		"victory_pose": "pose_default",
		"panic_anim": "panic_default",
		"emote_wheel": ["comfort", "scold", "applaud", "help", "noise", "yes", "no", "sorry"],
	}


## Recursively fills missing keys from the template (recovery from partial/old
## saves). Returns a NEW merged dictionary; never mutates inputs.
static func with_defaults(data: Dictionary, template: Dictionary) -> Dictionary:
	var out: Dictionary = data.duplicate(true)
	for key in template.keys():
		if not out.has(key):
			out[key] = _dup(template[key])
		elif template[key] is Dictionary and out[key] is Dictionary:
			out[key] = with_defaults(out[key], template[key])
	return out


## Validates and sanitises a loaded profile. Guards against invalid numeric
## values (NaN, negative resources) that could corrupt the economy.
static func sanitize(data: Dictionary) -> Dictionary:
	var out := with_defaults(data, new_profile(str(data.get("company_name", "Company"))))
	var res: Dictionary = out["resources"]
	for k in res.keys():
		var v: Variant = res[k]
		if not (v is int or v is float) or is_nan(float(v)):
			res[k] = 0
		res[k] = maxi(0, int(res[k]))
	out["resources"][GameConstants.RES_INSURANCE] = clampi(
		int(out["resources"].get(GameConstants.RES_INSURANCE, 3)),
		Balance.INSURANCE_MIN, Balance.INSURANCE_MAX)
	if not (out["playtime_seconds"] is float or out["playtime_seconds"] is int):
		out["playtime_seconds"] = 0.0
	return out


static func _dup(v: Variant) -> Variant:
	if v is Dictionary:
		return (v as Dictionary).duplicate(true)
	if v is Array:
		return (v as Array).duplicate(true)
	return v
