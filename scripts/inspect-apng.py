#!/usr/bin/env python3
"""Inspect an animated PNG and report everything needed to register it as a
ZooWorkers character sprite.

Reads the APNG chunk structure directly (rather than trusting a decoder's
convenience API) because the properties that matter here live in the chunks:

  acTL -> frame count and loop count
  fcTL -> per-frame size, offset and delay
  IDAT -> whether the first frame is part of the animation or a still poster

It also decodes every frame to measure the things that have actually bitten this
project before:

  - alpha dropouts: Pip's halo shimmer was caused by 8 frames whose
    semi-transparent alpha collapsed to about half. Mean alpha per frame is
    reported so that defect is visible as a number rather than a vibe.
  - bounding-box drift: a character whose opaque content wanders inside the
    canvas will appear to slide off its floor slot.
  - frame-to-frame deltas: a spike means a malformed or out-of-sequence frame.

Usage:
    python3 scripts/inspect-apng.py FILE [FILE...] [--json] [--max-frames N]
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

PNG_SIG = b"\x89PNG\r\n\x1a\n"


def read_chunks(data: bytes):
    """Yield (type, payload) for each PNG chunk."""
    if data[:8] != PNG_SIG:
        raise ValueError("not a PNG (bad signature)")
    offset = 8
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("truncated chunk header")
        (length,) = struct.unpack(">I", data[offset : offset + 4])
        ctype = data[offset + 4 : offset + 8].decode("ascii", "replace")
        start = offset + 8
        end = start + length
        if end + 4 > len(data):
            raise ValueError(f"truncated {ctype} chunk payload")
        yield ctype, data[start:end]
        offset = end + 4  # skip CRC


def structure(path: Path) -> dict:
    data = path.read_bytes()
    info: dict = {
        "file": str(path),
        "bytes": len(data),
        "errors": [],
        "warnings": [],
    }

    chunks = []
    try:
        for ctype, payload in read_chunks(data):
            chunks.append((ctype, payload))
    except ValueError as exc:
        info["errors"].append(f"structure: {exc}")
        return info

    order = [c for c, _ in chunks]
    info["chunk_order"] = order[:8]
    if order[-1] != "IEND":
        info["errors"].append("file does not end with IEND (truncated download?)")

    ihdr = next((p for c, p in chunks if c == "IHDR"), None)
    if ihdr is None:
        info["errors"].append("no IHDR")
        return info
    w, h, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", ihdr[:13])
    info["canvas"] = [w, h]
    info["bit_depth"] = depth
    info["colour_type"] = colour
    info["interlaced"] = bool(interlace)
    # Colour type 6 = RGBA, 4 = grey+alpha. Anything else has no alpha channel.
    info["has_alpha_channel"] = colour in (4, 6)
    if not info["has_alpha_channel"]:
        info["warnings"].append(
            f"colour type {colour} has no alpha channel; character art needs transparency"
        )
    if interlace:
        info["warnings"].append("interlaced PNGs decode slowly in browsers")

    actl = next((p for c, p in chunks if c == "acTL"), None)
    if actl is None:
        info["errors"].append("no acTL chunk: this is a still PNG, not an APNG")
        return info
    frames, plays = struct.unpack(">II", actl[:8])
    info["acTL_frames"] = frames
    info["plays"] = plays
    info["loops_forever"] = plays == 0
    if plays != 0:
        info["warnings"].append(f"acTL play count is {plays}; a looping sprite wants 0")

    fctl = [p for c, p in chunks if c == "fcTL"]
    info["fcTL_count"] = len(fctl)
    if len(fctl) != frames:
        info["warnings"].append(
            f"acTL declares {frames} frames but there are {len(fctl)} fcTL chunks"
        )

    # The first frame is part of the animation only when an fcTL precedes IDAT.
    first_idat = order.index("IDAT") if "IDAT" in order else -1
    first_fctl = order.index("fcTL") if "fcTL" in order else -1
    info["first_frame_is_animated"] = 0 <= first_fctl < first_idat

    delays_ms: list[float] = []
    sizes = set()
    offsets = set()
    for payload in fctl:
        (_seq, fw, fh, fx, fy, dnum, dden) = struct.unpack(">IIIIIHH", payload[:24])
        den = dden if dden else 100  # spec: 0 denominator means 1/100s
        delays_ms.append(dnum / den * 1000.0)
        sizes.add((fw, fh))
        offsets.add((fx, fy))

    info["frame_sizes"] = sorted(sizes)
    info["frame_offsets_count"] = len(offsets)
    info["full_frame_encode"] = sizes == {(w, h)} and offsets == {(0, 0)}
    if delays_ms:
        total = sum(delays_ms)
        info["delay_ms_min"] = round(min(delays_ms), 2)
        info["delay_ms_max"] = round(max(delays_ms), 2)
        info["duration_ms"] = round(total, 1)
        info["fps"] = round(len(delays_ms) / (total / 1000.0), 2) if total else None
        if min(delays_ms) <= 0:
            info["warnings"].append("a frame has a zero delay; browsers clamp this")
    return info


def pixels(path: Path, info: dict, max_frames: int) -> dict:
    """Decode frames and measure alpha stability, bbox drift and frame deltas."""
    try:
        from PIL import Image, ImageChops
    except ImportError:
        info["warnings"].append("Pillow not installed; skipped pixel analysis")
        return info

    try:
        im = Image.open(path)
    except Exception as exc:  # noqa: BLE001 - report, never crash the pipeline
        info["errors"].append(f"decode: {exc}")
        return info

    n = getattr(im, "n_frames", 1)
    step = max(1, n // max_frames) if max_frames else 1
    alphas: list[tuple[int, float]] = []
    boxes: list[tuple[int, tuple[int, int, int, int] | None]] = []
    deltas: list[tuple[int, float]] = []
    prev = None

    for index in range(0, n, step):
        try:
            im.seek(index)
            frame = im.convert("RGBA")
        except Exception as exc:  # noqa: BLE001
            info["errors"].append(f"frame {index}: {exc}")
            continue
        alpha = frame.getchannel("A")
        alphas.append((index, alpha.getextrema()[1] and sum(alpha.histogram()[i] * i for i in range(256)) / (frame.width * frame.height)))
        boxes.append((index, alpha.getbbox()))
        if prev is not None:
            diff = ImageChops.difference(frame, prev).convert("L")
            deltas.append((index, sum(diff.histogram()[i] * i for i in range(256)) / (frame.width * frame.height)))
        prev = frame

    info["frames_decoded"] = len(alphas)
    if alphas:
        values = [a for _, a in alphas]
        mean = sum(values) / len(values)
        info["alpha_mean"] = round(mean, 2)
        info["alpha_peak_to_peak"] = round(max(values) - min(values), 2)
        # Pip's defect was a ~52% collapse on isolated frames. Flag anything that
        # deviates far enough from the run of healthy frames to be visible.
        threshold = mean * 0.75
        info["alpha_dropout_frames"] = [i for i, a in alphas if a < threshold][:24]
        info["fully_opaque"] = min(values) > 254.0

    real_boxes = [(i, b) for i, b in boxes if b]
    if real_boxes:
        lefts = [b[0] for _, b in real_boxes]
        tops = [b[1] for _, b in real_boxes]
        rights = [b[2] for _, b in real_boxes]
        bottoms = [b[3] for _, b in real_boxes]
        info["content_bbox_union"] = [min(lefts), min(tops), max(rights), max(bottoms)]
        info["bbox_drift_px"] = {
            "left": max(lefts) - min(lefts),
            "top": max(tops) - min(tops),
            "right": max(rights) - min(rights),
            "bottom": max(bottoms) - min(bottoms),
        }
        # A sprite is anchored by its feet, so vertical drift at the bottom edge
        # is the one that makes a character look like it is sliding.
        if info["bbox_drift_px"]["bottom"] > max(4, info["canvas"][1] * 0.02):
            info["warnings"].append(
                f"content bottom edge drifts {info['bbox_drift_px']['bottom']}px across frames"
            )
        empty = [i for i, b in boxes if not b]
        if empty:
            info["warnings"].append(f"{len(empty)} fully transparent frame(s): {empty[:8]}")

    if deltas:
        values = [d for _, d in deltas]
        mean = sum(values) / len(values)
        info["frame_delta_mean"] = round(mean, 3)
        spike = mean * 6 + 1
        info["frame_delta_spikes"] = [i for i, d in deltas if d > spike][:16]

    return info


def main() -> int:
    ap = argparse.ArgumentParser(description="Inspect character APNGs.")
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    ap.add_argument(
        "--max-frames",
        type=int,
        default=60,
        help="sample at most N frames for pixel analysis (0 = every frame)",
    )
    args = ap.parse_args()

    reports = []
    for path in args.files:
        if not path.exists():
            reports.append({"file": str(path), "errors": ["missing"]})
            continue
        info = structure(path)
        if not info.get("errors"):
            info = pixels(path, info, args.max_frames)
        reports.append(info)

    if args.json:
        print(json.dumps(reports, indent=2))
    else:
        for r in reports:
            print(f"\n=== {Path(r['file']).name} ===")
            for key in (
                "bytes", "canvas", "colour_type", "has_alpha_channel", "acTL_frames",
                "fcTL_count", "plays", "loops_forever", "first_frame_is_animated",
                "full_frame_encode", "frame_sizes", "delay_ms_min", "delay_ms_max",
                "duration_ms", "fps", "frames_decoded", "alpha_mean",
                "alpha_peak_to_peak", "alpha_dropout_frames", "fully_opaque",
                "content_bbox_union", "bbox_drift_px", "frame_delta_mean",
                "frame_delta_spikes",
            ):
                if key in r:
                    print(f"  {key:24} {r[key]}")
            for w in r.get("warnings", []):
                print(f"  WARNING  {w}")
            for e in r.get("errors", []):
                print(f"  ERROR    {e}")

    return 1 if any(r.get("errors") for r in reports) else 0


if __name__ == "__main__":
    sys.exit(main())
