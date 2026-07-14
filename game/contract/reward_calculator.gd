class_name RewardCalculator
extends RefCounted
## Pure reward/insurance math (unit-tested in test_rewards.gd). Given a contract
## and a run summary, computes payout and progression deltas. No side effects.

## `run` keys: delivered:int, total_targets:int, damage_value:int (lost value),
## optional_completed:int, optional_total:int, perfect:bool, residue_events:int.
static func compute(contract: ContractData, run: Dictionary) -> Dictionary:
	var delivered: int = int(run.get("delivered", 0))
	var total: int = maxi(1, int(run.get("total_targets", 1)))
	var completion := float(delivered) / float(total)

	# Base payout scales with completion between min and max.
	var base := lerpf(float(contract.payment_min), float(contract.payment_max), completion)

	# Optional objectives add a bonus.
	var opt_total: int = int(run.get("optional_total", 0))
	var opt_done: int = int(run.get("optional_completed", 0))
	var opt_bonus := 0.0
	if opt_total > 0:
		opt_bonus = base * 0.15 * (float(opt_done) / float(opt_total))

	# Damage penalty (lost value directly subtracted, floored at 0).
	var damage_value: int = int(run.get("damage_value", 0))
	var payout := int(maxf(0.0, base + opt_bonus - float(damage_value)))

	# Perfect move multiplier (no damage, all targets, all optional).
	var perfect: bool = bool(run.get("perfect", false))
	if perfect:
		payout = int(round(float(payout) * Balance.REWARD_PERFECT_MULT))

	# Reputation: proportional to completion + optional objectives + danger.
	var reputation := int(round(completion * 10.0)) + opt_done * 3 + contract.danger * 2

	# Paranormal residue: earned by handling rare behaviours.
	var residue: int = int(run.get("residue_events", 0)) * 2

	# Insurance rating change: damage lowers it, clean moves raise it.
	var insurance_delta := 0
	if damage_value <= 0 and delivered >= total:
		insurance_delta = 1
	elif damage_value > int(contract.payment_max / 2):
		insurance_delta = -1

	return {
		"payout": payout,
		"reputation": reputation,
		"residue": residue,
		"insurance_delta": insurance_delta,
		"completion": completion,
		"perfect": perfect,
	}
