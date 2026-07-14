class_name NetMessages
extends RefCounted
## Typed multiplayer message catalogue + validation.
##
## All gameplay-critical actions travel as typed messages through NetManager,
## where the host validates them before applying. This keeps network wire format
## explicit and prevents malformed/cheating payloads from mutating game state.

enum Type {
	HANDSHAKE,          # {protocol, version, password_hash, name, character}
	HANDSHAKE_OK,       # {peer_id}
	HANDSHAKE_REJECT,   # {reason}
	GRAB_REQUEST,       # {furniture_id, grip_index}
	GRAB_GRANTED,       # {furniture_id, grip_index, peer_id}
	RELEASE,            # {furniture_id, grip_index}
	CALM_ACTION,        # {furniture_id, action}
	DOOR_TOGGLE,        # {door_id, open}
	PING,               # {position:Vector3, kind}
	PLAYER_STATE,       # {state}
	OBJECTIVE_UPDATE,   # {objective_id, complete}
	CONTRACT_COMPLETE,  # {result}
}

## Declares required fields per message type for validation.
const SCHEMA: Dictionary = {
	Type.HANDSHAKE: ["protocol", "version", "password_hash", "name"],
	Type.HANDSHAKE_OK: ["peer_id"],
	Type.HANDSHAKE_REJECT: ["reason"],
	Type.GRAB_REQUEST: ["furniture_id", "grip_index"],
	Type.GRAB_GRANTED: ["furniture_id", "grip_index", "peer_id"],
	Type.RELEASE: ["furniture_id", "grip_index"],
	Type.CALM_ACTION: ["furniture_id", "action"],
	Type.DOOR_TOGGLE: ["door_id", "open"],
	Type.PING: ["position", "kind"],
	Type.PLAYER_STATE: ["state"],
	Type.OBJECTIVE_UPDATE: ["objective_id", "complete"],
	Type.CONTRACT_COMPLETE: ["result"],
}


## Returns true if `payload` contains all required fields for `type` and the
## type is known. Used by the host before applying any client action.
static func validate(type: int, payload: Dictionary) -> bool:
	if not SCHEMA.has(type):
		Log.warn("Net", "Unknown message type %s" % type)
		return false
	for field in SCHEMA[type]:
		if not payload.has(field):
			Log.warn("Net", "Message %s missing field '%s'" % [type, field])
			return false
	return true


static func make(type: int, payload: Dictionary) -> Dictionary:
	return {"type": type, "payload": payload}
