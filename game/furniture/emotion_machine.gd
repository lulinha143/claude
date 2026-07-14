class_name EmotionMachine
extends RefCounted
## Finite-state emotion machine for a sentient object.
##
## Keeps a continuous `arousal` (0..AROUSAL_MAX) and resolves it (via Emotions)
## into a discrete emotion using the object's mood bias. Emits emotion_changed
## only on actual transitions. Pure logic — no scene dependencies — so it is
## fully unit-testable (see test/unit/test_emotions.gd).

signal emotion_changed(emotion: int, arousal: float)

var arousal: float = 0.0
var emotion: int = Emotions.E.CALM
var mood_bias: int = Emotions.E.NERVOUS
var calm_rate: float = 1.0
var trigger_sensitivity: float = 1.0

## When true, mid arousal reads as EXCITED (positive) rather than ANGRY.
var positive: bool = false


func configure(fd: FurnitureData) -> void:
	mood_bias = fd.mood_bias
	calm_rate = fd.calm_rate
	trigger_sensitivity = fd.trigger_sensitivity
	_resolve()


## Increases arousal (a trigger fired). Amount scaled by sensitivity.
func agitate(amount: float) -> void:
	arousal = clampf(arousal + amount * trigger_sensitivity, 0.0, Balance.AROUSAL_MAX)
	_resolve()


## Decreases arousal (a calming action). Not scaled by sensitivity.
func soothe(amount: float) -> void:
	arousal = clampf(arousal - amount, 0.0, Balance.AROUSAL_MAX)
	_resolve()


## Per-frame passive decay toward calm.
func tick(delta: float) -> void:
	if arousal > 0.0:
		arousal = maxf(0.0, arousal - Balance.EMOTION_DECAY * calm_rate * delta)
		_resolve()


func force_emotion(e: int) -> void:
	if e != emotion:
		emotion = e
		emotion_changed.emit(emotion, arousal)


func is_agitated() -> bool:
	return Emotions.is_agitated(emotion)


func _resolve() -> void:
	var positive_bias := Emotions.E.EXCITED if positive else Emotions.E.ANGRY
	var resolved := Emotions.resolve(arousal, mood_bias, positive_bias)
	if resolved != emotion:
		emotion = resolved
		emotion_changed.emit(emotion, arousal)
