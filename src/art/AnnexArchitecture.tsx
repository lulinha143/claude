import { memo } from 'react';

// The three annex rooms each carry a piece of architecture the shared room
// layers cannot draw: the studio's ON AIR lamp and cork panels, the workshop's
// roll-up bay door and its overhead crane rail, the conservatory's iron-and-glass
// roof. Everything here is fixed to the building (walls and ceiling only) and
// sits behind the cast and the player's decorations, so the floor stays theirs.
//
// Drawn at the room's own aspect (600 x 220 scene units, the wall above the
// floor line), stretched to the room; the room's CSS sets the materials around it.

type AnnexRoom = 'broadcast' | 'repair' | 'conservatory';

export const ANNEX_ROOMS: readonly AnnexRoom[] = ['broadcast', 'repair', 'conservatory'];

function isAnnex(roomId: string): roomId is AnnexRoom {
  return (ANNEX_ROOMS as readonly string[]).includes(roomId);
}

/**
 * The studio: quilted cork panels in two bays either side of the control-room
 * pane, and the ON AIR lamp over the door at the right, clear of where the cast
 * stands (their mood stickers rise into the middle of the wall).
 */
function Studio() {
  const panel = (x: number, y: number, key: string) => (
    <g key={key}>
      <rect x={x} y={y} width="28" height="30" rx="5" className="annex__cork" />
      <path d={`M${x + 4} ${y + 15}h20M${x + 14} ${y + 4}v22`} className="annex__cork-seam" />
    </g>
  );
  const panels: JSX.Element[] = [];
  // Two columns between the record wall (left) and the pane, two beyond it.
  for (const x0 of [120, 380]) {
    for (let col = 0; col < 2; col += 1) {
      for (let row = 0; row < 2; row += 1) {
        panels.push(panel(x0 + col * 32, 52 + row * 34, `${x0}${col}${row}`));
      }
    }
  }
  return (
    <>
      {panels}
      {/* the door frame at the right (its ON AIR lamp is drawn above it, below) */}
      <path d="M512 160V60h64v100" className="annex__door" />
    </>
  );
}

/** The workshop: a roll-up bay door on the right, and a crane rail across the ceiling. */
function Workshop() {
  const slats = Array.from({ length: 9 }, (_, i) => (
    <path key={i} d={`M422 ${58 + i * 11}h138`} className="annex__slat" />
  ));
  return (
    <>
      {/* the overhead rail and its hook trolley */}
      <path d="M0 18h600" className="annex__rail" />
      <g className="annex__trolley">
        <rect x="236" y="12" width="28" height="12" rx="2" className="annex__steel" />
        <path d="M250 24v24" className="annex__chain" />
        <path d="M244 48q6 10 12 0" className="annex__hook" />
      </g>
      {/* the bay door, half up, hazard-striped at its foot */}
      <rect x="414" y="48" width="154" height="112" rx="3" className="annex__bay" />
      {slats}
      <rect x="414" y="150" width="154" height="10" className="annex__hazard" />
      {/* a breaker panel by the door */}
      <rect x="380" y="74" width="24" height="34" rx="2" className="annex__steel" />
      <path d="M386 84h12M386 92h12M386 100h12" className="annex__breaker" />
    </>
  );
}

/** The conservatory: an arched iron-and-glass roof, ribs running down to the sill. */
function Glasshouse() {
  const ribs = [60, 150, 240, 360, 450, 540].map((x) => (
    <path key={x} d={`M${x} 160 Q${x} 50 300 6`} className="annex__rib" />
  ));
  return (
    <>
      {/* the glass, catching a lot more sky than any office window */}
      <path d="M0 160 Q0 30 300 6 Q600 30 600 160Z" className="annex__glass" />
      {ribs}
      <path d="M0 102 Q300 30 600 102" className="annex__purlin" />
      {/* hanging planters off the ribs */}
      {[150, 450].map((x) => (
        <g key={x} className="annex__planter">
          <path d={`M${x} 52v22`} className="annex__chain" />
          <path d={`M${x - 12} 74h24l-4 14h-16Z`} className="annex__pot" />
          <path
            d={`M${x - 10} 74q-6 10-4 22M${x + 10} 74q6 10 4 22M${x} 74q0 12 2 24`}
            className="annex__trail"
          />
        </g>
      ))}
      {/* the iron sill the glass sits on */}
      <path d="M0 160h600" className="annex__sill" />
    </>
  );
}

export const AnnexArchitecture = memo(function AnnexArchitecture({ roomId }: { roomId: string }) {
  if (!isAnnex(roomId)) return null;
  return (
    <>
      {/* The lamp keeps its own proportions (the wall art stretches to the room). */}
      {roomId === 'broadcast' ? (
        <span className="annex__onair" aria-hidden>
          ON AIR
        </span>
      ) : null}
      <svg
        className={`annex-architecture annex-architecture--${roomId}`}
        viewBox="0 0 600 220"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {roomId === 'broadcast' ? <Studio /> : roomId === 'repair' ? <Workshop /> : <Glasshouse />}
      </svg>
    </>
  );
});
