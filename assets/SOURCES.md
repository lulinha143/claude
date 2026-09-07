# Asset Sources

## Office background (animated)
- **Files:** `public/backgrounds/office/office-main-{loop.mp4,poster.jpg,source.gif}`
- **Origin:** supplied by the project owner via https://imgur.com/a/PFVDy74
  (image id `BOunkOV`, 1280×720, 16:9). The MP4 and JPG poster were taken from
  Imgur's own generated MP4/thumbnail of that image; the full GIF is preserved as
  the canonical source.
- **Role:** the animated background of the main Office tab (see
  `docs/OFFICE_BACKGROUND_IMPLEMENTATION.md`).
- **Rights:** provided as the game's official visual asset by the project owner,
  who is responsible for holding/clearing the rights to it.

## Employee sprites (animated)
- **Files:** `public/employees/bea.png` (animated APNG), `public/employees/bea-poster.png` (static frame).
- **Origin:** final artwork for **Bea** (Beaver, Construction) supplied by the
  project owner via Google Drive (file id `1rQkRLlsxD3XVgS4wozYpyLnziXzwakEk`).
- **Pipeline:** the delivered source APNG (960×960, 121 frames, 30 fps, infinite
  loop, ~103 MB) was optimized for shipping — uniform transparent padding trimmed,
  scaled to 384 px, quantized to a single shared 256-colour palette with alpha
  dithering, and re-assembled as a looping APNG (all 121 frames, exact 1/30 s
  timing, `num_plays = 0`) totalling ~6.2 MB. The animation, transparency and
  colours are preserved; it is **not** flattened to a static frame.
- **Role:** the employee's final animated "workstation" sprite, rendered in the
  office diorama, drag ghost and roster card via `src/art/EmployeeSprite.tsx`
  (registered in `src/art/employeeSprites.ts`). Falls back to a static poster
  when the player enables reduced motion.
- **Rights:** provided as the game's official character asset by the project
  owner, who is responsible for holding/clearing the rights to it.

## Audio
- 100% synthesized at runtime (Web Audio API). No external audio files. See
  `assets/audio/SOURCES.md` and `assets/audio/LICENSES.md`.

## Other art
- All remaining character/office/icon/decoration art is original, drawn in code
  as SVG. See `docs/ASSET_REPLACEMENT.md`. Animals without final art keep their
  code-drawn placeholder silhouette until a sprite is registered for them.
