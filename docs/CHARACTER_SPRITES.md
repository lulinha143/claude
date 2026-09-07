# Character sprites (animated APNG workstations)

How an animal's final animated artwork is stored, sized and validated — and the
write-up of the two Pip (squirrel) bugs, so neither gets re-investigated.

## The pipeline in one page

Each finished animal ships two things in `public/employees/`:

| file              | what it is                                                       |
| ----------------- | ---------------------------------------------------------------- |
| `<id>.png`        | looping, full-canvas animated APNG (`num_plays = 0`)             |
| `<id>-poster.png` | single static frame, used when the player prefers reduced motion |

Optionally `<id>-1x.png`: the same animation at exactly the office slot size, so
`srcset` can hand the browser a 1:1 frame at integer device pixel ratios. It is a
resolution hint only — it never affects layout.

Register it in `src/art/employeeSprites.ts`; nothing else in the codebase needs
to change per animal:

```ts
pip: {
  src: 'employees/pip.png',
  src1x: 'employees/pip-1x.png',   // optional
  poster: 'employees/pip-poster.png',
  frameWidth: 103, frameHeight: 93, // drives the ASPECT RATIO
  officeHeight: 93,                 // rendered height in the office diorama
  cardHeight: 133,                  // rendered height on the roster card
  anchorX: 0.5, baseline: 0,
}
```

`EmployeeSprite` renders one `<img>` and sets **both** its CSS width and height
from the height requested by the caller and the aspect ratio implied by
`frameWidth / frameHeight`.

### Geometry contract — do not break this

> The `<img>` must never be laid out **larger** than the box it sits in.

`src/styles.css` has a global overflow guard, `img { max-width: 100% }`. Applied
to a sprite it clamps **width** while an explicit **height** stays put, which
silently distorts the artwork. `.employee-sprite` therefore sets
`max-width: none`, and the component keeps the image at display size so it never
relies on that opt-out. Guarded by the aspect-ratio tests in
`tests/e2e/employee-sprite.spec.ts`, which check the real on-screen box in the
office and on the roster card at DPR 1 and 1.5.

### Validation

```bash
npm run verify:assets          # animated? poster present? halo temporally stable?
npx playwright test employee-sprite
```

`verify:assets` decodes every frame's alpha channel and fails if any frame's halo
opacity sits far below its neighbours' (see below). It runs on every registered
animal, so new artwork is checked on arrival.

Repair a flagged file with:

```bash
python scripts/repair-character-apng.py --in public/employees/<id>.png
python scripts/repair-character-apng.py --in public/employees/<id>.png --report-only
```

---

## Bug 1 — Pip looked squashed

**Symptom.** After the "render at native resolution + constant GPU scale" change,
Pip was visibly distorted.

**Cause.** That change sized the animated `<img>` at native resolution (206×186)
inside a smaller wrapper (103×93) and shrank it with `transform: scale(0.5)`. It
was the first code to render an `<img>` wider than its container, so it was the
first to trip the global `img { max-width: 100% }` guard: width was clamped
206 → 103 px while the inline `height: 186px` was untouched. Measured on screen:
**51.5 × 93 instead of 103 × 93 — aspect 0.554 against a true 1.113, a 2:1
error.** (The squash was horizontal, not vertical.)

**Fix.** Reverted to the simple render — one `<img>` sized to its display size —
and added `max-width: none` to `.employee-sprite` so the guard can never apply to
character art again. Restored geometry verified at DPR 1, 1.5 and 2 in both the
office and the roster card.

## Bug 2 — the soft halo shimmered

**Symptom.** In the packaged Electron/GPU build the soft baked-in halo flickered
between animation frames while the character's body looked stable. It could not
be reproduced headlessly, a static halo was stable, and no compositing, DPR,
`backdrop-filter`, layer-promotion or scaling change fixed it.

**Cause — the artwork, not the renderer.** 8 of Pip's 242 frames have their
semi-transparent alpha collapsed by ~52 %:

```
frames 13, 67, 87, 94, 157, 158, 161, 210   (~28 frames apart => ~0.94 s at 30fps)
mean halo alpha 60.8  ->  ~28.5 on those frames
```

So roughly once per second the halo deflated for a single frame and snapped back.
Supporting measurements:

- Between adjacent healthy frames the mean alpha over the visible sprite changes
  by only **0.41/255** (max 2.8); a dropout frame differs by **~24/255** — about
  58× the natural variation.
- The near-opaque body only dropped 244 → 232 alpha (barely visible) while the
  halo lost half its opacity — matching "the body is stable, the halo flickers".
- The halo's **RGB** is stable to 0.00 and the fully transparent region is 99.6 %
  static, so nothing else in the asset churns.
- The same 8 frames are present in the very first encode of the asset, so the
  defect came from the source master, not the downscale/encode step.

This also explains every earlier dead end: a **static** halo has no frames to
differ, so it was always stable; the **no-halo** variant has binary alpha, so a
50 % dip is invisible; and a renderer-side fix could never help because the
frames themselves differed.

**Fix.** `scripts/repair-character-apng.py` substitutes the nearest healthy frame
for each dropout. Safe because alpha is essentially static between neighbours, so
the substitution error is far below one alpha level while the halo is restored to
its authored opacity. For a 2-frame run the halves are filled from opposite sides
so no frame is held longer than two frame periods (~66 ms). The tool verifies its
own output: frame count, per-frame delays, loop count and total duration
unchanged, healthy frames **bit-identical**, zero dropouts remaining.

Result on `pip.png`: halo alpha peak-to-peak **5.1/255** across 242 frames, down
from a 33/255 swing. Dimensions, halo softness, transparency and timing unchanged.

### Honest limitation

This was diagnosed and fixed by exact measurement of the asset's pixels, and
confirmed by two independent decoders (Python/Pillow and the dependency-free
decoder in `verify-assets.mjs`). **It has not been confirmed on a real GPU.** The
sandbox used for the fix has no GPU, and a headless software-raster playback
comparison was only directionally supportive (temporal spread of the composited
halo roughly halved), not decisive. The defect was real, measurable and is now
gone from the artwork; if any shimmer remains on the Windows/Steam build it is a
separate, still-unproven renderer issue and should be investigated as such rather
than by re-litigating the asset.
