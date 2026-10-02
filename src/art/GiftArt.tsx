import type { GiftId } from '../content/characters';

// The six presents, as small inline drawings in the same sticker family as the
// emotion stickers and finds (no image assets).
const ART: Record<GiftId, JSX.Element> = {
  coffee: (
    <>
      <path className="gift__cut" d="M11 18h22v13a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9V18Z" />
      <path className="gift__ink" d="M33 21h3a4.5 4.5 0 0 1 0 9h-3" />
      <path className="gift__ink" d="M11 18h22v13a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9V18Z" />
      <path className="gift__steam" d="M17 13q-2-3 0-6M23 13q-2-3 0-6M29 13q-2-3 0-6" />
    </>
  ),
  acorn: (
    <>
      <path className="gift__nut" d="M13 22h22c0 10-5 18-11 18s-11-8-11-18Z" />
      <path className="gift__cap" d="M11 22c0-6 6-10 13-10s13 4 13 10H11Z" />
      <path className="gift__ink" d="M24 12V7M13 22c0 10 5 18 11 18s11-8 11-18M11 22h26" />
    </>
  ),
  golden: (
    <>
      <path className="gift__gold" d="M13 22h22c0 10-5 18-11 18s-11-8-11-18Z" />
      <path className="gift__gold-cap" d="M11 22c0-6 6-10 13-10s13 4 13 10H11Z" />
      <path className="gift__ink" d="M24 12V7M13 22c0 10 5 18 11 18s11-8 11-18M11 22h26" />
      <path
        className="gift__shine"
        d="m37 9 1.2 2.6L41 13l-2.8 1.4L37 17l-1.2-2.6L33 13l2.8-1.4Z"
      />
    </>
  ),
  plant: (
    <>
      <path className="gift__pot" d="M14 29h20l-3 12H17l-3-12Z" />
      <path
        className="gift__leaf"
        d="M24 29c-1-8-7-11-12-10 0 6 5 10 12 10ZM24 29c1-9 6-14 13-13 0 7-5 13-13 13Z"
      />
      <path className="gift__ink" d="M14 29h20l-3 12H17l-3-12ZM24 29v-9" />
    </>
  ),
  puzzle: (
    <>
      <path className="gift__box" d="M10 16h28v24H10z" />
      <path
        className="gift__piece"
        d="M17 22h6a2.6 2.6 0 1 1 4 0h4v6a2.6 2.6 0 1 0 0 4v4h-6a2.6 2.6 0 1 0-4 0h-4Z"
      />
      <path className="gift__ink" d="M10 16h28v24H10zM10 16l5-6h18l5 6" />
    </>
  ),
  scarf: (
    <>
      <path className="gift__scarf" d="M10 14c9 5 19 5 28 0l-2 9c-8 4-16 4-24 0Z" />
      <path className="gift__scarf" d="M28 22v17l6 2V21Z" />
      <path className="gift__stripe" d="M29 27h5M29 32h5M14 18l1 4M22 19.5v4.5M30 18l-1 4" />
      <path className="gift__ink" d="M10 14c9 5 19 5 28 0l-2 9c-8 4-16 4-24 0ZM28 22v17l6 2V21" />
    </>
  ),
};

export function GiftArt({ gift }: { gift: GiftId }) {
  return (
    <svg className={`gift gift--${gift}`} viewBox="0 0 48 48" focusable="false" aria-hidden>
      {ART[gift]}
    </svg>
  );
}
