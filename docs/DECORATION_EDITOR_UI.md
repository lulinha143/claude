# Decoration Editor UI

How the in-office decoration editor ("Arrange" mode) works after the Part 2 pass.

## Entering / leaving

- The **Arrange** chip in the office toolbar toggles Decoration Mode.
- The office scene stays fully visible — the editor is _not_ a full-screen modal.
- Leaving clears the current selection. Undo/Redo history is session-scoped.

## Bottom inventory tray (`src/ui/DecorationTray.tsx`)

- A strip fixed under the office, shown only in Arrange mode. The tower view
  shrinks by the strip's height (`--tray-h`: 172px, 136px in small windows) and
  keeps the floor in view centred above it, so the room being decorated is never
  covered.
- Lists every decoration the player **owns but hasn't placed** (the "storage"),
  grouped from all unlocked rooms.
- **Category filter** chips (All + each decoration _kind_ present) and a **search**
  box (matches localized names).
- Each card shows the decoration glyph, its name, and its room.
- **While dragging**, the tray drops to a slim strip (`.deco-tray.is-dragging`):
  the place to put a piece back in storage.
- The next-step hint lives in the strip's header on wide windows.

## Placing, moving, swapping, stowing

All handled by the unified pointer-drag in `OfficeScene.beginDrag('decoration', id)`:

- **Place**: drag a card from the tray onto its room → dropped at the anchor
  nearest the pointer (`engine.placeDecoration`).
- **Move**: drag a placed piece in the scene to another anchor.
- **Swap**: drop a placed piece onto an occupied anchor → the two pieces swap
  positions (`engine.placeDecoration` swap branch). A piece coming from storage
  instead bumps the occupant back to storage.
- **Stow**: drag any piece down onto the tray (or a per-room actions bar) →
  `engine.removeDecoration`.
- **Cancel**: release outside a valid target, or press **Escape** mid-drag.
- A real drag suppresses the trailing click (`draggedRef`) so it never doubles as
  a select; a cancelled drag never turns into a click either.
- **Tap-to-place**: with a piece picked, tapping an empty spot of a room puts it
  there exactly as a drop at that point would.
- **Edge scroll**: holding a piece (or a teammate) near the top or bottom of the
  tower view scrolls the other floors into reach.

### Feel ("pick it up and put it there")

- The piece in the paw (`DragGhost`) is drawn at exactly its in-room size (the
  scene scale is handed to the portal explicitly) and follows the pointer; the
  piece leaves its spot while carried. Only the ghost and the landing guide
  re-render per pointer move: the office re-renders only when the room under the
  pointer or the validity of a drop changes.
- One selection treatment: a white die-cut edge that follows the artwork and a
  soft lift. No frame, no corner grips, no tint. A paw cursor replaces the grab
  hand.
- Hit testing follows the artwork (painted shapes plus a small central grab
  core), so transparent corners never steal clicks from what is behind.
- Overlaps: clicking the picked piece again where others overlap it hands the
  pick to the next one down (paint order), cycling through the stack; a press on
  a stack drags the picked piece if it is under the pointer. The tray picks any
  piece directly.
- While arranging, teammates dim and let clicks through to the furniture.

### Front / back

Wall art and rugs sit **behind** the team; free-standing floor furniture and
ceiling pieces sit **in front** (`decorationRenderZ` in `src/sim/depth.ts`). With
a wall or floor piece picked, the room's actions bar offers **Put behind** /
**Put in front** (`engine.setDecorationLayer`). The choice is stored as
`DecorationInstance.layer` (optional, so older saves load on their natural side),
is part of undo/redo, and is cleared by **Tidy up**. Rugs and ceiling pieces
never offer it.

Per-room actions bar (slim, under each floor in Arrange mode): **Stow selected**
and **Tidy up** (`engine.resetRoomDecorations`, re-places all owned pieces into
default anchors). Global **Undo / Redo** live in the toolbar
(`engine.undoDecoration` / `redoDecoration`).

## Rooms as dioramas

- Anchors (`src/content/roomLayout.ts`) are spread across walls, corners and the
  two front floor corners, split into **back** (behind critters) and **front**
  (framing) depth layers.
- Decoration glyphs (`src/art/DecorationProp.tsx`) render as large furniture
  (52×60 base) and many are interactive on click (lamp/screen/aquarium toggle;
  plant sway; trophy twinkle).
- A **workbench** grows with the team (`RoomFurniture`) — one desk per employee.

## Accessibility

- Tap-to-select + tap-anchor still works as a non-drag fallback.
- Reduced Motion disables tray/idle animations.
- Cards are buttons with labels; the tray is a labelled region.

## Known limitations (honest status)

- Decorations are still **room-scoped** by design (each definition has one
  `room`); a piece highlights/places only in its own room. A fully room-agnostic
  inventory would require a data-model + save migration and is not done yet.
- Keyboard-only placement into a chosen anchor is partial (select works; anchor
  cycling via keyboard is not yet implemented).
