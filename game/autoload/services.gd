extends Node
## Lightweight service locator / dependency-injection registry (autoload
## "Services"). Lets unit-testable logic depend on interfaces rather than
## concrete autoloads. Tests can register mock implementations here.
##
## This is intentionally minimal: register by string key, resolve by string key.
## It never creates a hidden global-state monster — systems opt in explicitly.

var _services: Dictionary = {}


func register(key: String, service: Object) -> void:
	if _services.has(key):
		Log.warn("Services", "Overwriting service '%s'" % key)
	_services[key] = service
	Log.debug("Services", "Registered '%s' -> %s" % [key, service.get_class()])


func has(key: String) -> bool:
	return _services.has(key)


func resolve(key: String) -> Object:
	if not _services.has(key):
		Log.error("Services", "No service registered for '%s'" % key)
		return null
	return _services[key]


func unregister(key: String) -> void:
	_services.erase(key)


## Clears everything except what the caller wants to keep. Used by tests.
func reset() -> void:
	_services.clear()
