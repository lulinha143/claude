extends Node
## Network manager (autoload "Net").
##
## Interface-based networking so Steam P2P and the ENet dev transport never
## contaminate game logic. Host-authoritative: clients send typed requests, the
## host validates and applies, then state replicates. Includes a version
## handshake, lobby password (dev mode), and latency/packet-loss SIMULATION at
## the message-channel level for QA (transport-level sim is documented as out of
## scope in docs/MULTIPLAYER.md).

enum Status { OFFLINE, HOSTING, CONNECTING, CONNECTED, ERROR }

var status: int = Status.OFFLINE
var is_host: bool = false
var password_hash: String = ""

## QA simulation knobs (dev only). 0 = disabled.
var sim_latency_ms: int = 0
var sim_packet_loss: float = 0.0

var _peer: ENetMultiplayerPeer
var _peers: Dictionary = {}      # peer_id -> {name, verified}
var _handlers: Dictionary = {}   # message type -> Array[Callable]


func _ready() -> void:
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_server)
	multiplayer.connection_failed.connect(_on_connection_failed)
	multiplayer.server_disconnected.connect(_on_server_disconnected)


# --- Public API ------------------------------------------------------------
func host_game(port: int = GameConstants.DEFAULT_PORT, password: String = "") -> bool:
	_reset()
	password_hash = _hash_password(password)
	_peer = ENetMultiplayerPeer.new()
	var err := _peer.create_server(port, GameConstants.MAX_PLAYERS)
	if err != OK:
		_set_status(Status.ERROR, "create_server failed (%d)" % err)
		return false
	multiplayer.multiplayer_peer = _peer
	is_host = true
	_peers[1] = {"name": Platform.display_name(), "verified": true}
	_set_status(Status.HOSTING, Loc.t("NET_HOSTING", {"port": port}))
	return true


func join_game(address: String, port: int = GameConstants.DEFAULT_PORT, password: String = "") -> bool:
	_reset()
	password_hash = _hash_password(password)
	_peer = ENetMultiplayerPeer.new()
	var err := _peer.create_client(address, port)
	if err != OK:
		_set_status(Status.ERROR, "create_client failed (%d)" % err)
		return false
	multiplayer.multiplayer_peer = _peer
	is_host = false
	_set_status(Status.CONNECTING, Loc.t("NET_CONNECTING"))
	return true


func start_offline() -> void:
	## Solo/offline mode: no real peer, local player is authority id 1.
	_reset()
	is_host = true
	_set_status(Status.OFFLINE, "offline")


func disconnect_all() -> void:
	if _peer != null:
		_peer.close()
	multiplayer.multiplayer_peer = null
	_reset()
	_set_status(Status.OFFLINE, "disconnected")


func local_id() -> int:
	if multiplayer.multiplayer_peer == null:
		return 1
	return multiplayer.get_unique_id()


func peer_ids() -> Array:
	return _peers.keys()


func peer_count() -> int:
	return _peers.size()


# --- Message channel -------------------------------------------------------
## Registers a handler for a message type. Multiple handlers allowed.
func on_message(type: int, callable: Callable) -> void:
	if not _handlers.has(type):
		_handlers[type] = []
	_handlers[type].append(callable)


## Sends a typed message to the host (or applies locally if we are the host).
func send_to_host(type: int, payload: Dictionary) -> void:
	var msg := NetMessages.make(type, payload)
	if is_host or multiplayer.multiplayer_peer == null:
		_dispatch(local_id(), type, payload)
	else:
		_send_rpc(1, msg)


## Host broadcasts a message to all clients (and applies locally).
func broadcast(type: int, payload: Dictionary) -> void:
	if not is_host:
		return
	var msg := NetMessages.make(type, payload)
	_dispatch(1, type, payload)
	if multiplayer.multiplayer_peer != null:
		for pid in _peers.keys():
			if pid != 1:
				_send_rpc(pid, msg)


func _send_rpc(target: int, msg: Dictionary) -> void:
	if sim_packet_loss > 0.0 and randf() < sim_packet_loss:
		return  # simulated drop (message channel only)
	if sim_latency_ms > 0:
		var timer := get_tree().create_timer(sim_latency_ms / 1000.0)
		timer.timeout.connect(func() -> void: _rpc_receive.rpc_id(target, msg))
	else:
		_rpc_receive.rpc_id(target, msg)


@rpc("any_peer", "reliable")
func _rpc_receive(msg: Dictionary) -> void:
	var sender := multiplayer.get_remote_sender_id()
	var type := int(msg.get("type", -1))
	var payload: Dictionary = msg.get("payload", {})
	if not NetMessages.validate(type, payload):
		Log.warn("Net", "Rejected invalid message from %d" % sender)
		return
	# Host re-broadcasts validated critical actions after applying.
	_dispatch(sender, type, payload)


func _dispatch(sender: int, type: int, payload: Dictionary) -> void:
	if _handlers.has(type):
		for cb in _handlers[type]:
			cb.call(sender, payload)


# --- Multiplayer callbacks -------------------------------------------------
func _on_peer_connected(id: int) -> void:
	Log.info("Net", "Peer connected: %d" % id)
	if is_host:
		# Client will send HANDSHAKE; register provisionally.
		_peers[id] = {"name": "Mover", "verified": false}
	else:
		# We are the client; send handshake to host.
		if id == 1:
			_send_handshake()


func _on_peer_disconnected(id: int) -> void:
	Log.info("Net", "Peer disconnected: %d" % id)
	_peers.erase(id)
	EventBus.net_peer_left.emit(id)


func _on_connected_to_server() -> void:
	_set_status(Status.CONNECTED, Loc.t("NET_CONNECTED"))
	_send_handshake()


func _on_connection_failed() -> void:
	_set_status(Status.ERROR, Loc.t("NET_DISCONNECTED"))
	disconnect_all()


func _on_server_disconnected() -> void:
	_set_status(Status.ERROR, Loc.t("NET_DISCONNECTED"))
	disconnect_all()


# --- Handshake / version check --------------------------------------------
func _send_handshake() -> void:
	_handshake.rpc_id(1, {
		"protocol": GameConstants.NET_PROTOCOL_VERSION,
		"version": GameConstants.VERSION,
		"password_hash": password_hash,
		"name": Platform.display_name(),
	})


@rpc("any_peer", "reliable")
func _handshake(payload: Dictionary) -> void:
	if not is_host:
		return
	var sender := multiplayer.get_remote_sender_id()
	if int(payload.get("protocol", -1)) != GameConstants.NET_PROTOCOL_VERSION:
		_handshake_result.rpc_id(sender, false, Loc.t("NET_VERSION_MISMATCH"))
		_peer.disconnect_peer(sender)
		return
	if str(payload.get("password_hash", "")) != password_hash:
		_handshake_result.rpc_id(sender, false, "bad_password")
		_peer.disconnect_peer(sender)
		return
	_peers[sender] = {"name": str(payload.get("name", "Mover")), "verified": true}
	_handshake_result.rpc_id(sender, true, "")
	EventBus.net_peer_joined.emit(sender)


@rpc("authority", "reliable")
func _handshake_result(ok: bool, reason: String) -> void:
	if ok:
		_set_status(Status.CONNECTED, Loc.t("NET_CONNECTED"))
	else:
		_set_status(Status.ERROR, reason)
		disconnect_all()


# --- Internals -------------------------------------------------------------
func _hash_password(pw: String) -> String:
	return pw.sha256_text() if not pw.is_empty() else ""


func _set_status(new_status: int, detail: String) -> void:
	status = new_status
	EventBus.net_status_changed.emit(new_status, detail)
	Log.info("Net", "Status: %s (%s)" % [Status.keys()[new_status], detail])


func _reset() -> void:
	_peers.clear()
	is_host = false
