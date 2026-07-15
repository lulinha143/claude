import { cloneElement, useEffect, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';

// Lightweight, non-invasive tooltip system. A single fixed layer (TooltipLayer)
// renders the active tooltip via a portal to <body>, so it never clips against
// the app's overflow:hidden frame and never disturbs the layout of the element
// it describes. Elements opt in with the <Tip> wrapper (which clones its child
// and attaches hover/focus handlers) — no extra DOM nodes, and keyboard
// accessible via focus/blur.

interface TipState {
  content: ReactNode | null;
  rect: DOMRect | null;
  show: (content: ReactNode, rect: DOMRect) => void;
  hide: () => void;
}

const useTip = create<TipState>((set) => ({
  content: null,
  rect: null,
  show: (content, rect) => set({ content, rect }),
  hide: () => set({ content: null, rect: null }),
}));

interface HoverHandlers {
  onMouseEnter?: (e: SyntheticEvent) => void;
  onMouseLeave?: () => void;
  onFocus?: (e: SyntheticEvent) => void;
  onBlur?: () => void;
}

/** Returns handlers to spread onto a single element (top-level use only). */
export function useTooltip(content: ReactNode): HoverHandlers {
  const show = useTip((s) => s.show);
  const hide = useTip((s) => s.hide);
  if (content == null || content === '') return {};
  const open = (e: SyntheticEvent) => show(content, (e.currentTarget as Element).getBoundingClientRect());
  return { onMouseEnter: open, onMouseLeave: hide, onFocus: open, onBlur: hide };
}

/** Wrap a single element to give it a tooltip (safe inside lists). */
export function Tip({ content, children }: { content: ReactNode; children: ReactElement }) {
  const handlers = useTooltip(content);
  return cloneElement(children, handlers);
}

/** Mount once near the app root. Renders the currently-hovered tooltip. */
export function TooltipLayer() {
  const content = useTip((s) => s.content);
  const rect = useTip((s) => s.rect);
  const hide = useTip((s) => s.hide);

  // Dismiss on scroll/resize so a stale tooltip can never linger or float.
  useEffect(() => {
    if (!content) return;
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [content, hide]);

  if (content == null || !rect || typeof document === 'undefined') return null;

  const cx = rect.left + rect.width / 2;
  const below = rect.top < 96; // flip below near the top edge to avoid clipping
  const x = Math.max(8, Math.min(window.innerWidth - 8, cx));
  const y = below ? rect.bottom + 8 : rect.top - 8;

  return createPortal(
    <div
      className={`tooltip ${below ? 'tooltip--below' : 'tooltip--above'}`}
      style={{ left: `${x}px`, top: `${y}px` }}
      role="tooltip"
    >
      {content}
    </div>,
    document.body,
  );
}

/** Rich tooltip content: a title plus optional explanatory lines. */
export function TipContent({ title, lines }: { title: string; lines?: (string | null | undefined)[] }) {
  return (
    <span className="tooltip__body">
      <strong className="tooltip__title">{title}</strong>
      {lines
        ?.filter((l): l is string => !!l)
        .map((l, i) => (
          <span key={i} className="tooltip__line">
            {l}
          </span>
        ))}
    </span>
  );
}
