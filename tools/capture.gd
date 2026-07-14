extends Node
## Offscreen screenshot harness for headless-ish rendering (via Xvfb + software
## GL). Loads a target scene, lets it build/settle, then saves a PNG. Used to
## visually verify the game during development. Not shipped in the game.
##
## Usage:
##   xvfb-run -s "-screen 0 1600x900x24" godot --rendering-driver opengl3 \
##     --path . res://tools/capture.tscn -- --scene=res://... --out=/abs/x.png --frames=140

var _target: String = "res://game/ui/screens/main_menu.tscn"
var _out: String = "user://shot.png"
var _frames: int = 140
var _count: int = 0
var _child: Node = null


func _ready() -> void:
	var seed_value := 0
	var tod := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--scene="):
			_target = a.substr("--scene=".length())
		elif a.begins_with("--out="):
			_out = a.substr("--out=".length())
		elif a.begins_with("--frames="):
			_frames = int(a.substr("--frames=".length()))
		elif a.begins_with("--seed="):
			seed_value = int(a.substr("--seed=".length()))
		elif a.begins_with("--tod="):
			tod = a.substr("--tod=".length())
	# For contract captures, allow a deterministic seed + forced time-of-day.
	if seed_value != 0:
		var c := ContractGenerator.generate("suburban_house", seed_value, 200)
		if tod != "":
			c.time_of_day = tod
		App.session["selected_contract"] = c
	get_window().size = Vector2i(1600, 900)
	await get_tree().process_frame
	await get_tree().process_frame
	if ResourceLoader.exists(_target):
		_child = load(_target).instantiate()
		get_tree().root.add_child(_child)
	else:
		push_error("capture: missing scene " + _target)


func _process(_delta: float) -> void:
	_count += 1
	if _count == _frames:
		var img := get_viewport().get_texture().get_image()
		img.save_png(_out)
		print("[CAPTURE] saved ", _out, " (", img.get_width(), "x", img.get_height(), ")")
		get_tree().quit()
