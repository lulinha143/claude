# Known Limitations (transparent status)

This is deliberately honest. Nothing below is disguised as complete.

## Content depth vs. breadth
- **Systems** support the full 1.0 targets and content **data** meets the
  declared minimums (`content/CONTENT_STATUS.md`). However, only **4 of 20**
  furniture types have hand-authored *bespoke* supernatural behaviour (Sofa,
  Fridge, Wardrobe, Lamp). The other 16 are fully data-defined and spawnable and
  use generic emotional behaviour until their special behaviours are scripted.
- Of 8 location families, one procedural **house assembler** (`LevelBuilder`) is
  implemented and used for all contracts; per-location authored modules/hazards
  are data-listed but not yet uniquely built.

## Networking
- ENet development transport (direct IP / LAN) works with a version handshake,
  typed validated messages, and lightweight transform/emotion sync. It has **not**
  been hardened for adversarial clients or high latency at scale.
- **Steam P2P networking and Steam lobbies are stubs** behind the platform
  interface (`docs/STEAM_INTEGRATION.md`). Requires vendoring GodotSteam.
- Mid-contract rejoin is not implemented (late-join is handled at the warehouse).
- Full multiplayer QA (the matrix in `docs/MULTIPLAYER.md`) must be run manually
  on real machines; automated tests cover message validation and single-process
  logic only.

## Art & audio
- All visuals are **procedural placeholders** (code meshes/materials, SVG UI,
  code-drawn Boxy) and all SFX are **synthesized placeholders**. They are
  original and cohesive but not final. Replacement pipeline:
  `docs/ASSET_REPLACEMENT_GUIDE.md`.
- Adaptive music is a single intensity-modulated bed (hook exists for layered
  stems).

## Platforms
- Windows/Linux export presets provided; builds are **unsigned**.
- macOS is **experimental** and not commercially distributable without signing +
  notarization.
- Steam Deck is prepared but unverified on-device.

## Legal
- `LICENSE`, `PRIVACY.md`, and other legal docs are **templates requiring
  professional review**. The title "HEAVY BAGGAGE" needs formal trademark/domain/
  storefront availability checks before commercial use (tracked in the release
  checklist).

## Warehouse
- The warehouse is a functional **menu hub** (with Boxy), not yet a walkable 3D
  space. Every listed action is reachable and works.

See `docs/IMPLEMENTATION_PROGRESS.md` for the phase-by-phase status and the
continuation queue.
