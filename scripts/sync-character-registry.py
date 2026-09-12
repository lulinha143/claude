#!/usr/bin/env python3
"""Rewrite the `art(...)` calls in the character registry from measured data.

The registry (`src/art/characterAssets.ts`) is DERIVED data with three sources:

  * `frameWidth` / `frameHeight`  the real dimensions of the shipped `<asset>-1x.png`.
                                  They are the sprite's only aspect-ratio source, so
                                  they must match the file on disk exactly or
                                  characters render squashed.
  * `src2x` (5th argument)        the real dimensions of `<asset>.png`, so the
                                  renderer can label its srcSet density truthfully
                                  instead of asserting a 2x relationship that the
                                  display-size re-encode ended.
  * the figure block              `officeHeight` / `baseline` / `anchorX` /
                                  `figureTop`, straight out of
                                  `assets/sources/characters/figure-metrics.json`.

Keeping all three in one generator means the registry cannot drift from the pixels,
and `tests/characterAssets.test.ts` re-checks every number against the same sources.

Order of operations when the cast is re-encoded:

    1. python3 scripts/measure-character-figures.py       # fractions off the @2x art
    2. python3 scripts/sync-character-registry.py         # officeHeight lands here
    3. python3 scripts/reencode-cast-display-size.py      # encodes @1x at officeHeight*presence
    4. python3 scripts/sync-character-registry.py         # frame dims land here

Steps 2 and 4 are the same idempotent command; running it twice is what lets the
encode height depend on `officeHeight` without `officeHeight` depending back on the
encode. Re-running once more must produce no diff, which is the convergence check.

Usage:
    python3 scripts/sync-character-registry.py [--check]
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
REGISTRY = REPO / "src" / "art" / "characterAssets.ts"
METRICS = REPO / "assets" / "sources" / "characters" / "figure-metrics.json"
EMPLOYEE_DIR = REPO / "public" / "employees"

# Matches one `art('<asset>', W, H, { officeHeight: .., baseline: .., anchorX: ..,
# figureTop: .. }, [W2, H2])` head.
#
# `\s*` everywhere, including straight after `art(`, so Prettier is free to wrap the
# call across lines -- which it does, once the @2x tuple pushes it over the print
# width. The numbers are then substituted INDIVIDUALLY inside whatever text matched
# (see `sync_call`), so the generator preserves the existing layout instead of
# fighting the formatter over it. That is what keeps `--check` honest: a
# already-correct registry produces a byte-identical file whether Prettier has been
# over it or not.
ART_CALL = re.compile(
    r"art\(\s*'(?P<asset>[a-z0-9-]+)',\s*"
    r"(?P<fw>\d+),\s*(?P<fh>\d+),\s*"
    r"\{\s*officeHeight:\s*(?P<oh>\d+),\s*"
    r"baseline:\s*(?P<baseline>[\d.]+),\s*"
    r"anchorX:\s*(?P<anchor>[\d.]+),\s*"
    r"figureTop:\s*(?P<top>[\d.]+),?\s*\}"
    r"(?P<src2x>,\s*\[\s*\d+,\s*\d+,?\s*\])?"
)


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path} is not a PNG")
    return struct.unpack(">I", head[16:20])[0], struct.unpack(">I", head[20:24])[0]


def num(value: float) -> str:
    """Render a fraction the way the registry already writes them."""
    if value == int(value):
        return str(int(value))
    return f"{value:.6f}".rstrip("0")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--check",
        action="store_true",
        help="fail instead of writing if the registry is out of date",
    )
    args = ap.parse_args()

    metrics = json.loads(METRICS.read_text())
    derived = metrics["derived"]
    characters = metrics["characters"]
    source = REGISTRY.read_text()
    seen: list[str] = []

    def replace(match: re.Match[str]) -> str:
        asset = match.group("asset")
        seen.append(asset)
        if asset not in derived:
            raise SystemExit(f"{asset}: no measured figure metrics")
        d = derived[asset]
        m = characters[asset]
        fw, fh = png_size(EMPLOYEE_DIR / f"{asset}-1x.png")
        sw, sh = png_size(EMPLOYEE_DIR / f"{asset}.png")
        text = match.group(0)

        def field(pattern: str, value: str, source: str) -> str:
            out, n = re.subn(pattern, lambda mm: mm.group(1) + value, source, count=1)
            if n != 1:
                raise SystemExit(f"{asset}: could not update /{pattern}/")
            return out

        # Frame dimensions: the two bare integers straight after the asset name.
        text = field(rf"(art\(\s*'{asset}',\s*)\d+", str(fw), text)
        text = field(rf"(art\(\s*'{asset}',\s*{fw},\s*)\d+", str(fh), text)
        text = field(r"(officeHeight:\s*)\d+", str(d["officeHeight"]), text)
        text = field(r"(baseline:\s*)[\d.]+", num(d["baseline"]), text)
        text = field(r"(anchorX:\s*)[\d.]+", num(d["anchorX"]), text)
        text = field(r"(figureTop:\s*)[\d.]+", num(m["topPadFraction"]), text)

        if match.group("src2x"):
            text = field(r"(\[\s*)\d+", str(sw), text)
            text = field(rf"(\[\s*{sw},\s*)\d+", str(sh), text)
        else:
            # First run on a registry that predates the @2x tuple: append it.
            text = f"{text}, [{sw}, {sh}]"
        return text

    updated = ART_CALL.sub(replace, source)
    if not seen:
        raise SystemExit("no art(...) calls found -- has the registry shape changed?")

    if updated == source:
        print(f"registry already in sync ({len(seen)} characters)")
        return 0
    if args.check:
        print(f"registry is OUT OF DATE ({len(seen)} characters checked)", file=sys.stderr)
        return 1
    REGISTRY.write_text(updated)
    print(f"synced {len(seen)} characters into {REGISTRY.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
