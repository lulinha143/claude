import { create } from 'zustand';
import type { IconName } from '../art/UiIcon';

// Centralized, lightweight notification (toast) system. Notifications are
// resolved to display strings at push time (callers use i18n), carry a tone and
// an icon, are de-duplicated within a short window, and the stack is capped so a
// burst of changes can never flood the screen. The UI announces them politely
// for screen readers and respects reduced motion.
//
// NOTE: this file is intentionally named `notificationsStore.ts` (not
// `notifications.ts`) so it never case-collides with the `Notifications.tsx`
// component on case-insensitive filesystems (Windows/macOS).

export type ToastTone = 'positive' | 'negative' | 'neutral' | 'gold';

export interface Toast {
  id: number;
  icon: IconName;
  text: string;
  tone: ToastTone;
  at: number;
}

interface NotificationState {
  items: Toast[];
  push: (t: { icon: IconName; text: string; tone?: ToastTone }) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;
const MAX_ITEMS = 4;

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  push: ({ icon, text, tone = 'neutral' }) => {
    const now = Date.now();
    const recent = get().items;
    // de-dupe identical text pushed within 1.5s
    if (recent.some((t) => t.text === text && now - t.at < 1500)) return;
    const toast: Toast = { id: nextId++, icon, text, tone, at: now };
    set({ items: [...recent, toast].slice(-MAX_ITEMS) });
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
  clear: () => set({ items: [] }),
}));

/** convenience for non-hook callers (e.g. the store's engine subscriber). */
export function notify(icon: IconName, text: string, tone: ToastTone = 'neutral'): void {
  useNotifications.getState().push({ icon, text, tone });
}
