import { create } from 'zustand';
import type { IconName } from '../art/UiIcon';

// Centralized notification queue. Producers enqueue every meaningful update;
// the renderer decides how many can be shown for the current viewport. Exact
// repeats are folded together, while queued entries stay pending until one of
// the visible cards is dismissed or expires.
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
  count: number;
}

interface NotificationState {
  items: Toast[];
  push: (toast: { icon: IconName; text: string; tone?: ToastTone }) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;
const MAX_QUEUE = 32;
const GROUP_WINDOW_MS = 8_000;

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  push: ({ icon, text, tone = 'neutral' }) => {
    const now = Date.now();
    const queued = get().items;
    const repeated = queued.find(
      (toast) =>
        toast.icon === icon &&
        toast.text === text &&
        toast.tone === tone &&
        now - toast.at < GROUP_WINDOW_MS,
    );

    if (repeated) {
      set({
        items: queued.map((toast) =>
          toast.id === repeated.id ? { ...toast, at: now, count: toast.count + 1 } : toast,
        ),
      });
      return;
    }

    const toast: Toast = { id: nextId++, icon, text, tone, at: now, count: 1 };
    // Keep a bounded queue. Prefer retaining warnings if an extreme burst ever
    // exceeds the cap; routine updates are summarized by the UI while pending.
    const next = [...queued, toast];
    if (next.length > MAX_QUEUE) {
      const routineIndex = next.findIndex((item) => item.tone !== 'negative');
      next.splice(routineIndex >= 0 ? routineIndex : 0, 1);
    }
    set({ items: next });
  },
  dismiss: (id) => set({ items: get().items.filter((toast) => toast.id !== id) }),
  clear: () => set({ items: [] }),
}));

/** Convenience for non-hook callers (for example, the engine subscriber). */
export function notify(icon: IconName, text: string, tone: ToastTone = 'neutral'): void {
  useNotifications.getState().push({ icon, text, tone });
}
