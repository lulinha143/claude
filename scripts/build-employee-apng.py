#!/usr/bin/env python3
"""Canonical encoder for employee workstation APNG sprites.

Why this exists
---------------
Employee sprites are hi-res animated APNGs that the office renders *scaled down*.
If an APNG is written with the usual inter-frame "bbox diff" optimisation, each
frame is only a sub-rectangle of the canvas (with dispose=NONE / blend=SOURCE)
and that rectangle *oscillates* in size/offset from frame to frame. The soft
semi-transparent halo around a character then lands inside the updated rectangle
on some frames and is "held" from a previous frame on others. On a GPU
compositor (Chromium/Electron) the moving dirty-rect boundary is resampled
inconsistently while the sprite is scaled, so the halo *flickers/shimmers* even
though the decoded pixels are correct. (It looks fine at 100% in a plain browser
tab because there is no fractional resampling there.)

This script always writes **full-canvas frames** (every frame is the complete
WxH image, dispose=NONE, blend=SOURCE). The compositor then has one stable rect
to scale each frame, so the halo stays rock-steady. It is a superset-safe
encoding: decoded pixels are identical to a bbox-optimised file, the file is
about the same size, animation frames + timing are untouched and it loops
forever (num_plays = 0).

It also does a single premultiplied-alpha LANCZOS downscale (sharp, no dark edge
halos, no shimmer) and can crop/pad so the character's contact footprint is
centred.

Usage
-----
    python scripts/build-employee-apng.py \
        --src esquilo.png --out public/employees/pip.png \
        --poster public/employees/pip-poster.png \
        --height 223 --crop 0,53,960,960 --pad 47,0,0,0 --poster-height 360

--crop  x0,y0,x1,y1  (source pixels, applied before padding; default = full)
--pad   left,top,right,bottom  (transparent px added after crop; default 0,0,0,0)
--height  output FRAME height in px (width scales proportionally). Aim for
          ~2-2.4x the on-screen CSS height so it stays crisp on HiDPI.
"""
import argparse
import io
import struct
import zlib

import numpy as np
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True


def _premult_downscale(rgba: np.ndarray, size: tuple[int, int]) -> Image.Image:
    """Downscale RGBA using premultiplied alpha so edges don't pick up dark halos."""
    arr = rgba.astype(np.float64)
    a = arr[..., 3:4] / 255.0
    pm = arr[..., :3] * a  # premultiplied colour is always <= original
    pm_img = Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    a_img = Image.fromarray((a[..., 0] * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    pm2 = np.asarray(pm_img).astype(np.float64)
    a2 = np.asarray(a_img).astype(np.float64) / 255.0
    a2s = np.clip(a2, 1e-6, 1.0)[..., None]
    rgb2 = np.clip(pm2 / a2s, 0, 255)
    return Image.fromarray(np.dstack([rgb2, a2 * 255.0]).astype(np.uint8))


def _read_delays_ms(path: str) -> list[int]:
    delays = []
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
            if ctype == b"fcTL":
                dn, dd = struct.unpack(">HH", data[20:24])
                delays.append(max(1, round(dn / (dd or 100) * 1000)))
            if ctype == b"IEND":
                break
    return delays


def _prepare_frames(src, crop, pad, height):
    im = Image.open(src)
    n = im.n_frames
    x0, y0, x1, y1 = crop if crop else (0, 0, *im.size)
    pl, pt, pr, pb = pad
    W0 = (x1 - x0) + pl + pr
    H0 = (y1 - y0) + pt + pb
    s = height / H0
    fw = round(W0 * s)
    frames = []
    for i in range(n):
        im.seek(i)
        cropped = im.convert("RGBA").crop((x0, y0, x1, y1))
        canvas = Image.new("RGBA", (W0, H0), (0, 0, 0, 0))
        canvas.paste(cropped, (pl, pt))
        frames.append(_premult_downscale(np.asarray(canvas), (fw, height)))
    return frames, fw


def _chunk(typ: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + typ + data + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)


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


def write_full_frame_apng(path: str, frames: list[Image.Image], delays_ms: list[int], den: int = 1000):
    """Write frames as a full-canvas APNG (dispose=NONE, blend=SOURCE, loop forever)."""
    ihdr, _ = _png_parts(frames[0])
    out = [b"\x89PNG\r\n\x1a\n", _chunk(b"IHDR", ihdr), _chunk(b"acTL", struct.pack(">II", len(frames), 0))]
    seq = 0
    for i, fr in enumerate(frames):
        _, idat = _png_parts(fr)
        dn = delays_ms[i] if i < len(delays_ms) else round(den / 30)
        # full canvas: w,h = frame size, x=y=0, dispose_op=0 (NONE), blend_op=0 (SOURCE)
        out.append(_chunk(b"fcTL", struct.pack(">IIIIIHHBB", seq, fr.width, fr.height, 0, 0, dn, den, 0, 0)))
        seq += 1
        if i == 0:
            out.append(_chunk(b"IDAT", idat))
        else:
            out.append(_chunk(b"fdAT", struct.pack(">I", seq) + idat))
            seq += 1
    out.append(_chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(b"".join(out))


def _parse_ints(s, n):
    parts = tuple(int(v) for v in s.split(","))
    if len(parts) != n:
        raise argparse.ArgumentTypeError(f"expected {n} comma-separated ints, got {s!r}")
    return parts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, help="source animated APNG")
    ap.add_argument("--out", required=True, help="output full-frame APNG")
    ap.add_argument("--height", type=int, required=True, help="output frame height in px")
    ap.add_argument("--crop", type=lambda s: _parse_ints(s, 4), default=None, help="x0,y0,x1,y1 source crop")
    ap.add_argument("--pad", type=lambda s: _parse_ints(s, 4), default=(0, 0, 0, 0), help="left,top,right,bottom pad")
    ap.add_argument("--poster", default=None, help="optional static poster PNG (first frame)")
    ap.add_argument("--poster-height", type=int, default=None, help="poster height (default: --height)")
    args = ap.parse_args()

    delays = _read_delays_ms(args.src)
    frames, fw = _prepare_frames(args.src, args.crop, args.pad, args.height)
    write_full_frame_apng(args.out, frames, delays)
    print(f"wrote {args.out}: {len(frames)} full frames {fw}x{args.height}, loops forever")

    if args.poster:
        ph = args.poster_height or args.height
        pframes, _ = _prepare_frames(args.src, args.crop, args.pad, ph)
        pframes[0].save(args.poster, optimize=True)
        print(f"wrote {args.poster}: static poster (frame 0)")


if __name__ == "__main__":
    main()
