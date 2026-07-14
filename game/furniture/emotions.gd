class_name Emotions
extends RefCounted
## Emotional state definitions for sentient furniture.
##
## An object has a continuous `arousal` (0..100) and a discrete `emotion`. The
## emotion is chosen by combining arousal with the object's dominant "mood
## bias" derived from its traits, so the same arousal can read as Lonely on a
## clingy object but Angry on a territorial one. Pure data + mapping helpers.

enum E {
	CALM,
	NERVOUS,
	LONELY,
	EXCITED,
	SUSPICIOUS,
	EMBARRASSED,
	ANGRY,
	PANICKED,
	POSSESSIVE,
	EXHAUSTED,
	MELANCHOLIC,
	UNHINGED,
}

const LOC_KEYS: Dictionary = {
	E.CALM: "EMOTION_CALM",
	E.NERVOUS: "EMOTION_NERVOUS",
	E.LONELY: "EMOTION_LONELY",
	E.EXCITED: "EMOTION_EXCITED",
	E.SUSPICIOUS: "EMOTION_SUSPICIOUS",
	E.EMBARRASSED: "EMOTION_EMBARRASSED",
	E.ANGRY: "EMOTION_ANGRY",
	E.PANICKED: "EMOTION_PANICKED",
	E.POSSESSIVE: "EMOTION_POSSESSIVE",
	E.EXHAUSTED: "EMOTION_EXHAUSTED",
	E.MELANCHOLIC: "EMOTION_MELANCHOLIC",
	E.UNHINGED: "EMOTION_UNHINGED",
}

## Emotions considered "agitated" — they raise property instability while active.
const AGITATED: Array = [E.ANGRY, E.PANICKED, E.POSSESSIVE, E.UNHINGED, E.SUSPICIOUS]


static func loc_key(emotion: int) -> String:
	return LOC_KEYS.get(emotion, "EMOTION_CALM")


static func display_name(emotion: int) -> String:
	return Loc.t(loc_key(emotion))


static func is_agitated(emotion: int) -> bool:
	return AGITATED.has(emotion)


## Maps arousal + a "mood bias" (a preferred negative emotion for the object,
## e.g. a clingy sofa biases toward LONELY) to a concrete emotion.
static func resolve(arousal: float, mood_bias: int, positive_bias: int = E.EXCITED) -> int:
	if arousal < Balance.AROUSAL_NERVOUS:
		return E.CALM
	if arousal < Balance.AROUSAL_AGITATED:
		# Low-mid arousal reads as the object's characteristic mild mood.
		return mood_bias if mood_bias != E.CALM else E.NERVOUS
	if arousal < Balance.AROUSAL_PANIC:
		# Mid-high arousal: escalate toward the negative pole unless the object
		# is being positively excited.
		return positive_bias if positive_bias == E.EXCITED and mood_bias == E.EXCITED else E.ANGRY
	if arousal < Balance.AROUSAL_MAX:
		return E.PANICKED
	return E.UNHINGED
