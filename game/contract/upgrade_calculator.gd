class_name UpgradeCalculator
extends RefCounted
## Pure upgrade cost math (unit-tested in test_upgrades.gd).

## Cost to buy the NEXT level given the current owned level.
static func cost(upgrade_def: Dictionary, current_level: int) -> int:
	var base := float(upgrade_def.get("base_cost", 150))
	var growth := float(upgrade_def.get("cost_growth", 1.6))
	return int(round(base * pow(growth, current_level)))


## Total spent to reach `level` from 0 (for refunds / stats).
static func total_cost(upgrade_def: Dictionary, level: int) -> int:
	var total := 0
	for i in range(level):
		total += cost(upgrade_def, i)
	return total
