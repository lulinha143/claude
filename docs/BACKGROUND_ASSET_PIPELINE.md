# Background Asset Pipeline

How to replace or re-encode the Office background.

## Where the files live

```
public/backgrounds/office/
  office-main-loop.mp4     # what actually plays (H.264 MP4, looping)
  office-main-poster.jpg   # static poster / reduced-motion / fallback frame
  office-main-source.gif   # canonical source GIF (also last-resort fallback)
```

The runtime paths are hard-referenced (by stable filename) in
`src/art/OfficeBackground.tsx`. Keep the filenames the same and you don't need to
touch code.

## Replacing with a new GIF (no tools required)

1. Put your new GIF at `public/backgrounds/office/office-main-source.gif`.
2. If you have an MP4 version, save it as `office-main-loop.mp4`. If you only
   have a GIF, delete `office-main-loop.mp4` — the component falls back to the
   GIF automatically (heavier, but works).
3. Provide a static frame as `office-main-poster.jpg` (any single frame).
4. Run `npm run verify:assets` then `npm run build`.

## Recommended: convert a GIF to an optimized MP4 + poster (with ffmpeg)

If you have `ffmpeg` installed:

```
# optimized, looping, web-friendly MP4 (yuv420p is required for broad playback)
ffmpeg -i office-main-source.gif -movflags +faststart -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" office-main-loop.mp4

# a static poster from the first frame
ffmpeg -i office-main-source.gif -vframes 1 office-main-poster.jpg

# (optional) a WebM as well
ffmpeg -i office-main-source.gif -c:v libvpx-vp9 -b:v 0 -crf 32 office-main-loop.webm
```

Do not change the animation's timing, colors, or composition. Keep it a clean
loop (first and last frames should match).

## This project's asset (for the record)

- Source supplied by the owner: https://imgur.com/a/PFVDy74 → `BOunkOV`, 1280×720.
- The MP4 and poster were obtained from Imgur's own generated MP4 and thumbnail;
  the full GIF is preserved as the canonical source.

## Notes

- Prefer the MP4 for runtime (≈3 MB vs ≈31 MB GIF). The GIF is only fetched if
  the MP4 fails to decode.
- Assets are copied by Vite from `public/` to `dist/` and are included in the
  packaged Electron app. `scripts/verify-assets.mjs` gates their presence.
