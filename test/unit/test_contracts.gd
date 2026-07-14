extends HBTest
## Contract generation determinism and structure.

func test_deterministic_same_seed() -> void:
	var a := ContractGenerator.generate("suburban_house", 12345, 0)
	var b := ContractGenerator.generate("suburban_house", 12345, 0)
	eq(a.to_dict(), b.to_dict(), "same seed must produce identical contract")


func test_different_seed_differs() -> void:
	var a := ContractGenerator.generate("suburban_house", 1, 0)
	var b := ContractGenerator.generate("suburban_house", 2, 0)
	# At least one field should differ across seeds (targets or modifiers/tod).
	ne(a.to_dict(), b.to_dict(), "different seeds should usually differ")


func test_has_primary_objective() -> void:
	var c := ContractGenerator.generate("suburban_house", 999, 0)
	var has_primary := false
	for o in c.objectives:
		if not bool(o.get("optional", true)):
			has_primary = true
	check(has_primary, "must have a non-optional primary objective")


func test_targets_nonempty() -> void:
	var c := ContractGenerator.generate("suburban_house", 42, 0)
	gt(float(c.target_ids.size()), 0.0, "should have at least one target")


func test_seed_string_roundtrip() -> void:
	var c := ContractGenerator.generate("suburban_house", 512, 0)
	var parsed := DeterministicRNG.parse_seed(str(c.seed_value))
	eq(parsed, 512, "seed parse should round-trip integers")


func test_daily_deterministic() -> void:
	var a := ContractGenerator.generate_daily(2026, 7, 14)
	var b := ContractGenerator.generate_daily(2026, 7, 14)
	eq(a.to_dict(), b.to_dict(), "daily challenge must be deterministic by date")
	var c := ContractGenerator.generate_daily(2026, 7, 15)
	ne(a.seed_value, c.seed_value, "different dates give different daily seeds")
