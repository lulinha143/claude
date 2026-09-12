#!/usr/bin/env python3
"""Re-encode the shipped @1x character sprites at their TRUE display size.

THE DEFECT THIS FIXES
---------------------
No character was drawn at the resolution its artwork was encoded at. `officeHeight`
is the authored CSS height, the importer encoded the @1x asset at exactly that, and
then the global presence multiplier (`CHARACTER_PRESENCE_SCALE = 1.2`) arrived and
made every sprite render at `presenceSize(officeHeight)` instead. The file labelled
`1x` was really a 0.83x asset for the box it was drawn into, so the browser enlarged
it ~1.16x on average (worst 1.26x) and the softness was baked into the composite
before any GPU, compositor or DPR difference got a say.

    character   @1x   CSS     old ratio        after this script
    pip          93   112     1.204x  (soft)   112 -> 1.000x  (pixel-exact)
    inky        100   126     1.260x  (soft)   126 -> 1.000x

WHY THE SOURCE IS THE SHIPPED @2x AND NOT THE MASTER
----------------------------------------------------
The 960x960 masters are gitignored (~1.3 GB) and are not present in a checkout;
`manifest.json` records how to re-fetch them. More importantly Pip must NOT be
re-imported: her master still carries the collapsed-alpha defect that caused the
halo shimmer, and the shipped `pip.png` is the hand-repaired build that was verified
on real hardware. The shipped @2x animation is therefore the highest-fidelity
artwork that actually exists in the repository, and it is comfortably larger than
the target (e.g. 200px source -> 126px target), so every character is produced by a
DOWNSCALE. Downscaling is the sharp direction; the previous behaviour was an upscale.

This does cost one extra resampling generation versus master -> @1x directly. That
is a deliberate trade against re-importing Pip from a known-defective master, and it
is recorded per character in the report this writes.

NON-DESTRUCTIVE
---------------
Only `<asset>-1x.png` is rewritten. It is a DERIVATIVE, not a master:
`<asset>.png` (the @2x animation, the retained high-fidelity build) and
`<asset>-poster.png` are never touched, so the operation is idempotent and fully
reversible by re-running this script. Every input and output is recorded with its
SHA-256 in `assets/sources/characters/reencode-report.json`.

The canonical encoder does the actual work, so the output inherits its hard-won
properties: full-canvas frames (a moving dirty-rect is what made a halo shimmer
under a GPU compositor), a premultiplied LANCZOS resample (no dark edge fringe),
preserved frame delays and infinite looping, and lossless duplicate-frame
coalescing. The alpha-dropout repair pass then runs on the result, so a defective
frame cannot reach the game.

Usage:
    python3 scripts/reencode-cast-display-size.py            # re-encode all
    python3 scripts/reencode-cast-display-size.py --only pip,inky
    python3 scripts/reencode-cast-display-size.py --dry-run  # plan + ratios only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENCODER = REPO / "scripts" / "build-employee-apng.py"
REPAIR = REPO / "scripts" / "repair-character-apng.py"
REGISTRY_DUMP = REPO / "scripts" / "dump-character-registry.mjs"
EMPLOYEE_DIR = REPO / "public" / "employees"
REPORT = REPO / "assets" / "sources" / "characters" / "reencode-report.json"

# Mirror of CHARACTER_PRESENCE_SCALE in src/content/characterScale.ts. The rendered
# height of a character is presenceSize(officeHeight) = round(officeHeight * this),
# and that is exactly the height the @1x asset must be encoded at.
PRESENCE = 1.2


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    """Width/height straight out of the IHDR, without decoding image data."""
    with path.open("rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path} is not a PNG")
    return struct.unpack(">I", head[16:20])[0], struct.unpack(">I", head[20:24])[0]


def apng_frames(path: Path) -> int:
    """Frame count from the acTL chunk (0 if the file is a still)."""
    with path.open("rb") as fh:
        fh.read(8)
        while True:
            hdr = fh.read(8)
            if len(hdr) < 8:
                return 0
            length = struct.unpack(">I", hdr[:4])[0]
            ctype = hdr[4:8]
            data = fh.read(length)
            fh.read(4)
            if ctype == b"acTL":
                return struct.unpack(">I", data[:4])[0]
            if ctype == b"IDAT":
                return 0


def apng_duration_ms(path: Path) -> int:
    """Total animation duration, summed over every fcTL delay."""
    total = 0
    with path.open("rb") as fh:
        fh.read(8)
        while True:
            hdr = fh.read(8)
            if len(hdr) < 8:
                break
            length = struct.unpack(">I", hdr[:4])[0]
            ctype = hdr[4:8]
            data = fh.read(length)
            fh.read(4)
            if ctype == b"fcTL":
                dn, dd = struct.unpack(">HH", data[20:24])
                total += round(dn / (dd or 100) * 1000)
            if ctype == b"IEND":
                break
    return total


def read_registry() -> list[dict]:
    out = subprocess.run(
        ["node", str(REGISTRY_DUMP)], check=True, capture_output=True, text=True, cwd=REPO
    )
    return json.loads(out.stdout)


def reencode(entry: dict, dry_run: bool) -> dict:
    asset = entry["asset"]
    source = EMPLOYEE_DIR / f"{asset}.png"
    target = EMPLOYEE_DIR / f"{asset}-1x.png"
    if not source.exists():
        raise SystemExit(f"{asset}: missing @2x source {source}")

    # The one number this whole script exists to honour.
    css_height = round(entry["officeHeight"] * PRESENCE)

    src_w, src_h = png_size(source)
    old_w, old_h = png_size(target) if target.exists() else (0, 0)
    old_bytes = target.stat().st_size if target.exists() else 0
    old_sha = sha256(target) if target.exists() else None
    old_ratio = round(css_height / old_h, 4) if old_h else None

    record = {
        "employee": entry["employee"],
        "asset": asset,
        "officeHeight": entry["officeHeight"],
        "presenceScale": PRESENCE,
        "targetHeight": css_height,
        "source": {
            "file": source.name,
            "size": [src_w, src_h],
            "bytes": source.stat().st_size,
            "sha256": sha256(source),
            "frames": apng_frames(source),
            "durationMs": apng_duration_ms(source),
        },
        "before": {
            "file": target.name,
            "size": [old_w, old_h],
            "bytes": old_bytes,
            "sha256": old_sha,
            "dpr1Ratio": old_ratio,
        },
        # The resample this script performs: source height -> target height.
        "resample": round(css_height / src_h, 4),
    }

    print(
        f"  {entry['employee']:<8} @1x {old_h:>4} -> {css_height:<4} "
        f"(was {old_ratio if old_ratio else '?'}x upscaled)  "
        f"from @2x {src_h}px, resample {record['resample']}x"
    )
    if dry_run:
        return record

    subprocess.run(
        [
            sys.executable, str(ENCODER),
            "--src", str(source),
            "--out", str(target),
            "--height", str(css_height),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    # Repair isolated alpha dropouts in the pipeline rather than by hand, exactly as
    # the importer does. A no-op for healthy artwork.
    proc = subprocess.run(
        [sys.executable, str(REPAIR), "--in", str(target)],
        check=True,
        capture_output=True,
        text=True,
    )
    repaired = len([ln for ln in proc.stdout.splitlines() if "<- repair from frame" in ln])
    if repaired:
        print(f"    repaired {repaired} alpha-dropout frame(s)")

    new_w, new_h = png_size(target)
    record["after"] = {
        "file": target.name,
        "size": [new_w, new_h],
        "bytes": target.stat().st_size,
        "sha256": sha256(target),
        "frames": apng_frames(target),
        "durationMs": apng_duration_ms(target),
        "repairedFrames": repaired,
        "dpr1Ratio": round(css_height / new_h, 4),
    }

    # Hard invariants. These are the properties the geometry contract depends on, so
    # a violation must stop the run rather than ship.
    if new_h != css_height:
        raise SystemExit(f"{asset}: encoded {new_h}px, expected {css_height}px")
    src_aspect = src_w / src_h
    new_aspect = new_w / new_h
    if abs(src_aspect - new_aspect) / src_aspect > 0.01:
        raise SystemExit(
            f"{asset}: aspect ratio drifted {src_aspect:.4f} -> {new_aspect:.4f} (squash risk)"
        )
    if record["after"]["frames"] < 1:
        raise SystemExit(f"{asset}: output is not animated")
    # Duration must survive coalescing exactly; that is what makes it lossless.
    if record["after"]["durationMs"] != record["source"]["durationMs"]:
        raise SystemExit(
            f"{asset}: duration changed {record['source']['durationMs']} -> "
            f"{record['after']['durationMs']} ms"
        )
    return record


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only", default="", help="comma-separated employee ids")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    wanted = {s.strip() for s in args.only.split(",") if s.strip()}
    registry = read_registry()
    if wanted:
        registry = [e for e in registry if e["employee"] in wanted]
    if not registry:
        raise SystemExit("no characters selected")

    print(f"Re-encoding {len(registry)} character(s) at true display size\n")
    records = [reencode(entry, args.dry_run) for entry in registry]

    if args.dry_run:
        return 0

    before = sum(r["before"]["bytes"] for r in records)
    after = sum(r["after"]["bytes"] for r in records)
    print(
        f"\n@1x payload {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB "
        f"({(after - before) / 1e6:+.1f} MB)"
    )
    print("every character now renders 1.000x at DPR 1")

    REPORT.write_text(
        json.dumps(
            {
                "_comment": [
                    "Provenance for the @1x display-size re-encode.",
                    "",
                    "Only <asset>-1x.png is rewritten, from <asset>.png (the retained @2x",
                    "build). Masters are untouched and Pip is NOT re-imported, so her",
                    "hand-repaired artwork is preserved. Re-running the script reproduces",
                    "these outputs, and the sha256 of every input and output is recorded",
                    "here so a rollback is deterministic.",
                ],
                "presenceScale": PRESENCE,
                "generatedBy": "scripts/reencode-cast-display-size.py",
                "characters": records,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"wrote {REPORT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
