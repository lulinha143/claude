# Multiplayer Architecture

HEAVY BAGGAGE supports 1–4 players. Networking is **host-authoritative** and
sits behind an interface so Steam P2P and the ENet development transport never
contaminate game logic.

## Layers

- **Transport:** `ENetMultiplayerPeer` for development (direct IP / LAN). In a
  Steam build, a Steam P2P transport implements the same role behind the
  `PlatformInterface` boundary (stubbed today — see `docs/STEAM_INTEGRATION.md`).
- **Message channel:** `Net` (autoload `game/autoload/net_manager.gd`) exposes
  `send_to_host(type, payload)` and `broadcast(type, payload)`. Every message is
  a `{type, payload}` dictionary validated by `NetMessages.validate()` on receipt.
- **State sync:** transforms/emotions for furniture and players are pushed by the
  authority via lightweight RPC (`_sync_state` / `_sync_player`) at 15–20 Hz and
  interpolated on remotes.

## Authority model

- The **host is peer 1** and authoritative over furniture and world state.
- Clients **request** critical actions (grab, calm, door toggle, contract
  complete). The host validates (schema + game rules) then applies and
  replicates. This prevents malformed/cheating payloads from mutating state.
- Furniture nodes are named deterministically (`Furniture_<type>_<suffix>`) so
  RPC node paths match across peers (all peers build the same contract from the
  same seed).

## Session flow

1. Host: Warehouse → **Host Co-op** → `Net.host_game(port, password?)`.
2. Client: Main Menu → **Join Game** → enter IP (+ optional dev password).
3. On connect, the client sends a **handshake** (`protocol`, `version`,
   `password_hash`, `name`). The host rejects mismatched protocol or password and
   disconnects the peer.
4. Contract seed is shared so all peers generate identical contracts. Late-join
   is handled at the warehouse; mid-contract rejoin is a documented future item.

## Lobby modes

- Dev build: direct IP + optional **lobby password** (hashed).
- Steam build: private / friends-only / public lobbies, invitations, join-through-
  friends — via the platform adapter (stubbed).

## QA / simulation tools

`Net.sim_latency_ms` and `Net.sim_packet_loss` add artificial delay/drops **at
the message-channel level** for testing reconnection and desync handling.
Transport-level netem-style simulation is out of scope and should be done with OS
tooling if needed. The dev overlay can trigger these.

## Manual multiplayer test (two clients, one machine)

```bash
# Terminal 1 — host:
godot --path . --dev -- --host
# Terminal 2 — client:
godot --path . --dev -- --join 127.0.0.1
```

**Test matrix (do not assume it works just because windows connect):**

- [ ] Two players grab the same sofa; forces combine; it lifts.
- [ ] Furniture emotion changes replicate to the client.
- [ ] Door open/break replicates.
- [ ] A player is incapacitated and revived; state replicates.
- [ ] A furniture object entering the van completes the objective for all.
- [ ] Host disconnect returns clients to a clear error/menu.
- [ ] Version mismatch is rejected with a message.

## No permanent server

There is no dedicated-server requirement and no developer-operated backend for
core play. `--host` simply makes one client authoritative.
