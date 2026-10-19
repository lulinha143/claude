import type { CSSProperties } from 'react';
import type { EmployeeMood } from '../sim/types';

// Emotion stickers: the office's mood language.
//
// Fifteen moods exist in the simulation; on screen they read as nine stickers,
// each with its own die-cut SILHOUETTE as well as its own colour and glyph, so
// two different feelings never look alike even when the sticker is 24px across
// in a corner window. Everything is drawn here (no image assets): a soft drop
// shadow, a dark contour for contrast on pale walls, the white die-cut border,
// the coloured sticker, then the ink.

export type StickerKind =
  'joy' | 'proud' | 'calm' | 'focused' | 'idea' | 'curious' | 'sleepy' | 'stressed' | 'upset';

export const STICKER_FOR_MOOD: Record<EmployeeMood, StickerKind> = {
  happy: 'joy',
  excited: 'joy',
  proud: 'proud',
  relaxed: 'calm',
  focused: 'focused',
  inspired: 'idea',
  curious: 'curious',
  suspicious: 'curious',
  tired: 'sleepy',
  frustrated: 'stressed',
  worried: 'stressed',
  overcaffeinated: 'stressed',
  embarrassed: 'stressed',
  angry: 'upset',
  sad: 'upset',
};

const FILL: Record<StickerKind, string> = {
  joy: '#ffd44d',
  proud: '#f7b53b',
  calm: '#9edcb0',
  focused: '#8ec8f2',
  idea: '#ffe07a',
  curious: '#c9b3ef',
  sleepy: '#a9bde8',
  stressed: '#ffa47c',
  upset: '#b7c1cf',
};

function burst(cx: number, cy: number, points: number, outer: number, inner: number): string {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? inner : outer;
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)} `;
  }
  return `${d}Z`;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

/** The die-cut outline of each sticker (48×48 art box). */
const SHAPE: Record<StickerKind, string> = {
  joy: burst(24, 24, 12, 20, 16.6),
  proud: burst(24, 25.5, 5, 21.5, 12),
  calm: circle(24, 24, 17),
  focused: 'M12 8h24a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6Z',
  idea:
    'M24 4.5a14.5 14.5 0 0 1 8.7 26.1c-1.3 1-2 2.3-2 3.9v1.5H17.3v-1.5c0-1.6-.7-2.9-2-3.9A14.5 14.5 0 0 1 24 4.5Z' +
    'M17.6 37.6h12.8v2.6a3.6 3.6 0 0 1-3.6 3.6h-5.6a3.6 3.6 0 0 1-3.6-3.6Z',
  curious:
    'M24 7c9.4 0 17 6.7 17 15s-7.6 15-17 15c-1.9 0-3.7-.3-5.4-.8l-6.6 4.3 1.6-6.9C9.5 30.9 7 26.7 7 22c0-8.3 7.6-15 17-15Z',
  sleepy: `${circle(21, 27, 14)}${circle(36, 12, 7)}`,
  stressed: 'M24 5S39 19.5 39 28.5a15 15 0 0 1-30 0C9 19.5 24 5 24 5Z',
  upset: 'M14 36A8 8 0 0 1 12.5 21.5 10.5 10.5 0 0 1 31.5 17.5 9.5 9.5 0 0 1 34 36Z',
};

function Glyph({ kind }: { kind: StickerKind }) {
  switch (kind) {
    case 'joy':
      return (
        <>
          <path className="sticker__ink" d="M16.6 22.4q2.6-3.4 5.2 0M26.2 22.4q2.6-3.4 5.2 0" />
          <path className="sticker__ink-fill" d="M17.4 26.2h13.2q0 7.4-6.6 7.4t-6.6-7.4Z" />
          <ellipse cx="24" cy="31.4" rx="3.1" ry="1.5" fill="#ff8f8f" />
          <ellipse className="sticker__blush" cx="14.6" cy="27.2" rx="2.3" ry="1.4" />
          <ellipse className="sticker__blush" cx="33.4" cy="27.2" rx="2.3" ry="1.4" />
        </>
      );
    case 'proud':
      return (
        <>
          <path className="sticker__ink" d="M18.4 24.3q2.1 2.2 4.2 0M25.4 24.3q2.1 2.2 4.2 0" />
          <path className="sticker__ink" d="M20.2 29.2q3.8 2.8 7.6-.8" />
          <path className="sticker__shine" d="m33.5 10.5.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9Z" />
        </>
      );
    case 'calm':
      return (
        <>
          <path className="sticker__ink" d="M16.4 23.2q2.6 2.4 5.2 0M26.4 23.2q2.6 2.4 5.2 0" />
          <path className="sticker__ink" d="M20.2 28.8q3.8 2.6 7.6 0" />
          <path
            className="sticker__leaf"
            d="M24 13.4c-.6-3.4 1.8-5.6 5.4-5.6.2 3.4-2 5.8-5.4 5.6Z"
          />
          <ellipse className="sticker__blush" cx="15.4" cy="27.4" rx="2" ry="1.2" />
          <ellipse className="sticker__blush" cx="32.6" cy="27.4" rx="2" ry="1.2" />
        </>
      );
    case 'focused':
      // Level brows and a firm little mouth (determined, not cross), with
      // concentration ticks in the corner.
      return (
        <>
          <path className="sticker__ink" d="M15.6 19.4h6M26.4 19.4h6" />
          <circle className="sticker__ink-fill" cx="18.8" cy="24.6" r="2.1" />
          <circle className="sticker__ink-fill" cx="29.2" cy="24.6" r="2.1" />
          <path className="sticker__ink" d="M21 31.2q3 1.4 6 0" />
          <path
            className="sticker__ink sticker__ink--thin"
            d="m33.6 13.4 2.6-2.6M35.2 16.6h3M31 12l.7-2.8"
          />
        </>
      );
    case 'idea':
      return (
        <>
          <path className="sticker__ink" d="m19 22.6 2.5-3.6 2.5 3.6 2.5-3.6 2.5 3.6M24 22.6v7.2" />
          <path className="sticker__ink sticker__ink--thin" d="M19.4 40.2h9.2" />
          <path className="sticker__gloss" d="M15.8 13.6a10 10 0 0 1 5-4.6" />
        </>
      );
    case 'curious':
      return (
        <>
          <path
            className="sticker__ink sticker__ink--bold"
            d="M19.4 17.6a4.7 4.7 0 1 1 6.9 4.1c-1.6.9-2.3 1.8-2.3 3.5v.9"
          />
          <circle className="sticker__ink-fill" cx="24" cy="30.6" r="2" />
        </>
      );
    case 'sleepy':
      return (
        <>
          <path className="sticker__ink" d="M13.8 26.2q3 2.2 6 0M22.2 26.2q3 2.2 6 0" />
          <circle className="sticker__ink-fill" cx="21" cy="32.6" r="1.8" />
          <path className="sticker__ink sticker__ink--thin" d="M33.2 9.4h5.6l-5.6 5.4h5.6" />
        </>
      );
    case 'stressed':
      return (
        <>
          <path className="sticker__ink" d="m16.4 24.4 5-2.2M31.6 24.4l-5-2.2" />
          <circle className="sticker__ink-fill" cx="19.2" cy="28" r="1.8" />
          <circle className="sticker__ink-fill" cx="28.8" cy="28" r="1.8" />
          <path
            className="sticker__ink sticker__ink--thin"
            d="M18.6 35.2q1.35-1.6 2.7 0t2.7 0 2.7 0 2.7 0"
          />
          <path className="sticker__drop" d="M34.4 18.6c1.7 2.3 1.7 3.8 0 3.8s-1.7-1.5 0-3.8Z" />
        </>
      );
    case 'upset':
      return (
        <>
          <path className="sticker__ink" d="m16.8 23.4 5 2M31.2 23.4l-5 2" />
          <circle className="sticker__ink-fill" cx="19.6" cy="28" r="1.7" />
          <circle className="sticker__ink-fill" cx="28.4" cy="28" r="1.7" />
          <path className="sticker__ink" d="M20.2 33.4q3.8-2.8 7.6 0" />
        </>
      );
  }
}

/**
 * One emotion sticker. `compact` drops the shadow and contour for the small
 * inline uses (Team rows, the visit header, consequence lists).
 */
export function StickerArt({ kind, compact = false }: { kind: StickerKind; compact?: boolean }) {
  const d = SHAPE[kind];
  return (
    <svg
      className={`sticker sticker--${kind}`}
      viewBox="0 0 48 48"
      focusable="false"
      aria-hidden
      style={{ ['--sticker-fill' as string]: FILL[kind] } as CSSProperties}
    >
      {compact ? null : (
        <>
          <path className="sticker__shadow" d={d} transform="translate(0 1.8)" />
          <path className="sticker__contour" d={d} />
        </>
      )}
      <path className="sticker__cut" d={d} />
      <Glyph kind={kind} />
    </svg>
  );
}

// ---- steady display ----------------------------------------------------------
// The sim's mood is deterministic, but the numbers it reads (morale above all)
// drift continuously, so a teammate sitting right on a threshold could flip
// faces every tick. On screen a new mood has to persist for a moment, and the
// current one stays up for a minimum time, before the sticker changes. An
// event-driven emotion (the player just made a choice) shows at once.
const HOLD_MS = 2500;
const MIN_SHOWN_MS = 6000;

interface Shown {
  mood: EmployeeMood;
  since: number;
  pending: EmployeeMood | null;
  pendingSince: number;
}
const shown = new Map<string, Shown>();

export function steadyMood(
  id: string,
  mood: EmployeeMood,
  now: number,
  immediate = false,
): EmployeeMood {
  const current = shown.get(id);
  if (!current || immediate) {
    if (!current || current.mood !== mood) {
      shown.set(id, { mood, since: now, pending: null, pendingSince: 0 });
    }
    return mood;
  }
  if (current.mood === mood) {
    current.pending = null;
    return mood;
  }
  if (current.pending !== mood) {
    current.pending = mood;
    current.pendingSince = now;
    return current.mood;
  }
  if (now - current.pendingSince >= HOLD_MS && now - current.since >= MIN_SHOWN_MS) {
    shown.set(id, { mood, since: now, pending: null, pendingSince: 0 });
    return mood;
  }
  return current.mood;
}

/** Deterministic little tilt per teammate, so a row of stickers looks hand-placed. */
export function stickerTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 9) - 4) * 1.5;
}
