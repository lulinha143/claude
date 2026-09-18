# Office Background Implementation

The main **Office** tab is backed by the official animated office asset supplied
by the project owner. This document explains how it is integrated.

## Source asset

- Provided by the project owner via: https://imgur.com/a/PFVDy74 (image id `BOunkOV`, 1280×720, 16:9).
- Treated as the game's own official visual asset (see `assets/SOURCES.md` / `assets/LICENSES.md`).

## Files (served, path-stable in dev, web build, and packaged Electron)

```
public/backgrounds/office/
  office-main-loop.mp4     # primary optimized loop (~3.3 MB, H.264) — what plays
  office-main-poster.jpg   # static poster (1024×576) — reduced motion + fallback
  office-main-source.gif   # canonical source GIF (~31 MB) — last-resort fallback
```

They live under `public/` so Vite copies them verbatim to `dist/backgrounds/office/`
and they resolve through `import.meta.env.BASE_URL` (`'/'` in dev, `'./'` in the
build) — i.e. correctly under the packaged Electron `file://` load and GitHub Pages.

## Playback architecture

- Component: `src/art/OfficeBackground.tsx`.
- **Mounted once** in `src/App.tsx` as a direct child of `.app`, _outside_ the
  view switch, with `visible={view === 'office'}`. Because it is never unmounted
  when you change tabs or open panels, the `<video>` element persists and the
  loop **never restarts** on ordinary UI updates.
- Primary: a persistent `<video muted loop playsInline preload="auto" poster=…>`
  with an MP4 source. It is decorative: `pointer-events: none`, `aria-hidden`.
- Fallback chain: MP4 `<video>` → (on error) original GIF `<img>` → (on error)
  static poster `<img>`. It can never show a broken-image icon or a black void.
- `object-fit: cover` + a configurable `object-position` focal point → fills the
  area with **no black bars and no stretching**; intelligent crop instead of
  deformation.
- A soft top/bottom **scrim** (`.office-bg__scrim`) keeps counters/panels readable
  over bright or busy frames.
- The procedural diorama (`OfficeScene`) becomes a translucent interactive layer
  over the background (`.office--overgif`) so crate collection, employees,
  decorations, room status, and dialogue all keep working on top of the GIF.

## Loop continuity

- The element is not recreated on currency changes, mood changes, notifications,
  saves, language switches, or panel opens (they don't touch this subtree).
- Visibility: a `visibilitychange` listener pauses the video while the tab/window
  is hidden (when _Pause when hidden_ is on) and resumes cleanly — no frame-zero
  jump, no black flash. Simulation time is fully independent of playback.

## Responsive behavior

- The container is `position: absolute; inset: 0` behind `z-index:1` UI; it clips
  overflow and inherits the window's rounded corners.
- Focal position is user-selectable (center/top/bottom/left/right) so the
  important part of the office stays visible in compact/vertical/ultrawide sizes
  rather than being deformed.

## Settings (Settings → Office Background)

`settings.background`: `enabled`, `brightness`, `contrast`, `saturation`,
`blurBehindPanels`, `quality` (`high` | `balanced` | `static`), `focal`,
`pauseWhenHidden`. Persisted in the save (schema defaults fill older saves — no
migration needed). `Reset background settings` restores defaults.

## Reduced motion / battery

- **Reduced Motion** (accessibility) or **quality = static** → shows the static
  poster, never the animation, while the tab stays fully functional.
- **Pause when hidden** stops decoding while minimized/hidden for battery.

## Fallbacks

If the MP4 and GIF both fail, the poster shows; if everything fails the office UI
still works (the background is purely decorative). `scripts/verify-assets.mjs`
(run in `npm run validate`) fails the build if the required formats are missing.

## Tests

- `tests/assets.test.ts` — the MP4, poster, and source GIF ship.
- `tests/background.test.tsx` — video plays when allowed; poster shows in reduced
  motion / static / disabled; decorative (`pointer-events` via `.office-bg`,
  `aria-hidden`); stays mounted-but-hidden off the Office tab.

## Known limitations

- `quality: balanced` currently plays the same MP4 as `high` (there is one
  encode); it's reserved for a future lower-resolution encode. `static` is the
  meaningful battery option today.
- Verified in the browser dev server, the production build, and via render tests.
  A **real packaged `.exe` could not be produced/opened in this Linux sandbox**
  (no Windows/Wine/display) — build it on Windows with `npm run build:windows`
  and confirm using `docs/PACKAGED_BUILD_QA.md`.

## Replacing the GIF later

See `docs/BACKGROUND_ASSET_PIPELINE.md`.
