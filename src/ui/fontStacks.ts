export type CanvasFontRole = 'display' | 'body' | 'numeric';

/**
 * Canvas cannot resolve CSS custom properties, so exported game art uses the
 * same ordered, offline-safe stacks as the typography tokens.
 */
export const CANVAS_FONT_STACKS: Record<CanvasFontRole, string> = {
  display: "'DynaPuff', 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif",
  body: "'Nunito', 'Avenir Next', 'Segoe UI', system-ui, sans-serif",
  numeric: "'Nunito', ui-rounded, 'Segoe UI', system-ui, sans-serif",
};

export function canvasFont(weight: number, size: number, role: CanvasFontRole): string {
  return `${weight} ${size}px ${CANVAS_FONT_STACKS[role]}`;
}
