// What a teammate says, presented as a Nutshell Inc. observation note.
//
// WHY THIS IS A PORTAL, NOT AN IN-SCENE BUBBLE
// --------------------------------------------
// The speech used to render inside the character's button, which lives inside
// `.floor` — and `.floor` sets `overflow: hidden` to keep the room illusion. Any
// teammate standing near a room edge therefore had their dialogue sliced off, and
// a hard `max-width: 150px` cap meant longer lines were squeezed into a narrow
// column that could run past the top of the room as well. Both failures hid text
// from the player with no way to recover it.
//
// Rendering the note in a body-level portal removes the clipping ancestor
// entirely, and measuring the anchor lets the note clamp itself into the window.
// The result: the container adapts to the text instead of the text being cut to
// fit the container, at any window size or UI scale.

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../state/store';
import { Glyph } from './Glyph';

/** A side sheet slides in over ~0.34s; measure again once it has landed. */
const SHEET_SETTLE_MS = 380;

/** Keep the note this far from the window edges. */
const SAFE_MARGIN = 10;
/**
 * Gap between the character's head and the note's tail.
 *
 * The anchor IS the teammate's emotion sticker (above their head), so the note
 * only needs a small gap above it.
 */
const ANCHOR_GAP = 8;

interface Position {
  left: number;
  top: number;
  /** true when the note had to sit BELOW the anchor (no room above). */
  below: boolean;
  /** how far the tail is from the note's left edge, in px. */
  tailLeft: number;
  /** the speaker is scrolled out of the office's visible area. */
  offstage: boolean;
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a note may go: the part of the office the player can actually see.
 * Never over the HUD, the dock or an open side sheet: a line of dialogue
 * belongs to the room, not to the interface around it.
 */
function officeBounds(anchor: Element, vw: number, vh: number): Bounds {
  const bounds: Bounds = { left: 0, top: 0, right: vw, bottom: vh };
  const clip = (rect: DOMRect | undefined) => {
    if (!rect) return;
    bounds.left = Math.max(bounds.left, rect.left);
    bounds.top = Math.max(bounds.top, rect.top);
    bounds.right = Math.min(bounds.right, rect.right);
    bounds.bottom = Math.min(bounds.bottom, rect.bottom);
  };
  clip(anchor.closest('.office__view, .office')?.getBoundingClientRect());
  clip(document.querySelector('.app__stage')?.getBoundingClientRect());
  // The tower's own scroller: it stops above the meadow strip that holds the
  // office's notes and controls, so a teammate scrolled down behind that strip
  // is off stage rather than talking over the goal tag.
  clip(anchor.closest('.office')?.querySelector('.office__world')?.getBoundingClientRect());
  // A side sheet covers the right of the stage; keep the note on the office side.
  const sheet = document.querySelector('.sheet')?.getBoundingClientRect();
  if (sheet && sheet.left > bounds.left + 120)
    bounds.right = Math.min(bounds.right, sheet.left - 6);
  return bounds;
}

/** A way into a visit, offered on the note itself. */
export interface SpeechNoteAction {
  label: string;
  onActivate: () => void;
  /** the pointer is on its way to it: keep the note up a moment longer. */
  onHold?: () => void;
}

export interface SpeechNoteProps {
  /** the speaking teammate's display name. */
  name: string;
  /** the line being said. */
  text: string;
  /** tint taken from the character's mood, so the note still feels like theirs. */
  color: string;
  /** an offer the player can take from the note (the note itself stays click-through). */
  action?: SpeechNoteAction;
}

/**
 * Renders an invisible anchor in the scene (so it inherits the character's
 * position) and portals the readable note to the body.
 */
export function SpeechNote({ name, text, color, action }: SpeechNoteProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const noteRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  // Opening or closing a side sheet changes the room's visible width without a
  // scroll or resize, so the note is placed again (it must never sit on a sheet).
  const view = useStore((s) => s.view);
  // An offer makes the note taller: place it again when one appears or goes.
  const hasAction = Boolean(action);

  // Measure after layout so the note's real (wrapped) size is known before it is
  // placed. Re-measured on scroll/resize/zoom and whenever the text changes.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const note = noteRef.current;
      if (!anchor.isConnected || !note) return;
      const a = anchor.getBoundingClientRect();
      // The note's LAYOUT size, not its painted box: it pops in with a scale
      // animation, and measuring mid-pop placed a shrunken note that then grew
      // past the window edge (a transform never fires the ResizeObserver again).
      const n = { width: note.offsetWidth, height: note.offsetHeight };
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const b = officeBounds(anchor, vw, vh);
      const cx = a.left + a.width / 2;
      const offstage = a.bottom < b.top || a.top > b.bottom || cx < b.left || cx > b.right;

      // Prefer above the character; flip below only if there is genuinely no room.
      const above = a.top - ANCHOR_GAP - n.height;
      const below = above < b.top + SAFE_MARGIN;
      const top = below
        ? Math.min(b.bottom - n.height - SAFE_MARGIN, a.bottom + ANCHOR_GAP)
        : above;

      // Centre on the character, then clamp so the note stays inside the office.
      const desiredLeft = cx - n.width / 2;
      const left = Math.max(
        b.left + SAFE_MARGIN,
        Math.min(desiredLeft, b.right - n.width - SAFE_MARGIN),
      );
      // The tail follows the character even after the note has been clamped.
      const tailLeft = Math.max(12, Math.min(n.width - 12, cx - left));

      setPos({ left, top: Math.max(b.top + SAFE_MARGIN, top), below, tailLeft, offstage });
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    schedule();
    const settle = window.setTimeout(schedule, SHEET_SETTLE_MS);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);

    // The character moves (walking to a prop, being dragged) and the note wraps
    // differently as the window changes, so watch both boxes.
    const observer = new ResizeObserver(schedule);
    observer.observe(anchor);
    if (noteRef.current) observer.observe(noteRef.current);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      observer.disconnect();
    };
  }, [text, name, view, hasAction]);

  const style: CSSProperties = {
    ['--mood-color' as string]: color,
    ['--note-tail' as string]: `${pos?.tailLeft ?? 20}px`,
    left: pos ? `${pos.left}px` : '-9999px',
    top: pos ? `${pos.top}px` : '-9999px',
    // Hidden until measured so it never flashes in the wrong place.
    // ...and while the speaker is scrolled out of view: a note never talks from nowhere.
    visibility: pos && !pos.offstage ? 'visible' : 'hidden',
  };

  return (
    <>
      <span className="speech-anchor" ref={anchorRef} aria-hidden />
      {typeof document !== 'undefined'
        ? createPortal(
            <div
              className={`speech-note ${pos?.below ? 'speech-note--below' : ''}`}
              style={style}
              ref={noteRef}
              role="status"
            >
              {/* The offer rides on the name row, so it adds no more than a line's
                  height: a taller note would flip below and cover the speaker. */}
              <span className="speech-note__head">
                <span className="speech-note__who">{name}</span>
                {action ? (
                  <button
                    type="button"
                    className="speech-note__action"
                    onPointerEnter={action.onHold}
                    onFocus={action.onHold}
                    onClick={action.onActivate}
                  >
                    {action.label}
                    <Glyph name="arrow" size={11} />
                  </button>
                ) : null}
              </span>
              <p className="speech-note__body">{text}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
