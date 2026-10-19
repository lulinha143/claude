// Small marks drawn as shapes rather than typed as characters: symbols such as
// ♥ ★ ✦ are missing from the game's fonts and would fall back to whatever the
// player's system happens to have (or to an empty box).
export type GlyphName =
  | 'heart'
  | 'star'
  | 'sparkle'
  | 'note'
  | 'smile'
  | 'dots'
  | 'plus'
  | 'tilde'
  | 'question'
  // the five room routines
  | 'cup'
  | 'wrench'
  | 'eye'
  | 'parcel'
  | 'dial'
  // something to look at more closely
  | 'lens'
  // go on: "have a chat"
  | 'arrow';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SHAPES: Record<GlyphName, JSX.Element> = {
  heart: (
    <path fill="currentColor" d="M8 14.2 2.3 8.6A3.5 3.5 0 0 1 8 3.9a3.5 3.5 0 0 1 5.7 4.7Z" />
  ),
  star: (
    <path
      fill="currentColor"
      d="m8 1.4 2 4.2 4.6.6-3.4 3.1.9 4.6L8 11.6l-4.1 2.3.9-4.6-3.4-3.1 4.6-.6Z"
    />
  ),
  sparkle: (
    <path
      fill="currentColor"
      d="M8 1.2c.7 4 2.8 6.1 6.8 6.8-4 .7-6.1 2.8-6.8 6.8-.7-4-2.8-6.1-6.8-6.8 4-.7 6.1-2.8 6.8-6.8Z"
    />
  ),
  note: (
    <>
      <path
        fill="currentColor"
        d="m2.6 13.4 1-3.8 7-7a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3l-7 7Z"
      />
    </>
  ),
  smile: (
    <>
      <circle cx="8" cy="8" r="6" {...STROKE} strokeWidth={1.8} />
      <path d="M5.4 9.4a3.1 3.1 0 0 0 5.2 0" {...STROKE} strokeWidth={1.6} />
      <circle cx="6" cy="6.5" r="1" fill="currentColor" />
      <circle cx="10" cy="6.5" r="1" fill="currentColor" />
    </>
  ),
  dots: (
    <>
      <circle cx="3.4" cy="9" r="1.6" fill="currentColor" />
      <circle cx="8" cy="9" r="1.6" fill="currentColor" />
      <circle cx="12.6" cy="9" r="1.6" fill="currentColor" />
    </>
  ),
  plus: <path d="M8 3.2v9.6M3.2 8h9.6" {...STROKE} strokeWidth={2.4} />,
  tilde: <path d="M2.4 9.4c1.7-2.6 3.4-2.6 4.8-.9s3.2 1.7 4.6-.9" {...STROKE} strokeWidth={2.2} />,
  arrow: <path d="M3 8h9.2M8.6 4.2 12.4 8l-3.8 3.8" {...STROKE} strokeWidth={2.2} />,
  question: (
    <>
      <path d="M5.5 5.9a2.6 2.6 0 1 1 3.6 2.4c-.8.3-1.1.9-1.1 1.6v.3" {...STROKE} strokeWidth={2} />
      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
    </>
  ),
  cup: (
    <>
      <path d="M3 6.5h8v3.6a3.6 3.6 0 0 1-3.6 3.6h-.8A3.6 3.6 0 0 1 3 10.1Z" fill="currentColor" />
      <path d="M11 7.6h1.1a1.8 1.8 0 0 1 0 3.6H11" {...STROKE} strokeWidth={1.6} />
      <path d="M5.4 4.6q-.8-1.2 0-2.4M8.4 4.6q-.8-1.2 0-2.4" {...STROKE} strokeWidth={1.4} />
    </>
  ),
  wrench: (
    <path
      fill="currentColor"
      d="M10.9 1.6a3.6 3.6 0 0 0-3.4 4.8L2.2 11.7a1.5 1.5 0 0 0 2.1 2.1l5.3-5.3a3.6 3.6 0 0 0 4.8-3.4l-2.1 2.1-2-.6-.6-2Z"
    />
  ),
  eye: (
    <>
      <path
        d="M1.4 8s2.6-4.6 6.6-4.6S14.6 8 14.6 8s-2.6 4.6-6.6 4.6S1.4 8 1.4 8Z"
        {...STROKE}
        strokeWidth={1.7}
      />
      <circle cx="8" cy="8" r="2.1" fill="currentColor" />
    </>
  ),
  parcel: (
    <>
      <path d="M2.2 5.2 8 2.4l5.8 2.8v6.2L8 14.2l-5.8-2.8Z" fill="currentColor" />
      <path d="m2.4 5.3 5.6 2.8 5.6-2.8M8 8.1v6" stroke="#fffaf0" strokeWidth={1.2} fill="none" />
    </>
  ),
  dial: (
    <>
      <circle cx="8" cy="8.6" r="5.6" {...STROKE} strokeWidth={1.8} />
      <path d="m8 8.6 2.6-2.8" {...STROKE} strokeWidth={2} />
      <circle cx="8" cy="8.6" r="1.2" fill="currentColor" />
    </>
  ),
  lens: (
    <>
      <circle cx="6.8" cy="6.8" r="4.3" {...STROKE} strokeWidth={2} />
      <path d="m10 10 3.8 3.8" {...STROKE} strokeWidth={2.6} />
    </>
  ),
};

export function Glyph({ name, size = 12 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      className={`glyph glyph--${name}`}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
