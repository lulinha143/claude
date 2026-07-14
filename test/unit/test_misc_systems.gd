extends HBTest
## Cross-system unit tests: RNG determinism, instability mapping, upgrades,
## net message validation, incident reports, localization, input serialization.

# --- Deterministic RNG ---
func test_rng_repeatable() -> void:
	var a := DeterministicRNG.new(77)
	var b := DeterministicRNG.new(77)
	eq(a.int_range("x", 0, 1000), b.int_range("x", 0, 1000), "same seed+stream repeats")


func test_rng_streams_independent() -> void:
	var r := DeterministicRNG.new(5)
	var first := r.int_range("alpha", 0, 100000)
	var r2 := DeterministicRNG.new(5)
	r2.int_range("beta", 0, 5)   # touch a different stream first
	eq(first, r2.int_range("alpha", 0, 100000), "alpha stream unaffected by beta")


# --- Instability ---
func test_instability_levels() -> void:
	eq(InstabilitySystem.level_for(0.0), InstabilitySystem.Level.UNEASY, "0 -> uneasy")
	eq(InstabilitySystem.level_for(100.0), InstabilitySystem.Level.REJECTION, "100 -> rejection")
	check(InstabilitySystem.level_for(60.0) == InstabilitySystem.Level.HOSTILE, "60 -> hostile")


# --- Upgrades ---
func test_upgrade_cost_grows() -> void:
	var u := {"base_cost": 100, "cost_growth": 2.0}
	eq(UpgradeCalculator.cost(u, 0), 100, "level 0 costs base")
	eq(UpgradeCalculator.cost(u, 1), 200, "level 1 doubles")
	eq(UpgradeCalculator.total_cost(u, 2), 300, "total of first two levels")


# --- Net messages ---
func test_net_validate_ok() -> void:
	check(NetMessages.validate(NetMessages.Type.GRAB_REQUEST, {"furniture_id": "sofa_t0", "grip_index": 0}),
		"valid grab request passes")


func test_net_validate_missing_field() -> void:
	check(not NetMessages.validate(NetMessages.Type.GRAB_REQUEST, {"furniture_id": "x"}),
		"missing grip_index rejected")


func test_net_validate_unknown_type() -> void:
	check(not NetMessages.validate(-1, {}), "unknown type rejected")


# --- Incident report ---
func test_incident_report_success() -> void:
	var r := IncidentReport.generate({"success": true, "delivered": 2, "total_targets": 2, "payout": 400}, 123)
	eq(str(r["result_key"]), "RESULT_SUCCESS", "success maps to success key")
	check(not str(r["title"]).is_empty(), "has a title line")


func test_incident_report_abandoned() -> void:
	var r := IncidentReport.generate({"success": false, "abandoned": true}, 1)
	eq(str(r["result_key"]), "RESULT_ABANDONED", "abandoned maps correctly")


# --- Localization ---
func test_loc_known_key() -> void:
	ne(Loc.t("MENU_SETTINGS"), "MENU_SETTINGS", "known key should translate")


func test_loc_missing_key_returns_key() -> void:
	eq(Loc.t("__DEFINITELY_MISSING__"), "__DEFINITELY_MISSING__", "missing key returns itself")


func test_loc_args_substitution() -> void:
	var s := Loc.t("HUD_TARGETS_LOADED", {"loaded": 1, "total": 3})
	check(s.contains("1") and s.contains("3"), "arguments substituted")


func test_loc_en_ptbr_complete() -> void:
	var comp := Loc.completeness()
	almost(float(comp.get("en", 0.0)), 1.0, 0.001, "English fully authored")
	almost(float(comp.get("pt_BR", 0.0)), 1.0, 0.001, "Brazilian Portuguese fully authored")


# --- Input rebinding serialization ---
func test_input_serialize_roundtrip() -> void:
	var data := InputRebinder.serialize()
	check(data.has("interact"), "serialized bindings include interact")
	# Deserialize back and re-serialize; should be stable.
	InputRebinder.deserialize(data)
	var again := InputRebinder.serialize()
	eq(data.keys().size(), again.keys().size(), "roundtrip preserves action count")
