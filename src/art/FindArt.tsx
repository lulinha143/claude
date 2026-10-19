import type { OfficeFind } from '../sim/types';

// What a teammate holds out when they found something: one small item per kind
// of room, drawn in the same die-cut sticker style as the emotion stickers so
// the office's little signals read as one family. Inline SVG, no image assets.

const ART: Record<OfficeFind['kind'], JSX.Element> = {
  // a tidy stack of nuts
  operational: (
    <>
      <path className="find__cut" d="M9 30c0-6 7-9 15-9s15 3 15 9-7 9-15 9-15-3-15-9Z" />
      <ellipse className="find__nut" cx="18" cy="29" rx="5.4" ry="4.4" />
      <ellipse className="find__nut" cx="30" cy="29" rx="5.4" ry="4.4" />
      <ellipse className="find__nut" cx="24" cy="23" rx="5.4" ry="4.4" />
      <path className="find__ink" d="M14.5 27.6h7M26.5 27.6h7M20.5 21.6h7" />
    </>
  ),
  // a snack basket
  social: (
    <>
      <path className="find__cut" d="M8 22h32l-4 16H12L8 22Z" />
      <path className="find__ink" d="M14 22c0-6 4.5-10 10-10s10 4 10 10" />
      <circle className="find__berry" cx="18" cy="20" r="3.4" />
      <circle className="find__nut" cx="25" cy="18.6" r="3.8" />
      <circle className="find__berry" cx="31" cy="20.4" r="3" />
      <path className="find__ink find__ink--thin" d="M12 28h24M14 33h20" />
    </>
  ),
  // a curious sample
  analytical: (
    <>
      <path
        className="find__cut"
        d="M19 8h10v11l9 15a4 4 0 0 1-3.4 6H13.4A4 4 0 0 1 10 34l9-15V8Z"
      />
      <path
        className="find__fluid"
        d="M15 30h18l2.6 4.4a1.6 1.6 0 0 1-1.4 2.4H13.8a1.6 1.6 0 0 1-1.4-2.4L15 30Z"
      />
      <path className="find__ink" d="M17 8h14M19 8v11l-9 15M29 8v11l9 15" />
      <circle className="find__bubble" cx="22" cy="25" r="1.6" />
      <circle className="find__bubble" cx="26.5" cy="21.5" r="1.1" />
    </>
  ),
  // a spare bolt, and nuts
  industrial: (
    <>
      <path className="find__cut find__metal" d="m24 8 13 7.5v15L24 38l-13-7.5v-15L24 8Z" />
      <circle className="find__hole" cx="24" cy="23" r="5.2" />
      <path className="find__ink" d="m24 8 13 7.5v15L24 38l-13-7.5v-15L24 8Z" />
      <ellipse className="find__nut" cx="36" cy="35" rx="4.6" ry="3.8" />
    </>
  ),
  // a coin pouch
  secure: (
    <>
      <path
        className="find__cut find__pouch"
        d="M17 14h14l-2.4 4.4C34.6 21 38 26.4 38 31.4 38 37 32 40 24 40s-14-3-14-8.6c0-5 3.4-10.4 9.4-13L17 14Z"
      />
      <path className="find__ink" d="M18.6 18.6h10.8" />
      <circle className="find__coin" cx="24" cy="30" r="5" />
      <path className="find__ink find__ink--thin" d="M24 27.4v5.2" />
    </>
  ),
  // a mystery box
  irregular: (
    <>
      <path className="find__cut find__box" d="M10 18h28v20H10z" />
      <path className="find__lid" d="M8 13h32v6H8z" />
      <path className="find__ribbon" d="M22 13h4v25h-4z" />
      <path className="find__ink" d="M10 18h28v20H10zM8 13h32v6H8z" />
      <path
        className="find__ink find__ink--bold"
        d="M21.4 25.6a2.8 2.8 0 1 1 4 2.5c-.9.5-1.4 1-1.4 2"
      />
      <circle className="find__dot" cx="24" cy="33.2" r="1.3" />
    </>
  ),
};

export function FindArt({ kind }: { kind: OfficeFind['kind'] }) {
  return (
    <svg className={`find find--${kind}`} viewBox="0 0 48 48" focusable="false" aria-hidden>
      {ART[kind]}
    </svg>
  );
}
