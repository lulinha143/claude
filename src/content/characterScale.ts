// How large characters are drawn on screen.
//
// This lives in `content/` rather than `art/` on purpose: it is authored tuning
// data, and BOTH the framework-free layout layer (`content/roomLayout.ts`) and the
// React renderers (`art/employeeSprites.ts`, `art/OfficeScene.tsx`) need it. Per
// CONTRIBUTING, `src/sim` and `src/content` must not import React, so the shared
// constant cannot live next to the sprite components.

/**
 * Global presence multiplier applied to every character's RENDERED size.
 *
 * The source artwork is never touched — this is purely a layout-layer knob, and it
 * is the single place the on-screen character scale is decided. It multiplies the
 * authored `officeHeight` / `cardHeight` only; a sprite's `frameWidth` /
 * `frameHeight` stay at their intrinsic values because they are the aspect-ratio
 * source that `EmployeeSprite` derives width from (see the geometry contract
 * there, and note that deriving width is what keeps Pip from being squashed).
 *
 * Everything that must stay in proportion with the characters keys off this same
 * constant instead of hard-coding its own factor:
 *   - `.floor` / `.floor__stage` heights and the contact ellipse (styles.css, via
 *     the `--character-presence` custom property set in App.tsx)
 *   - the SVG fallback critter sizes (OfficeScene / EmployeesView)
 *   - the character-slot horizontal spread and depth rhythm (content/roomLayout.ts)
 */
export const CHARACTER_PRESENCE_SCALE = 1.2;

/** Round a rendered dimension through the global presence multiplier. */
export function presenceSize(base: number): number {
  return Math.round(base * CHARACTER_PRESENCE_SCALE);
}

/* ---------------------------------------------------------------------------
 * The cast scale: one visible figure height for everybody.
 *
 * A character's BOX is not its size. Two kinds of artwork sit in this game, and
 * both frame their subject with slack:
 *
 *   - the photographic APNGs, whose canvases keep between 89% and 99% of their
 *     height as actual animal (measured in assets/sources/characters/figure-metrics.json)
 *   - the code-drawn fallback critters, which occupy 92 of their 104-unit viewBox
 *
 * Sizing either one by its box therefore draws figures at whatever scale the
 * padding happens to imply. That is why the roster looked mismatched, and why the
 * vector critters — used by every employee still awaiting artwork — rendered a
 * third smaller than the animals beside them.
 *
 * So the scale is defined once, in terms of the VISIBLE FIGURE, and every renderer
 * converts that into a box using its own art's fill fraction.
 * ------------------------------------------------------------------------- */

/**
 * The reference: Pip's artwork is 92px of squirrel inside a 93px canvas, and her
 * canvas renders at `presenceSize(93)`. Everything else matches the figure height
 * that produces. Pip is the reference because the rooms, desks and dialogue
 * geometry were tuned against her, and because her build is hand-repaired and must
 * not be re-encoded.
 */
const REFERENCE_FIGURE_PX = 92;
const REFERENCE_CANVAS_PX = 93;

/** On-screen height of a character's visible figure, in CSS px. */
export const CHARACTER_FIGURE_HEIGHT =
  (presenceSize(REFERENCE_CANVAS_PX) * REFERENCE_FIGURE_PX) / REFERENCE_CANVAS_PX;

/**
 * The box height that renders a figure at the cast scale, given how much of that
 * box the figure actually fills. `fraction` of 1 means the art is trimmed tight.
 */
export function figureBoxHeight(fraction: number, relativeScale = 1): number {
  return Math.round((CHARACTER_FIGURE_HEIGHT * relativeScale) / fraction);
}

/**
 * The fallback critters are drawn into a 100x104 viewBox with their feet on the
 * contact shadow at y=98 and their silhouette starting around y=11 — 92 units of
 * character, confirmed by `getBBox()` in a real browser rather than assumed.
 */
export const VECTOR_CRITTER_FIGURE_FRACTION = 92 / 104;

/** Office diorama size for a code-drawn critter, matched to the sprite cast. */
export const VECTOR_CRITTER_OFFICE_SIZE = figureBoxHeight(VECTOR_CRITTER_FIGURE_FRACTION);

/**
 * Roster-card size for a code-drawn critter. Uses the same card-to-office ratio the
 * sprite registry applies, so a portrait never changes size depending on whether
 * that employee's artwork has landed yet.
 */
export const VECTOR_CRITTER_CARD_SIZE = figureBoxHeight(VECTOR_CRITTER_FIGURE_FRACTION, 1.43);
