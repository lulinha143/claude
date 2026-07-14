class_name SaveMigrations
extends RefCounted
## Sequential save-file migrations. Each step upgrades exactly one version.
## Migrations MUST be pure functions of the input dictionary and are covered by
## automated tests (test/unit/test_save_migrations.gd).

## Upgrades `data` from its stored schema_version up to the current version.
## Returns the migrated dictionary (input is not mutated).
static func migrate(data: Dictionary) -> Dictionary:
	var out: Dictionary = data.duplicate(true)
	var v: int = int(out.get("schema_version", 1))
	while v < GameConstants.SAVE_SCHEMA_VERSION:
		match v:
			1:
				out = _v1_to_v2(out)
			2:
				out = _v2_to_v3(out)
			_:
				# Unknown intermediate version: stop to avoid corrupting data.
				Log.warn("Save", "No migration path from version %d" % v)
				break
		v = int(out.get("schema_version", v))
	return out


static func _v1_to_v2(data: Dictionary) -> Dictionary:
	# v2 introduced object_trust and the encyclopedia.
	var out := data.duplicate(true)
	if not out.has("object_trust"):
		out["object_trust"] = {}
	if not out.has("encyclopedia"):
		out["encyclopedia"] = {}
	out["schema_version"] = 2
	return out


static func _v2_to_v3(data: Dictionary) -> Dictionary:
	# v3 split cosmetics out of "character" and added campaign_milestones +
	# daily_completed, and renamed "money" -> "cash" inside resources.
	var out := data.duplicate(true)
	if not out.has("cosmetics_unlocked"):
		out["cosmetics_unlocked"] = ["uniform_default", "helmet_default"]
	if not out.has("campaign_milestones"):
		out["campaign_milestones"] = []
	if not out.has("daily_completed"):
		out["daily_completed"] = {}
	var res: Dictionary = out.get("resources", {})
	if res.has("money") and not res.has(GameConstants.RES_CASH):
		res[GameConstants.RES_CASH] = res["money"]
		res.erase("money")
	out["resources"] = res
	out["schema_version"] = 3
	return out
