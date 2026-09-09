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

/** Keep the note this far from the window edges. */
const SAFE_MARGIN = 10;
/**
 * Gap between the character's head and the note's tail.
 *
 * Sized to clear the in-scene mood bubble, which also sits directly above the
 * character — otherwise the note lands on top of it and the two overlap.
 */
const ANCHOR_GAP = 44;

interface Position {
  left: number;
  top: number;
  /** true when the note had to sit BELOW the anchor (no room above). */
  below: boolean;
  /** how far the tail is from the note's left edge, in px. */
  tailLeft: number;
}

export interface SpeechNoteProps {
  /** the speaking teammate's display name. */
  name: string;
  /** the line being said. */
  text: string;
  /** tint taken from the character's mood, so the note still feels like theirs. */
  color: string;
}

/**
 * Renders an invisible anchor in the scene (so it inherits the character's
 * position) and portals the readable note to the body.
 */
export function SpeechNote({ name, text, color }: SpeechNoteProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const noteRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Position | null>(null);

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
      const n = note.getBoundingClientRect();
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;

      // Prefer above the character; flip below only if there is genuinely no room.
      const above = a.top - ANCHOR_GAP - n.height;
      const below = above < SAFE_MARGIN;
      const top = below ? Math.min(vh - n.height - SAFE_MARGIN, a.bottom + ANCHOR_GAP) : above;

      // Centre on the character, then clamp so the note is always fully visible.
      const desiredLeft = a.left + a.width / 2 - n.width / 2;
      const left = Math.max(SAFE_MARGIN, Math.min(desiredLeft, vw - n.width - SAFE_MARGIN));
      // The tail follows the character even after the note has been clamped.
      const tailLeft = Math.max(12, Math.min(n.width - 12, a.left + a.width / 2 - left));

      setPos({ left, top: Math.max(SAFE_MARGIN, top), below, tailLeft });
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    schedule();
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
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      observer.disconnect();
    };
  }, [text, name]);

  const style: CSSProperties = {
    ['--mood-color' as string]: color,
    ['--note-tail' as string]: `${pos?.tailLeft ?? 20}px`,
    left: pos ? `${pos.left}px` : '-9999px',
    top: pos ? `${pos.top}px` : '-9999px',
    // Hidden until measured so it never flashes in the wrong place.
    visibility: pos ? 'visible' : 'hidden',
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
              <span className="speech-note__who">{name}</span>
              <p className="speech-note__body">{text}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
