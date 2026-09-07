export const INTERACTION_CANCEL_EVENT = 'wmno:interaction-cancel';
export const INTERACTION_FOCUS_EVENT = 'wmno:interaction-focus';

export type InteractionCancelReason =
  'window-blur' | 'window-focus' | 'document-hidden' | 'platform-blur' | 'platform-focus';

/**
 * Cancels renderer-local transient pointer state without touching committed
 * game data. The event is intentionally global: a pointer stream can be lost
 * while its owning component is behind a portal or while Electron is blurred.
 */
export function cancelTransientInteractions(reason: InteractionCancelReason): void {
  window.dispatchEvent(new CustomEvent(INTERACTION_CANCEL_EVENT, { detail: { reason } }));
}

/** Lets focus traps and cancelled drags restore a sensible target after the OS returns focus. */
export function restoreTransientInteractionFocus(): void {
  window.dispatchEvent(new Event(INTERACTION_FOCUS_EVENT));
}
