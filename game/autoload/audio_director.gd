extends Node
## Audio director (autoload "Audio").
##
## Owns the audio bus layout, a bounded pool of one-shot SFX players (so we never
## spawn unbounded voices), and a layered adaptive music system whose intensity
## responds to contract phase / instability. All sounds are procedural
## placeholders generated at boot via ProceduralSfx (original, no copyright).

const SFX_POOL_SIZE: int = 16

var _sfx_players: Array[AudioStreamPlayer] = []
var _sfx_index: int = 0
var _bank: Dictionary = {}                # name -> AudioStream

var _music_player: AudioStreamPlayer
var _ambience_player: AudioStreamPlayer
var _music_intensity: float = 0.0


func _ready() -> void:
	_ensure_buses()
	_build_bank()
	_build_players()
	Settings.apply_all()   # re-apply volumes now that buses exist
	Log.info("Audio", "Audio director ready (%d SFX voices)." % SFX_POOL_SIZE)


func _ensure_buses() -> void:
	for bus_name in ["Music", "SFX", "Ambience", "Dialogue"]:
		if AudioServer.get_bus_index(bus_name) < 0:
			var idx := AudioServer.bus_count
			AudioServer.add_bus(idx)
			AudioServer.set_bus_name(idx, bus_name)
			AudioServer.set_bus_send(idx, "Master")


func _build_bank() -> void:
	_bank["thud"] = ProceduralSfx.thud()
	_bank["thud_heavy"] = ProceduralSfx.thud(60.0, 0.4)
	_bank["squeak"] = ProceduralSfx.squeak()
	_bank["creak"] = ProceduralSfx.squeak(220.0, 0.6)
	_bank["chime"] = ProceduralSfx.chime()
	_bank["chime_low"] = ProceduralSfx.chime(440.0, 0.5)
	_bank["grab"] = ProceduralSfx.thud(140.0, 0.12)
	_bank["knock"] = ProceduralSfx.thud(200.0, 0.1)
	_bank["murmur_calm"] = ProceduralSfx.murmur(160.0, 0.5, 4.0)
	_bank["murmur_nervous"] = ProceduralSfx.murmur(220.0, 0.4, 12.0)
	_bank["murmur_panic"] = ProceduralSfx.murmur(300.0, 0.6, 20.0)
	_bank["ui_move"] = ProceduralSfx.chime(880.0, 0.08)
	_bank["ui_confirm"] = ProceduralSfx.chime(720.0, 0.2)


func _build_players() -> void:
	for i in range(SFX_POOL_SIZE):
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_sfx_players.append(p)
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Music"
	add_child(_music_player)
	_ambience_player = AudioStreamPlayer.new()
	_ambience_player.bus = "Ambience"
	add_child(_ambience_player)


## Plays a named SFX from the bank on the next free (round-robin) voice.
func play_sfx(name: String, pitch: float = 1.0, volume_db: float = 0.0) -> void:
	if not _bank.has(name):
		Log.warn("Audio", "Unknown SFX '%s'" % name)
		return
	var p := _sfx_players[_sfx_index]
	_sfx_index = (_sfx_index + 1) % SFX_POOL_SIZE
	p.stream = _bank[name]
	p.pitch_scale = clampf(pitch, 0.2, 3.0)
	p.volume_db = volume_db
	p.play()


## Adjusts adaptive music intensity 0..1 (contract phase / instability driven).
func set_music_intensity(value: float) -> void:
	_music_intensity = clampf(value, 0.0, 1.0)
	# Placeholder: modulate volume; real layers swap in later.
	if _music_player != null and _music_player.playing:
		_music_player.volume_db = lerp(-12.0, 0.0, _music_intensity)


func play_bank(name: String) -> void:
	play_sfx(name)


func has_sound(name: String) -> bool:
	return _bank.has(name)
