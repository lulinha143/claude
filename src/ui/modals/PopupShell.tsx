import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { INTERACTION_FOCUS_EVENT } from '../interactionLifecycle';

export type PopupVariant =
  | 'standard'
  | 'reward'
  | 'employee'
  | 'choice'
  | 'warning'
  | 'critical'
  | 'minigame-result'
  | 'unlock'
  | 'decoration';

interface PopupShellProps {
  variant?: PopupVariant;
  className?: string;
  titleId?: string;
  ariaLabel?: string;
  children: ReactNode;
  actions?: ReactNode;
  closing?: boolean;
  onDismiss?: () => void;
  closeOnBackdrop?: boolean;
}

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Shared accessible popup frame styled as a small piece of office stationery. */
export function PopupShell({
  variant = 'standard',
  className = '',
  titleId,
  ariaLabel,
  children,
  actions,
  closing = false,
  onDismiss,
  closeOnBackdrop = false,
}: PopupShellProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const wasClosingRef = useRef(closing);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const popup = popupRef.current;
    const first = popup?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? popup)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!popupRef.current) return;
      if (event.key === 'Escape' && dismissRef.current) {
        event.preventDefault();
        dismissRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...popupRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        popupRef.current.focus();
        return;
      }
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    function restorePopupFocus() {
      window.requestAnimationFrame(() => {
        const activePopup = popupRef.current;
        if (!activePopup || activePopup.contains(document.activeElement)) return;
        const firstFocusable = activePopup.querySelector<HTMLElement>(FOCUSABLE);
        (firstFocusable ?? activePopup).focus({ preventScroll: true });
      });
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') restorePopupFocus();
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', restorePopupFocus);
    window.addEventListener(INTERACTION_FOCUS_EVENT, restorePopupFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', restorePopupFocus);
      window.removeEventListener(INTERACTION_FOCUS_EVENT, restorePopupFocus);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  // A window can regain focus while the exit animation has every action
  // disabled, which intentionally focuses the dialog itself. If that exit
  // advances a chained popup, move focus to its newly enabled first action.
  useEffect(() => {
    const finishedClosing = wasClosingRef.current && !closing;
    wasClosingRef.current = closing;
    if (!finishedClosing) return;
    const frame = window.requestAnimationFrame(() => {
      const popup = popupRef.current;
      const first = popup?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? popup)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [closing]);

  const urgent = variant === 'warning' || variant === 'critical';
  return (
    <div
      className={`popup-backdrop ${closing ? 'is-closing' : ''}`}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onDismiss?.();
      }}
    >
      <div
        ref={popupRef}
        className={`popup popup--${variant} ${className}`.trim()}
        role={urgent ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : ariaLabel}
        tabIndex={-1}
      >
        <span className="popup__folder-tab" aria-hidden="true" />
        <span className="popup__clip" aria-hidden="true" />
        <span className="popup__tape" aria-hidden="true" />
        <div className="popup__content">{children}</div>
        {actions ? <div className="popup__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Delays state-changing close actions just long enough to show the exit motion. */
export function usePopupExit() {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const exitThen = useCallback((action: () => void) => {
    // The timer is also the single-flight lock: a rapid second activation must
    // not apply the same action twice while the exit animation is playing.
    if (timer.current !== null) return;
    setClosing(true);
    const reduced =
      document.documentElement.dataset.reducedMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(() => {
      // Event and consequence modal components remain mounted while returning
      // null. Release both pieces of state before they are reused for a chain
      // step or a later popup; otherwise every future action stays disabled.
      timer.current = null;
      try {
        action();
      } finally {
        setClosing(false);
      }
    }, reduced ? 0 : 130);
  }, []);

  return { closing, exitThen };
}
