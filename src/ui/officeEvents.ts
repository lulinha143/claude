// Tiny cross-component bridge: ask the office tower to bring a floor into view
// (the next-step note, discoveries, "Arrange in office"...). Kept dependency-free
// so both the shell and the scene can import it without importing each other.

export const FOCUS_FLOOR_EVENT = 'zw:focus-floor';

export function focusFloor(roomId: string): void {
  window.dispatchEvent(new CustomEvent(FOCUS_FLOOR_EVENT, { detail: { roomId } }));
}
