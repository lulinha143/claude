import type { CSSProperties } from 'react';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import {
  castScaleFor,
  employeeSprite,
  VECTOR_CRITTER_OFFICE_SIZE,
} from '../../art/employeeSprites';
import { StickerArt, type StickerKind } from '../../art/EmotionSticker';
import {
  MICRO_TEAM,
  type BugSpecies,
  type CoffeeDropKindId,
  type MicroMode,
} from '../../sim/minigames';

// Authored art for the three games: who hosts each one (their real artwork, at the
// cast's one presentation scale), the games' emblems, and the drawn pieces the
// boards are made of. Kept out of the game components so they stay about rules
// and input.

/* --- the host -------------------------------------------------------------- */

/** The teammate who runs a game: the first of its team on staff, else the founder. */
export function microHostFor(
  mode: MicroMode,
  employees: Readonly<Record<string, { hired?: boolean } | undefined>>,
): string {
  return MICRO_TEAM[mode].find((id) => employees[id]?.hired) ?? 'pip';
}

export function MicroHost({
  employeeId,
  space,
  reducedMotion,
  sticker,
  className = '',
}: {
  employeeId: string;
  /** Height the host may use, in px. The whole cast shares one scale for it. */
  space: number;
  reducedMotion: boolean;
  sticker?: StickerKind;
  className?: string;
}) {
  const def = EMPLOYEES_BY_ID[employeeId];
  if (!def) return null;
  const sprite = employeeSprite(employeeId);
  // One scale for whoever hosts, as large as the space allows and never enlarging
  // anyone's art (the visit's rule, so a host reads at the size they do there).
  const scale = castScaleFor(space);
  const height = sprite
    ? Math.round(sprite.officeHeight * scale)
    : Math.round(VECTOR_CRITTER_OFFICE_SIZE * scale);
  const shape = shapeFor(employeeId);
  return (
    <span
      className={`micro-host ${className}`}
      data-employee={employeeId}
      style={{ ['--host-h' as string]: `${height}px` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="micro-host__figure">
        {sprite ? (
          <EmployeeSprite config={sprite} reducedMotion={reducedMotion} height={height} />
        ) : (
          <Critter
            species={shape.species}
            color={def.color}
            accent={def.accent}
            state="talk"
            hasGlasses={shape.hasGlasses}
            size={Math.round(height * 0.72)}
          />
        )}
      </span>
      {sticker ? (
        <span className="micro-host__sticker" key={sticker}>
          <StickerArt kind={sticker} />
        </span>
      ) : null}
    </span>
  );
}

/* --- emblems --------------------------------------------------------------- */

export function MicroGameEmblem({ mode, compact = false }: { mode: MicroMode; compact?: boolean }) {
  const size = compact ? 36 : 104;
  return (
    <svg
      className={`microgame-emblem microgame-emblem--${mode}`}
      width={size}
      height={size}
      viewBox="0 0 104 104"
      aria-hidden="true"
    >
      <ellipse cx="52" cy="91" rx="33" ry="7" fill="rgba(30,18,9,.25)" />
      {mode === 'coffeeRescue' ? (
        <>
          <path
            className="microgame-emblem__steam"
            d="M40 38c-8-10 8-13 0-24M56 36c-8-10 8-13 0-24"
            fill="none"
            stroke="#fff1cf"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M27 42h50v34c0 10-8 16-18 16H45c-10 0-18-6-18-16Z"
            fill="#e6bb70"
            stroke="#332619"
            strokeWidth="4"
          />
          <path d="M77 49h8c13 0 13 22 0 22h-8" fill="none" stroke="#332619" strokeWidth="5" />
          <path d="M32 48h40v11H32Z" fill="#75482b" />
          <path
            d="M42 68q10 8 20 0"
            fill="none"
            stroke="#332619"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {mode === 'bugSquash' ? (
        <>
          <path d="M18 81q34-24 68 0v11H18Z" fill="#8a5a2b" stroke="#332619" strokeWidth="4" />
          <ellipse
            cx="52"
            cy="64"
            rx="22"
            ry="25"
            fill="#b86c3f"
            stroke="#332619"
            strokeWidth="4"
          />
          <path
            d="M31 59 17 49M73 59l14-10M31 72l-16 5M73 72l16 5M43 38l-8-12M61 38l8-12"
            stroke="#332619"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="44" cy="58" r="5" fill="#fff4e0" />
          <circle cx="60" cy="58" r="5" fill="#fff4e0" />
          <circle cx="45" cy="59" r="2" fill="#332619" />
          <circle cx="59" cy="59" r="2" fill="#332619" />
          <path
            d="M45 73q7-5 14 0"
            fill="none"
            stroke="#332619"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {mode === 'cableUntangle' ? (
        <>
          <path
            d="M22 28c20 4 12 48 35 51 20 2 16-31 29-34"
            fill="none"
            stroke="#38271c"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M22 26c20 4 12 48 35 51 20 2 16-31 29-34"
            fill="none"
            stroke="#e6a93f"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M22 25c20 4 12 48 35 51 20 2 16-31 29-34"
            fill="none"
            stroke="rgba(255,255,255,.38)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g transform="translate(8 12)">
            <rect width="27" height="27" rx="7" fill="#f0e2c8" stroke="#332619" strokeWidth="4" />
            <path d="M7 13h13M13 7v13" stroke="#3f7d4f" strokeWidth="3" />
          </g>
          <g transform="translate(74 31)">
            <rect width="24" height="29" rx="6" fill="#f0e2c8" stroke="#332619" strokeWidth="4" />
            <circle cx="12" cy="10" r="4" fill="#4f9d69" />
            <path d="M7 20h10" stroke="#332619" strokeWidth="3" />
          </g>
          <path d="M38 83h28" stroke="#d8c4a8" strokeWidth="6" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}

/* --- Coffee Rescue --------------------------------------------------------- */

const INK = '#2b1b10';

/**
 * Each drink is told apart by its SHAPE first (a mug, a tall carafe, a small cup on
 * a saucer, a grey cup with a crossed-out bean), then by colour. The decaf is the
 * only grey thing that falls and the only one with a mark on it, so it reads
 * without colour vision at all.
 */
export function DrinkArt({ kind, className = '' }: { kind: CoffeeDropKindId; className?: string }) {
  return (
    <svg
      className={`drink drink--${kind} ${className}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'mug' ? (
        <>
          <path d="M28 15h3a5 5 0 0 1 0 10h-3" fill="none" stroke={INK} strokeWidth="3" />
          <path
            d="M9 12h20v15a7 7 0 0 1-7 7h-6a7 7 0 0 1-7-7Z"
            fill="#e9b864"
            stroke={INK}
            strokeWidth="2.6"
          />
          <path d="M11 15h16v5H11Z" fill="#7a4a2a" />
          <path
            d="M14 7q2-3 0-5M20 7q2-3 0-5"
            fill="none"
            stroke="#fff4dc"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {kind === 'carafe' ? (
        <>
          <path
            d="M14 4h12v4l5 7v15a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6V15l5-7Z"
            fill="#f4ead6"
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d="M10 21h20v9a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5Z" fill="#6c3f22" />
          <path d="M13 4h14" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M12 17h16" stroke="#c98a4b" strokeWidth="2.4" />
        </>
      ) : null}
      {kind === 'espresso' ? (
        <>
          <ellipse cx="20" cy="31" rx="15" ry="4.5" fill="#f0e2c8" stroke={INK} strokeWidth="2.4" />
          <path
            d="M11 16h18v8a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7Z"
            fill="#fff4e0"
            stroke={INK}
            strokeWidth="2.4"
          />
          <path d="M29 18h2a3.5 3.5 0 0 1 0 7h-2" fill="none" stroke={INK} strokeWidth="2.4" />
          <path d="M13 18h14v3H13Z" fill="#3b2213" />
          <path
            d="M17 12l3-6 3 6"
            fill="#f2c94c"
            stroke={INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {kind === 'decaf' ? (
        <>
          <path d="M28 15h3a5 5 0 0 1 0 10h-3" fill="none" stroke="#4a4038" strokeWidth="3" />
          <path
            d="M9 12h20v15a7 7 0 0 1-7 7h-6a7 7 0 0 1-7-7Z"
            fill="#b9b2a7"
            stroke={INK}
            strokeWidth="2.6"
            strokeDasharray="4 2.4"
          />
          <ellipse cx="19" cy="22" rx="5.4" ry="4" fill="#6b625a" />
          <path d="M19 18.4v7.2" stroke="#b9b2a7" strokeWidth="1.4" />
          <path d="M11.5 29.5 26.5 14.5" stroke="#c94452" strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}

/**
 * The cup's share of the drawn mug's width. The art is padded on the left by as much
 * as the handle sticks out on the right, so the element's centre IS the cup's centre:
 * the mug sits exactly under the pointer, and catches are judged on the cup alone.
 */
export const COFFEE_CUP_SHARE = 54 / 82;

/** The player's mug. It fills as the catch streak builds toward the next combo. */
export function CoffeeMugArt({ fill, hot }: { fill: number; hot: boolean }) {
  const level = Math.max(0, Math.min(1, fill));
  const top = 34 - level * 20;
  return (
    <svg
      className={`coffee-mug ${hot ? 'is-hot' : ''}`}
      viewBox="-4 0 82 64"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="38" cy="60" rx="30" ry="3.6" fill="rgba(40,24,12,.22)" />
      <path d="M62 22h6a10 10 0 0 1 0 20h-6" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M62 22h6a10 10 0 0 1 0 20h-6" fill="none" stroke="#f4e3c3" strokeWidth="2" />
      <path
        d="M10 10h54v34a14 14 0 0 1-14 14H24a14 14 0 0 1-14-14Z"
        fill="#fff7ea"
        stroke={INK}
        strokeWidth="3.4"
      />
      <clipPath id="coffee-mug-inside">
        <path d="M13 12h48v32a12 12 0 0 1-12 12H25a12 12 0 0 1-12-12Z" />
      </clipPath>
      <g clipPath="url(#coffee-mug-inside)">
        <rect x="10" y={top} width="56" height="60" fill="#7a4a2a" />
        <path
          d={`M10 ${top + 1}q8 -3 14 0t14 0t14 0t14 0`}
          fill="none"
          stroke="#b97a45"
          strokeWidth="2"
        />
      </g>
      <path d="M10 10h54" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="29" cy="31" r="2.6" fill={INK} />
      <circle cx="45" cy="31" r="2.6" fill={INK} />
      <path d="M32 38q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="24" cy="37" rx="3.4" ry="2" fill="#f2a28c" opacity=".75" />
      <ellipse cx="50" cy="37" rx="3.4" ry="2" fill="#f2a28c" opacity=".75" />
    </svg>
  );
}

/**
 * The break room behind the counter. Its pieces are drawn at furniture size and
 * placed on the wall, not one picture stretched to the board: a bigger window shows
 * more of the room (the espresso machine, the pendant lamp, the plant) instead of a
 * bigger window frame.
 */
export function CafeBackdrop() {
  return (
    <div className="coffee-cafe">
      <span className="coffee-cafe__wall" />
      <svg className="coffee-cafe__lamp" viewBox="0 0 60 80" focusable="false">
        <path d="M30 0v30" stroke="#52341d" strokeWidth="2.4" />
        <path
          d="M12 46q18-26 36 0Z"
          fill="#45763d"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <ellipse cx="30" cy="48" rx="7" ry="4" fill="#fff4c0" />
        <path
          d="M20 54 12 76M40 54l8 22"
          stroke="#fff4c0"
          strokeWidth="6"
          opacity=".35"
          strokeLinecap="round"
        />
      </svg>
      <svg className="coffee-cafe__window" viewBox="0 0 92 70" focusable="false">
        <defs>
          <linearGradient id="cafe-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a9dbe3" />
            <stop offset="1" stopColor="#fbeed4" />
          </linearGradient>
        </defs>
        <rect width="92" height="70" rx="5" fill="#6a4526" />
        <rect x="6" y="6" width="80" height="58" rx="3" fill="url(#cafe-sky)" />
        <path d="M6 48q20-14 40-4t40-6v26H6Z" fill="#8dbd66" />
        <path d="M46 6v58M6 35h80" stroke="#6a4526" strokeWidth="4" />
        <circle cx="70" cy="20" r="7" fill="#fff4c0" />
      </svg>
      <svg className="coffee-cafe__board" viewBox="0 0 96 74" focusable="false">
        <rect width="96" height="74" rx="6" fill="#3d2716" />
        <rect x="5" y="5" width="86" height="64" rx="3" fill="#2f4a3a" />
        <text
          x="48"
          y="29"
          textAnchor="middle"
          fill="#f6efe0"
          fontFamily="DynaPuff, sans-serif"
          fontSize="15"
        >
          NUT
        </text>
        <text
          x="48"
          y="47"
          textAnchor="middle"
          fill="#f6efe0"
          fontFamily="DynaPuff, sans-serif"
          fontSize="15"
        >
          ROAST
        </text>
        <path
          d="M30 57h36"
          stroke="#f2c94c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="5 5"
        />
      </svg>
      <svg className="coffee-cafe__shelf" viewBox="0 0 104 40" focusable="false">
        <path d="M0 36h104" stroke="#6a4526" strokeWidth="6" strokeLinecap="round" />
        <rect
          x="8"
          y="8"
          width="18"
          height="28"
          rx="4"
          fill="#f4ead6"
          stroke={INK}
          strokeWidth="2"
        />
        <rect x="8" y="20" width="18" height="16" rx="3" fill="#a8733f" />
        <rect
          x="34"
          y="14"
          width="16"
          height="22"
          rx="4"
          fill="#f4ead6"
          stroke={INK}
          strokeWidth="2"
        />
        <rect x="34" y="24" width="16" height="12" rx="3" fill="#5c9a45" />
        <rect
          x="58"
          y="4"
          width="20"
          height="32"
          rx="5"
          fill="#f4ead6"
          stroke={INK}
          strokeWidth="2"
        />
        <rect x="58" y="18" width="20" height="18" rx="4" fill="#d9722a" />
        <path d="M86 36c0-14 14-14 14 0" fill="#5c9a45" stroke={INK} strokeWidth="2" />
      </svg>
      <svg className="coffee-cafe__machine" viewBox="0 0 70 64" focusable="false">
        <rect
          x="6"
          y="4"
          width="58"
          height="46"
          rx="7"
          fill="#cbc4b8"
          stroke={INK}
          strokeWidth="2.6"
        />
        <rect x="12" y="10" width="46" height="12" rx="3" fill="#5d564d" />
        <circle cx="20" cy="16" r="3" fill="#86bd5c" />
        <path d="M24 22v10h22V22" fill="#8f877b" stroke={INK} strokeWidth="2.2" />
        <path d="M30 34v6M40 34v6" stroke="#6f4a2f" strokeWidth="2.4" strokeLinecap="round" />
        <rect
          x="26"
          y="42"
          width="18"
          height="8"
          rx="2"
          fill="#fff7ea"
          stroke={INK}
          strokeWidth="2"
        />
        <rect
          x="2"
          y="50"
          width="66"
          height="10"
          rx="3"
          fill="#8f877b"
          stroke={INK}
          strokeWidth="2.4"
        />
      </svg>
      <svg className="coffee-cafe__plant" viewBox="0 0 40 52" focusable="false">
        <path
          d="M20 30C8 26 4 12 10 4c6 8 10 16 10 26ZM20 30c12-4 16-18 10-26-6 8-10 16-10 26ZM20 30c-2-10 0-20 0-28 4 8 4 18 0 28Z"
          fill="#5c9a45"
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M9 30h22l-3 20H12Z"
          fill="#d9722a"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="coffee-cafe__counter" />
    </div>
  );
}

/* --- Bug Squash ------------------------------------------------------------ */

const SPECIES_PAINT: Record<string, { body: string; shell: string }> = {
  // Colour MEANS something: the player should be able to read the behaviour off the
  // pest before deciding whether to commit to it. Chosen against this board (brown
  // desk, grey-tan folders), so the two-tap armoured pest is dark slate against a
  // bright steel plate rather than furniture-coloured.
  worker: { body: '#a95b38', shell: '#e48b55' },
  runner: { body: '#6b4fa8', shell: '#b79cf0' },
  armoured: { body: '#2f4757', shell: '#cfe2ec' },
  rare: { body: '#8a5a12', shell: '#ffd54a' },
};

export function BugArt({
  species,
  squashed = false,
  cracked = false,
}: {
  species: BugSpecies;
  squashed?: boolean;
  cracked?: boolean;
}) {
  if (species.hazard) return <FeatureArt squashed={squashed} />;
  const paint = SPECIES_PAINT[species.id] ?? SPECIES_PAINT.worker;
  const body = paint.body;
  const shell = paint.shell;
  return (
    <svg
      className={`bug bug--${species.id} ${squashed ? 'is-squashed' : ''} ${cracked ? 'is-cracked' : ''}`}
      viewBox="0 0 52 52"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        className="bug__wing bug__wing--left"
        cx="16"
        cy="25"
        rx="10"
        ry="7"
        fill="#d9e9d7"
        stroke="#2a1a0e"
        strokeWidth="1.8"
        transform="rotate(-25 16 25)"
      />
      <ellipse
        className="bug__wing bug__wing--right"
        cx="36"
        cy="25"
        rx="10"
        ry="7"
        fill="#d9e9d7"
        stroke="#2a1a0e"
        strokeWidth="1.8"
        transform="rotate(25 36 25)"
      />
      <ellipse cx="26" cy="31" rx="13" ry="15" fill={body} stroke="#2a1a0e" strokeWidth="2.6" />
      <path d="M26 17v29" stroke="#2a1a0e" strokeWidth="1.7" opacity=".8" />
      <path
        d="M17 22q9 6 18 0M15 33q11 7 22 0"
        stroke={shell}
        strokeWidth="4"
        fill="none"
        opacity=".9"
      />
      <path
        d="M13 27 3 19M39 27l10-8M13 34 2 35M39 34l11 1M17 42l-7 8M35 42l7 8"
        stroke="#2a1a0e"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="21" cy="24" r="4" fill="#fff4e0" />
      <circle cx="31" cy="24" r="4" fill="#fff4e0" />
      <circle cx="22" cy="25" r="1.6" fill="#2a1a0e" />
      <circle cx="30" cy="25" r="1.6" fill="#2a1a0e" />
      <path d="M18 11l4 7M34 11l-4 7" stroke="#2a1a0e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 32q4-3 8 0" stroke="#2a1a0e" strokeWidth="2" fill="none" strokeLinecap="round" />
      {species.id === 'worker' ? (
        <g fill={shell} stroke="#2a1a0e" strokeWidth="1">
          <circle cx="20" cy="30" r="2.2" />
          <circle cx="32" cy="35" r="2.4" />
          <circle cx="24" cy="40" r="1.8" />
        </g>
      ) : null}
      {/* Runner: swept back with a speed line, so "this one moves" reads at a glance. */}
      {species.id === 'runner' ? (
        <>
          <path d="M11 20 3 9l14 6M41 20l8-11-14 6" fill={shell} stroke="#2a1a0e" strokeWidth="2" />
          <path d="M2 44h9M1 39h6" stroke="#2a1a0e" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}
      {/* Armoured: a plate over the back, which splits once it has been cracked. */}
      {species.id === 'armoured' ? (
        <g stroke="#2a1a0e" strokeWidth="2">
          <path d="M15 26q11-8 22 0v8q-11 6-22 0Z" fill={shell} />
          <path d="M19 29h3M25 28h3M31 29h3" strokeWidth="1.6" />
          {cracked ? (
            <path d="M26 24l-4 6 5 3-3 6" fill="none" strokeWidth="2.2" stroke="#c94452" />
          ) : null}
        </g>
      ) : null}
      {/* Golden: it shines. Worth dropping everything for. */}
      {species.id === 'rare' ? (
        <g>
          <path d="M26 17 22 7l4 3 4-3-4 10" fill={shell} stroke="#2a1a0e" strokeWidth="1.8" />
          <path
            d="M8 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
            fill="#fff4c0"
            stroke="#2a1a0e"
            strokeWidth="1.2"
          />
          <path
            d="M44 34l1.4 3.4 3.4 1.4-3.4 1.4L44 43.6l-1.4-3.4-3.4-1.4 3.4-1.4Z"
            fill="#fff4c0"
            stroke="#2a1a0e"
            strokeWidth="1"
          />
        </g>
      ) : null}
      <circle cx="17" cy="17" r="2" fill={shell} opacity=".8" />
    </svg>
  );
}

/**
 * The decoy: a sticky note that has come to life, wearing an "approved" rosette.
 * Square where every bug is round, flat paper where they are shiny shells, and it
 * says FEATURE on it, so it reads as "not a bug" by shape and word before colour.
 */
export function FeatureArt({ squashed = false }: { squashed?: boolean }) {
  return (
    <svg
      className={`bug bug--feature ${squashed ? 'is-squashed' : ''}`}
      viewBox="0 0 52 52"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9 10h32l3 3v29H12l-3-3Z"
        fill="#fff1a8"
        stroke="#2a1a0e"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M41 10v3h3" fill="#f2d96b" stroke="#2a1a0e" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 14h20" stroke="#e0c25a" strokeWidth="2.4" strokeLinecap="round" />
      <text
        x="26"
        y="22"
        textAnchor="middle"
        fontFamily="Nunito, sans-serif"
        fontWeight="800"
        fontSize="7.2"
        fill="#2f5428"
      >
        FEATURE
      </text>
      <circle cx="20" cy="29" r="2.4" fill="#2a1a0e" />
      <circle cx="32" cy="29" r="2.4" fill="#2a1a0e" />
      <path
        d="M21 34q5 4 10 0"
        fill="none"
        stroke="#2a1a0e"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M9 31 3 26M44 31l5-6" stroke="#2a1a0e" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="41" cy="41" r="8" fill="#5c9a45" stroke="#2a1a0e" strokeWidth="2" />
      <path
        d="M37.4 41.2l2.6 2.6 4.6-5"
        fill="none"
        stroke="#fffaf0"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 47l-2 5 4-1.6M46 47l2 5-4-1.6"
        fill="#c94452"
        stroke="#2a1a0e"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* --- shared icons ------------------------------------------------------------ */

/** A pause glyph drawn as two bars (no font glyph to fall back on). */
export function PauseGlyph() {
  return (
    <svg className="micro-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3.5" y="2.5" width="3.2" height="11" rx="1.2" fill="currentColor" />
      <rect x="9.3" y="2.5" width="3.2" height="11" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function PlayGlyph() {
  return (
    <svg className="micro-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4.5 2.8v10.4l8.4-5.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A keyboard key cap with a drawn arrow, for control hints (arrow glyphs are not in the fonts). */
export function KeyCap({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="micro-key" viewBox="0 0 22 20" aria-hidden="true" focusable="false">
      <rect
        x="1"
        y="1"
        width="20"
        height="18"
        rx="4"
        fill="#fffaf0"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d={dir === 'left' ? 'M14 10H8m3-3.2L7.8 10l3.2 3.2' : 'M8 10h6m-3-3.2 3.2 3.2-3.2 3.2'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
