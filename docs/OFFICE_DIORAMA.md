# Office Diorama — Art & Layout Pipeline

The Office tab is the game's core visual identity. It is a vertical stack of
**miniature illustrated rooms** ("floors") nested in a cozy tree-trunk frame.
Rooms are drawn with layered CSS + SVG (no external art), so they scale
crisply, theme by department, and stay one cohesive style.

## Why this approach

The previous scene layered flat dark translucent "room bands" on top of a
detailed pre-rendered isometric video, so two unrelated art styles fought each
other and characters looked like sprites floating on a photo. We now render each
room as an **opaque, illustrated diorama** (Approach A/B in the brief) and demote
the video to a soft, blurred ambient backdrop seen only in the margins.

## Coordinate system & layers (per room)

A room is `.floor` → `.floor__stage` (the playfield). Everything is positioned
from the **stage bottom = the floor line**. Depth layers, back to front:

1. **Back wall** — `.floor` background: a warm cream/wood vertical gradient with
   a subtle department tint at the top; faint wainscot line via `.floor::before`.
2. **Floor plane** — `.floor::after`: a wood-plank strip along the bottom with a
   lit front edge, implying a shallow 2.5D ground.
3. **Background props / wall decorations** — `.floor__anchor--back` (z 1).
4. **Workbench furniture** — `.floor__furniture` desks (z 1), grouped centrally.
5. **Characters** — `.critter-btn` (z 3–5) standing on the floor line, each with
   a soft contact shadow (`.critter-btn::after`) so they never look like they
   float.
6. **Foreground props** — `.floor__anchor--front` (z 6).
7. **Label plaque** — `.floor__label`: a small department-tinted pinned tag in
   the top-left, dark text, never a big dark bar across the room.

## Scale tokens

- `--asset-scale` (existing) scales room height and stage with the window/UI.
- Characters render at `size≈74` (readable in the normal Office view) and sit on
  the floor line; furniture desks are ~46×32 and grouped so coworkers cluster.
- Decoration anchors carry `x` (0..1 across the room), `y` (px up from the floor
  line), `scale`, and `layer` (`back`/`front`) — see `content/roomLayout.ts`.

## Light, shadow, palette

- **Light** comes from the upper-left; **contact shadows** are soft dark
  ellipses directly under feet/furniture (bottom-anchored, blurred).
- Palette: warm wood browns, cream, and a per-department **accent**
  (`--dept-*` tokens) used for the left border, the wall tint, and the plaque.
- Outlines are the dark wood ink `#241a12`; keep them consistent across props.

## Department identity

Each room keeps a distinct accent + ambient touch (steam, conveyor, bubbling
flask, swaying plant, …) but shares the same wall/floor/lighting system, so a lab
and a break room feel different yet clearly part of one building.

## Adding room/prop art

- Prefer inline SVG or CSS; if a raster asset is ever added, document its source
  + license in `assets/` and keep the outline/scale/perspective consistent with
  this guide. Do **not** paste in mismatched internet artwork.
