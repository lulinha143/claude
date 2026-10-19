# Character sprite sharpness

Investigation into the report that characters look noticeably softer in the
packaged Electron application than in the development browser.

> **Status: fixed.** The cast is re-encoded at true display size — DPR 1 is now
> `1.000x` for all 22 characters, measured **+22.4% mean acutance**, with no halo
> regression. See [The fix (done)](#the-fix-done). The two sections below describe the
> defect as it was found, and are kept because the cause is easy to reintroduce.
>
> **Update — the cast is now 23.** The bear (`bia`) landed after the numbers below were
> measured and went through the same pipeline, so the figures in this document describe
> the 22 characters that existed at the time and are left exactly as measured. The bear
> was verified the same way and reaches the same result: `1.000x` at DPR 1, halo
> peak-to-peak 3.3/255 at `@1x`. `scripts/check-sprite-resampling.mjs` now reports
> `DPR1 is pixel-exact for the whole cast` across all 23.

## Finding: every character was upscaled, on every display

The report is about a _difference_ between dev and packaged, but measuring the
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
_presence_ multiplier was introduced: `configFor()` in
`src/art/employeeSprites.ts` renders at `presenceSize(officeHeight)`, i.e.
`officeHeight * 1.2`. So the sprite is displayed 20% larger than the resolution it
was encoded at, and the `srcSet` density labels (`@1x 1x, @2x 2x`) describe a
relationship that no longer holds — the file labelled `1x` is really a `0.83x`
asset for the box it is drawn into.

Nothing about the layout or the Pip normalisation is wrong; the _encode_ heights
are simply 20% behind the display sizes.

## Why this also explains a dev/packaged difference

The upscale factor is constant, but _what it is applied to_ is not, because
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

## The fix (done)

Every `@1x` asset is now encoded at the height it is actually drawn at, so a DPR-1
display resamples **nothing**:

| character | @1x before | @1x now | CSS height | DPR 1 before |  DPR 1 now |
| --------- | ---------: | ------: | ---------: | -----------: | ---------: |
| pip       |         93 |     112 |        112 |       1.204x | **1.000x** |
| bea       |        116 |     122 |        122 |       1.069x | **1.000x** |
| corvus    |        100 |     124 |        124 |       1.240x | **1.000x** |
| inky      |        100 |     126 |        126 |       1.260x | **1.000x** |

DPR 1 is now **1.000x for all 22 characters** (was mean 1.162x, worst 1.260x).

`scripts/reencode-cast-display-size.py` performs the re-encode, and
`scripts/compare-sprite-sharpness.py` measures the result against the previous
pipeline — the old asset enlarged by bilinear, which is what the browser did — on
alpha-weighted-luminance acutance (mean gradient magnitude):

**+22.4% mean acutance, +15.3% worst, +29.6% best, 22 of 22 characters sharper, and
no character's halo peak-to-peak regressed.**

### How the two blockers were removed

1. **The circular derivation.** `measure-character-figures.py` used
   `measured['pip']['figureHeight']` — the reference figure in _pixels of the shipped
   canvas_ — as the target. That is what made the fix a 1.44x runaway: encoding Pip
   1.2x larger raises her measured figure 1.2x, which raises every derived
   `officeHeight` 1.2x, which presence then multiplies by 1.2 again.

   `officeHeight` is a _layout_ quantity, so its anchor has to be one too. It is now
   the authored constant `REFERENCE_FIGURE_LAYOUT_PX = 92`, mirroring
   `REFERENCE_FIGURE_PX` in `src/content/characterScale.ts`. The derivation then
   depends only on each animal's `figureHeightFraction`, a **shape** fraction that is
   invariant under uniform rescaling. Confirmed as a byte-identical no-op against the
   previously committed metrics before any pixel was touched.

   The measurement also moved from the `-1x` derivative to the `@2x` build. The `@1x`
   height is now a _function_ of `officeHeight`, so measuring it to derive
   `officeHeight` would close the loop a second time at ±1px per re-encode. The `@2x`
   build is never re-encoded, which makes these numbers a fixed property of the
   artwork — and finds the figure edge in four times the pixels.

2. **Pip's protected asset.** She was never re-imported. The source for every
   re-encode is the **shipped `@2x` build**, which for Pip _is_ the hand-repaired one
   — so the repair is inherited rather than risked. That also means no master had to
   be fetched: the masters are gitignored (~1.3 GB) and absent from a checkout.
   `npm run verify:assets` re-checks halo temporal stability on every shipped asset
   (22 then, 23 now) and passes; Pip measures 5.0/255 peak-to-peak, far below the raw
   master's 16.95.

### What this costs, stated plainly

- **One extra resampling generation.** The chain is now master → `@2x` → `@1x`
  instead of master → `@1x`. That is a deliberate trade against re-importing Pip from
  a known-defective master, and it is still a large net win because the final step is
  a _downscale_ (0.53–0.63x) where it used to be an upscale.
- **`@1x` payload 64.6 MB → 83.4 MB** (`public/employees` 271 MB → 288 MB, +6.4%).
  The canvases are 15–26% larger in each axis; that is the resolution being paid for.
- **DPR 2 is unchanged** (mean 1.161x, worst 1.260x) and is now a genuine _asset_
  limit rather than a layout bug. A DPR-2 display wants `2 x cssHeight` pixels and the
  `@2x` build only carries `2 x officeHeight`. Closing that gap means upscaling
  artwork — inventing pixels — so it is deliberately not done. The `@2x` build is left
  exactly as it was.

### The `srcSet` densities are now measured, not asserted

The old markup declared `"@1x 1x, @2x 2x"`. Neither label was true after the
re-encode, and `2x` was not true before it either. `EmployeeSprite` now computes each
candidate's density from its real pixel height against the height being rendered, so
one rule serves every call site:

- **office** (`height === frameHeight`): `src1x` is `1.000x` → DPR 1 takes it, 1:1.
- **roster card** (`height ≈ 1.43 × frameHeight`): `src1x` falls below `1.000x`, so
  DPR 1 steps up to the `@2x` build and _downscales_ it. Portraits used to enlarge the
  small file ~1.7x and were the softest thing in the game; this fixes them too, and it
  came out of stating the densities honestly rather than from a separate change.
- **pushed back in perspective**: `src1x` rises above `1.000x` and still wins, again as
  a downscale.

`tests/spriteResampling.test.ts` now pins DPR 1 at exactly `1.0` (it previously only
guarded against getting worse than 1.27), asserts the registry's `srcWidth`/`srcHeight`
match the files on disk, and covers the card case.

## Reproducing the pipeline

The four steps are idempotent and must run in this order, because the encode height
depends on `officeHeight` while `officeHeight` must not depend back on the encode:

```bash
python3 scripts/measure-character-figures.py     # shape fractions, off the @2x art
python3 scripts/sync-character-registry.py       # officeHeight lands in the registry
python3 scripts/reencode-cast-display-size.py    # @1x encoded at officeHeight * presence
python3 scripts/sync-character-registry.py       # frame dimensions land in the registry
python3 scripts/sync-character-registry.py --check   # convergence: must be a no-op
```

Then verify:

```bash
node scripts/check-sprite-resampling.mjs         # DPR1 must be 1.000x for everybody
node scripts/verify-assets.mjs                   # halo temporal stability, every @1x
python3 scripts/compare-sprite-sharpness.py      # acutance vs the previous pipeline
python3 scripts/shot-cast-scale.py               # the cast on one floor line, vs Pip
```

`shot-cast-scale.py` is the visual counterpart to the numbers: it draws every animal at
the exact height the game renders it, on a shared floor line, with guide lines at Pip's
figure top and bottom. Measure the **union** silhouette across the whole loop, which is
what it does — a single mid-loop frame reported the bear 9.9% short and 10px airborne
purely because its soft contact shadow only reaches full extent in a few frames.

Provenance for every input and output, with SHA-256s, is written to
`assets/sources/characters/reencode-report.json`. Only `<asset>-1x.png` is ever
rewritten; `<asset>.png` and `<asset>-poster.png` are never touched, so the operation
is reversible by re-running the script.

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
