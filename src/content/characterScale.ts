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
