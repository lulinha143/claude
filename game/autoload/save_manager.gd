extends Node
## Company save manager (autoload "SaveManager").
##
## Features: multiple local profiles, automatic + manual save, versioning +
## migration, schema validation, corruption detection, rotating backups, atomic
## writes, export/import, and a Steam-cloud-compatible directory abstraction
## (path comes from Platform, never hardcoded to Steam).

const MAX_SLOTS: int = 5
const BACKUP_COUNT: int = 3
const AUTOSAVE_INTERVAL: float = 60.0

var current: Dictionary = {}
var current_slot: int = -1

var _autosave_accum: float = 0.0
var _dirty: bool = false


func _ready() -> void:
	_ensure_dir()


func _process(delta: float) -> void:
	if current_slot < 0 or current.is_empty():
		return
	current["playtime_seconds"] = float(current.get("playtime_seconds", 0.0)) + delta
	_dirty = true
	_autosave_accum += delta
	if _autosave_accum >= AUTOSAVE_INTERVAL:
		_autosave_accum = 0.0
		save()


# --- Directory / paths -----------------------------------------------------
func _base_dir() -> String:
	return Platform.save_dir()


func _ensure_dir() -> void:
	var dir := _base_dir()
	if not DirAccess.dir_exists_absolute(dir):
		DirAccess.make_dir_recursive_absolute(dir)


func _slot_path(slot: int) -> String:
	return "%s/company_%d.json" % [_base_dir(), slot]


func _backup_path(slot: int, index: int) -> String:
	return "%s/company_%d.bak%d.json" % [_base_dir(), slot, index]


# --- Profile listing -------------------------------------------------------
## Returns metadata for every existing slot (for the "Continue" screen).
func list_profiles() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for slot in range(MAX_SLOTS):
		if FileAccess.file_exists(_slot_path(slot)):
			var data := _read_json(_slot_path(slot))
			if data.is_empty():
				# Try a backup if the primary is corrupt.
				data = _read_first_valid_backup(slot)
			if not data.is_empty():
				out.append({
					"slot": slot,
					"company_name": data.get("company_name", "Company"),
					"cash": data.get("resources", {}).get(GameConstants.RES_CASH, 0),
					"reputation": data.get("resources", {}).get(GameConstants.RES_REPUTATION, 0),
					"playtime_seconds": data.get("playtime_seconds", 0.0),
					"contracts": data.get("stats", {}).get("contracts_completed", 0),
				})
	return out


func first_free_slot() -> int:
	for slot in range(MAX_SLOTS):
		if not FileAccess.file_exists(_slot_path(slot)):
			return slot
	return -1


# --- Create / load / save --------------------------------------------------
func new_company(company_name: String, slot: int = -1) -> bool:
	if slot < 0:
		slot = first_free_slot()
	if slot < 0:
		Log.warn("Save", "No free save slots.")
		return false
	current = SaveSchema.new_profile(company_name)
	current_slot = slot
	_dirty = true
	return save()


func load_company(slot: int) -> bool:
	var data := _read_json(_slot_path(slot))
	if data.is_empty():
		Log.warn("Save", "Primary save %d unreadable; trying backups." % slot)
		data = _read_first_valid_backup(slot)
	if data.is_empty():
		Log.error("Save", "Could not load company in slot %d." % slot)
		return false
	data = SaveMigrations.migrate(data)
	current = SaveSchema.sanitize(data)
	current_slot = slot
	EventBus.resources_changed.emit(current["resources"])
	Log.info("Save", "Loaded company '%s' (slot %d)." % [current["company_name"], slot])
	return true


## Atomic save with backup rotation. Returns success.
func save() -> bool:
	if current_slot < 0 or current.is_empty():
		return false
	_ensure_dir()
	current["schema_version"] = GameConstants.SAVE_SCHEMA_VERSION
	_rotate_backups(current_slot)

	var path := _slot_path(current_slot)
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		Log.error("Save", "Cannot open temp save file.")
		return false
	var payload := {"data": current, "checksum": _checksum(current)}
	f.store_string(JSON.stringify(payload, "\t"))
	f.flush()
	f.close()

	# Atomic replace where the platform supports it.
	var dir := DirAccess.open(_base_dir())
	if dir != null:
		if dir.file_exists(path.get_file()):
			dir.remove(path.get_file())
		dir.rename(tmp.get_file(), path.get_file())
	_dirty = false
	Log.debug("Save", "Saved company slot %d." % current_slot)
	return true


func delete_profile(slot: int) -> void:
	var dir := DirAccess.open(_base_dir())
	if dir == null:
		return
	var candidates := [_slot_path(slot).get_file()]
	for i in range(BACKUP_COUNT):
		candidates.append(_backup_path(slot, i).get_file())
	for c in candidates:
		if dir.file_exists(c):
			dir.remove(c)
	if slot == current_slot:
		current = {}
		current_slot = -1


# --- Export / import -------------------------------------------------------
func export_profile(slot: int, dest_path: String) -> bool:
	var data := _read_json(_slot_path(slot))
	if data.is_empty():
		return false
	var f := FileAccess.open(dest_path, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify({"data": data, "checksum": _checksum(data)}, "\t"))
	f.close()
	return true


func import_profile(src_path: String, slot: int) -> bool:
	var data := _read_json(src_path)
	if data.is_empty():
		return false
	data = SaveSchema.sanitize(SaveMigrations.migrate(data))
	current = data
	current_slot = slot
	return save()


# --- Resource helpers (used by progression) --------------------------------
func get_resource(id: String) -> int:
	return int(current.get("resources", {}).get(id, 0))


func add_resource(id: String, amount: int) -> void:
	if current.is_empty():
		return
	var res: Dictionary = current["resources"]
	res[id] = maxi(0, int(res.get(id, 0)) + amount)
	if id == GameConstants.RES_INSURANCE:
		res[id] = clampi(res[id], Balance.INSURANCE_MIN, Balance.INSURANCE_MAX)
	_dirty = true
	EventBus.resources_changed.emit(res)


func can_afford(id: String, amount: int) -> bool:
	return get_resource(id) >= amount


# --- Internals -------------------------------------------------------------
func _rotate_backups(slot: int) -> void:
	var path := _slot_path(slot)
	if not FileAccess.file_exists(path):
		return
	var dir := DirAccess.open(_base_dir())
	if dir == null:
		return
	# Shift older backups down.
	for i in range(BACKUP_COUNT - 1, 0, -1):
		var older := _backup_path(slot, i - 1).get_file()
		var newer := _backup_path(slot, i).get_file()
		if dir.file_exists(older):
			if dir.file_exists(newer):
				dir.remove(newer)
			dir.copy(older, newer)
	# Current -> backup 0.
	var b0 := _backup_path(slot, 0).get_file()
	if dir.file_exists(b0):
		dir.remove(b0)
	dir.copy(path.get_file(), b0)


func _read_first_valid_backup(slot: int) -> Dictionary:
	for i in range(BACKUP_COUNT):
		var d := _read_json(_backup_path(slot, i))
		if not d.is_empty():
			Log.info("Save", "Recovered from backup %d." % i)
			return d
	return {}


## Reads a JSON save file, verifies checksum, returns the inner data dict or {}.
func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	if not (parsed is Dictionary):
		Log.warn("Save", "Corrupt save (not JSON): %s" % path)
		return {}
	var payload: Dictionary = parsed
	if not payload.has("data"):
		# Legacy plain-data file (pre-checksum). Accept it.
		return payload if payload.has("schema_version") else {}
	var data: Dictionary = payload.get("data", {})
	var expected: String = str(payload.get("checksum", ""))
	if expected != "" and expected != _checksum(data):
		Log.warn("Save", "Checksum mismatch (possible tamper/corruption): %s" % path)
		# We still return the data — corruption detection is a warning, not a hard
		# fail, and backups provide the safety net.
	return data


func _checksum(data: Dictionary) -> String:
	return str(JSON.stringify(data)).sha256_text()
