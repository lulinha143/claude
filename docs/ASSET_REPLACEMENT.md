# Asset Replacement Guide

All initial art and audio are **generated in code** so the repo ships nothing
that needs licensing:

- **Design tokens:** `src/ui/tokens.css` is the single source of truth for
  colour (semantic + department accents), elevation, spacing, radius, and
  motion. Re-theme the whole game from here; high-contrast mode overrides only
  the semantic tokens.
- **Characters:** `src/art/Critter.tsx` draws six **distinct species**
  (squirrel, capybara, raccoon, beaver, crow, mole) with bespoke geometry and
  shared expressive faces (blink, eyebrows, mood-driven mouth). Species per
  employee are declared in `src/art/critterShapes.ts`.
- **UI icons:** `src/art/UiIcon.tsx` is a unified 24×24 line-icon set using
  `currentColor` (`<Icon name="…" />`), readable at 16–24px.
- **Illustrative props:** `src/art/Icons.tsx` (acorn/crate/nut).
- **Office diorama:** `src/art/OfficeScene.tsx` — an organic tree-trunk frame
  (SVG) with stacked rooms, per-department accents, and ambient animations.
- **Audio:** synthesized at runtime via the Web Audio API (`src/audio/audio.ts`).

The code is structured so professional assets can replace the generated ones
**without touching gameplay logic.**

## Replacing character art (e.g. with a sprite sheet or PixiJS)

The gameplay never imports SVG internals. The rendering boundary is:

- `src/art/Critter.tsx` — swap the SVG body for `<img>`/sprite frames, or an
  animation-library component. Keep the same props (`color`, `accent`, `state`,
  silhouette flags, `size`, `reducedMotion`).
- `src/art/OfficeScene.tsx` — replace the DOM/SVG scene with a canvas/PixiJS
  `SceneRenderer`. It reads from `useGame()` (engine state) and the animation
  state machine; keep those inputs and the office layout contract.
- `src/art/animation.ts` — the `CritterStateMachine` outputs a `CritterState`
  string per employee. A sprite renderer maps each state to an animation clip.

### Suggested PixiJS path

1. Add `pixi.js`; create `src/art/pixi/PixiOfficeScene.tsx` implementing the same
   "render the office from engine state + per-employee `CritterState`" contract.
2. Mount it in `App.tsx` in place of `OfficeScene` (or behind a setting).
3. Load a sprite atlas keyed by `employeeId` + `CritterState`; drive frames from
   the state machine. No changes to `src/sim` or `src/content` are required.

## Final animated employee sprites (implemented)

The first final character asset (Bea the beaver) ships as an **animated PNG
(APNG)** and is wired through a small, reusable per-employee pipeline. This is
the path to give every animal its own final art without any per-employee code:

1. **Drop the files in `public/employees/`** — the animated `…​.png` (APNG) plus a
   `…​-poster.png` still frame. They are served verbatim via `BASE_URL` (never
   bundled/transformed by Vite), exactly like the office background, so the
   animation, transparency, colours and timing are preserved end-to-end.
2. **Register the sprite** in `src/art/employeeSprites.ts` (`EMPLOYEE_SPRITES`):
   the source/poster paths, the intrinsic frame size, the in-office and roster
   render heights, and the anchor/baseline used to seat the character on its
   floor slot. Nothing else changes.
3. `src/art/EmployeeSprite.tsx` renders the APNG in a `<img>` (browser-native
   autoplay + infinite loop). It is **memoised on stable props** so the office
   can re-render every animation frame without ever recreating the element —
   the loop therefore never restarts on ordinary React churn. It swaps to the
   static poster when the player prefers reduced motion, matching the office
   background's behaviour.
4. `OfficeScene` (diorama + drag ghost) and `EmployeesView` (roster card) prefer
   a registered sprite and otherwise fall back to the code-drawn `Critter` SVG,
   so animals without final art keep their placeholder silhouette.

`scripts/verify-assets.mjs` fails the build if a registered sprite is missing or
has regressed into a static PNG (it checks for the APNG `acTL` chunk).

### Optimising a delivered APNG for shipping

Raw exports are often huge (Bea's source was ~103 MB). Optimise **without
flattening the animation** by trimming uniform transparent padding, scaling to a
display-appropriate size (~384 px), quantising every frame against **one shared
palette** (pngquant, so colours never pop between frames and alpha edges stay
smooth), and re-assembling a looping APNG that keeps all frames, `num_plays = 0`
and the original per-frame delays. Bea's ships at ~6 MB with all 121 frames.

## Replacing audio

Swap `AudioManager.play()` in `src/audio/audio.ts` to play decoded audio buffers
instead of synthesizing oscillators. Keep the `SfxName` union and the channel
volume / mute / quiet / focus behavior. Add asset files under `src/audio/samples/`
and confirm their licenses permit redistribution.

## Fonts

The dyslexia-friendly option uses a safe system-font fallback and bundles no
third-party font. To bundle one, add the font under `src/assets/fonts/`, include
its license, and reference it in `styles.css` under `[data-dyslexia='true']`.

## Keeping gameplay decoupled

- `src/sim` and `src/content` must never import art/audio/UI.
- Content records reference employees/rooms by id and carry `color`/`accent`
  hints; a new renderer can ignore or use those freely.
