import { memo } from 'react';
import { ROOM_BUILTIN } from '../content/roomSurfaces';

// Built-in, non-interactive room architecture. Department identity comes from
// wall treatment, flooring, baseboards, windows, lighting, and restrained
// wall-mounted motifs. Freestanding objects are deliberately excluded: every
// object resting on the floor must be a movable player decoration.

const LINE = '#3a2a18';
const WOOD = '#b8935e';
const WOOD_DARK = '#8a6a44';
const METAL = '#8f9aa8';
const PALE = '#f3ead2';

type PropId =
  | 'bookshelf'
  | 'deskMonitor'
  | 'filingCabinet'
  | 'plantTall'
  | 'plantPot'
  | 'binShelf'
  | 'conveyor'
  | 'crates'
  | 'menuBoard'
  | 'coffeeCounter'
  | 'loungeChair'
  | 'corkboard'
  | 'printerDesk'
  | 'pegboard'
  | 'workbench'
  | 'lumber'
  | 'flaskShelf'
  | 'labBench'
  | 'campaignBoard'
  | 'easel'
  | 'safe'
  | 'goldStacks'
  | 'whiteboard'
  | 'serverRack'
  | 'conferenceTable'
  | 'projectorStand'
  | 'hammock'
  | 'pipes'
  | 'planterBed'
  | 'skyline'
  | 'cameraWall'
  | 'recordWall';

// Architectural props are restricted to the back wall. Any prop that rests on
// the floor must be a movable DecorationDef instead.
type Slot = 'wallLeft' | 'wallRight' | 'ambient';

/**
 * The props that are genuinely FIXED TO A WALL, and so the only ones a wall slot
 * may hold. The slots position their contents by the top edge, with no floor
 * anchoring, so hanging a free-standing object here leaves it in mid-air — which
 * is exactly what happened when unlisted rooms fell back to a bookshelf. Narrowing
 * the type turns that from a rendering bug into a compile error.
 */
type WallPropId =
  | 'corkboard'
  | 'whiteboard'
  | 'pegboard'
  | 'menuBoard'
  | 'campaignBoard'
  | 'binShelf'
  | 'flaskShelf'
  | 'pipes'
  | 'skyline'
  | 'cameraWall'
  | 'recordWall';

interface ScenePiece {
  prop: WallPropId;
  slot: Slot;
}

// Per-room architectural recipe. Only wall-mounted identity pieces remain here;
// every object that visually rests on the floor belongs to the movable player
// decoration system instead of being baked into the room.
const ROOM_SCENE: Record<string, ScenePiece[]> = {
  'founder-desk': [{ prop: 'corkboard', slot: 'wallLeft' }],
  sorting: [{ prop: 'binShelf', slot: 'wallLeft' }],
  morale: [{ prop: 'menuBoard', slot: 'wallLeft' }],
  procurement: [{ prop: 'corkboard', slot: 'wallLeft' }],
  construction: [{ prop: 'pegboard', slot: 'wallLeft' }],
  lab: [{ prop: 'flaskShelf', slot: 'wallLeft' }],
  marketing: [{ prop: 'campaignBoard', slot: 'wallLeft' }],
  vault: [],
  research: [{ prop: 'whiteboard', slot: 'wallLeft' }],
  meeting: [{ prop: 'whiteboard', slot: 'wallLeft' }],
  nap: [],
  basement: [{ prop: 'pipes', slot: 'wallLeft' }],
  rooftop: [{ prop: 'skyline', slot: 'wallLeft' }],
  // Second expansion. Each gets the fixture that says what the room is for.
  cafeteria: [{ prop: 'menuBoard', slot: 'wallLeft' }],
  mailroom: [{ prop: 'binShelf', slot: 'wallLeft' }],
  security: [{ prop: 'cameraWall', slot: 'wallLeft' }],
  archive: [{ prop: 'recordWall', slot: 'wallLeft' }],
  incubator: [{ prop: 'flaskShelf', slot: 'wallLeft' }],
};

/** Rooms with no built-in wall fixture, stated rather than left to a fallback. */
export const ROOMS_WITHOUT_WALL_FIXTURE = ['vault', 'nap'] as const;

/** Which rooms have an authored architectural recipe. Read by the room tests. */
export const ROOMS_WITH_SCENE: readonly string[] = Object.keys(ROOM_SCENE);

function shadow(cx: number, cy: number, rx: number, ry = 3) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(40,26,12,0.22)" />;
}

// A single prop, drawn in its own small viewBox so CSS can size + position it.
function SceneProp({ prop }: { prop: PropId }) {
  const box = (w: number, h: number, vb: string) =>
    ({ width: w, height: h, viewBox: vb, 'aria-hidden': true }) as const;

  switch (prop) {
    case 'bookshelf':
      return (
        <svg {...box(42, 54, '0 0 42 54')}>
          <rect x="4" y="2" width="34" height="50" rx="2" fill={WOOD} stroke={LINE} strokeWidth="2" />
          {[6, 20, 34].map((y) => (
            <rect key={y} x="6" y={y} width="30" height="3" fill={WOOD_DARK} />
          ))}
          <rect x="8" y="8" width="4" height="10" fill="#b0473a" />
          <rect x="13" y="9" width="4" height="9" fill="#4f7d4f" />
          <rect x="18" y="8" width="5" height="10" fill="#6f7fb0" />
          <rect x="26" y="10" width="8" height="8" fill="#c79a5e" />
          <rect x="8" y="23" width="9" height="10" fill="#8a6a44" />
          <rect x="19" y="22" width="4" height="11" fill="#b0473a" />
          <rect x="24" y="23" width="4" height="10" fill="#4f7d4f" />
          <circle cx="30" cy="41" r="4" fill="var(--dept, #c79a5e)" stroke={LINE} strokeWidth="1.2" />
        </svg>
      );
    // Security: a bank of small monitors on a bracket, all watching something.
    case 'cameraWall':
      return (
        <svg {...box(50, 38, '0 0 50 38')}>
          <rect x="2" y="2" width="46" height="30" rx="2" fill={METAL} stroke={LINE} strokeWidth="1.8" />
          {[0, 1].map((row) =>
            [0, 1, 2].map((col) => (
              <g key={`${row}-${col}`}>
                <rect
                  x={5 + col * 14}
                  y={5 + row * 13}
                  width="11"
                  height="10"
                  rx="1"
                  fill="#1e2830"
                  stroke={LINE}
                  strokeWidth="1.1"
                />
                <rect
                  x={6.4 + col * 14}
                  y={6.4 + row * 13}
                  width="8.2"
                  height="7.2"
                  fill={(row + col) % 3 === 0 ? '#5f8f6f' : '#3b5a68'}
                  opacity="0.9"
                />
              </g>
            )),
          )}
          <circle cx="44" cy="35" r="2" fill="#b0473a" stroke={LINE} strokeWidth="0.9" />
        </svg>
      );
    // Archive: a rack of labelled box files, the company's memory on a wall.
    case 'recordWall':
      return (
        <svg {...box(52, 40, '0 0 52 40')}>
          <rect x="2" y="2" width="48" height="34" rx="2" fill={WOOD} stroke={LINE} strokeWidth="1.8" />
          {[3, 19].map((y) => (
            <rect key={y} x="4" y={y + 12} width="44" height="2.6" fill={WOOD_DARK} />
          ))}
          {[0, 1].map((row) =>
            [0, 1, 2, 3, 4].map((col) => (
              <g key={`${row}-${col}`}>
                <rect
                  x={5 + col * 8.6}
                  y={4 + row * 16}
                  width="7.2"
                  height="11"
                  rx="0.8"
                  fill={['#b8a07a', '#a8895f', '#c2ad86', '#9c7f57', '#b09070'][(row + col) % 5]}
                  stroke={LINE}
                  strokeWidth="1"
                />
                <rect x={6 + col * 8.6} y={6 + row * 16} width="5.2" height="2.4" fill="#f2e6cc" />
              </g>
            )),
          )}
        </svg>
      );
    case 'deskMonitor':
      return (
        <svg {...box(54, 40, '0 0 54 40')}>
          {shadow(27, 37, 24)}
          <rect x="4" y="22" width="46" height="12" rx="2" fill={WOOD} stroke={LINE} strokeWidth="1.8" />
          <rect x="8" y="26" width="12" height="8" fill={WOOD_DARK} />
          <rect x="30" y="14" width="20" height="14" rx="1.5" fill="#26303a" stroke={LINE} strokeWidth="1.6" />
          <rect x="32" y="16" width="16" height="10" fill="#7fb0c8" />
          <path d="M33 24 l4 -4 3 2 4 -4 4 6 Z" fill="#3f7d4f" opacity="0.8" />
          <rect x="38" y="28" width="4" height="4" fill={LINE} />
          <rect x="8" y="18" width="14" height="4" rx="1" fill="#e0cba0" stroke={LINE} strokeWidth="1" />
        </svg>
      );
    case 'filingCabinet':
      return (
        <svg {...box(34, 44, '0 0 34 44')}>
          {shadow(17, 42, 15)}
          <rect x="5" y="2" width="24" height="40" rx="2" fill={METAL} stroke={LINE} strokeWidth="1.8" />
          {[6, 16, 26].map((y) => (
            <g key={y}>
              <rect x="8" y={y} width="18" height="8" rx="1" fill="#a9b3bf" stroke={LINE} strokeWidth="0.8" />
              <rect x="15" y={y + 3} width="4" height="2" fill={LINE} />
            </g>
          ))}
        </svg>
      );
    case 'plantTall':
      return (
        <svg {...box(34, 56, '0 0 34 56')}>
          {shadow(17, 53, 13)}
          <path d="M17 44 C6 40 4 20 13 8 C18 18 18 32 17 44 Z" fill="#3f7d4f" stroke={LINE} strokeWidth="1.2" />
          <path d="M17 44 C28 40 30 20 21 8 C16 18 16 32 17 44 Z" fill="#4f9d69" stroke={LINE} strokeWidth="1.2" />
          <path d="M17 46 C15 32 17 16 17 6" stroke="#2f6d47" strokeWidth="1.4" fill="none" />
          <path d="M9 44 h16 l-2.5 10 h-11 Z" fill="var(--dept, #c98a4b)" stroke={LINE} strokeWidth="1.4" />
        </svg>
      );
    case 'plantPot':
      return (
        <svg {...box(30, 34, '0 0 30 34')}>
          {shadow(15, 32, 11)}
          <path d="M15 22 C7 20 6 8 13 4 C16 10 16 16 15 22 Z" fill="#4f9d69" stroke={LINE} strokeWidth="1.1" />
          <path d="M15 22 C23 20 24 9 17 4 C14 10 14 16 15 22 Z" fill="#3f7d4f" stroke={LINE} strokeWidth="1.1" />
          <path d="M9 22 h12 l-2 10 h-8 Z" fill="var(--dept, #c98a4b)" stroke={LINE} strokeWidth="1.3" />
        </svg>
      );
    case 'binShelf':
      return (
        <svg {...box(44, 40, '0 0 44 40')}>
          <rect x="3" y="2" width="38" height="36" rx="2" fill={WOOD} stroke={LINE} strokeWidth="1.8" />
          <path d="M3 20 h38 M22 2 v36" stroke={WOOD_DARK} strokeWidth="1.4" />
          {[[6, 5], [24, 5], [6, 23], [24, 23]].map(([x, y], i) => (
            <g key={i}>
              <rect x={x} y={y} width="14" height="12" rx="1.5" fill="#d9b98a" stroke={LINE} strokeWidth="1" />
              <rect x={x + 4} y={y + 4} width="6" height="2" fill={LINE} opacity="0.6" />
              <circle cx={x + 7} cy={y + 8} r="1.6" fill="var(--dept, #b07f45)" />
            </g>
          ))}
        </svg>
      );
    case 'conveyor':
      return (
        <svg {...box(96, 34, '0 0 96 34')}>
          {shadow(48, 31, 44)}
          <rect x="2" y="14" width="92" height="10" rx="5" fill="#6f6a60" stroke={LINE} strokeWidth="1.8" />
          {[10, 26, 42, 58, 74, 88].map((x) => (
            <circle key={x} cx={x} cy={19} r="4.5" fill="#8f8a80" stroke={LINE} strokeWidth="1" />
          ))}
          <rect x="8" y="24" width="8" height="8" fill={WOOD_DARK} />
          <rect x="80" y="24" width="8" height="8" fill={WOOD_DARK} />
          <ellipse cx="30" cy="12" rx="5" ry="4" fill="var(--dept, #c79a5e)" stroke={LINE} strokeWidth="1" />
          <ellipse cx="52" cy="12" rx="4" ry="3" fill="#b07f45" stroke={LINE} strokeWidth="1" />
          <ellipse cx="70" cy="12" rx="5" ry="4" fill="#c79a5e" stroke={LINE} strokeWidth="1" />
        </svg>
      );
    case 'crates':
      return (
        <svg {...box(46, 42, '0 0 46 42')}>
          {shadow(23, 40, 20)}
          <rect x="4" y="18" width="20" height="20" rx="1.5" fill={WOOD} stroke={LINE} strokeWidth="1.6" />
          <path d="M4 18 l20 20 M24 18 l-20 20" stroke={WOOD_DARK} strokeWidth="1.2" />
          <rect x="24" y="22" width="18" height="16" rx="1.5" fill="#c9a06a" stroke={LINE} strokeWidth="1.6" />
          <path d="M24 22 l18 16 M42 22 l-18 16" stroke={WOOD_DARK} strokeWidth="1.2" />
          <rect x="12" y="4" width="18" height="14" rx="1.5" fill="#d9b98a" stroke={LINE} strokeWidth="1.6" />
          <path d="M12 11 h18" stroke={WOOD_DARK} strokeWidth="1.2" />
        </svg>
      );
    case 'menuBoard':
      return (
        <svg {...box(38, 30, '0 0 38 30')}>
          <rect x="2" y="2" width="34" height="26" rx="2" fill="#2f2a24" stroke={WOOD_DARK} strokeWidth="2.5" />
          <path d="M6 8 h16 M6 13 h22 M6 18 h12" stroke="#efe0c1" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <circle cx="30" cy="19" r="3" fill="var(--dept, #e0a43b)" />
        </svg>
      );
    case 'coffeeCounter':
      return (
        <svg {...box(56, 40, '0 0 56 40')}>
          {shadow(28, 38, 25)}
          <rect x="2" y="18" width="52" height="18" rx="2" fill={WOOD} stroke={LINE} strokeWidth="1.8" />
          <rect x="2" y="18" width="52" height="4" fill="#d9b98a" />
          <rect x="30" y="4" width="18" height="14" rx="2" fill={METAL} stroke={LINE} strokeWidth="1.6" />
          <rect x="34" y="8" width="10" height="5" fill="#26303a" />
          <path d="M37 18 v3 M41 18 v3" stroke={LINE} strokeWidth="1.4" />
          <path d="M8 12 c-3 -4 3 -5 0 -9 M14 12 c-3 -4 3 -5 0 -9" stroke="#efe0c1" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M4 14 h16 v4 h-16 Z" fill="var(--dept, #c98a4b)" stroke={LINE} strokeWidth="1.2" />
          <circle cx="24" cy="24" r="3.5" fill="#efe0c1" stroke={LINE} strokeWidth="1" />
        </svg>
      );
    case 'loungeChair':
      return (
        <svg {...box(42, 38, '0 0 42 38')}>
          {shadow(21, 36, 18)}
          <path d="M6 34 C4 20 12 16 21 16 C30 16 38 20 36 34 C36 36 30 36 21 36 C12 36 6 36 6 34 Z" fill="var(--dept, #c98a4b)" stroke={LINE} strokeWidth="1.8" />
          <path d="M12 32 q9 5 18 0" fill="none" stroke={LINE} strokeWidth="1" opacity="0.5" />
          <rect x="9" y="34" width="4" height="4" fill={WOOD_DARK} />
          <rect x="29" y="34" width="4" height="4" fill={WOOD_DARK} />
        </svg>
      );
    case 'corkboard':
      return (
        <svg {...box(40, 30, '0 0 40 30')}>
          <rect x="2" y="2" width="36" height="26" rx="2" fill="#c79a5e" stroke={WOOD_DARK} strokeWidth="2.5" />
          <rect x="6" y="6" width="10" height="8" fill="#f3ead2" stroke={LINE} strokeWidth="0.6" transform="rotate(-3 11 10)" />
          <rect x="20" y="7" width="12" height="7" fill="#bcd" stroke={LINE} strokeWidth="0.6" transform="rotate(2 26 10)" />
          <rect x="8" y="17" width="11" height="8" fill="#9bb59a" stroke={LINE} strokeWidth="0.6" />
          <rect x="22" y="17" width="10" height="8" fill="#e6c07a" stroke={LINE} strokeWidth="0.6" transform="rotate(-2 27 21)" />
          <circle cx="11" cy="6" r="1.4" fill="var(--dept, #b0473a)" />
          <circle cx="26" cy="7" r="1.4" fill="#b0473a" />
        </svg>
      );
    case 'printerDesk':
      return (
        <svg {...box(48, 40, '0 0 48 40')}>
          {shadow(24, 38, 21)}
          <rect x="4" y="24" width="40" height="12" rx="2" fill={WOOD} stroke={LINE} strokeWidth="1.8" />
          <rect x="12" y="8" width="26" height="16" rx="2" fill="#d8d2c6" stroke={LINE} strokeWidth="1.6" />
          <rect x="16" y="6" width="18" height="5" rx="1" fill="#efe9dd" stroke={LINE} strokeWidth="1" />
          <rect x="15" y="18" width="20" height="4" fill="#f3ead2" stroke={LINE} strokeWidth="0.8" />
          <rect x="16" y="12" width="8" height="3" fill="#26303a" />
          <circle cx="32" cy="13" r="1.6" fill="var(--dept, #4f9d69)" />
        </svg>
      );
    case 'pegboard':
      return (
        <svg {...box(44, 30, '0 0 44 30')}>
          <rect x="2" y="2" width="40" height="26" rx="1.5" fill="#c79a5e" stroke={LINE} strokeWidth="2" />
          <path d="M10 6 v12 M8 6 h4 M9 18 h2" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
          <path d="M22 6 l5 11 M20 6 h5" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
          <path d="M33 6 v8 a4 4 0 0 0 6 0 v-8" fill="none" stroke={LINE} strokeWidth="2" />
          <circle cx="14" cy="22" r="2.5" fill="none" stroke={LINE} strokeWidth="2" />
          <rect x="26" y="20" width="12" height="4" rx="1" fill="var(--dept, #b07f45)" stroke={LINE} strokeWidth="1" />
        </svg>
      );
    case 'workbench':
      return (
        <svg {...box(56, 40, '0 0 56 40')}>
          {shadow(28, 38, 25)}
          <rect x="2" y="16" width="52" height="8" fill={WOOD} stroke={LINE} strokeWidth="1.8" />
          <rect x="6" y="24" width="6" height="14" fill={WOOD_DARK} />
          <rect x="44" y="24" width="6" height="14" fill={WOOD_DARK} />
          <rect x="14" y="24" width="20" height="12" fill="#a9805180" stroke={LINE} strokeWidth="1.2" />
          <rect x="16" y="27" width="16" height="3" fill={WOOD_DARK} />
          <rect x="20" y="8" width="16" height="8" rx="1" fill={METAL} stroke={LINE} strokeWidth="1.2" />
          <circle cx="42" cy="12" r="4" fill="var(--dept, #c79a5e)" stroke={LINE} strokeWidth="1.2" />
          <path d="M8 14 l6 -6" stroke={LINE} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'lumber':
      return (
        <svg {...box(40, 34, '0 0 40 34')}>
          {shadow(20, 32, 18)}
          {[[24, '#c9a06a'], [28, '#b8935e'], [20, '#d9b98a']].map(([y, c], i) => (
            <g key={i}>
              <rect x="2" y={Number(y)} width="36" height="6" rx="1.5" fill={String(c)} stroke={LINE} strokeWidth="1.2" />
              <circle cx="5" cy={Number(y) + 3} r="1.6" fill={WOOD_DARK} />
              <circle cx="35" cy={Number(y) + 3} r="1.6" fill={WOOD_DARK} />
            </g>
          ))}
          <rect x="30" y="4" width="8" height="16" rx="1" fill="var(--dept, #b07f45)" stroke={LINE} strokeWidth="1.2" transform="rotate(8 34 12)" />
        </svg>
      );
    case 'flaskShelf':
      return (
        <svg {...box(42, 34, '0 0 42 34')}>
          <rect x="2" y="24" width="38" height="4" rx="1" fill={WOOD} stroke={LINE} strokeWidth="1.4" />
          <rect x="2" y="10" width="38" height="4" rx="1" fill={WOOD} stroke={LINE} strokeWidth="1.4" />
          <path d="M8 24 l-2 -8 h8 l-2 8 Z" fill="#a9d3c0" stroke={LINE} strokeWidth="1" />
          <path d="M20 24 v-9 h6 v9 Z" fill="var(--dept, #c0b0e0)" stroke={LINE} strokeWidth="1" />
          <circle cx="33" cy="20" r="4" fill="#e6a9c0" stroke={LINE} strokeWidth="1" />
          <rect x="10" y="4" width="6" height="6" fill="#a9d3c0" stroke={LINE} strokeWidth="0.8" />
          <rect x="24" y="4" width="5" height="6" fill="#c0b0e0" stroke={LINE} strokeWidth="0.8" />
        </svg>
      );
    case 'labBench':
      return (
        <svg {...box(54, 40, '0 0 54 40')}>
          {shadow(27, 38, 24)}
          <rect x="2" y="20" width="50" height="10" rx="1.5" fill="#c8cdd4" stroke={LINE} strokeWidth="1.8" />
          <rect x="6" y="30" width="6" height="8" fill={METAL} />
          <rect x="42" y="30" width="6" height="8" fill={METAL} />
          <path d="M14 20 l-3 -10 h8 l-3 10 Z" fill="#a9d3c0" stroke={LINE} strokeWidth="1.2" />
          <path d="M30 20 l-4 -12 h9 l-4 12 Z" fill="var(--dept, #c0b0e0)" stroke={LINE} strokeWidth="1.2" />
          <rect x="40" y="8" width="8" height="12" rx="1" fill="#e6a9c0" stroke={LINE} strokeWidth="1.1" />
          {[15, 31].map((x) => <circle key={x} cx={x} cy={x === 31 ? 8 : 10} r="1.4" fill="#fff" opacity="0.8" />)}
        </svg>
      );
    case 'campaignBoard':
      return (
        <svg {...box(40, 30, '0 0 40 30')}>
          <rect x="2" y="2" width="36" height="26" rx="1.5" fill={PALE} stroke={LINE} strokeWidth="2" />
          <rect x="6" y="6" width="13" height="9" fill="#d9b382" />
          <rect x="22" y="6" width="12" height="5" fill="var(--dept, #9bb59a)" />
          <rect x="22" y="13" width="12" height="2.5" fill="#c0a2c8" />
          <path d="M6 24 l6 -6 4 3 5 -5 6 8 Z" fill="#7fb0c8" opacity="0.8" />
          <circle cx="30" cy="21" r="3" fill="var(--dept, #e0a43b)" />
        </svg>
      );
    case 'easel':
      return (
        <svg {...box(40, 44, '0 0 40 44')}>
          {shadow(20, 42, 15)}
          <path d="M10 42 L18 8 M30 42 L22 8 M14 40 h12" stroke={WOOD_DARK} strokeWidth="2.4" strokeLinecap="round" />
          <rect x="8" y="6" width="24" height="20" rx="1.5" fill={PALE} stroke={LINE} strokeWidth="1.8" />
          <path d="M11 22 l5 -7 4 3 4 -5 5 9 Z" fill="var(--dept, #4f9d69)" opacity="0.85" />
          <circle cx="15" cy="12" r="2.5" fill="#e0a43b" />
        </svg>
      );
    case 'safe':
      return (
        <svg {...box(40, 42, '0 0 40 42')}>
          {shadow(20, 40, 17)}
          <rect x="4" y="4" width="32" height="36" rx="3" fill="#5a6470" stroke={LINE} strokeWidth="2" />
          <rect x="8" y="8" width="24" height="28" rx="2" fill="#6d7884" stroke={LINE} strokeWidth="1.4" />
          <circle cx="20" cy="22" r="7" fill="#4a525c" stroke={LINE} strokeWidth="1.6" />
          <circle cx="20" cy="22" r="2.5" fill="var(--dept, #e0a43b)" />
          <path d="M20 15 v3 M20 26 v3 M13 22 h3 M24 22 h3" stroke={LINE} strokeWidth="1.4" />
        </svg>
      );
    case 'goldStacks':
      return (
        <svg {...box(38, 30, '0 0 38 30')}>
          {shadow(19, 28, 16)}
          {[[6, 20], [15, 16], [24, 22]].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={Number(x) + 4} cy={Number(y)} rx="7" ry="2.5" fill="#e0a43b" stroke={LINE} strokeWidth="1" />
              <rect x={x} y={Number(y) - 6} width="14" height="6" fill="#f4c95a" stroke={LINE} strokeWidth="1" />
              <ellipse cx={Number(x) + 4} cy={Number(y) - 6} rx="7" ry="2.5" fill="#ffe08a" stroke={LINE} strokeWidth="1" />
            </g>
          ))}
        </svg>
      );
    case 'whiteboard':
      return (
        <svg {...box(48, 32, '0 0 48 32')}>
          <rect x="2" y="2" width="44" height="26" rx="2" fill="#f6f4ee" stroke={WOOD_DARK} strokeWidth="2.5" />
          <path d="M7 9 h20 M7 14 h26 M7 19 h14" stroke="#6f7fb0" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M34 18 l4 -7 4 10 Z" fill="none" stroke="var(--dept, #b0473a)" strokeWidth="1.6" />
          <rect x="10" y="28" width="28" height="2.5" fill={WOOD_DARK} />
        </svg>
      );
    case 'serverRack':
      return (
        <svg {...box(34, 44, '0 0 34 44')}>
          {shadow(17, 42, 14)}
          <rect x="5" y="2" width="24" height="40" rx="2" fill="#2f333a" stroke={LINE} strokeWidth="1.8" />
          {[6, 13, 20, 27, 34].map((y) => (
            <g key={y}>
              <rect x="8" y={y} width="18" height="5" rx="1" fill="#454b54" stroke="#20242a" strokeWidth="0.6" />
              <circle cx="11" cy={y + 2.5} r="1" fill="var(--dept, #4f9d69)" />
              <circle cx="14" cy={y + 2.5} r="1" fill="#e0a43b" />
            </g>
          ))}
        </svg>
      );
    case 'conferenceTable':
      return (
        <svg {...box(104, 40, '0 0 104 40')}>
          {shadow(52, 37, 48)}
          <ellipse cx="52" cy="24" rx="46" ry="12" fill={WOOD} stroke={LINE} strokeWidth="2" />
          <ellipse cx="52" cy="22" rx="40" ry="9" fill="#c9a06a" />
          {[14, 34, 70, 90].map((x) => (
            <g key={x}>
              <rect x={x} y="8" width="12" height="9" rx="2" fill="var(--dept, #b07f45)" stroke={LINE} strokeWidth="1.2" />
              <rect x={x + 2} y="16" width="8" height="4" fill={WOOD_DARK} />
            </g>
          ))}
          {[20, 52, 84].map((x) => (
            <g key={x}>
              <rect x={x - 6} y="30" width="12" height="8" rx="2" fill="#b07f45" stroke={LINE} strokeWidth="1.2" />
            </g>
          ))}
        </svg>
      );
    case 'projectorStand':
      return (
        <svg {...box(34, 40, '0 0 34 40')}>
          {shadow(17, 38, 13)}
          <path d="M12 38 L16 20 M22 38 L18 20 M14 37 h6" stroke={WOOD_DARK} strokeWidth="2.2" strokeLinecap="round" />
          <rect x="6" y="12" width="22" height="10" rx="2" fill="#3a3f47" stroke={LINE} strokeWidth="1.6" />
          <circle cx="24" cy="17" r="3" fill="#7fb0c8" stroke={LINE} strokeWidth="1" />
          <circle cx="12" cy="15" r="1.4" fill="var(--dept, #e0a43b)" />
          <path d="M27 17 l6 -3 v6 Z" fill="#7fb0c8" opacity="0.4" />
        </svg>
      );
    case 'hammock':
      return (
        <svg {...box(80, 40, '0 0 80 40')}>
          {shadow(40, 37, 34)}
          <path d="M6 8 v26 M74 8 v26" stroke={WOOD_DARK} strokeWidth="3" strokeLinecap="round" />
          <path d="M6 14 C30 42 50 42 74 14" fill="var(--dept, #c98a4b)" stroke={LINE} strokeWidth="2" />
          <path d="M6 14 C30 42 50 42 74 14" fill="none" stroke={LINE} strokeWidth="1" opacity="0.4" />
          <ellipse cx="40" cy="26" rx="10" ry="5" fill="#efe0c1" stroke={LINE} strokeWidth="1.2" />
        </svg>
      );
    case 'pipes':
      return (
        <svg {...box(44, 30, '0 0 44 30')}>
          <path d="M2 8 h30 v14 h10" fill="none" stroke="#7d756a" strokeWidth="5" strokeLinecap="round" />
          <path d="M2 20 h18" fill="none" stroke="#8a8278" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="8" r="3.5" fill="#6a6258" stroke={LINE} strokeWidth="1" />
          <rect x="18" y="4" width="6" height="8" rx="1" fill="var(--dept, #8a8278)" stroke={LINE} strokeWidth="1" />
          <circle cx="20" cy="20" r="2.5" fill="none" stroke="#6a6258" strokeWidth="2" />
        </svg>
      );
    case 'planterBed':
      return (
        <svg {...box(84, 34, '0 0 84 34')}>
          {shadow(42, 32, 38)}
          <rect x="4" y="16" width="76" height="16" rx="2" fill={WOOD} stroke={LINE} strokeWidth="2" />
          <rect x="4" y="16" width="76" height="5" fill="#6a4a2a" />
          {[14, 28, 42, 56, 70].map((x, i) => (
            <path
              key={x}
              d={`M${x} 16 C${x - 6} 6 ${x + 6} 2 ${x} ${i % 2 ? -2 : 0}`}
              fill="none"
              stroke={i % 2 ? '#4f9d69' : 'var(--dept, #5a9a68)'}
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          <circle cx="24" cy="8" r="2.5" fill="#e07a5f" />
          <circle cx="52" cy="7" r="2.5" fill="#ffd54a" />
        </svg>
      );
    case 'skyline':
      return (
        <svg {...box(60, 30, '0 0 60 30')}>
          <circle cx="46" cy="9" r="6" fill="#ffe08a" opacity="0.9" />
          <path d="M2 30 v-12 h8 v-6 h8 v10 h9 v-8 h8 v14 h9 v-10 h6 v22 Z" fill="var(--dept, #8aa0b8)" opacity="0.55" stroke={LINE} strokeWidth="0.8" />
          <path d="M8 24 h2 v2 h-2 Z M24 20 h2 v2 h-2 Z M40 26 h2 v2 h-2 Z" fill="#fff4c0" opacity="0.8" />
        </svg>
      );
    default:
      return null;
  }
}

export const RoomDressing = memo(function RoomDressing({ roomId }: { roomId: string }) {
  const builtIn = ROOM_BUILTIN[roomId] ?? 'shelf';
  // No fallback fixture. An unlisted room shows bare walls, which reads as an
  // unfinished room; the old fallback hung a free-standing bookshelf in mid-air,
  // which reads as a bug. `tests/roomExpansion.test.ts` requires every room to be
  // listed, so bare walls should never actually ship.
  const scene = ROOM_SCENE[roomId] ?? [];
  return (
    <div className={`room-dressing room-dressing--${builtIn} rd--${roomId}`} aria-hidden>
      <span className="room-dressing__wall" />
      <span className="room-dressing__floor" />
      <span className="room-dressing__baseboard" />

      {/* --- Architectural shell -------------------------------------------
          The rooms used to read as flat coloured bands: a wall gradient, a
          floor gradient, and a lot of empty middle. The cast is photographic
          and richly lit, so a flat backdrop behind it is what made the whole
          scene look like a level editor rather than a place.

          These four layers give the room the structure a real interior has,
          WITHOUT putting anything on the floor — the complete floor plane stays
          player-owned, which is the constraint the freestanding furniture was
          removed for in the first place. Everything here is fixed to the
          building: ceiling, wall joinery, corner shading, and the light those
          surfaces receive.

          All of it is `pointer-events: none` inside `.room-dressing` and stays
          at z-index 0, so decoration hit-testing and the
          decorations-behind-characters ordering are untouched. Per-room art
          direction continues to live in the `rd--<room>` CSS blocks, which can
          restyle or hide any of these (the rooftop has no ceiling; the vault
          has no daylight). */}
      <span className="room-dressing__ceiling" />
      <span className="room-dressing__rail" />
      <span className="room-dressing__fixture">
        <span className="room-dressing__fixture-pool" />
      </span>
      <span className="room-dressing__depth" />

      {/* Back-wall opening. Its shape, glazing and sky are set per department in
          CSS (arched daylight, corporate city view, night window, sealed lab
          pane, barred basement slit, open rooftop sky — or hidden entirely for
          windowless interiors like the vault). */}
      <span className="room-dressing__window">
        <span className="room-dressing__window-glow" />
      </span>

      {scene.map((piece, index) => (
        <span
          key={`${piece.prop}-${piece.slot}-${index}`}
          className={`room-dressing__prop room-dressing__prop--${piece.slot}`}
        >
          <SceneProp prop={piece.prop} />
        </span>
      ))}

      {/* Per-department mood lighting wash (warm cafe, cool lab, gold vault
          spotlight, dim night, bright rooftop day). */}
      <span className="room-dressing__light" />
    </div>
  );
});
