import type { ReactNode } from 'react';

// Authored brass, enamel, felt and glass objects. Their support coordinates
// match the shared placement contract, including tall stands and hanging cords.
const objects: Record<string, ReactNode> = {
  'ribbon-microphone': (
    <>
      <path d="M8 27h8m-4-1V14M7 8v4q0 5 5 5t5-5V8" />
      <rect x="9" y="3" width="6" height="11" rx="3" fill="#b29b63" />
      <path d="M11 5v6m2-6v6" />
    </>
  ),
  'reel-recorder': (
    <>
      <rect x="3" y="12" width="18" height="14" rx="1" fill="#8a6d52" />
      <circle cx="7" cy="10" r="5" fill="#d5c9aa" />
      <circle cx="17" cy="10" r="5" fill="#d5c9aa" />
      <path d="m5 7 4 6m-5-3h6m5-3 4 6m-5-3h6" />
      <rect x="6" y="19" width="7" height="3" fill="#e9dbb3" />
      <circle cx="17" cy="21" r="1.5" fill="#586d5b" />
      <path d="M5 26v1m14-1v1" />
    </>
  ),
  'on-air-sign': (
    <>
      <path d="M5 8V6h14v2" />
      <rect x="2" y="8" width="20" height="12" rx="2" fill="#a16a59" />
      <path d="M5 12v4m3-4v4m4-4v4m3-4v4m3-4v4" stroke="#f7e2bc" />
      <circle cx="5" cy="10" r=".5" fill="#eccc87" stroke="none" />
    </>
  ),
  'acoustic-mobile': (
    <>
      <path d="M12 2v5M3 7h18M5 7v6m7-6v9m7-9v6" />
      <path d="M2 13h6v7H2zm7 3h6v7H9zm7-3h6v7h-6Z" fill="#82907b" />
      <path d="m3 15 4 3m3 0 4 3m3-6 4 3" stroke="#d9d9bf" />
    </>
  ),
  'parts-trolley': (
    <>
      <rect x="2" y="7" width="19" height="16" rx="1" fill="#769184" />
      <path d="M3 6h18V3m-16 9h13M5 17h13" />
      <path d="M10 10h3m-3 5h3m-3 5h3" stroke="#ebe1c7" />
      <circle cx="6" cy="25" r="2" fill="#575b53" />
      <circle cx="18" cy="25" r="2" fill="#575b53" />
    </>
  ),
  'repair-vise': (
    <>
      <path d="M5 27V16h14v11M4 17h16" />
      <path d="M7 10h10v5H7Z" fill="#7c8982" />
      <path d="M6 5h4v6H6zm8 0h4v6h-4Z" fill="#9aa59b" />
      <path d="M3 12h18m-1-3v6" />
      <rect x="4" y="16" width="16" height="4" fill="#b29974" />
    </>
  ),
  'borrow-board': (
    <>
      <rect x="2" y="5" width="20" height="18" fill="#ae9067" />
      <path d="M5 8v8m3-8v8m9-8v8m3-8v8" stroke="#d2ba94" strokeDasharray="1 2" />
      <path d="M5 8v5l2 2 2-2V8m-2 7v4M17 8l3 3-3 2-2-2Z" fill="#a3aaa0" />
      <path d="M12 9v9" stroke="#ece1c6" strokeDasharray="2 2" />
      <path d="M10 20h5" />
    </>
  ),
  'inspection-lamp': (
    <>
      <path d="M12 2v10" />
      <path d="m5 19 3-7h8l3 7Z" fill="#788775" />
      <ellipse cx="12" cy="19" rx="7" ry="2" fill="#e5d8a7" />
      <path d="M11 19v2h2v-2" fill="#f6edce" />
    </>
  ),
  'rain-collector': (
    <>
      <path d="M7 27V13h10v14" fill="#bbcfc3" />
      <path d="M4 8h16l-5 5H9Z" fill="#8ba89b" />
      <path d="M8 21h8v5H8Z" fill="#7aa6a7" stroke="none" />
      <path d="M14 16h2m-2 3h2m-2 3h2M8 2v2m5-4v3m5 0v2" stroke="#709da0" />
    </>
  ),
  'folding-bench': (
    <>
      <path d="M3 27 6 15m15 12-3-12M5 25h14" />
      <path d="M2 18h20v3H2Z" fill="#b69566" />
      <path d="M4 11h16v5H4Z" fill="#b69566" />
      <path d="M6 16v2m12-2v2M5 13h14" />
    </>
  ),
  'growth-chart': (
    <>
      <rect x="4" y="4" width="16" height="21" fill="#ede5c9" />
      <path d="M7 20V9m0 11h10" />
      <path d="m8 18 3-2 2 1 4-7" stroke="#68846a" />
      <path d="M8 7h6" />
      <path d="M3 5h3m12 19h3" stroke="#bea579" strokeWidth="2" />
    </>
  ),
  'glass-chimes': (
    <>
      <path d="M12 2v4M3 6h18M5 6v8m5-8v5m5-5v9m5-9v6" />
      <path d="M4 14h2v9H4zm5-3h2v8H9zm5 4h2v9h-2zm5-3h2v9h-2Z" fill="#b8d2c5" />
      <path d="M10 20v5m-1 0h2" />
    </>
  ),
};

export function AnnexDecorArt({ id, scale = 1 }: { id: string; scale?: number }) {
  const art = objects[id];
  if (!art) return null;
  return (
    <svg width={52 * scale} height={60 * scale} viewBox="0 0 24 28" aria-hidden="true">
      <g fill="none" stroke="#4e554a" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round">
        {art}
      </g>
    </svg>
  );
}
export const ANNEX_DECOR_IDS = Object.keys(objects);
