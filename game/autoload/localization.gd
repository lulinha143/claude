extends Node
## Localization service (autoload "Loc").
##
## Loads translations at runtime from CSV (works headless / in exports without
## relying on the editor import step), registers them with the TranslationServer,
## and offers a typed `t()` helper with argument substitution, pluralization,
## missing-key warnings (dev only), and a pseudo-localization mode for layout
## testing. UI code must call Loc.t("KEY") — never hardcode display text.

const CSV_PATH: String = "res://content/localization/strings.csv"

## Locales we ship infrastructure for. en + pt_BR are fully authored; the rest
## fall back to English until translated (see docs/LOCALIZATION_GUIDE.md).
const SUPPORTED_LOCALES: Array[String] = [
	"en", "pt_BR", "es", "fr", "de", "it", "pl", "ru", "ja", "ko", "zh_CN", "zh_TW",
]
const FALLBACK_LOCALE: String = "en"

var _keys: Dictionary = {}          # key -> {locale -> text}
var _missing_reported: Dictionary = {}
var _pseudo: bool = false
var _current: String = "en"


func _ready() -> void:
	# Our t() implements its own fallback; also inform the engine when available.
	if TranslationServer.has_method("set_fallback_locale"):
		TranslationServer.call("set_fallback_locale", FALLBACK_LOCALE)
	_load_csv()
	EventBus.settings_changed.connect(_on_settings_changed)
	_apply_from_settings()


func _apply_from_settings() -> void:
	var lang := str(Settings.get_value("locale", "language"))
	_pseudo = bool(Settings.get_value("locale", "pseudo_localize"))
	if lang == "auto" or lang.is_empty():
		lang = _detect_system_locale()
	set_locale(lang)


func _on_settings_changed(section: String) -> void:
	if section == "locale":
		_apply_from_settings()


func set_locale(locale: String) -> void:
	if not SUPPORTED_LOCALES.has(locale):
		Log.warn("Loc", "Unsupported locale '%s'; using fallback." % locale)
		locale = FALLBACK_LOCALE
	_current = locale
	TranslationServer.set_locale(locale)
	EventBus.locale_changed.emit(locale)
	Log.info("Loc", "Locale set to %s (pseudo=%s)" % [locale, _pseudo])


func get_locale() -> String:
	return _current


## Primary translation function. Supports named args: t("HELLO", {"name": "Boxy"})
## where the CSV value contains "{name}".
func t(key: String, args: Dictionary = {}) -> String:
	var text := _lookup(key, _current)
	if text.is_empty():
		text = _lookup(key, FALLBACK_LOCALE)
	if text.is_empty():
		_report_missing(key)
		text = key
	for arg_key in args.keys():
		text = text.replace("{%s}" % arg_key, str(args[arg_key]))
	if _pseudo:
		text = _pseudo_localize(text)
	return text


## Simple pluralization: expects keys "<base>.one" and "<base>.other".
func t_plural(base_key: String, n: int, args: Dictionary = {}) -> String:
	var full := args.duplicate()
	full["n"] = n
	var suffix := ".one" if n == 1 else ".other"
	return t(base_key + suffix, full)


## Locale-aware integer formatting (thousands separators per locale).
func format_int(value: int) -> String:
	var s := str(absi(value))
	var sep := _thousands_sep()
	var out := ""
	var count := 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		count += 1
		if count % 3 == 0 and i > 0:
			out = sep + out
	return ("-" + out) if value < 0 else out


func format_money(value: int) -> String:
	return "$" + format_int(value)


func _thousands_sep() -> String:
	match _current:
		"de", "it", "es", "pt_BR": return "."
		"fr", "ru": return " "
		_: return ","


func get_supported_locales() -> Array[String]:
	return SUPPORTED_LOCALES.duplicate()


func all_keys() -> Array:
	return _keys.keys()


## Returns per-locale completeness ratios for the localization validator.
func completeness() -> Dictionary:
	var total := _keys.size()
	var out: Dictionary = {}
	for locale in SUPPORTED_LOCALES:
		var have := 0
		for key in _keys.keys():
			var m: Dictionary = _keys[key]
			if m.has(locale) and not str(m[locale]).is_empty():
				have += 1
		out[locale] = 0.0 if total == 0 else float(have) / float(total)
	return out


# --- Internals -------------------------------------------------------------
func _lookup(key: String, locale: String) -> String:
	if not _keys.has(key):
		return ""
	var m: Dictionary = _keys[key]
	return str(m.get(locale, ""))


func _report_missing(key: String) -> void:
	if OS.is_debug_build() and not _missing_reported.has(key):
		_missing_reported[key] = true
		Log.warn("Loc", "Missing localization key: '%s'" % key)


func _load_csv() -> void:
	if not FileAccess.file_exists(CSV_PATH):
		Log.error("Loc", "Missing strings CSV at %s" % CSV_PATH)
		return
	var f := FileAccess.open(CSV_PATH, FileAccess.READ)
	if f == null:
		return
	var header := f.get_csv_line()
	# header: keys, en, pt_BR, es, ...
	var locales := header.slice(1)
	var loaded := 0
	while not f.eof_reached():
		var row := f.get_csv_line()
		if row.size() < 2 or row[0].strip_edges().is_empty():
			continue
		var key := row[0]
		var m: Dictionary = {}
		for i in range(locales.size()):
			var col := i + 1
			if col < row.size():
				m[locales[i]] = row[col]
		_keys[key] = m
		loaded += 1
	f.close()
	Log.info("Loc", "Loaded %d localization keys." % loaded)


func _detect_system_locale() -> String:
	var sys := OS.get_locale()          # e.g. "pt_BR", "en_US"
	# Exact match first.
	if SUPPORTED_LOCALES.has(sys):
		return sys
	# Language-only match (en_US -> en).
	var lang := sys.split("_")[0]
	for loc in SUPPORTED_LOCALES:
		if loc == lang or loc.begins_with(lang + "_"):
			return loc
	return FALLBACK_LOCALE


## Transforms text into accented/expanded pseudo-locale to expose layout issues
## and untranslated strings, while remaining readable.
func _pseudo_localize(text: String) -> String:
	var map := {
		"a": "á", "e": "é", "i": "í", "o": "ó", "u": "ú",
		"A": "Á", "E": "É", "O": "Ó",
	}
	var out := ""
	var in_brace := false
	for ch in text:
		if ch == "{":
			in_brace = true
		elif ch == "}":
			in_brace = false
		if in_brace:
			out += ch
		else:
			out += str(map.get(ch, ch))
	# Expand length ~30% to catch overflow.
	return "»" + out + "««"
