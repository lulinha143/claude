class_name InstabilitySystem
extends RefCounted
## Static helpers for the Property Instability tension system.
##
## Instability is a single 0..INSTABILITY_MAX value with five named levels.
## The runtime accumulator lives on PropertyInstability (a Node in the contract
## scene); this class holds the pure mapping/label logic so it is unit-testable
## without a scene tree.

enum Level { UNEASY, ACTIVE, HOSTILE, UNCONTAINED, REJECTION }

const LOC_KEYS: Array[String] = [
	"INSTABILITY_UNEASY",
	"INSTABILITY_ACTIVE",
	"INSTABILITY_HOSTILE",
	"INSTABILITY_UNCONTAINED",
	"INSTABILITY_REJECTION",
]


## Returns the Level for a given instability point value.
static func level_for(points: float) -> int:
	var lvl := 0
	for i in range(Balance.INSTABILITY_THRESHOLDS.size()):
		if points >= float(Balance.INSTABILITY_THRESHOLDS[i]):
			lvl = i
	return lvl


static func level_name(level: int) -> String:
	var idx := clampi(level, 0, LOC_KEYS.size() - 1)
	return Loc.t(LOC_KEYS[idx])


## Normalised 0..1 progress for HUD bars.
static func normalized(points: float) -> float:
	return clampf(points / float(Balance.INSTABILITY_MAX), 0.0, 1.0)
