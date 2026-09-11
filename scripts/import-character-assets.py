#!/usr/bin/env python3
"""Import raw character APNGs into ZooWorkers as game-ready sprite sets.

WHY THIS EXISTS
---------------
The supplied character artwork is 960x960 and 80-210 MB per animal — fine as a
master, impossible to ship. This turns each master into the three files the game
actually renders, using the project's existing canonical encoder so the result
inherits its two hard-won properties: full-canvas frames (a moving dirty-rect is
what made a halo shimmer under a GPU compositor) and a premultiplied LANCZOS
downscale (so edges pick up no dark fringe).

NON-DESTRUCTIVE BY DESIGN
------------------------
Masters are never modified and never overwritten. They live outside the build in
`assets/sources/characters/` (gitignored, because ~1.3 GB has no business in a
repository) and every import records the Drive id, byte size and SHA-256 in a
committed manifest. That manifest is what makes a rollback deterministic without
digging through git history: re-fetch by id, verify the hash, re-run this script.

WHAT IT PRODUCES, per character
-------------------------------
    <name>.png         @2x animation, the sprite the office renders
    <name>-1x.png      @1x animation, so integer-DPR displays map 1:1
    <name>-poster.png  first frame, used when the player prefers reduced motion

Sizing: each master is cropped to the union of its content across sampled frames
(removing dead transparent padding, which otherwise makes one animal render tiny
inside a big empty canvas), then scaled so the @1x frame height matches the
authored office height. Rendering at @1x therefore maps one source pixel to one
CSS pixel, which is the condition the sprite renderer's geometry contract wants.

Usage:
    python3 scripts/import-character-assets.py --manifest assets/sources/characters/manifest.json
    python3 scripts/import-character-assets.py --only pip,bea        # subset
    python3 scripts/import-character-assets.py --dry-run            # plan only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENCODER = REPO / "scripts" / "build-employee-apng.py"
REPAIR = REPO / "scripts" / "repair-character-apng.py"

# Frames sampled when measuring the content bounding box. The box only needs to be
# tight enough to remove dead padding, and every animal here is a seated figure
# whose silhouette barely moves, so a sample is both sufficient and much faster
# than decoding 242 frames of a 200 MB file.
BBOX_SAMPLES = 16
# Breathing room kept around the measured content so a frame outside the sample
# cannot clip. Expressed as a fraction of the master canvas.
BBOX_MARGIN = 0.012


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def content_box(path: Path) -> tuple[int, int, int, int]:
    """Union of the opaque content across sampled frames, plus a safety margin."""
    from PIL import Image

    im = Image.open(path)
    n = getattr(im, "n_frames", 1)
    step = max(1, n // BBOX_SAMPLES)
    left = top = 10**9
    right = bottom = -1
    for index in range(0, n, step):
        im.seek(index)
        box = im.convert("RGBA").getchannel("A").getbbox()
        if not box:
            continue
        left, top = min(left, box[0]), min(top, box[1])
        right, bottom = max(right, box[2]), max(bottom, box[3])
    if right < 0:
        raise SystemExit(f"{path.name}: every sampled frame is fully transparent")

    w, h = im.size
    pad_x = int(w * BBOX_MARGIN)
    pad_y = int(h * BBOX_MARGIN)
    return (
        max(0, left - pad_x),
        max(0, top - pad_y),
        min(w, right + pad_x),
        min(h, bottom + pad_y),
    )


def build(entry: dict, source: Path, out_dir: Path, dry_run: bool) -> dict:
    name = entry["asset"]
    box = content_box(source)
    crop_w = box[2] - box[0]
    crop_h = box[3] - box[1]

    # `officeHeight` is the authored CSS height for this animal. The @1x asset is
    # encoded at exactly that height so it renders 1:1, and @2x at double for
    # HiDPI. Width follows the crop's aspect ratio in the encoder.
    h1 = int(entry["officeHeight"])
    h2 = h1 * 2

    out2x = out_dir / f"{name}.png"
    out1x = out_dir / f"{name}-1x.png"
    poster = out_dir / f"{name}-poster.png"
    crop_arg = f"{box[0]},{box[1]},{box[2]},{box[3]}"

    plan = {
        "employee": entry["employee"],
        "asset": name,
        "source": source.name,
        "source_bytes": source.stat().st_size,
        "crop": list(box),
        "crop_size": [crop_w, crop_h],
        "height_1x": h1,
        "height_2x": h2,
    }
    print(
        f"  {entry['employee']:<8} {source.name:<14} crop={crop_arg} "
        f"({crop_w}x{crop_h}) -> @1x h={h1}, @2x h={h2}"
    )
    if dry_run:
        return plan

    # @2x animation + the poster (poster taken at a generous height so the
    # reduced-motion still is not softer than the animation it replaces).
    subprocess.run(
        [
            sys.executable, str(ENCODER),
            "--src", str(source),
            "--out", str(out2x),
            "--height", str(h2),
            "--crop", crop_arg,
            "--poster", str(poster),
            "--poster-height", str(int(h2 * 1.4)),
        ],
        check=True,
    )
    # @1x animation.
    subprocess.run(
        [
            sys.executable, str(ENCODER),
            "--src", str(source),
            "--out", str(out1x),
            "--height", str(h1),
            "--crop", crop_arg,
        ],
        check=True,
    )

    # Repair isolated alpha dropouts, in the pipeline rather than by hand.
    #
    # A handful of frames in some masters have their semi-transparent alpha collapsed
    # to roughly half, which deflates the character's soft baked-in halo for a single
    # frame about once a second and reads in game as a shimmer/flicker. It was first
    # found in Pip and fixed by hand; when the 2.0 cast arrived, 7 of the 13 new
    # masters (marlow, otto, hazel, canela, quincy, mina, perry) carried the same
    # defect, so leaving the repair as a manual follow-up step was clearly the wrong
    # design. Running it here means a defective master cannot reach the game, and it
    # is a no-op for healthy artwork.
    #
    # The master itself is never touched: it stays in assets/sources/characters/ with
    # its SHA-256 recorded, so ORIGINAL -> DERIVED/REPAIRED -> ACTIVE all remain
    # recoverable. `npm run verify:assets` independently re-checks the result.
    plan["repaired_frames"] = {}
    for key, path in (("out_2x", out2x), ("out_1x", out1x)):
        proc = subprocess.run(
            [sys.executable, str(REPAIR), "--in", str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
        n = len([ln for ln in proc.stdout.splitlines() if "<- repair from frame" in ln])
        plan["repaired_frames"][key] = n
        if n:
            print(f"    repaired {n} alpha-dropout frame(s) in {path.name}")

    from PIL import Image

    for key, path in (("out_2x", out2x), ("out_1x", out1x), ("poster", poster)):
        im = Image.open(path)
        plan[key] = {
            "file": path.name,
            "size": list(im.size),
            "frames": getattr(im, "n_frames", 1),
            "bytes": path.stat().st_size,
        }
    plan["source_sha256"] = sha256(source)
    return plan


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--manifest",
        type=Path,
        default=REPO / "assets" / "sources" / "characters" / "manifest.json",
    )
    ap.add_argument("--out", type=Path, default=REPO / "public" / "employees")
    ap.add_argument("--only", default="", help="comma-separated employee ids")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    manifest = json.loads(args.manifest.read_text())
    src_dir = args.manifest.parent
    args.out.mkdir(parents=True, exist_ok=True)

    wanted = {s.strip() for s in args.only.split(",") if s.strip()}
    results = []
    print(f"Importing into {args.out.relative_to(REPO)}")
    for entry in manifest["characters"]:
        if wanted and entry["employee"] not in wanted:
            continue
        if entry.get("skipImport"):
            print(f"  {entry['employee']:<8} SKIPPED ({entry.get('skipReason', 'no reason given')})")
            continue
        source = src_dir / entry["sourceFile"]
        if not source.exists():
            print(f"  {entry['employee']:<8} MISSING master {source.name}", file=sys.stderr)
            continue
        results.append(build(entry, source, args.out, args.dry_run))

    if not args.dry_run and results:
        report = args.manifest.with_name("import-report.json")
        report.write_text(json.dumps({"characters": results}, indent=2) + "\n")
        print(f"\nWrote {report.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
