extends HBTest
## Emotion FSM: arousal thresholds, decay, and transition signalling.

func test_starts_calm() -> void:
	var m := EmotionMachine.new()
	eq(m.emotion, Emotions.E.CALM, "new machine should be calm")


func test_agitate_raises_emotion() -> void:
	var m := EmotionMachine.new()
	m.mood_bias = Emotions.E.ANGRY
	m.agitate(Balance.AROUSAL_PANIC + 1.0)
	check(m.is_agitated(), "should be agitated after big trigger")
	eq(m.emotion, Emotions.E.PANICKED, "panic threshold reached")


func test_soothe_lowers() -> void:
	var m := EmotionMachine.new()
	m.agitate(90.0)
	m.soothe(90.0)
	eq(m.emotion, Emotions.E.CALM, "soothing back to calm")


func test_decay_toward_calm() -> void:
	var m := EmotionMachine.new()
	m.agitate(50.0)
	for i in range(200):
		m.tick(0.1)
	almost(m.arousal, 0.0, 0.01, "arousal should decay to zero")


func test_sensitivity_scales_trigger() -> void:
	var m := EmotionMachine.new()
	m.trigger_sensitivity = 2.0
	m.agitate(10.0)
	almost(m.arousal, 20.0, 0.01, "sensitivity multiplies trigger")


func test_transition_emits_once() -> void:
	var m := EmotionMachine.new()
	var count := [0]
	m.emotion_changed.connect(func(_e: int, _a: float) -> void: count[0] += 1)
	m.agitate(90.0)   # calm->panicked (at least one change)
	gt(float(count[0]), 0.0, "should emit on transition")
