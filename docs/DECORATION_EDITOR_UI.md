# Decoration Editor UI

How buying and arranging decorations works (Chapter 8). Rules live in
`src/sim` (`engine.ts`, `decorations.ts`, `placement.ts`, `depth.ts`); the scene
in `src/art/OfficeScene.tsx`; the catalogue in `src/ui/views/DecorateView.tsx`
and the storage strip in `src/ui/DecorationTray.tsx`.

## The catalogue (Decorate in the dock)

- Three parts: **Available** (pieces whose room is open, owned or not),
  **Yours** and **Coming soon** (rooms not open yet), each with its count. One
  search and one filter (a room, or a kind of piece).
- Each card: the piece in a little of its room (wall, floor or ceiling), its
  name and line, its surface and room (for an owned piece, the room it stands in
  or "In storage"), its set when it belongs to one, and its state:
  - not owned: the price on the buy button and "Morale +N when bought"; short of
    the price, the button stays pressable, says "N short" and answers with what
    is still missing (nothing is charged);
  - owned: **Arrange** (to the office, the piece picked) and **Move To…** (a
    room or storage, the keyboard and touch path);
  - coming soon: "Comes with: <room>" and the price.
- A purchase is one engine step, `engine.purchaseDecoration`: every check runs
  before the charge, the piece is owned once, put on its home room's surface when
  there is a spot (otherwise storage), and saved at once. The card says where it
  went; a refusal says why and changes nothing.

## Arranging (the Arrange switch, or Arrange on a card)

- The storage strip sits under the rooms (the tower view shrinks by its height)
  and lists every owned piece, placed or stored, with a search. Its labels are
  never under the legibility floor.
- **Place / move**: drag a strip card or a placed piece. The piece is drawn at
  its in-room size where it will land (`DragGhost`, plus a soft footprint);
  off the rooms it hangs from the pointer at the offset it was grabbed at.
- **Put away**: let go over the strip. While a piece is in the paw the strip is
  a slim band that says, in place, what letting go there does ("put it in
  storage" for a placed piece, "leave it in storage" for one taken from it).
- **Tap-to-place**: with a piece picked, a tap on a room puts it there.
- **Edge scroll**: holding a piece at the top or bottom edge of the tower for
  350 ms scrolls the other floors into reach; passing through the edge (every
  drag up from the strip does) never moves the room.
- What is shown is what a release does: the landing is worked out again when the
  window resizes or the tower scrolls under a still pointer.
- **Cancel** changes nothing (no charge, no move, no stow): Escape, a cancelled
  pointer, lost capture, the window losing focus or going hidden, and leaving
  arranging with a piece in the paw. An invalid release over a room says why.
- One selection treatment: a white die-cut edge and a soft lift. Teammates dim
  and let clicks through to the furniture. Clicking a stack hands the pick down.
- Per room, under its floor: **Move To…**, **Stow** and front/back for the
  picked piece, and **Tidy up** (`engine.resetRoomDecorations`, offered only
  when the room has pieces of its own). Undo/redo sit with the Arrange switch.

## Depth

`src/sim/depth.ts`: rugs, wall art and hanging ceiling pieces are behind the
team; floor furniture stands among the team, sorted with them by how far back
its base stands (`decorationRenderZ` with the stage-height conversion in
`content/roomLayout.ts`), a teammate winning a tie. A wall piece can be brought
in front of everyone, a floor piece sent behind everyone
(`engine.setDecorationLayer`, saved as `DecorationInstance.layer`, part of
undo/redo, cleared by Tidy up). The picked piece keeps its depth; the carried
ghost floats above everything until it is let go.

## Saves

Ownership is a `deco:<id>` mark; placement is the piece's `DecorationInstance`
(room or storage, surface, position, depth, optional layer). Loading never drops
an owned piece: one in a room that no longer fits is stored, one on the wrong
surface is nudged back or given one of its room's default spots (pieces moved
together each get their own).

## Known limitations

- Keyboard placement chooses a room (Move To…), not a spot in it.
