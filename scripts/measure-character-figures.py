#!/usr/bin/env python3
"""Measure the VISIBLE figure inside each shipped character APNG.

Why this exists
---------------
The game used to size a character by its @1x canvas height. That is not the same
thing as how big the animal LOOKS, because every asset carries a different amount
of transparent padding around the figure: of the nine masters, three were never
trimmed at all (960x960) while one lost 118 rows off the top, and all nine kept
their full width. Scaling those canvases to a similar height therefore rendered
the cast at visibly different sizes -- Pip, whose canvas hugs her the tightest,
came out the SMALLEST of the roster despite being the intended reference.

So we measure the thing that actually matters: the union of the non-transparent
pixels across the animation, as a fraction of the canvas. From that the registry
can derive, per animal, the canvas height that makes every FIGURE the same height
as Pip's, plus the bottom padding that has to be taken out for feet to reach the
floor.

Measuring the shipped derived assets (not the masters) is deliberate: those are
the pixels the player sees, and it keeps the whole normalisation a registry change
with no re-encode -- Pip's repaired build is not touched at all.

Output: assets/sources/characters/figure-metrics.json, which is committed and read
back by tests so the registry can never silently drift from the artwork.

Usage:
    python3 scripts/measure-character-figures.py [--json PATH] [--quiet]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parent.parent
EMPLOYEE_DIR = ROOT / "public" / "employees"
DEFAULT_OUT = ROOT / "assets" / "sources" / "characters" / "figure-metrics.json"

# Alpha at or below this is treated as "not part of the figure". The artwork has a
# soft halo that fades to nothing over several pixels; counting those near-zero
# pixels would inflate every figure by the halo's full reach and undo the point of
# the measurement. 12/255 keeps the visible glow while ignoring its dead tail.
ALPHA_FLOOR = 12

# Every frame is inspected rather than a sample. These are small (@1x) canvases and
# a limb extended in a single frame still changes how large the animal reads, so a
# sampled union would be a different number run to run.
MAX_FRAMES = 4096

# The canonical character. Every other animal is scaled so its visible figure is the
# same height as this one's. Pip is the reference because her artwork is what the
# game's room, desk and dialogue geometry was tuned against, and because her build is
# a hand-repaired one that must not be re-encoded.
REFERENCE = "pip"

# Mirror of CHARACTER_PRESENCE_SCALE in src/content/characterScale.ts, used only to
# report the resulting on-screen figure heights.
PRESENCE = 1.2

# The reference figure height in LAYOUT px, mirroring REFERENCE_FIGURE_PX in
# src/content/characterScale.ts. Pip's artwork is 92px of squirrel inside a 93px
# canvas, and that 92 is the authored cast scale.
#
# WHY THIS IS A CONSTANT AND NOT MEASURED OFF PIP'S CANVAS
# -------------------------------------------------------
# It used to be `measured[REFERENCE]["figureHeight"]` -- the reference figure's size
# in PIXELS OF THE SHIPPED CANVAS. That made the whole derivation circular the moment
# any canvas was re-encoded at a different resolution: encoding Pip 1.2x larger
# raises her measured figureHeight 1.2x, which raises every derived `officeHeight`
# 1.2x, which the presence multiplier then scales by 1.2 AGAIN -- a 1.44x runaway.
# That circularity is precisely why re-encoding the cast at its true display size was
# deferred as "not a small change".
#
# `officeHeight` is a LAYOUT quantity (CSS px, pre-presence), so its anchor has to be
# a layout quantity too. Fixing it to the authored 92 makes the derivation depend
# only on each animal's `figureHeightFraction` -- a SHAPE fraction that is invariant
# under uniform rescaling -- so the artwork can be re-encoded at any resolution and
# these numbers do not move. Verified as a no-op against the previously committed
# metrics: every derived officeHeight is byte-identical either way.
REFERENCE_FIGURE_LAYOUT_PX = 92


def derive_registry(measured: dict[str, dict]) -> dict[str, dict]:
    """Registry values that put every figure at the reference figure's height.

    A canvas is scaled uniformly, so a figure occupying `f` of its canvas renders at
    `officeHeight * f`. Holding that product equal to the reference's figure height
    gives `officeHeight = referenceFigureHeight / f` -- i.e. an animal loosely framed
    inside its canvas gets a correspondingly TALLER canvas, which is exactly the
    compensation the old canvas-height sizing was missing.

    Nothing here rescales artwork: frame dimensions stay tied to the real files, so
    the aspect-ratio contract that protects Pip from squashing is untouched.
    """
    target = REFERENCE_FIGURE_LAYOUT_PX
    out: dict[str, dict] = {}
    for employee, m in measured.items():
        out[employee] = {
            "officeHeight": round(target / m["figureHeightFraction"]),
            # Sink the sprite by its own dead bottom margin so the feet, not the
            # canvas edge, land on the floor line.
            "baseline": m["bottomPadFraction"],
            # Where the figure actually sits horizontally, so a character stands at
            # their workstation rather than at the centre of their padding.
            "anchorX": m["figureCentreX"],
        }
    return out


def figure_metrics(path: Path) -> dict:
    """Union bounding box of the visibly-opaque pixels across every frame."""
    with Image.open(path) as im:
        width, height = im.size
        left = top = 10**9
        right = bottom = -1
        frames = 0
        for frame in ImageSequence.Iterator(im):
            if frames >= MAX_FRAMES:
                break
            alpha = np.asarray(frame.convert("RGBA").getchannel("A"))
            rows = np.where(alpha.max(axis=1) > ALPHA_FLOOR)[0]
            cols = np.where(alpha.max(axis=0) > ALPHA_FLOOR)[0]
            frames += 1
            if rows.size == 0 or cols.size == 0:
                continue
            top = min(top, int(rows[0]))
            bottom = max(bottom, int(rows[-1]))
            left = min(left, int(cols[0]))
            right = max(right, int(cols[-1]))

    if bottom < 0:
        raise SystemExit(f"{path.name}: no visible pixels found")

    figure_h = bottom - top + 1
    figure_w = right - left + 1
    return {
        "canvasWidth": width,
        "canvasHeight": height,
        "frames": frames,
        "box": {"left": left, "top": top, "right": right, "bottom": bottom},
        "figureWidth": figure_w,
        "figureHeight": figure_h,
        # Fractions of the canvas. These are the numbers the registry needs.
        "figureHeightFraction": round(figure_h / height, 6),
        "figureWidthFraction": round(figure_w / width, 6),
        # Padding below the lowest visible pixel: how far the feet sit above the
        # element's bottom edge, i.e. how far the sprite must sink to touch the floor.
        "bottomPadFraction": round((height - 1 - bottom) / height, 6),
        "topPadFraction": round(top / height, 6),
        # Horizontal centre of the figure, for the sprite's own anchor.
        "figureCentreX": round(((left + right + 1) / 2) / width, 6),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    # Measure the @2x build, NOT the @1x derivative.
    #
    # The @1x asset is now generated by downscaling this one to the character's exact
    # display height (scripts/reencode-cast-display-size.py), and its height is
    # therefore a FUNCTION of `officeHeight`. Measuring it to derive `officeHeight`
    # would close that loop: the bounding box lands on slightly different pixel rows
    # at a different resolution, so each re-encode would nudge `officeHeight` by a
    # pixel, which nudges the encode height, and the two would chase each other.
    #
    # The @2x build is the retained high-fidelity artwork and is never re-encoded, so
    # measuring it makes these numbers a fixed property of the ARTWORK. It is also the
    # more accurate measurement, having four times the pixels to find the figure edge
    # in. Every value the registry consumes is a FRACTION of the canvas, so which
    # resolution it was measured at does not matter -- only that it is stable.
    assets = sorted(p for p in EMPLOYEE_DIR.glob("*.png") if not p.stem.endswith(("-1x", "-poster")))
    if not assets:
        raise SystemExit(f"no character assets found in {EMPLOYEE_DIR}")

    measured: dict[str, dict] = {}
    for path in assets:
        employee = path.stem
        measured[employee] = figure_metrics(path)
        if not args.quiet:
            m = measured[employee]
            print(
                f"{employee:8s} canvas {m['canvasWidth']:3d}x{m['canvasHeight']:3d}  "
                f"figure {m['figureWidth']:3d}x{m['figureHeight']:3d}  "
                f"figureH {m['figureHeightFraction']:.3f}  "
                f"padBottom {m['bottomPadFraction']:.3f}  "
                f"padTop {m['topPadFraction']:.3f}  "
                f"centreX {m['figureCentreX']:.3f}  ({m['frames']} frames)"
            )

    if REFERENCE not in measured:
        raise SystemExit(f"reference character {REFERENCE!r} was not measured")

    derived = derive_registry(measured)
    if not args.quiet:
        ref = measured[REFERENCE]
        target = ref["figureHeight"]
        print(
            f"\nreference {REFERENCE}: figure {target}px tall inside a "
            f"{ref['canvasHeight']}px canvas\n"
        )
        print("          officeHeight  baseline  anchorX   rendered figure height")
        for employee in sorted(derived):
            d = derived[employee]
            m = measured[employee]
            rendered = round(d["officeHeight"] * PRESENCE) * m["figureHeightFraction"]
            print(
                f"{employee:8s}  {d['officeHeight']:11d}  {d['baseline']:8.3f}  "
                f"{d['anchorX']:7.3f}   {rendered:6.1f}px"
            )

    payload = {
        "generatedBy": "scripts/measure-character-figures.py",
        "alphaFloor": ALPHA_FLOOR,
        "presenceScale": PRESENCE,
        "reference": REFERENCE,
        "note": (
            "Visible-figure geometry of the shipped @1x character assets, as fractions "
            "of each canvas, plus the registry values derived from them. `derived` is "
            "what src/art/characterAssets.ts must declare so every animal presents at "
            "the reference character's figure scale; tests/characterAssets.test.ts "
            "asserts the two agree, so the registry cannot drift from the artwork."
        ),
        "characters": measured,
        "derived": derived,
    }
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    if not args.quiet:
        print(f"\nwrote {args.json.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
