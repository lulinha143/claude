/**
 * World/scene scale — how big the diorama is drawn right now.
 *
 * THE BUG THIS FIXES
 * ------------------
 * The room is fluid: it is as wide as the window lets it be. The characters
 * standing in it were not. Their size came from the art registry and was written
 * straight into the sprite as a pixel height, so shrinking the window shrank the
 * room, the wall, the window fixture and the floor around a cast that stayed
 * exactly the same size. Measured before this module existed, with
 * `scripts/measure-scene-scale.mjs`:
 *
 *     viewport      room width    tallest figure
 *     900x600            824px          112.00px
 *     1024x700           948px          112.00px
 *     1280x800          1140px          112.00px
 *     2560x1080         1140px          112.00px
 *
 * The room varied by 38% while the figure never moved off 112.00px, so at a small
 * window the characters read as oversized cut-outs pasted onto a shrunken set.
 *
 * THE FIX
 * -------
 * `--asset-scale` already existed and was already multiplied into everything that
 * is *part of the scene* — the floor block, the room stage, the window fixture,
 * the contact shadow and the sprite's own width/height. It was simply never
 * driven: a literal `1` in tokens.css that no code ever wrote. So there is no new
 * parallel scaling system here. This module supplies the one number that variable
 * was always meant to carry, measured off the room itself, which is what keeps
 *
 *     ROOM -> WORKSTATION -> CHARACTER -> DECORATION
 *
 * locked to each other at every window size.
 *
 * WHY THE ROOM AND NOT THE WINDOW
 * -------------------------------
 * Scale is derived from the room's own rendered width rather than
 * `window.innerWidth`, so it stays correct no matter what else changes the room's
 * width — padding, a scrollbar, the decoration tray, a future sidebar. It is the
 * environment's real size that the cast has to agree with.
 *
 * WHY IT IS QUANTISED
 * -------------------
 * The room lives inside a scrollable column, and scale changes the room's height.
 * A continuous scale could therefore feed back on itself: shrink the rooms ->
 * scroll bar disappears -> column gets ~15px wider -> scale up -> scroll bar
 * returns. Snapping to `SCENE_SCALE_STEP` means a change that small usually
 * lands on the same step, so the loop cannot sustain itself. At 2% steps of a
 * ~112px figure the increment is ~2px, which is not visible.
 *
 * SCENE SCALE IS NOT UI SCALE
 * ---------------------------
 * These are deliberately different things and must not be collapsed:
 *
 *   --ui-scale    the player's accessibility zoom. Applied as `zoom` on `.app`,
 *                 so it magnifies EVERYTHING, HUD included.
 *   --asset-scale how big the world is drawn inside whatever space it was given.
 *                 Scene only. The HUD does not use it.
 *
 * Because scale is measured from the room's rendered box, which is already inside
 * the zoomed subtree, raising the UI scale does not shrink the world back down to
 * compensate: the player still gets bigger characters, as intended. Characters
 * belong to the scene, and are never sized like a HUD element.
 *
 * Framework-free on purpose (CONTRIBUTING): no React import, so the sim and tests
 * can use it directly.
 */

/**
 * Room width, in CSS px, at which the scene is drawn at its authored size.
 *
 * This is also the maximum width of a floor in the tree-trunk tower (world.css
 * reads the same number as `--floor-max-w`): large windows show more floors and
 * more world around the trunk instead of stretching a room into a 6:1 strip.
 *
 * Why 700: a full room seats four animals at x ≈ 0.22 / 0.43 / 0.63 / 0.83, i.e.
 * one teammate per ~0.2 of the room's width, and the widest workstation sprite is
 * ~124px at scale 1. 0.2 × 700 = 140px per teammate leaves a clear gap between
 * desks at every scale, so a full room never overlaps. (The old 1140px reference
 * clamped at 0.7 put 87px-wide desks 64px apart in the 380px default window.)
 */
export const SCENE_REFERENCE_ROOM_WIDTH = 700;

/**
 * Floor on the scale. The smallest window Electron allows is 320px wide, which
 * leaves a ~296px floor: 0.42 of the reference. This bound sits just below that
 * so the real minimum window is still drawn in proportion, and only a
 * pathologically narrow container is clamped.
 */
export const SCENE_SCALE_MIN = 0.4;

/** Ceiling. The authored sizes are the intended maximum. */
export const SCENE_SCALE_MAX = 1;

/** Quantisation step; see "why it is quantised" above. */
export const SCENE_SCALE_STEP = 0.02;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The scene scale for a given rendered room width.
 *
 * Linear in the room's width, because the requirement is that the cast and the
 * set keep the same relationship at every size: if the room is drawn at 80% then
 * so is everything standing in it. Non-finite or non-positive widths (a detached
 * node, a display:none ancestor, a measurement taken before first layout) fall
 * back to the reference scale rather than collapsing the scene to nothing.
 */
export function sceneScaleForRoomWidth(roomWidth: number): number {
  if (!Number.isFinite(roomWidth) || roomWidth <= 0) return SCENE_SCALE_MAX;
  const raw = roomWidth / SCENE_REFERENCE_ROOM_WIDTH;
  const stepped = Math.round(raw / SCENE_SCALE_STEP) * SCENE_SCALE_STEP;
  // Re-round to kill float dust like 0.7200000000000001 so the value written into
  // the CSS variable (and asserted in tests) is exact.
  return clamp(Number(stepped.toFixed(4)), SCENE_SCALE_MIN, SCENE_SCALE_MAX);
}

/** The CSS custom property the scene scale is published through. */
export const SCENE_SCALE_PROPERTY = '--asset-scale';
