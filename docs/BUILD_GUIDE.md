# Build Guide

## Prerequisites

- **Godot 4.4.x** standard build (no C#/Mono needed).
- For exporting: the matching **export templates** for 4.4.x
  (Editor → Manage Export Templates, or place them in
  `~/.local/share/godot/export_templates/4.4.1.stable/`).

## Open / run / test

```bash
make import        # build import + class cache (do this first on a clean clone)
make run           # run the game
make editor        # open in the editor
make test          # headless unit tests
make integration   # end-to-end contract test
make validate      # content + localization validators
```

All `make` targets accept `GODOT=/path/to/godot`.

## Renderers

- Default: **Forward+** (`renderer/rendering_method="forward_plus"`).
- Fallback: **Compatibility** (GL) is configured as the mobile method and can be
  forced with `--rendering-method gl_compatibility` for integrated GPUs / older
  hardware. Low settings target integrated graphics.

## Exports

```bash
make export-windows   # -> build/windows/HeavyBaggage.exe
make export-linux     # -> build/linux/HeavyBaggage.x86_64
make export-demo      # -> build/demo/HeavyBaggage_Demo.exe (feature "demo")
make release          # all of the above + zip archives into dist/
```

Presets are in `export_presets.cfg` (no secrets). The **Demo** preset sets the
`demo` custom feature, which restricts locations and suppresses achievements.

## Platforms

| Platform | Status |
|----------|--------|
| Windows 10/11 x64 | Primary target |
| Linux x64 | Supported |
| Steam Deck | Prepared (verify controls/perf on device) |
| macOS | **Experimental** — builds are not commercially distributable until
signed with a Developer ID and **notarized** by Apple (see RELEASE_CHECKLIST). |

## Code signing (commercial)

Development/CI builds are **unsigned**. For store distribution:

- **Windows:** sign with an Authenticode certificate (EV recommended to avoid
  SmartScreen warnings). Certificates are never stored in this repo.
- **macOS:** sign with Apple Developer ID + notarize + staple.

Never commit certificates or `steam_appid.txt`.
