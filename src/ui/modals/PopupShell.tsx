import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

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

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const popup = popupRef.current;
    const first = popup?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? popup)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!popupRef.current) return;
      if (event.key === 'Escape' && onDismiss) {
        event.preventDefault();
        onDismiss();
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

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onDismiss]);

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

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const exitThen = useCallback((action: () => void) => {
    if (timer.current !== null) return;
    setClosing(true);
    const reduced = document.documentElement.dataset.reducedMotion === 'true'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(action, reduced ? 0 : 130);
  }, []);

  return { closing, exitThen };
}
