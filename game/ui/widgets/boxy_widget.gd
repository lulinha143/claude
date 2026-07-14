extends Control
## Boxy — the company mascot ghost that lives in a cardboard box. Drawn entirely
## in code (original art) so he shows up in the warehouse and screenshots without
## any external asset. He dispenses tips/dispatch lines and occasionally "hides"
## in his box when spooked (high recent instability).

const TIPS: Array[String] = [
	"Every object has issues. Some just hide them better.",
	"Two movers carry a sofa. One mover carries regret.",
	"Knock before you open. The wardrobe remembers.",
	"Applause is free. Use it on the piano.",
	"If it's dark, the lamp is not okay. Neither are we.",
	"Feed the fridge before it feeds itself.",
	"A calm object is a light object.",
	"The side table did nothing wrong. Probably.",
]

var _hiding: bool = false
var _blink: float = 1.0
var _tip_index: int = 0
var _bubble: Label


func _ready() -> void:
	custom_minimum_size = Vector2(220, 220)
	_bubble = Label.new()
	_bubble.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_bubble.custom_minimum_size = Vector2(240, 0)
	_bubble.position = Vector2(230, 20)
	_bubble.add_theme_font_size_override("font_size", 16)
	add_child(_bubble)
	_next_tip()
	var t := Timer.new()
	t.wait_time = 6.0
	t.autostart = true
	t.timeout.connect(_next_tip)
	add_child(t)
	EventBus.instability_level_changed.connect(_on_instability)


func _next_tip() -> void:
	_tip_index = (_tip_index + 1) % TIPS.size()
	_bubble.text = "Boxy: " + TIPS[_tip_index]
	_blink = 0.0
	queue_redraw()


func _on_instability(level: int) -> void:
	_hiding = level >= 3
	queue_redraw()


func _process(delta: float) -> void:
	_blink = minf(1.0, _blink + delta)


func _draw() -> void:
	var box_col := Color(0.79, 0.54, 0.29)
	var box_dark := Color(0.55, 0.35, 0.18)
	var origin := Vector2(20, 60)
	var w := 150.0
	var h := 120.0
	# Box body.
	draw_rect(Rect2(origin, Vector2(w, h)), box_col)
	# Box lid line.
	draw_rect(Rect2(origin, Vector2(w, 26)), box_dark)
	draw_line(origin + Vector2(w * 0.5, 0), origin + Vector2(w * 0.5, h), box_dark, 3.0)
	if _hiding:
		# Lid closed — a little tag: "nobody home".
		draw_rect(Rect2(origin + Vector2(0, -6), Vector2(w, 16)), box_dark)
		return
	# Ghost peeking out.
	var gx := origin.x + w * 0.5
	var gy := origin.y + 34
	draw_circle(Vector2(gx, gy), 34, Color(0.95, 0.96, 1.0))
	draw_rect(Rect2(gx - 34, gy, 68, 30), Color(0.95, 0.96, 1.0))
	# Eyes (blink).
	var eye_h := 8.0 if _blink > 0.12 else 1.0
	draw_rect(Rect2(gx - 16, gy - 6, 8, eye_h), Color(0.15, 0.12, 0.2))
	draw_rect(Rect2(gx + 8, gy - 6, 8, eye_h), Color(0.15, 0.12, 0.2))
	# Smile.
	draw_arc(Vector2(gx, gy + 8), 10, 0.2, PI - 0.2, 12, Color(0.15, 0.12, 0.2), 2.0)
