extends HBTest
## Save migrations, schema defaults, sanitisation and corruption recovery.

func test_migrate_v1_to_current() -> void:
	var old := {"schema_version": 1, "company_name": "Old Co", "resources": {"money": 700}}
	var migrated := SaveMigrations.migrate(old)
	eq(int(migrated["schema_version"]), GameConstants.SAVE_SCHEMA_VERSION, "reaches current version")
	check(migrated.has("object_trust"), "v2 field added")
	check(migrated.has("campaign_milestones"), "v3 field added")


func test_money_renamed_to_cash() -> void:
	var old := {"schema_version": 2, "company_name": "X", "resources": {"money": 500}}
	var migrated := SaveMigrations.migrate(old)
	eq(int(migrated["resources"].get(GameConstants.RES_CASH, -1)), 500, "money migrated to cash")
	check(not migrated["resources"].has("money"), "old money key removed")


func test_sanitize_fixes_negative() -> void:
	var profile := SaveSchema.new_profile("Test")
	profile["resources"][GameConstants.RES_CASH] = -50
	var clean := SaveSchema.sanitize(profile)
	check(int(clean["resources"][GameConstants.RES_CASH]) >= 0, "negative cash clamped")


func test_sanitize_clamps_insurance() -> void:
	var profile := SaveSchema.new_profile("Test")
	profile["resources"][GameConstants.RES_INSURANCE] = 99
	var clean := SaveSchema.sanitize(profile)
	check(int(clean["resources"][GameConstants.RES_INSURANCE]) <= Balance.INSURANCE_MAX, "insurance clamped")


func test_with_defaults_recovers_missing_fields() -> void:
	var partial := {"company_name": "Partial"}
	var full := SaveSchema.with_defaults(partial, SaveSchema.new_profile("Partial"))
	check(full.has("stats"), "missing stats recovered")
	check(full.has("character"), "missing character recovered")


func test_unknown_version_stops_safely() -> void:
	var weird := {"schema_version": 999, "company_name": "Future"}
	var migrated := SaveMigrations.migrate(weird)
	# Should not crash and should return the input unchanged-ish.
	eq(int(migrated["schema_version"]), 999, "no downgrade attempted")
