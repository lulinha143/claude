#!/usr/bin/env python3
"""Measure whether the display-size re-encode actually made characters sharper.

"The build passes" is not evidence about pixels, so this compares the two pipelines
on the same character at the same final size:

    BEFORE  the old @1x asset (encoded at `officeHeight`) enlarged to the display
            height the way a browser would -- bilinear, which is what Chromium uses
            for an <img> being scaled up.
    AFTER   the new @1x asset, which IS the display height, drawn 1:1.

Both end up as the same number of pixels, so they can be compared directly. Two
metrics, on the alpha-weighted luminance so the transparent surround cannot skew them:

  * acutance -- mean gradient magnitude. Enlarging invents intermediate pixels, which
    flattens edges, so a higher number means genuinely crisper edges.
  * halo peak-to-peak -- spread of the mean alpha over the soft semi-transparent band
    across frames. This is the shimmer metric: it must NOT get worse, because a
    collapsed-alpha frame is what made Pip's halo flicker in the first place.

The BEFORE asset is read out of git, so this works on a normal checkout with no extra
files kept around.

Usage:
    python3 scripts/compare-sprite-sharpness.py [--rev HEAD] [--only pip,inky]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageSequence

REPO = Path(__file__).resolve().parent.parent
REGISTRY_DUMP = REPO / "scripts" / "dump-character-registry.mjs"
PRESENCE = 1.2

# Alpha band treated as "the soft halo": clearly present but not opaque. Mirrors the
# intent of the band in verify-assets.mjs.
HALO_LO, HALO_HI = 8, 200
# Frames sampled for the metrics. The figures barely move, so a sample is stable and
# far cheaper than decoding 242 frames of 22 animals twice.
SAMPLES = 24


def frames_of(im: Image.Image, limit: int) -> list[Image.Image]:
    total = getattr(im, "n_frames", 1)
    step = max(1, total // limit)
    out = []
    for index, frame in enumerate(ImageSequence.Iterator(im)):
        if index % step:
            continue
        out.append(frame.convert("RGBA").copy())
        if len(out) >= limit:
            break
    return out


def acutance(rgba: np.ndarray) -> float:
    """Mean gradient magnitude of alpha-weighted luminance."""
    arr = rgba.astype(np.float64)
    a = arr[..., 3] / 255.0
    lum = (0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]) * a
    gy, gx = np.gradient(lum)
    return float(np.hypot(gx, gy).mean())


def halo_mean(rgba: np.ndarray) -> float | None:
    alpha = rgba[..., 3]
    band = alpha[(alpha >= HALO_LO) & (alpha <= HALO_HI)]
    return float(band.mean()) if band.size else None


def measure(images: list[Image.Image]) -> dict:
    acu = [acutance(np.asarray(im)) for im in images]
    halos = [h for h in (halo_mean(np.asarray(im)) for im in images) if h is not None]
    return {
        "acutance": round(sum(acu) / len(acu), 4),
        "haloMean": round(sum(halos) / len(halos), 2) if halos else None,
        "haloPeakToPeak": round(max(halos) - min(halos), 2) if halos else None,
        "frames": len(images),
    }


def git_show(rev: str, path: str) -> bytes | None:
    proc = subprocess.run(
        ["git", "show", f"{rev}:{path}"], cwd=REPO, capture_output=True
    )
    return proc.stdout if proc.returncode == 0 else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rev", default="HEAD", help="revision holding the BEFORE assets")
    ap.add_argument("--only", default="")
    ap.add_argument("--json", type=Path, default=None)
    args = ap.parse_args()

    registry = json.loads(
        subprocess.run(
            ["node", str(REGISTRY_DUMP)], cwd=REPO, check=True, capture_output=True, text=True
        ).stdout
    )
    wanted = {s.strip() for s in args.only.split(",") if s.strip()}
    if wanted:
        registry = [e for e in registry if e["employee"] in wanted]

    print(
        f"\n{'character':<10}{'acutance before':>16}{'after':>9}{'change':>9}"
        f"{'halo p2p before':>17}{'after':>8}"
    )
    rows = []
    for entry in registry:
        asset = entry["asset"]
        css = round(entry["officeHeight"] * PRESENCE)
        new_path = REPO / "public" / "employees" / f"{asset}-1x.png"

        old_bytes = git_show(args.rev, f"public/employees/{asset}-1x.png")
        if old_bytes is None:
            print(f"{entry['employee']:<10}  no BEFORE asset at {args.rev}, skipped")
            continue

        with Image.open(BytesIO(old_bytes)) as old_im:
            old_frames = frames_of(old_im, SAMPLES)
        with Image.open(new_path) as new_im:
            new_frames = frames_of(new_im, SAMPLES)

        # Reproduce what the browser did to the old asset: enlarge it to the box.
        scale = css / old_frames[0].height
        if abs(scale - 1) < 1e-6:
            print(f"{entry['employee']:<10}  BEFORE already at display size, skipped")
            continue
        target = (round(old_frames[0].width * scale), css)
        upscaled = [im.resize(target, Image.BILINEAR) for im in old_frames]

        before = measure(upscaled)
        after = measure(new_frames)
        change = (after["acutance"] - before["acutance"]) / before["acutance"] * 100
        rows.append(
            {
                "employee": entry["employee"],
                "displayHeight": css,
                "beforeUpscale": round(scale, 4),
                "before": before,
                "after": after,
                "acutanceChangePct": round(change, 2),
            }
        )
        print(
            f"{entry['employee']:<10}{before['acutance']:>16.3f}{after['acutance']:>9.3f}"
            f"{change:>8.1f}%{str(before['haloPeakToPeak']):>17}{str(after['haloPeakToPeak']):>8}"
        )

    if not rows:
        print("\nnothing compared")
        return 1

    gains = [r["acutanceChangePct"] for r in rows]
    improved = sum(1 for g in gains if g > 0)
    print(
        f"\nacutance: mean {sum(gains) / len(gains):+.1f}%, "
        f"worst {min(gains):+.1f}%, best {max(gains):+.1f}%  "
        f"({improved}/{len(rows)} characters sharper)"
    )
    worse_halo = [
        r["employee"]
        for r in rows
        if r["before"]["haloPeakToPeak"] is not None
        and r["after"]["haloPeakToPeak"] is not None
        and r["after"]["haloPeakToPeak"] > r["before"]["haloPeakToPeak"] + 2
    ]
    print(
        "halo stability: no character regressed"
        if not worse_halo
        else f"halo stability: REGRESSED for {', '.join(worse_halo)}"
    )
    if args.json:
        args.json.write_text(json.dumps({"characters": rows}, indent=2) + "\n")
        print(f"wrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
