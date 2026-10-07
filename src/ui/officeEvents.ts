// Tiny cross-component bridge: ask the office tower to bring a floor into view
// (the next-step note, discoveries, "Arrange in office"...). Kept dependency-free
// so both the shell and the scene can import it without importing each other.

export const FOCUS_FLOOR_EVENT = 'zw:focus-floor';

export function focusFloor(roomId: string): void {
  window.dispatchEvent(new CustomEvent(FOCUS_FLOOR_EVENT, { detail: { roomId } }));
}

/** Something was just bought from the office: the room it serves reacts. */
export const PURCHASE_EVENT = 'zw:purchase';

export interface PurchaseDetail {
  /** what was bought, already localized. */
  title: string;
  /** what it changes ("+0.2/s"), already localized; null when it says nothing. */
  gain: string | null;
  /** a hire or promotion: that teammate's room reacts (otherwise the home floor). */
  employeeId?: string;
}

export function announcePurchase(detail: PurchaseDetail): void {
  window.dispatchEvent(new CustomEvent<PurchaseDetail>(PURCHASE_EVENT, { detail }));
}
