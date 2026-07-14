# Asset Replacement Guide

The shipping placeholder art/audio is **original and code-generated** so the
project runs and looks cohesive with zero external files. Real artists replace
these without touching gameplay scripts.

## Principle: visuals are separated from gameplay

- A furniture's **collision, grip points, weight, and behaviour** live on
  `FurnitureController` + `FurnitureData` (data).
- Its **visual** is a separate child `Node3D` built by
  `FurnitureMeshFactory.build_visual()`. Replacing the visual does not affect
  physics or logic.

## Replacing a furniture mesh

Option A — keep the factory, add a real mesh branch:
1. Import your `.glb`/`.gltf` (Blender-friendly; Blender is *not* required to
   run the project).
2. In `furniture_mesh_factory.gd`, in the `build_visual` match, load and return
   your imported scene for that `mesh_kind` instead of the primitive builder.

Option B — data-select a scene:
- Add a `visual_scene` path to the furniture JSON and have the factory prefer it
  when present (small, localized change).

Keep the visual centered on the body origin and sized to `dimensions` so grips
line up.

## Replacing audio

`Audio` plays named sounds from a bank built in `AudioDirector._build_bank()`
via `ProceduralSfx`. To use recorded audio, assign an imported `AudioStream` to
the same bank keys (`thud`, `squeak`, `chime`, `murmur_*`, `ui_*`, …). Gameplay
calls `Audio.play_sfx("thud")` and is unaffected.

Adaptive music hooks into `Audio.set_music_intensity(0..1)`; drop layered stems
in and crossfade by intensity.

## Replacing UI art

`assets/ui/theme.tres` is a standard Godot `Theme`. Swap StyleBoxes, fonts, and
colors there. SVG icons live in `assets/icons/`. Boxy is currently code-drawn
(`boxy_widget.gd`); replace with an `AnimatedSprite2D`/`TextureRect` keeping the
same node so tips/hiding still work.

## Do / don't

- **Do** keep node names and public methods stable so scripts keep working.
- **Do** record originals or use assets whose license permits commercial use, and
  log them in `THIRD_PARTY_NOTICES.md`.
- **Don't** introduce marketplace/copyrighted assets without clear licensing.
