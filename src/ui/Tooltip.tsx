import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { INTERACTION_CANCEL_EVENT, INTERACTION_FOCUS_EVENT } from './interactionLifecycle';

// Lightweight, non-invasive tooltip system. One fixed layer renders through a
// body portal, so tooltips escape every clipped/scaled app container. Hover and
// keyboard focus are tracked independently: ending one modality never closes a
// tooltip while the other still owns it.

interface TipTarget {
  content: ReactNode;
  anchor: HTMLElement;
  id: string;
  order: number;
}

interface TipState {
  hovered: TipTarget | null;
  focused: TipTarget | null;
  showHovered: (target: Omit<TipTarget, 'order'>) => void;
  hideHovered: (anchor: HTMLElement) => void;
  showFocused: (target: Omit<TipTarget, 'order'>) => void;
  hideFocused: (anchor: HTMLElement) => void;
  hideAll: () => void;
}

let interactionOrder = 0;

const useTip = create<TipState>((set) => ({
  hovered: null,
  focused: null,
  showHovered: (target) => set({ hovered: { ...target, order: ++interactionOrder } }),
  hideHovered: (anchor) =>
    set((state) => (state.hovered?.anchor === anchor ? { hovered: null } : state)),
  showFocused: (target) => set({ focused: { ...target, order: ++interactionOrder } }),
  hideFocused: (anchor) =>
    set((state) => (state.focused?.anchor === anchor ? { focused: null } : state)),
  hideAll: () => set({ hovered: null, focused: null }),
}));

interface TooltipHandlers {
  onMouseEnter?: (event: ReactMouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: ReactMouseEvent<HTMLElement>) => void;
  onFocus?: (event: ReactFocusEvent<HTMLElement>) => void;
  onBlur?: (event: ReactFocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
  /** Pressing the anchor dismisses its tooltip: it has done its job, and a
      tooltip left open over the page the click just opened would cover it. */
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  'aria-describedby'?: string;
}

// The focus that a mouse/touch press gives a button arrives in the same moment as
// the press. Focus from the keyboard, or moved programmatically later, does not.
let lastPressAt = -Infinity;
// True from a press until the pointer really moves again. A click often changes
// what is under a still pointer (a button relabels, a mode opens), and the
// browser reports that as a fresh "enter": that is not the player hovering.
let pressedStill = false;
// The control that was pressed keeps its tooltip closed until the pointer leaves it.
let pressedTarget: Element | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPressAt = performance.now();
      pressedStill = true;
      pressedTarget = event.target instanceof Element ? event.target : null;
    },
    true,
  );
  window.addEventListener(
    'pointermove',
    (event) => {
      if (pressedStill && (event.movementX !== 0 || event.movementY !== 0)) pressedStill = false;
    },
    true,
  );
  // The keyboard is a deliberate new interaction.
  window.addEventListener('keydown', () => (pressedStill = false), true);
}
function pressedHere(anchor: HTMLElement): boolean {
  return Boolean(pressedTarget && (anchor === pressedTarget || anchor.contains(pressedTarget)));
}
function isKeyboardFocus(): boolean {
  return performance.now() - lastPressAt > 80;
}

/** Returns handlers to spread onto one tooltip trigger (top-level use only). */
export function useTooltip(content: ReactNode): TooltipHandlers {
  const id = useId();
  const showHovered = useTip((state) => state.showHovered);
  const hideHovered = useTip((state) => state.hideHovered);
  const showFocused = useTip((state) => state.showFocused);
  const hideFocused = useTip((state) => state.hideFocused);
  const hideAll = useTip((state) => state.hideAll);

  if (content == null || content === '') return {};
  return {
    onMouseEnter: (event) => {
      if (pressedStill || pressedHere(event.currentTarget)) return;
      showHovered({ content, anchor: event.currentTarget, id });
    },
    onMouseLeave: (event) => {
      if (pressedHere(event.currentTarget)) pressedTarget = null;
      hideHovered(event.currentTarget);
    },
    // Keyboard focus only: a mouse click also focuses a button, and a tooltip
    // re-opening over the page the click just opened is exactly what we remove.
    onFocus: (event) => {
      // ...and not on the very control that was just pressed, when a click
      // re-renders it and focus is handed back to it.
      if (isKeyboardFocus() && !(pressedStill && pressedHere(event.currentTarget))) {
        showFocused({ content, anchor: event.currentTarget, id });
      }
    },
    onBlur: (event) => hideFocused(event.currentTarget),
    onKeyDown: (event) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') hideAll();
    },
    onPointerDown: () => hideAll(),
    'aria-describedby': id,
  };
}

type ChildHandlers = TooltipHandlers & {
  'aria-describedby'?: string;
};

function mergeDescriptionIds(first?: string, second?: string): string | undefined {
  const ids = [first, second].filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)].join(' ') : undefined;
}

/** Wrap a single element to give it a tooltip (safe inside lists). */
export function Tip({ content, children }: { content: ReactNode; children: ReactElement }) {
  const tip = useTooltip(content);
  const child = children as ReactElement<ChildHandlers>;
  const props = child.props;
  return cloneElement(child, {
    onMouseEnter: (event) => {
      props.onMouseEnter?.(event);
      if (!event.defaultPrevented) tip.onMouseEnter?.(event);
    },
    onMouseLeave: (event) => {
      props.onMouseLeave?.(event);
      tip.onMouseLeave?.(event);
    },
    onFocus: (event) => {
      props.onFocus?.(event);
      if (!event.defaultPrevented) tip.onFocus?.(event);
    },
    onBlur: (event) => {
      props.onBlur?.(event);
      tip.onBlur?.(event);
    },
    onKeyDown: (event) => {
      props.onKeyDown?.(event);
      if (!event.defaultPrevented) tip.onKeyDown?.(event);
    },
    onPointerDown: (event) => {
      props.onPointerDown?.(event);
      tip.onPointerDown?.(event);
    },
    'aria-describedby': mergeDescriptionIds(props['aria-describedby'], tip['aria-describedby']),
  });
}

interface TooltipPosition {
  left: number;
  top: number;
  side: 'above' | 'below';
}

const SAFE_MARGIN = 8;
const ANCHOR_GAP = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Mount once near the app root. Measures and clamps the active body portal. */
export function TooltipLayer() {
  const hovered = useTip((state) => state.hovered);
  const focused = useTip((state) => state.focused);
  const hideHovered = useTip((state) => state.hideHovered);
  const hideFocused = useTip((state) => state.hideFocused);
  const hideAll = useTip((state) => state.hideAll);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  // The latest real interaction owns the visual tooltip. A new pointer hover
  // therefore overrides stale focus after a click, while a later keyboard
  // focus can still replace a hover left behind under an unmoved pointer.
  const active =
    hovered && focused
      ? hovered.order >= focused.order
        ? hovered
        : focused
      : (hovered ?? focused);
  const inactive = active === hovered ? focused : hovered;

  // Native/Electron focus transitions do not consistently blur the focused
  // element. Clear transient tooltip ownership explicitly so no portal remains
  // stuck over the game after app switching; the next hover/focus works fresh.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hideAll();
    };
    window.addEventListener('blur', hideAll);
    window.addEventListener(INTERACTION_CANCEL_EVENT, hideAll);
    window.addEventListener(INTERACTION_FOCUS_EVENT, hideAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', hideAll);
      window.removeEventListener(INTERACTION_CANCEL_EVENT, hideAll);
      window.removeEventListener(INTERACTION_FOCUS_EVENT, hideAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [hideAll]);

  useEffect(() => {
    if (!active) {
      setPosition(null);
      return;
    }

    let frame = 0;
    const update = () => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      if (!active.anchor.isConnected) {
        if (focused?.anchor === active.anchor) hideFocused(active.anchor);
        else hideHovered(active.anchor);
        return;
      }

      const anchor = active.anchor.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      // Intrinsic CSS sizing uses the layout viewport. Constrain the rendered
      // portal to the live visual viewport before measuring, which also keeps
      // it containable under page zoom and Electron UI scaling.
      tooltip.style.maxWidth = `${Math.max(1, viewportWidth - SAFE_MARGIN * 2)}px`;
      tooltip.style.maxHeight = `${Math.max(1, viewportHeight - SAFE_MARGIN * 2)}px`;
      const measured = tooltip.getBoundingClientRect();
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const roomAbove = anchor.top - viewportTop - SAFE_MARGIN - ANCHOR_GAP;
      const roomBelow = viewportBottom - anchor.bottom - SAFE_MARGIN - ANCHOR_GAP;
      const fitsAbove = measured.height <= roomAbove;
      const fitsBelow = measured.height <= roomBelow;
      /* Prefer above, EXCEPT when going up would cover the header.
         The destination rail sits directly under the header, so "above whenever it
         fits" put every nav tooltip across the resource strip — hiding the live nut
         count, morale and standing, which are exactly the numbers a player is watching
         while they decide where to go. Opening downward there costs nothing: it lands
         on the content area, which the tooltip is describing anyway. */
      const headerRect = document.querySelector('.hud')?.getBoundingClientRect();
      const wouldCoverHeader =
        !!headerRect &&
        anchor.top - ANCHOR_GAP - measured.height < headerRect.bottom &&
        anchor.top >= headerRect.top;
      const side: TooltipPosition['side'] =
        (fitsAbove && !(wouldCoverHeader && fitsBelow)) || (!fitsBelow && roomAbove >= roomBelow)
          ? 'above'
          : 'below';
      const desiredLeft = anchor.left + anchor.width / 2 - measured.width / 2;
      const desiredTop =
        side === 'above' ? anchor.top - ANCHOR_GAP - measured.height : anchor.bottom + ANCHOR_GAP;

      setPosition({
        left: clamp(
          desiredLeft,
          viewportLeft + SAFE_MARGIN,
          viewportRight - SAFE_MARGIN - measured.width,
        ),
        top: clamp(
          desiredTop,
          viewportTop + SAFE_MARGIN,
          viewportBottom - SAFE_MARGIN - measured.height,
        ),
        side,
      });
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    setPosition(null);
    update();
    window.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('scroll', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(active.anchor);
    if (tooltipRef.current) observer.observe(tooltipRef.current);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('scroll', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
      observer.disconnect();
    };
  }, [active, focused, hideFocused, hideHovered]);

  if (!active || typeof document === 'undefined') return null;

  const side = position?.side ?? 'above';
  return createPortal(
    <>
      {inactive && inactive.id !== active.id ? (
        <span id={inactive.id} hidden>
          {inactive.content}
        </span>
      ) : null}
      <div
        ref={tooltipRef}
        id={active.id}
        className={`tooltip tooltip--${side}`}
        style={{
          left: `${position?.left ?? 0}px`,
          top: `${position?.top ?? 0}px`,
          visibility: position ? 'visible' : 'hidden',
        }}
        role="tooltip"
        data-side={side}
      >
        {active.content}
      </div>
    </>,
    document.body,
  );
}

/** Rich tooltip content: a title plus optional explanatory lines. */
export function TipContent({
  title,
  lines,
  titleAriaHidden = false,
}: {
  title: string;
  lines?: (string | null | undefined)[];
  titleAriaHidden?: boolean;
}) {
  return (
    <span className="tooltip__body">
      <strong className="tooltip__title" aria-hidden={titleAriaHidden || undefined}>
        {title}
      </strong>
      {lines
        ?.filter((line): line is string => !!line)
        .map((line, index) => (
          <span key={index} className="tooltip__line">
            {line}
          </span>
        ))}
    </span>
  );
}
