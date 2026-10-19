import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications, type Toast, type ToastTone } from './notificationsStore';
import { Icon, type IconName } from '../art/UiIcon';
import { useStore } from '../state/store';
import { ReturnNote } from './ReturnNote';

export const NOTIFICATION_PUSH_EVENT = 'wmno:notification';
export const NOTIFICATION_CLEAR_EVENT = 'wmno:notifications-clear';

const BLOCKING_OVERLAYS = '.popup-backdrop, .modal-backdrop, .photo-mode, .talk--destination';

function visibleLimit(): number {
  if (window.innerWidth <= 480) return 1;
  if (window.innerWidth <= 800) return 2;
  return 4;
}

function useVisibleLimit(): number {
  const [limit, setLimit] = useState(visibleLimit);
  useEffect(() => {
    const update = () => setLimit(visibleLimit());
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return limit;
}

function useBlockingOverlay(): boolean {
  const [blocked, setBlocked] = useState(() => Boolean(document.querySelector(BLOCKING_OVERLAYS)));
  useEffect(() => {
    const update = () => setBlocked(Boolean(document.querySelector(BLOCKING_OVERLAYS)));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return blocked;
}

function validTone(value: unknown): value is ToastTone {
  return ['positive', 'negative', 'neutral', 'gold'].includes(String(value));
}

export function Notifications() {
  const { t } = useTranslation();
  const items = useNotifications((state) => state.items);
  const push = useNotifications((state) => state.push);
  const clear = useNotifications((state) => state.clear);
  const viewportLimit = useVisibleLimit();
  const blocked = useBlockingOverlay();
  // The welcome-back note heads the column; it takes one toast's place (on the
  // smallest windows, the only one: the rest wait their turn behind it).
  const returning = useStore((s) => s.returnSummary !== null) && !blocked;
  const limit = Math.max(0, viewportLimit - (returning ? 1 : 0));

  // A small event bridge lets renderer subsystems (and deterministic E2E
  // coverage) enqueue notifications without importing React or the store.
  useEffect(() => {
    const onPush = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail || typeof detail.text !== 'string') return;
      push({
        icon: (typeof detail.icon === 'string' ? detail.icon : 'notification') as IconName,
        text: detail.text,
        tone: validTone(detail.tone) ? detail.tone : 'neutral',
      });
    };
    const onClear = () => clear();
    window.addEventListener(NOTIFICATION_PUSH_EVENT, onPush);
    window.addEventListener(NOTIFICATION_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(NOTIFICATION_PUSH_EVENT, onPush);
      window.removeEventListener(NOTIFICATION_CLEAR_EVENT, onClear);
    };
  }, [clear, push]);

  const visible = useMemo(() => {
    if (blocked) return [];
    return [...items]
      .sort((left, right) => {
        const warningOrder = Number(right.tone === 'negative') - Number(left.tone === 'negative');
        return warningOrder || left.at - right.at;
      })
      .slice(0, limit);
  }, [blocked, items, limit]);
  const visibleIds = new Set(visible.map((toast) => toast.id));
  const queuedCount = items
    .filter((toast) => !visibleIds.has(toast.id))
    .reduce((total, toast) => total + toast.count, 0);

  return (
    <div
      className={`toasts ${visible.length === 0 && !returning ? 'is-empty' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="false"
      data-queue-size={items.length}
    >
      {returning ? <ReturnNote /> : null}
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
      {/* While the welcome back is up, the notes queued behind it wait quietly
          (a count pill under it sat right on the room's desks). */}
      {queuedCount > 0 && !(returning && visible.length === 0) ? (
        <div
          className="toast-summary"
          aria-label={t('notify.additionalUpdates', { count: queuedCount })}
        >
          {t('notify.additionalUpdates', { count: queuedCount })}
        </div>
      ) : null}
    </div>
  );
}

function durationFor(toast: Toast): number {
  if (toast.tone === 'negative') return 6_500;
  if (toast.tone === 'neutral') return 4_200;
  return 2_800;
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useNotifications((state) => state.dismiss);
  const duration = durationFor(toast);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(duration);
  const startedRef = useRef(0);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    startedRef.current = Date.now();
    timeoutRef.current = setTimeout(() => dismiss(toast.id), remainingRef.current);
  }, [clearTimer, dismiss, toast.id]);

  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current));
    clearTimer();
    setPaused(true);
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    if (remainingRef.current <= 0) dismiss(toast.id);
    else startTimer();
  }, [dismiss, startTimer, toast.id]);

  useEffect(() => {
    pausedRef.current = false;
    remainingRef.current = duration;
    setPaused(false);
    startTimer();
    // Hover/focus may pause the ordinary timer, but never beyond this hard cap.
    hardTimeoutRef.current = setTimeout(() => dismiss(toast.id), Math.max(10_000, duration * 2));
    return () => {
      clearTimer();
      if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
      hardTimeoutRef.current = null;
    };
  }, [clearTimer, dismiss, duration, startTimer, toast.at, toast.id]);

  return (
    <button
      className={`toast toast--${toast.tone} ${toast.tone === 'negative' ? 'toast--important' : 'toast--routine'} ${paused ? 'is-paused' : ''}`}
      onClick={() => dismiss(toast.id)}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      title={toast.text}
      aria-label={toast.text}
      style={{ '--toast-duration': `${duration}ms` } as React.CSSProperties}
    >
      <span className="toast__icon">
        <Icon name={toast.icon} size={14} />
      </span>
      <span className="toast__text">{toast.text}</span>
      {toast.count > 1 ? <span className="toast__count">×{toast.count}</span> : null}
      <span className="toast__bar" aria-hidden />
    </button>
  );
}
