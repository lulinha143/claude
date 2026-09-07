# Decoration Editor UI

How the in-office decoration editor ("Arrange" mode) works after the Part 2 pass.

## Entering / leaving

- The **Arrange** chip in the office toolbar toggles Decoration Mode.
- The office scene stays fully visible — the editor is *not* a full-screen modal.
- Leaving clears the current selection. Undo/Redo history is session-scoped.

## Bottom inventory tray (`src/ui/DecorationTray.tsx`)

- A single panel fixed to the bottom of the office, spanning the width, shown
  only in Decoration Mode. It never covers the whole scene, and the office gains
  bottom padding (`.office--decorating .office__trunk`) so the last room stays
  clear.
- Lists every decoration the player **owns but hasn't placed** (the "storage"),
  grouped from all unlocked rooms.
- **Category filter** chips (All + each decoration *kind* present) and a **search**
  box (matches localized names).
- Each card shows the decoration glyph, its name, and its room.
- **While dragging**, the tray shrinks and fades (`.deco-tray.is-dragging`) so the
  target rooms are visible.

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
  a select.

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
