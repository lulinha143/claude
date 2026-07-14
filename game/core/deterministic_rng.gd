class_name DeterministicRNG
extends RefCounted
## A seedable, reproducible random number generator wrapper.
##
## Contracts, daily challenges, and procedural layout all derive from a single
## seed so that a shared seed reproduces an identical contract on any machine.
## Uses named sub-streams so unrelated systems don't disturb each other's
## sequence (e.g. layout RNG stays stable even if audio RNG is added later).

var _seed: int = 0
var _streams: Dictionary = {}


func _init(seed_value: int = 0) -> void:
	set_seed(seed_value)


func set_seed(seed_value: int) -> void:
	_seed = seed_value
	_streams.clear()


func get_seed() -> int:
	return _seed


## Returns (creating if needed) a named deterministic sub-stream.
func stream(name: String) -> RandomNumberGenerator:
	if _streams.has(name):
		return _streams[name]
	var rng := RandomNumberGenerator.new()
	# Combine the master seed with a stable hash of the stream name.
	rng.seed = _seed ^ (hash(name) * 2654435761)
	_streams[name] = rng
	return rng


# Named to avoid clashing with the @GlobalScope randi_range/randf functions.
func int_range(name: String, from: int, to: int) -> int:
	return stream(name).randi_range(from, to)


func float_range(name: String, from: float, to: float) -> float:
	return stream(name).randf_range(from, to)


func unit(name: String) -> float:
	return stream(name).randf()


## Deterministically picks one element from an array using the named stream.
func pick(name: String, arr: Array) -> Variant:
	if arr.is_empty():
		return null
	return arr[int_range(name, 0, arr.size() - 1)]


## Returns a shuffled copy of `arr` without mutating the input.
func shuffled(name: String, arr: Array) -> Array:
	var copy := arr.duplicate()
	var rng := stream(name)
	# Fisher-Yates for deterministic ordering.
	for i in range(copy.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp: Variant = copy[i]
		copy[i] = copy[j]
		copy[j] = tmp
	return copy


## Builds a deterministic integer seed from a date, used by daily challenges.
static func seed_from_date(year: int, month: int, day: int, salt: int = 0) -> int:
	return (year * 10000 + month * 100 + day) ^ (salt * 2654435761)


## Parses a human-shareable seed string ("ABCD-1234") into an int, or hashes it.
static func parse_seed(text: String) -> int:
	var trimmed := text.strip_edges()
	if trimmed.is_valid_int():
		return int(trimmed)
	return abs(hash(trimmed))
