// Small marks drawn as shapes rather than typed as characters: symbols such as
// ♥ ★ ✦ are missing from the game's fonts and would fall back to whatever the
// player's system happens to have (or to an empty box).
export type GlyphName =
  'heart' | 'star' | 'sparkle' | 'note' | 'smile' | 'dots' | 'plus' | 'tilde' | 'question';

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
  question: (
    <>
      <path d="M5.5 5.9a2.6 2.6 0 1 1 3.6 2.4c-.8.3-1.1.9-1.1 1.6v.3" {...STROKE} strokeWidth={2} />
      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
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
