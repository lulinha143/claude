class_name ProceduralSfx
extends RefCounted
## Generates original placeholder sound effects entirely in code (no external
## audio files, zero copyright risk). Produces 16-bit mono AudioStreamWAV assets
## for squeaks, creaks, thuds, chimes and vocal "murmurs". Real artists replace
## these later via the AudioBank without touching gameplay (see
## docs/ASSET_REPLACEMENT_GUIDE.md).

const SAMPLE_RATE: int = 22050


static func _make_wav(samples: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in range(samples.size()):
		var v := clampf(samples[i], -1.0, 1.0)
		var s := int(v * 32767.0)
		bytes.encode_s16(i * 2, s)
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.data = bytes
	return wav


## Envelope helper: attack/decay applied to a sample index.
static func _env(i: int, total: int, attack: float, release: float) -> float:
	var t := float(i) / float(total)
	var a := clampf(t / maxf(attack, 0.001), 0.0, 1.0)
	var r := clampf((1.0 - t) / maxf(release, 0.001), 0.0, 1.0)
	return a * r


## A short "thud" for furniture impacts (low sine + noise burst).
static func thud(freq: float = 90.0, dur: float = 0.25) -> AudioStreamWAV:
	var n := int(SAMPLE_RATE * dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = int(freq * 1000.0)
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var tone := sin(TAU * freq * t) * 0.7
		var noise := rng.randf_range(-1.0, 1.0) * 0.3 * exp(-t * 30.0)
		out[i] = (tone + noise) * _env(i, n, 0.01, 0.9)
	return _make_wav(out)


## A squeak/creak for furniture movement (frequency-swept).
static func squeak(base: float = 400.0, dur: float = 0.4) -> AudioStreamWAV:
	var n := int(SAMPLE_RATE * dur)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var f := base + sin(t * 22.0) * base * 0.35
		out[i] = sin(TAU * f * t) * 0.35 * _env(i, n, 0.05, 0.4)
	return _make_wav(out)


## A soft chime for positive feedback (two-note bell).
static func chime(freq: float = 660.0, dur: float = 0.6) -> AudioStreamWAV:
	var n := int(SAMPLE_RATE * dur)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var a := sin(TAU * freq * t)
		var b := sin(TAU * freq * 1.5 * t) * 0.5
		out[i] = (a + b) * 0.3 * exp(-t * 4.0)
	return _make_wav(out)


## A murmuring vocalization for emotional furniture (non-verbal, gibberish).
static func murmur(pitch: float = 180.0, dur: float = 0.5, wobble: float = 8.0) -> AudioStreamWAV:
	var n := int(SAMPLE_RATE * dur)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var f := pitch * (1.0 + sin(t * wobble) * 0.15)
		var vib := sin(TAU * f * t)
		var formant := sin(TAU * f * 2.5 * t) * 0.3
		out[i] = (vib + formant) * 0.28 * _env(i, n, 0.08, 0.5)
	return _make_wav(out)
