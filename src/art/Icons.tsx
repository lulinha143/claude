// Small original SVG props used across the office and UI.

export function Acorn({ size = 40, golden = false }: { size?: number; golden?: boolean }) {
  const cap = golden ? '#b8860b' : '#7a4a24';
  const body = golden ? '#ffd54a' : '#c98a4b';
  const bodyDark = golden ? '#e0a800' : '#a9743b';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="acorn">
      <path d="M12 16 q12 -10 24 0 q-2 4 -12 4 q-10 0 -12 -4 Z" fill={cap} />
      <path d="M23 6 q1 -4 3 0" stroke={cap} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M14 18 q10 22 20 0 q-10 6 -20 0 Z" fill={body} stroke={bodyDark} strokeWidth="1.2" />
      <ellipse cx="20" cy="26" rx="3" ry="5" fill="#fff" opacity="0.3" />
    </svg>
  );
}

export function Crate({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="crate">
      <rect x="10" y="20" width="44" height="36" rx="4" fill="#b9803f" stroke="#7a4a24" strokeWidth="2" />
      <rect x="10" y="20" width="44" height="10" rx="3" fill="#caa062" stroke="#7a4a24" strokeWidth="1.5" />
      <line x1="20" y1="30" x2="20" y2="56" stroke="#7a4a24" strokeWidth="1.5" />
      <line x1="44" y1="30" x2="44" y2="56" stroke="#7a4a24" strokeWidth="1.5" />
      <circle cx="26" cy="18" r="6" fill="#c98a4b" stroke="#7a4a24" strokeWidth="1" />
      <circle cx="36" cy="16" r="6" fill="#c98a4b" stroke="#7a4a24" strokeWidth="1" />
      <circle cx="32" cy="20" r="6" fill="#d69a58" stroke="#7a4a24" strokeWidth="1" />
    </svg>
  );
}

export function GoldenNut({ size = 24 }: { size?: number }) {
  return <Acorn size={size} golden />;
}

export function NutDot({ color, size = 28 }: { color: string; size?: number }) {
  const d = shade(color, -0.3);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="nut">
      <ellipse cx="16" cy="18" rx="10" ry="12" fill={color} stroke={d} strokeWidth="1.2" />
      <path d="M8 12 q8 -8 16 0 q-2 3 -8 3 q-6 0 -8 -3 Z" fill={d} />
      <ellipse cx="12" cy="16" rx="2" ry="3" fill="#fff" opacity="0.35" />
    </svg>
  );
}

function shade(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.replace(/(.)/g, '$1$1') : c, 16);
  const r = clamp(((num >> 16) & 0xff) + 255 * amount);
  const g = clamp(((num >> 8) & 0xff) + 255 * amount);
  const b = clamp((num & 0xff) + 255 * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
