import { memo } from 'react';

// Built-in, non-interactive room "dressing" so every room reads as an actual
// office even before the player adds decorations (brief §3/§4). Rendered behind
// the characters (z-index 0 inside the stage). Pure SVG/CSS, one cohesive style,
// tinted by the room's department accent via the inherited `--dept` variable.
//
// It draws, back-to-front: a framed window on the wall, department signage, a
// soft floor rug, and one department-appropriate built-in prop in a back corner.
// These do NOT consume the player's decoration inventory.

type BuiltIn = 'shelf' | 'counter' | 'cabinet' | 'lab' | 'board' | 'toolwall' | 'pipes' | 'plant';

// which built-in fixture suits each room's identity
const ROOM_BUILTIN: Record<string, BuiltIn> = {
  'founder-desk': 'shelf',
  morale: 'counter',
  procurement: 'cabinet',
  sorting: 'cabinet',
  lab: 'lab',
  research: 'lab',
  marketing: 'board',
  construction: 'toolwall',
  vault: 'cabinet',
  basement: 'pipes',
  meeting: 'board',
  nap: 'plant',
  rooftop: 'plant',
};

function BuiltInProp({ kind }: { kind: BuiltIn }) {
  const stroke = '#3a2a18';
  switch (kind) {
    case 'counter': // coffee counter with cups
      return (
        <g>
          <rect x="0" y="14" width="44" height="16" rx="2" fill="#b98a52" stroke={stroke} strokeWidth="1.4" />
          <rect x="4" y="6" width="10" height="8" rx="1" fill="#8a6a44" stroke={stroke} strokeWidth="1" />
          <circle cx="26" cy="11" r="3" fill="#efe0c1" stroke={stroke} strokeWidth="1" />
          <circle cx="34" cy="11" r="3" fill="#efe0c1" stroke={stroke} strokeWidth="1" />
        </g>
      );
    case 'cabinet': // filing / storage cabinet
      return (
        <g>
          <rect x="6" y="2" width="30" height="30" rx="2" fill="#9c7b4f" stroke={stroke} strokeWidth="1.4" />
          <rect x="10" y="6" width="22" height="7" rx="1" fill="#b8935e" stroke={stroke} strokeWidth="0.8" />
          <rect x="10" y="16" width="22" height="7" rx="1" fill="#b8935e" stroke={stroke} strokeWidth="0.8" />
          <rect x="19" y="8.5" width="4" height="2" fill={stroke} />
          <rect x="19" y="18.5" width="4" height="2" fill={stroke} />
        </g>
      );
    case 'lab': // lab bench with flasks
      return (
        <g>
          <rect x="0" y="20" width="46" height="10" rx="2" fill="#8f9aa8" stroke={stroke} strokeWidth="1.4" />
          <path d="M10 20 v-7 h6 v7Z" fill="#a9d3c0" stroke={stroke} strokeWidth="1" />
          <path d="M26 20 l-3 -10 h8 l-3 10Z" fill="#c0b0e0" stroke={stroke} strokeWidth="1" />
        </g>
      );
    case 'board': // presentation / campaign board
      return (
        <g>
          <rect x="4" y="0" width="34" height="24" rx="1.5" fill="#f3ead2" stroke={stroke} strokeWidth="1.4" />
          <rect x="8" y="4" width="12" height="7" fill="#d9b382" />
          <rect x="22" y="4" width="12" height="4" fill="#9bb59a" />
          <rect x="8" y="14" width="26" height="3" fill="#c0a2c8" />
          <rect x="18" y="24" width="6" height="8" fill="#8a6a44" stroke={stroke} strokeWidth="1" />
        </g>
      );
    case 'toolwall': // pegboard with tools
      return (
        <g>
          <rect x="4" y="0" width="34" height="22" rx="1" fill="#c79a5e" stroke={stroke} strokeWidth="1.4" />
          <path d="M12 4 v10 M11 4 h2" stroke={stroke} strokeWidth="1.6" />
          <path d="M22 4 l4 8 M20 4 h4" stroke={stroke} strokeWidth="1.6" />
          <circle cx="31" cy="7" r="3" fill="none" stroke={stroke} strokeWidth="1.6" />
        </g>
      );
    case 'pipes': // basement pipes
      return (
        <g>
          <path d="M2 6 h40 M2 6 v16 M42 6 v10" fill="none" stroke="#7d756a" strokeWidth="4" strokeLinecap="round" />
          <circle cx="2" cy="6" r="3" fill="#6a6258" />
          <rect x="18" y="4" width="6" height="4" fill="#8a8278" />
        </g>
      );
    case 'plant': // large leafy plant
      return (
        <g>
          <path d="M22 30 v-12" stroke={stroke} strokeWidth="1.4" />
          <path d="M22 20 C12 18 10 8 18 6 C20 12 24 14 22 20Z" fill="#5a9a68" stroke={stroke} strokeWidth="1" />
          <path d="M22 22 C32 20 34 10 26 8 C24 14 20 16 22 22Z" fill="#6aa878" stroke={stroke} strokeWidth="1" />
          <path d="M17 30 h10 l-1.5 -6 h-7Z" fill="#b07f45" stroke={stroke} strokeWidth="1.2" />
        </g>
      );
    case 'shelf':
    default: // wall shelf with books/binders
      return (
        <g>
          <rect x="2" y="10" width="42" height="4" rx="1" fill="#9c7b4f" stroke={stroke} strokeWidth="1.2" />
          <rect x="6" y="1" width="4" height="9" fill="#b0473a" />
          <rect x="11" y="2" width="4" height="8" fill="#4f7d4f" />
          <rect x="16" y="1" width="5" height="9" fill="#6f7fb0" />
          <rect x="24" y="3" width="8" height="7" fill="#c79a5e" />
        </g>
      );
  }
}

export const RoomDressing = memo(function RoomDressing({ roomId }: { roomId: string }) {
  const builtIn = ROOM_BUILTIN[roomId] ?? 'shelf';
  const onFloor = builtIn === 'lab' || builtIn === 'counter' || builtIn === 'cabinet' || builtIn === 'plant';
  return (
    <div className="room-dressing" aria-hidden>
      {/* framed window on the back wall */}
      <svg className="room-dressing__window" viewBox="0 0 60 44" preserveAspectRatio="none">
        <rect x="1" y="1" width="58" height="42" rx="2" fill="url(#winsky)" stroke="#8a6a44" strokeWidth="3" />
        <path d="M30 2 v40 M2 22 h56" stroke="#8a6a44" strokeWidth="2" />
        <defs>
          <linearGradient id="winsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfe0ef" />
            <stop offset="1" stopColor="#e9f2d9" />
          </linearGradient>
        </defs>
      </svg>

      {/* soft department-tinted rug on the floor */}
      <span className="room-dressing__rug" />

      {/* one built-in department fixture */}
      <svg
        className={`room-dressing__builtin ${onFloor ? 'is-floor' : 'is-wall'}`}
        viewBox="0 0 46 32"
        preserveAspectRatio="xMidYMax meet"
      >
        <BuiltInProp kind={builtIn} />
      </svg>
    </div>
  );
});
