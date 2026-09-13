#!/usr/bin/env python3
"""Compose the whole cast at their REAL rendered sizes, on one floor line.

WHY THIS EXISTS
---------------
"Every animal must look the same size as Pip" is the cast's hardest visual rule and
the easiest one to break, because the tempting way to check it is to compare image
dimensions — which is precisely the wrong question. The canvases are all different
sizes on purpose: each one is chosen so that the ANIMAL inside it, not the box
around it, matches Pip's figure height.

`tests/characterAssets.test.ts` already proves that arithmetically from the measured
fractions. What it cannot do is show you the answer, and a number agreeing with
another number is not the same as a roster that reads as one cast. So this draws the
thing a player actually sees: every character composited at the exact CSS height the
game renders them at (`frameHeight`, which is `officeHeight * presence`), aligned on
a shared floor line with each sprite sunk by its own `baseline`, exactly as the
office does it.

Two guide lines are drawn across the sheet at Pip's measured figure top and bottom.
An animal whose silhouette does not reach or overshoots those lines is mis-scaled,
and you can see it at a glance instead of reading a table.

The measured figure box of each character is also printed, so the sheet and the
numbers can be checked against each other.

Usage:
    python3 scripts/shot-cast-scale.py [--out PATH] [--frame 0.5]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageSequence

REPO = Path(__file__).resolve().parent.parent
EMPLOYEE_DIR = REPO / "public" / "employees"
METRICS = REPO / "assets" / "sources" / "characters" / "figure-metrics.json"
REGISTRY_DUMP = REPO / "scripts" / "dump-character-registry.mjs"
DEFAULT_OUT = REPO / "visual-artifacts" / "cast-scale.png"

# Mirrors the office backdrop closely enough to judge silhouettes against, without
# pulling the real scene in. Warm paper, not a neutral grey, because a cool
# background makes warm-toned artwork read smaller than it is.
BG = (233, 224, 208, 255)
FLOOR = (176, 154, 126, 255)
GUIDE = (34, 108, 74, 255)
LABEL = (58, 48, 38, 255)

# Alpha floor, mirroring scripts/measure-character-figures.py so the silhouette
# measured here is the same silhouette the registry was derived from.
ALPHA_FLOOR = 12

PAD_X = 14
TOP_PAD = 54
FLOOR_PAD = 46


def registry() -> list[dict]:
    out = subprocess.run(
        ["node", str(REGISTRY_DUMP)], check=True, capture_output=True, text=True, cwd=REPO
    )
    return json.loads(out.stdout)


def frame_at(path: Path, position: float) -> Image.Image:
    """A representative frame, as RGBA."""
    with Image.open(path) as im:
        n = getattr(im, "n_frames", 1)
        im.seek(min(n - 1, max(0, int(n * position))))
        return im.convert("RGBA")


def figure_box(path: Path) -> tuple[tuple[int, int, int, int], int]:
    """Union silhouette across EVERY frame, plus the per-frame vertical jitter.

    The union is the measurement that matters and the one the registry is derived
    from: a character's apparent size is the space they occupy over the loop, not in
    whichever frame a screenshot happened to catch. Sampling one frame instead is
    actively misleading — several animals have a soft contact shadow that only
    reaches its full extent in a handful of frames, so a mid-loop sample reported the
    bear 9.9% short and 10px airborne when its union silhouette is within 1% of Pip
    and its feet are exactly on the line.

    The jitter is returned alongside so that breathing room is visible rather than
    silently averaged away.
    """
    tops: list[int] = []
    bottoms: list[int] = []
    left = top = 10**9
    right = bottom = -1
    with Image.open(path) as im:
        for frame in ImageSequence.Iterator(im):
            a = np.asarray(frame.convert("RGBA").getchannel("A"))
            rows = np.where(a.max(axis=1) > ALPHA_FLOOR)[0]
            cols = np.where(a.max(axis=0) > ALPHA_FLOOR)[0]
            if rows.size == 0 or cols.size == 0:
                continue
            tops.append(int(rows[0]))
            bottoms.append(int(rows[-1]))
            top, bottom = min(top, int(rows[0])), max(bottom, int(rows[-1]))
            left, right = min(left, int(cols[0])), max(right, int(cols[-1]))
    if bottom < 0:
        raise SystemExit(f"{path.name}: no visible pixels in any frame")
    jitter = (max(bottoms) - min(bottoms)) + (max(tops) - min(tops))
    return (left, top, right, bottom), jitter


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument(
        "--frame",
        type=float,
        default=0.5,
        help="which frame to draw, as a fraction of the animation (default mid-loop)",
    )
    args = ap.parse_args()

    metrics = json.loads(METRICS.read_text())
    entries = registry()

    # The @1x asset is encoded at exactly the height the game renders it at, so
    # drawing it 1:1 reproduces the on-screen size with no resampling of our own.
    tiles: list[dict] = []
    for entry in entries:
        asset = entry["asset"]
        path = EMPLOYEE_DIR / f"{asset}-1x.png"
        if not path.exists():
            print(f"  {asset}: no @1x asset, skipped", file=sys.stderr)
            continue
        img = frame_at(path, args.frame)
        if img.height != entry["frameHeight"] or img.width != entry["frameWidth"]:
            raise SystemExit(
                f"{asset}: @1x is {img.width}x{img.height} but the registry says "
                f"{entry['frameWidth']}x{entry['frameHeight']} — run "
                f"scripts/sync-character-registry.py"
            )
        measured = metrics["characters"][asset]
        box, jitter = figure_box(path)
        tiles.append(
            {
                "employee": entry["employee"],
                "img": img,
                # The office sinks each sprite by its own dead bottom margin so the
                # FEET land on the floor line rather than the canvas edge.
                "sink": round(measured["bottomPadFraction"] * img.height),
                "box": box,
                "jitter": jitter,
            }
        )

    if not tiles:
        raise SystemExit("no character assets found")

    tallest = max(t["img"].height for t in tiles)
    width = sum(t["img"].width + PAD_X for t in tiles) + PAD_X
    height = TOP_PAD + tallest + FLOOR_PAD
    floor_y = TOP_PAD + tallest

    sheet = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.rectangle([0, floor_y, width, height], fill=FLOOR)
    draw.line([0, floor_y, width, floor_y], fill=(120, 100, 78, 255), width=2)

    # Pip is the reference. Her guide lines are what everyone else is judged against.
    pip = next(t for t in tiles if t["employee"] == "pip")
    pip_box = pip["box"]
    pip_bottom = floor_y - pip["sink"] + (pip_box[3] - pip["img"].height + 1)
    pip_top = floor_y - pip["sink"] + pip_box[1] - pip["img"].height
    for y in (pip_top, pip_bottom):
        draw.line([0, y, width, y], fill=GUIDE, width=1)
    draw.text((PAD_X, max(2, pip_top - 14)), "Pip figure top", fill=GUIDE)

    x = PAD_X
    rows = []
    for tile in tiles:
        img = tile["img"]
        y = floor_y - img.height + tile["sink"]
        sheet.alpha_composite(img, (x, y))
        box = tile["box"]
        fig_h = box[3] - box[1] + 1
        top_y = y + box[1]
        bottom_y = y + box[3] + 1
        draw.text((x, floor_y + 6), tile["employee"], fill=LABEL)
        draw.text((x, floor_y + 20), f"{fig_h}px", fill=LABEL)
        rows.append(
            {
                "employee": tile["employee"],
                "canvas": [img.width, img.height],
                "figureHeight": fig_h,
                "topVsPip": top_y - pip_top,
                "bottomVsPip": bottom_y - pip_bottom,
                "jitter": tile["jitter"],
            }
        )
        x += img.width + PAD_X

    args.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(args.out)
    print(f"wrote {args.out.relative_to(REPO)}  ({width}x{height})\n")

    ref = next(r for r in rows if r["employee"] == "pip")["figureHeight"]
    print("           canvas    figure   vs Pip    top drift  foot drift   jitter")
    worst = 0.0
    worst_who = ""
    for r in sorted(rows, key=lambda r: r["employee"]):
        delta = (r["figureHeight"] - ref) / ref
        if abs(delta) > worst:
            worst, worst_who = abs(delta), r["employee"]
        print(
            f"{r['employee']:<9} {r['canvas'][0]:>3}x{r['canvas'][1]:<3}  "
            f"{r['figureHeight']:>5}px  {delta*100:+6.1f}%  "
            f"{r['topVsPip']:+8d}px  {r['bottomVsPip']:+8d}px  {r['jitter']:+6d}px"
        )
    print(f"\nreference pip = {ref}px; worst deviation {worst*100:.1f}% ({worst_who})")
    print(
        "figure/drift are UNION silhouettes over the whole loop; jitter is how much\n"
        "the silhouette breathes, which is animation and not a scaling fault."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
