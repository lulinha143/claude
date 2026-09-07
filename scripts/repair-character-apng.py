#!/usr/bin/env python3
"""Detect and repair ISOLATED ALPHA DROPOUTS in a character APNG.

The problem this solves
-----------------------
Pip's (the squirrel's) soft baked-in halo appeared to "shimmer/flicker" in the
game while the character's opaque body looked stable. It was not a compositing,
DPR, scaling or GPU problem: a handful of individual frames in the source artwork
have their SEMI-TRANSPARENT alpha collapsed to roughly half, so once per second
the halo deflates for a single frame and snaps back. Measured on pip.png:

    8 of 242 frames (13, 67, 87, 94, 157, 158, 161, 210) lose ~52% of halo
    opacity, spaced ~28 frames apart (~0.94 s at 30 fps).

Every other frame is smooth: between adjacent healthy frames the mean alpha over
the visible sprite changes by only ~0.41/255 (max ~2.8), while a dropout frame
differs by ~24/255 - about 58x the natural variation. The defect is present in
the very first encode of the asset, so it comes from the source master, not from
the downscale/encode step.

Why this repair is safe
-----------------------
Because alpha is essentially static between neighbouring frames, substituting the
nearest healthy frame for a dropout frame introduces an error far below one alpha
level - invisible - while restoring the halo to its authored opacity. The
substituted frame is copied WHOLE (RGB + alpha together) so a frame can never end
up with mismatched colour and coverage. Healthy frames are passed through with
their pixels untouched, and frame count, per-frame delays, loop count and total
duration are preserved exactly, so timing and motion are unchanged.

For a 2-frame run the two halves are filled from opposite sides (the first from
the frame before, the second from the frame after) so no frame is ever held for
more than two frame periods (~66 ms).

Usage
-----
    python scripts/repair-character-apng.py --in public/employees/pip.png
    python scripts/repair-character-apng.py --in a.png --out b.png --report-only
"""
from __future__ import annotations

import argparse
import io
import struct
import zlib

import numpy as np
from PIL import Image, ImageFile, ImageSequence

ImageFile.LOAD_TRUNCATED_IMAGES = True


# --------------------------------------------------------------------------
# APNG reading
# --------------------------------------------------------------------------
def read_apng(path: str):
    """Return (frames RGBA uint8 array, delays as (num, den) list, loop count)."""
    frames = [
        np.asarray(f.convert("RGBA"), dtype=np.uint8)
        for f in ImageSequence.Iterator(Image.open(path))
    ]
    delays: list[tuple[int, int]] = []
    loops = 0
    with open(path, "rb") as fh:
        fh.read(8)
        while True:
            hdr = fh.read(8)
            if len(hdr) < 8:
                break
            length = struct.unpack(">I", hdr[:4])[0]
            ctype = hdr[4:8]
            data = fh.read(length)
            fh.read(4)
            if ctype == b"acTL":
                loops = struct.unpack(">II", data)[1]
            elif ctype == b"fcTL":
                delays.append(struct.unpack(">HH", data[20:24]))
            elif ctype == b"IEND":
                break
    return np.stack(frames), delays, loops


# --------------------------------------------------------------------------
# Detection
# --------------------------------------------------------------------------
def detect_dropouts(alpha: np.ndarray, threshold: float = 3.0, window: int = 9):
    """Frames whose mean halo alpha sits `threshold`/255 below the local median.

    The halo band is defined from a frame that is itself healthy, so a dropout
    cannot skew the definition of the region being measured.
    """
    n = alpha.shape[0]
    # Provisional band from frame 0, used only to rank frames by halo opacity.
    prov = (alpha[0] >= 1) & (alpha[0] <= 191)
    ranked = np.argsort(alpha[:, prov].mean(axis=1))
    reference = int(ranked[len(ranked) // 2])  # a median (healthy) frame
    band = (alpha[reference] >= 1) & (alpha[reference] <= 191)

    series = alpha[:, band].mean(axis=1)
    bad: list[int] = []
    for i in range(n):
        lo, hi = max(0, i - window), min(n, i + window + 1)
        neighbourhood = np.delete(series[lo:hi], i - lo)
        if series[i] < np.median(neighbourhood) - threshold:
            bad.append(i)
    return bad, series, reference


def choose_sources(bad: list[int], n: int) -> dict[int, int]:
    """Map each damaged frame to the nearest healthy frame.

    Prefers the previous frame; for a run, the second half is filled from the
    following side so no frame is held for more than two frame periods.
    """
    badset = set(bad)
    healthy = lambda i: 0 <= i < n and i not in badset  # noqa: E731
    src: dict[int, int] = {}
    for i in bad:
        run = [i]
        j = i - 1
        while j in badset:
            run.insert(0, j)
            j -= 1
        k = i + 1
        while k in badset:
            run.append(k)
            k += 1
        pos = run.index(i)
        back_first = pos < (len(run) + 1) // 2  # first half looks backwards
        picked = None
        for d in range(1, n):
            for c in ([i - d, i + d] if back_first else [i + d, i - d]):
                if healthy(c):
                    picked = c
                    break
            if picked is not None:
                break
        src[i] = picked if picked is not None else i
    return src


# --------------------------------------------------------------------------
# APNG writing (full-canvas frames, dispose=NONE, blend=SOURCE)
# --------------------------------------------------------------------------
def _chunk(typ: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + typ
        + data
        + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
    )


def _png_parts(img: Image.Image):
    bio = io.BytesIO()
    img.save(bio, format="PNG", compress_level=9)
    bio.seek(8)
    ihdr = idat = b""
    while True:
        hdr = bio.read(8)
        if len(hdr) < 8:
            break
        length = struct.unpack(">I", hdr[:4])[0]
        ctype = hdr[4:8]
        data = bio.read(length)
        bio.read(4)
        if ctype == b"IHDR":
            ihdr = data
        elif ctype == b"IDAT":
            idat += data
        elif ctype == b"IEND":
            break
    return ihdr, idat


def write_apng(path: str, frames: np.ndarray, delays: list[tuple[int, int]], loops: int = 0):
    imgs = [Image.fromarray(f) for f in frames]
    ihdr, _ = _png_parts(imgs[0])
    out = [
        b"\x89PNG\r\n\x1a\n",
        _chunk(b"IHDR", ihdr),
        _chunk(b"acTL", struct.pack(">II", len(imgs), loops)),
    ]
    seq = 0
    for i, img in enumerate(imgs):
        _, idat = _png_parts(img)
        dn, dd = delays[i] if i < len(delays) else (33, 1000)
        out.append(
            _chunk(
                b"fcTL",
                struct.pack(">IIIIIHHBB", seq, img.width, img.height, 0, 0, dn, dd, 0, 0),
            )
        )
        seq += 1
        if i == 0:
            out.append(_chunk(b"IDAT", idat))
        else:
            out.append(_chunk(b"fdAT", struct.pack(">I", seq) + idat))
            seq += 1
    out.append(_chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(b"".join(out))


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", default=None, help="default: overwrite --in")
    ap.add_argument("--threshold", type=float, default=3.0, help="alpha levels below local median")
    ap.add_argument("--report-only", action="store_true")
    args = ap.parse_args()

    frames, delays, loops = read_apng(args.src)
    alpha = frames[..., 3].astype(np.float64)
    n = len(frames)
    bad, series, ref = detect_dropouts(alpha, args.threshold)

    print(f"{args.src}: {n} frames {frames.shape[2]}x{frames.shape[1]}, loops={loops}")
    print(f"  halo reference frame: {ref}, median halo alpha {np.median(series):.2f}")
    if not bad:
        print("  no alpha dropouts detected - nothing to repair.")
        return
    src_map = choose_sources(bad, n)
    print(f"  {len(bad)} alpha dropout frame(s) detected:")
    for i in bad:
        drop = 100 * (1 - series[i] / max(np.median(series), 1e-9))
        print(f"    frame {i:3d}: halo alpha {series[i]:6.2f} ({drop:4.1f}% below median)"
              f"  <- repair from frame {src_map[i]}")
    if args.report_only:
        return

    repaired = frames.copy()
    for i, s in src_map.items():
        repaired[i] = frames[s]

    dst = args.dst or args.src
    write_apng(dst, repaired, delays, loops)

    # ---- verification --------------------------------------------------
    v_frames, v_delays, v_loops = read_apng(dst)
    v_bad, v_series, _ = detect_dropouts(v_frames[..., 3].astype(np.float64), args.threshold)
    healthy = [i for i in range(n) if i not in set(bad)]
    untouched = bool(np.array_equal(v_frames[healthy], frames[healthy]))
    print(f"\n  wrote {dst}")
    print(f"  VERIFY frame count      : {len(v_frames)} (was {n}) "
          f"{'OK' if len(v_frames) == n else 'FAIL'}")
    print(f"  VERIFY delays preserved : {'OK' if v_delays == delays else 'FAIL'}")
    print(f"  VERIFY loops preserved  : {'OK' if v_loops == loops else 'FAIL'} ({v_loops})")
    print(f"  VERIFY healthy frames bit-identical : {'OK' if untouched else 'FAIL'}")
    print(f"  VERIFY dropouts remaining : {len(v_bad)} {'OK' if not v_bad else 'FAIL ' + str(v_bad)}")
    print(f"  halo alpha now: min {v_series.min():.2f} median {np.median(v_series):.2f} "
          f"max {v_series.max():.2f}")


if __name__ == "__main__":
    main()
