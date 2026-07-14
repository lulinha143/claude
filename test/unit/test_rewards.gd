extends HBTest
## Reward + insurance calculation.

func _contract() -> ContractData:
	var c := ContractData.new()
	c.payment_min = 100
	c.payment_max = 300
	c.danger = 2
	return c


func test_full_delivery_pays_near_max() -> void:
	var r := RewardCalculator.compute(_contract(), {
		"delivered": 2, "total_targets": 2, "damage_value": 0,
		"optional_completed": 0, "optional_total": 0, "perfect": false,
	})
	gt(float(r["payout"]), 250.0, "full delivery should approach max payment")


func test_partial_delivery_scales() -> void:
	var r := RewardCalculator.compute(_contract(), {
		"delivered": 1, "total_targets": 2, "damage_value": 0,
	})
	almost(float(r["payout"]), 200.0, 1.0, "half delivery should be midpoint")


func test_damage_reduces_payout() -> void:
	var clean := RewardCalculator.compute(_contract(), {"delivered": 2, "total_targets": 2, "damage_value": 0})
	var damaged := RewardCalculator.compute(_contract(), {"delivered": 2, "total_targets": 2, "damage_value": 100})
	gt(float(clean["payout"]), float(damaged["payout"]), "damage should reduce payout")


func test_perfect_bonus() -> void:
	var r := RewardCalculator.compute(_contract(), {
		"delivered": 2, "total_targets": 2, "damage_value": 0,
		"optional_completed": 1, "optional_total": 1, "perfect": true,
	})
	check(r["perfect"], "perfect flag preserved")


func test_insurance_up_on_clean() -> void:
	var r := RewardCalculator.compute(_contract(), {"delivered": 2, "total_targets": 2, "damage_value": 0})
	eq(int(r["insurance_delta"]), 1, "clean move raises insurance")


func test_insurance_down_on_heavy_damage() -> void:
	var r := RewardCalculator.compute(_contract(), {"delivered": 2, "total_targets": 2, "damage_value": 200})
	eq(int(r["insurance_delta"]), -1, "heavy damage lowers insurance")


func test_payout_never_negative() -> void:
	var r := RewardCalculator.compute(_contract(), {"delivered": 0, "total_targets": 2, "damage_value": 9999})
	check(int(r["payout"]) >= 0, "payout floored at zero")
