# Character sprite sharpness

Investigation into the report that characters look noticeably softer in the
packaged Electron application than in the development browser.

## Finding: every character is upscaled, on every display

The report is about a *difference* between dev and packaged, but measuring the
sprites turned up something more basic that is true in both: **no character is
drawn at the resolution its artwork was encoded at.** They are all upscaled, which
means the browser is inventing pixels for every animal, all the time.

Measured with `scripts/check-sprite-resampling.mjs`:

| character | @1x asset | @2x asset | CSS height | DPR 1 resample | DPR 2 resample |
| --------- | --------: | --------: | ---------: | -------------: | -------------: |
| pip       |        93 |       186 |        112 |         1.204x |         1.204x |
| bea       |       116 |       232 |        124 |         1.069x |         1.069x |
| corvus    |       100 |       200 |        124 |         1.240x |         1.240x |
| inky      |       100 |       200 |        126 |         1.260x |         1.260x |
| quincy    |       100 |       200 |        124 |         1.240x |         1.240x |
| …         |           |           |            |                |                |

Mean **1.162x** upscale, worst **1.260x**. A value above 1 means the artwork is
being enlarged to fit its box, so the softness is baked into the composite before
any GPU or platform difference gets involved.

## Cause

Two numbers that should be the same thing drifted apart.

`officeHeight` in `src/art/characterAssets.ts` is the **layout** height: the
normalised box height at which an animal's visible figure matches Pip's. The
importer encodes the `@1x` asset at exactly that height, which is why
`assets/sources/characters/manifest.json` says the asset "maps 1:1 to CSS pixels".

That was true when it was written. It stopped being true when the character
*presence* multiplier was introduced: `configFor()` in
`src/art/employeeSprites.ts` renders at `presenceSize(officeHeight)`, i.e.
`officeHeight * 1.2`. So the sprite is displayed 20% larger than the resolution it
was encoded at, and the `srcSet` density labels (`@1x 1x, @2x 2x`) describe a
relationship that no longer holds — the file labelled `1x` is really a `0.83x`
asset for the box it is drawn into.

Nothing about the layout or the Pip normalisation is wrong; the *encode* heights
are simply 20% behind the display sizes.

## Why this also explains a dev/packaged difference

The upscale factor is constant, but *what it is applied to* is not, because
`srcSet` picks a candidate from `devicePixelRatio`:

- **DPR 1** (a great many Windows desktops, and the packaged app on them): the
  browser picks the `@1x` file, 93px for Pip, and upscales it to 112 device px.
  This is the softest case, and it is the one most packaged users are in.
- **DPR 2** (a Retina laptop, where this game is most often developed): the
  browser picks the `@2x` file, 186px, and upscales to 224 device px. The same
  1.204x ratio, but starting from four times as many source pixels, so the
  resampling has far more information to work with and reads as visibly crisper.
- **Fractional DPR** (Windows display scaling at 125% / 150%): the layer is
  resampled again by the compositor at a non-integer factor, on top of the
  above.

So "dev looks sharper than the packaged app" is consistent with the developer
being on a high-DPR display and the packaged app running at DPR 1 or a fractional
DPR — the assets are doing something different in each case, and the 20% upscale
is what makes it visible rather than academic.

## The fix, and why it is not in this change

The correct fix is to encode each asset at the size it is actually drawn:

- `@1x` encode height := `presenceSize(officeHeight)` (the real CSS height)
- `@2x` encode height := twice that

which makes DPR 1 and DPR 2 both land on exactly `1.000x` — no resampling at all.

It is deliberately not done here because it is not a one-line change and it
touches the one asset that must not be broken:

1. `scripts/measure-character-figures.py` derives `officeHeight` *from* the shipped
   `-1x` canvas. Encoding 1.2x larger inflates the measured canvas, so the derived
   height would come back 1.2x larger and then be multiplied by presence again —
   a 1.44x error. The measurement has to divide the presence factor back out, which
   means the script, the registry's `frameWidth`/`frameHeight` for 21 animals, and
   the tests that bind them together all move at once.
2. Pip is currently `skipImport`, because the shipped `pip.png` is the **repaired**
   build and her master still carries the alpha defect that caused the halo
   shimmer. Re-encoding her at a new resolution means re-importing from that
   master. That is now *probably* safe — the importer repairs alpha dropouts
   itself as of this branch, and `npm run verify:assets` re-checks the result — but
   "probably safe" is not the standard for an asset whose fix was verified on real
   hardware, and it should be done as its own change with its own verification
   rather than as a side effect of a sharpening pass.

`scripts/check-sprite-resampling.mjs` reports the current ratios, and
`tests/spriteResampling.test.ts` fails if they get *worse*, so this cannot quietly
degrade further while the proper fix is outstanding.

## Ruled out

- **Asset loading.** The packaged app serves the identical files from
  `asarUnpack: ["dist/**"]`; they are byte-for-byte the same PNGs as dev.
- **A zoom or scale override in the shell.** `electron/main.ts` sets no
  `zoomFactor`, no `deviceScaleFactor` and no `--force-device-scale-factor`.
- **CSS interpolation hints.** None are set on `.employee-sprite`, so the sprite
  gets the browser default (smooth), which is the right choice for photographic
  artwork — `image-rendering: pixelated` would make a downscaled photo worse, not
  better.
- **The halo shimmer.** A different, already-fixed bug (oscillating dirty-rects
  plus alpha dropouts). Frames are full-canvas and alpha is repaired; do not
  re-open that by "sharpening" anything.

## Not verified here

The dev-versus-packaged comparison itself has not been reproduced. It needs a real
display at a known DPR, and ideally Windows at 100% / 125% / 150% scaling; this
work was done in a headless Linux container, so the numbers above are measurements
of the sprites and the layout, not of two running builds side by side. The
explanation in "why this also explains a dev/packaged difference" is consistent
with the measurements and with the report, but it is a conclusion, not an
observation.
