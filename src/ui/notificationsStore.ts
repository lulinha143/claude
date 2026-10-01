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
  /** The last few notes, newest first, so a toast you missed can still be read. */
  history: Toast[];
  push: (toast: { icon: IconName; text: string; tone?: ToastTone }) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;
const MAX_QUEUE = 32;
const MAX_HISTORY = 12;
const GROUP_WINDOW_MS = 8_000;

function remember(history: Toast[], toast: Toast): Toast[] {
  const rest = history.filter((entry) => entry.id !== toast.id);
  return [toast, ...rest].slice(0, MAX_HISTORY);
}

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  history: [],
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
      const updated = { ...repeated, at: now, count: repeated.count + 1 };
      set({
        items: queued.map((toast) => (toast.id === repeated.id ? updated : toast)),
        history: remember(get().history, updated),
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
    set({ items: next, history: remember(get().history, toast) });
  },
  dismiss: (id) => set({ items: get().items.filter((toast) => toast.id !== id) }),
  clear: () => set({ items: [] }),
}));

/** Convenience for non-hook callers (for example, the engine subscriber). */
export function notify(icon: IconName, text: string, tone: ToastTone = 'neutral'): void {
  useNotifications.getState().push({ icon, text, tone });
}
