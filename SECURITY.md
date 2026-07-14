# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.
Add a real security contact (email or a private advisory link) here before
release. Include steps to reproduce, affected version, and impact.

We aim to acknowledge reports within a reasonable time and to coordinate
disclosure responsibly.

## Scope & threat model

HEAVY BAGGAGE is a client-side game with peer-to-peer co-op:

- **No developer-operated backend** stores player data; there is no server-side
  attack surface owned by us.
- **Multiplayer is host-authoritative.** The host validates critical actions via
  typed messages (`game/net/net_messages.gd`) before applying them, to limit the
  impact of malformed or malicious client input. Report any validation bypass.
- **Saves** are local JSON with a checksum for corruption detection. They are not
  a trust boundary for other players; do not treat them as tamper-proof.

## Secrets

This repository must never contain secrets. `steam_appid.txt`, signing
certificates, and `.env` files are git-ignored. If you discover a committed
secret, report it privately and it will be rotated and purged.
