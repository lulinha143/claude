import { useId } from 'react';
import { GAME_TITLE } from '../brand';

// ZooWorkers brand mark: a friendly animal peeking over an office desk inside a
// warm rounded badge, with a cozy window glow behind. It reads instantly as
// "an adorable animal, at work" — cute + wholesome + professional — and stays
// legible from a Steam-capsule size down to a small in-app emblem.
export function BrandEmblem({ size = 64, title }: { size?: number; title?: string }) {
  const uid = useId().replace(/:/g, '');
  const grad = `zw-badge-${uid}`;
  const glow = `zw-glow-${uid}`;
  return (
    <svg
      className="brand-emblem"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7dda7" />
          <stop offset="1" stopColor="#e1a659" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.42" r="0.55">
          <stop offset="0" stopColor="#fff6da" />
          <stop offset="1" stopColor="#fff6da" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* warm rounded badge */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${grad})`} stroke="#7a4f28" strokeWidth="3" />
      <rect x="5.5" y="5.5" width="53" height="53" rx="12.5" fill="none" stroke="#fff3d4" strokeOpacity="0.5" strokeWidth="1.5" />

      {/* cozy office window glow + arch behind the worker */}
      <ellipse cx="32" cy="27" rx="17" ry="17" fill={`url(#${glow})`} />
      <path d="M19 31 V22 a13 13 0 0 1 26 0 V31" fill="none" stroke="#8a5c2f" strokeWidth="2.2" opacity="0.5" />
      <path d="M32 9 V31 M19.5 22 H44.5" stroke="#8a5c2f" strokeWidth="1.5" opacity="0.32" />

      {/* ears */}
      <circle cx="24" cy="24" r="6" fill="#cf8f4a" stroke="#3a2817" strokeWidth="2" />
      <circle cx="40" cy="24" r="6" fill="#cf8f4a" stroke="#3a2817" strokeWidth="2" />
      <circle cx="24" cy="24" r="2.6" fill="#a9702f" />
      <circle cx="40" cy="24" r="2.6" fill="#a9702f" />

      {/* head */}
      <circle cx="32" cy="34" r="13" fill="#d99a54" stroke="#3a2817" strokeWidth="2.4" />
      <ellipse cx="32" cy="39" rx="7.2" ry="5" fill="#f2d8a8" />
      <circle cx="27.4" cy="33" r="2.1" fill="#3a2817" />
      <circle cx="36.6" cy="33" r="2.1" fill="#3a2817" />
      <circle cx="27" cy="32.3" r="0.7" fill="#fff" />
      <circle cx="36.2" cy="32.3" r="0.7" fill="#fff" />
      <circle cx="32" cy="37.4" r="1.9" fill="#3a2817" />
      <path d="M29 41 q3 2.2 6 0" fill="none" stroke="#3a2817" strokeWidth="1.4" strokeLinecap="round" />

      {/* a little office bow-tie, peeking above the desk */}
      <path d="M32 44 l-4.5 -3 v6 Z" fill="#4f9d69" stroke="#2f5f42" strokeWidth="1" />
      <path d="M32 44 l4.5 -3 v6 Z" fill="#4f9d69" stroke="#2f5f42" strokeWidth="1" />
      <circle cx="32" cy="44" r="1.4" fill="#3c7d54" />

      {/* the desk the whole company works at */}
      <rect x="6" y="46" width="52" height="10" rx="3.5" fill="#a9702f" stroke="#5f3d1c" strokeWidth="2" />
      <rect x="8.5" y="47.5" width="47" height="2" rx="1" fill="#d99a54" />
    </svg>
  );
}

// Emblem stacked above the wordmark — used where the game introduces itself.
export function BrandLogo({ size = 76 }: { size?: number }) {
  return (
    <span className="brand-logo">
      <BrandEmblem size={size} title={GAME_TITLE} />
      <span className="brand-logo__wordmark">{GAME_TITLE}</span>
    </span>
  );
}
