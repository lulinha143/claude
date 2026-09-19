// Click-station sprites.
//
// Drawn in exactly the same idiom as the decoration sprites (see decoArt.tsx):
// integer pixel blocks on a 24x28 grid, crisp edges, the same cohesive palette,
// the same top-left light, contacting the support at the grid baseline. Stations
// are equipment rather than furniture, so they lean on the metal and screen
// tones and each one carries a small "active" accent that the feedback layer
// pulses on a tap — but they must read as belonging to the same company as the
// props around them, which is why the palette is shared rather than reinvented.

import { memo } from 'react';
import type { ClickStationKind } from '../content/clickStations';

// Palette kept deliberately in step with decoArt's `C`. Shared names, shared
// values: a station and a filing cabinet should look like the same company
// bought them.
const C = {
  out: '#2a1d12',
  k: '#3a2817',
  w: '#6f4a24',
  wd: '#96662f',
  wl: '#c08a44',
  wh: '#e6c690',
  paper: '#f2e6c8',
  white: '#fffdf4',
  ms: '#5c6774',
  m: '#8b97a4',
  ml: '#c2ccd6',
  lg: '#2f6b3f',
  g: '#4f9d5a',
  gl: '#79c06e',
  tt: '#a24e33',
  t: '#cd7449',
  tl: '#e2b48c',
  scr: '#6fa8c4',
  scrl: '#a6d6ea',
  scrd: '#2b3a44',
  gy: '#cf9a34',
  gold: '#ffd36b',
  goldl: '#fff0b8',
  red: '#b0473a',
  redl: '#d86a52',
  blue: '#5f7fc0',
  bluel: '#8fb4e6',
  vio: '#8a5fb0',
  viol: '#b48fd6',
  shadow: 'rgba(40,29,18,0.22)',
} as const;

type Rect = readonly [number, number, number, number, string];

interface StationSprite {
  base: Rect[];
  /** pulsed on tap (class `station__accent`) */
  accent?: Rect[];
  shadowR?: number;
}

const rectEl = ([x, y, w, h, fill]: Rect, i: number) => (
  <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
);

// --- shared parts -----------------------------------------------------------

/** A plain crate/box body. */
function box(x: number, y: number, w: number, h: number): Rect[] {
  return [
    [x, y, w, h, C.wd],
    [x, y, w, 1, C.wl],
    [x, y + h - 1, w, 1, C.w],
    [x, y, 1, h, C.wl],
    [x + w - 1, y, 1, h, C.w],
  ];
}

/** A metal housing. */
function housing(x: number, y: number, w: number, h: number): Rect[] {
  return [
    [x, y, w, h, C.m],
    [x, y, w, 1, C.ml],
    [x, y + h - 1, w, 1, C.ms],
    [x + w - 1, y, 1, h, C.ms],
  ];
}

/** Four short legs under a housing. */
function legs(x: number, w: number, y: number): Rect[] {
  return [
    [x + 1, y, 2, 2, C.k],
    [x + w - 3, y, 2, 2, C.k],
  ];
}

const SPRITES: Record<ClickStationKind, StationSprite> = {
  'mixing-desk': {
    base: [
      [2, 14, 20, 9, C.w],
      [4, 23, 2, 4, C.k],
      [18, 23, 2, 4, C.k],
      [3, 13, 18, 6, C.ms],
      [4, 14, 4, 3, C.paper],
      [10, 14, 1, 4, C.ml],
      [13, 14, 1, 4, C.ml],
      [16, 14, 1, 4, C.ml],
      [19, 14, 1, 4, C.ml],
      [4, 5, 2, 8, C.k],
      [3, 3, 4, 5, C.m],
    ],
    accent: [
      [10, 15, 2, 1, C.gl],
      [16, 16, 2, 1, C.gold],
    ],
  },
  'test-bench': {
    base: [
      [2, 16, 20, 4, C.wl],
      [3, 20, 3, 7, C.ms],
      [18, 20, 3, 7, C.ms],
      [4, 6, 10, 10, C.ms],
      [5, 7, 8, 7, C.scrd],
      [16, 10, 5, 6, C.m],
      [17, 8, 3, 3, C.ml],
    ],
    accent: [
      [6, 11, 2, 1, C.gl],
      [8, 9, 1, 3, C.gl],
      [9, 9, 3, 1, C.gl],
    ],
  },
  'rain-gauge': {
    base: [
      [10, 7, 4, 18, C.ml],
      [5, 25, 14, 2, C.ms],
      [5, 5, 14, 3, C.m],
      [7, 8, 10, 2, C.m],
      [11, 14, 2, 9, C.scr],
      [15, 13, 5, 7, C.w],
      [16, 14, 3, 3, C.paper],
    ],
    accent: [
      [10, 2, 1, 2, C.scrl],
      [15, 1, 1, 2, C.scrl],
    ],
  },
  // A nut crate, lid slightly ajar, acorns showing.
  crate: {
    base: [
      ...box(4, 14, 16, 13),
      [6, 17, 12, 1, C.w],
      [6, 21, 12, 1, C.w],
      // acorns spilling over the rim
      [7, 11, 3, 3, C.wl],
      [7, 10, 3, 1, C.k],
      [12, 12, 3, 2, C.wh],
      [12, 11, 3, 1, C.k],
    ],
    accent: [
      [15, 10, 3, 3, C.gold],
      [15, 9, 3, 1, C.gy],
    ],
  },

  // A sorting chute: angled tray with nuts running down it.
  chute: {
    base: [
      ...housing(3, 13, 18, 4),
      [3, 17, 3, 10, C.ms],
      [18, 17, 3, 10, C.ms],
      [6, 20, 12, 2, C.k],
      ...legs(3, 18, 25),
      [8, 10, 8, 3, C.m],
      [8, 10, 8, 1, C.ml],
    ],
    accent: [
      [9, 14, 2, 2, C.gold],
      [13, 14, 2, 2, C.goldl],
    ],
  },

  // A coffee urn with a tap and a warming plate.
  urn: {
    base: [
      ...housing(7, 9, 10, 14),
      [9, 11, 6, 5, C.ms],
      [11, 19, 2, 3, C.k], // tap
      [5, 23, 14, 2, C.ms],
      [5, 25, 14, 2, C.k],
      [10, 6, 4, 3, C.m],
    ],
    accent: [
      [9, 11, 6, 5, C.t],
      [10, 12, 4, 2, C.tl],
    ],
  },

  // A standing ledger on a lectern.
  ledger: {
    base: [
      [11, 20, 2, 7, C.w],
      [7, 25, 10, 2, C.k],
      ...box(5, 12, 14, 8),
      [6, 13, 12, 6, C.paper],
      [7, 15, 10, 1, C.w],
      [7, 17, 7, 1, C.w],
    ],
    accent: [
      [6, 13, 12, 1, C.gold],
      [15, 10, 2, 3, C.red],
    ],
  },

  // A heavy shell press with a ram.
  press: {
    base: [
      ...housing(4, 16, 16, 8),
      [4, 24, 16, 3, C.k],
      [6, 6, 3, 10, C.ms],
      [15, 6, 3, 10, C.ms],
      [5, 4, 14, 3, C.m],
      [5, 4, 14, 1, C.ml],
      [9, 12, 6, 4, C.k], // ram
    ],
    accent: [
      [9, 18, 6, 3, C.gold],
      [10, 19, 4, 1, C.goldl],
    ],
  },

  // A behavioural centrifuge: domed glass over a spinning rotor.
  centrifuge: {
    base: [
      ...housing(5, 15, 14, 9),
      [5, 24, 14, 3, C.k],
      [6, 8, 12, 7, C.scrd],
      [7, 9, 10, 5, C.scr],
      [8, 10, 8, 3, C.scrl],
      [4, 7, 16, 1, C.ml],
    ],
    accent: [
      [10, 10, 4, 3, C.vio],
      [11, 11, 2, 1, C.viol],
      [7, 18, 3, 2, C.gl],
    ],
  },

  // An announcement horn on a bracket.
  /* A megaphone on a post, flaring to the right.
     The old one went from a 4-wide throat to an 18-tall mouth in three steps, with the
     red accent floating as a separate bar past the rim — at room size it read as grey
     blocks with a detached red smear. A horn needs a readable CONE, so this flares in
     six even steps (6, 8, 12, 14, 18, 20) from a gripped throat to a belled rim, with
     the rim lit along the top and shaded underneath. The accent is the mouth of the
     bell rather than something beside it, so a tap looks like the horn sounding. */
  megaphone: {
    base: [
      // post and plinth
      [7, 26, 10, 2, C.k],
      [10, 20, 3, 6, C.ms],
      // grip behind the throat
      [3, 12, 3, 5, C.k],
      // throat flaring out to the bell
      [6, 11, 2, 6, C.ms],
      [8, 10, 2, 8, C.m],
      [10, 8, 2, 12, C.m],
      [12, 7, 2, 14, C.ml],
      [14, 5, 2, 18, C.m],
      [16, 4, 2, 20, C.ml],
      // lit top rim, shaded underside
      [16, 4, 2, 1, C.white],
      [16, 23, 2, 1, C.ms],
    ],
    accent: [
      [16, 7, 2, 14, C.red],
      [16, 10, 2, 8, C.redl],
    ],
  },

  // A vault deposit wheel.
  safe: {
    base: [
      ...housing(4, 10, 16, 14),
      [4, 24, 16, 3, C.k],
      [6, 12, 12, 10, C.ms],
      [10, 15, 4, 4, C.ml],
      [11, 12, 2, 3, C.m],
      [11, 19, 2, 3, C.m],
      [7, 16, 3, 2, C.m],
      [14, 16, 3, 2, C.m],
    ],
    accent: [
      [10, 15, 4, 4, C.gold],
      [11, 16, 2, 2, C.goldl],
    ],
  },

  // An observation terminal: screen plus a notes shelf.
  observation: {
    base: [
      [10, 22, 4, 4, C.ms],
      [7, 26, 10, 1, C.k],
      [4, 8, 16, 12, C.k],
      [5, 9, 14, 10, C.scrd],
      [6, 10, 12, 8, C.scr],
      [4, 20, 16, 2, C.m],
    ],
    accent: [
      [7, 11, 10, 1, C.scrl],
      [7, 13, 6, 1, C.gl],
      [7, 15, 8, 1, C.scrl],
    ],
  },

  // A desk bell on the agenda folder.
  agenda: {
    base: [
      [4, 22, 16, 3, C.paper],
      [4, 25, 16, 2, C.w],
      [5, 23, 8, 1, C.w],
      [9, 12, 6, 4, C.ml],
      [8, 16, 8, 6, C.m],
      [8, 21, 8, 1, C.ms],
      [11, 9, 2, 3, C.ms],
    ],
    accent: [
      [11, 8, 2, 2, C.gold],
      [9, 17, 6, 2, C.goldl],
    ],
  },

  // A dream recorder: soft lamp over a paper roll.
  dreamlog: {
    base: [
      [11, 20, 2, 6, C.ms],
      [7, 26, 10, 1, C.k],
      [6, 14, 12, 6, C.m],
      [7, 15, 10, 4, C.paper],
      [8, 17, 8, 1, C.w],
      [7, 7, 10, 5, C.ms],
      [8, 8, 8, 3, C.m],
    ],
    accent: [
      [8, 11, 8, 2, C.viol],
      [9, 13, 6, 1, C.vio],
    ],
  },

  // The basement furnace valve. Warm, and asking no questions.
  furnace: {
    base: [
      ...housing(4, 12, 16, 12),
      [4, 24, 16, 3, C.k],
      [6, 14, 12, 8, C.scrd],
      [3, 8, 4, 4, C.ms],
      [17, 8, 4, 4, C.ms],
      [9, 6, 6, 6, C.m],
      [11, 4, 2, 2, C.ms],
    ],
    accent: [
      [7, 16, 10, 5, C.red],
      [8, 17, 8, 3, C.gold],
      [10, 18, 4, 1, C.goldl],
    ],
  },

  // A cafeteria serving line: heated trays under a sneeze guard.
  servery: {
    base: [
      ...housing(3, 16, 18, 6),
      [3, 22, 18, 3, C.k],
      ...legs(3, 18, 25),
      [5, 12, 14, 1, C.ml],
      [5, 8, 1, 5, C.ml],
      [18, 8, 1, 5, C.ml],
      [5, 7, 14, 1, C.m],
    ],
    accent: [
      [5, 17, 4, 3, C.t],
      [10, 17, 4, 3, C.gold],
      [15, 17, 4, 3, C.tl],
    ],
  },

  // A pneumatic tube station: a canister waiting in a glass column.
  tube: {
    base: [
      [8, 4, 8, 20, C.ms],
      [9, 5, 6, 18, C.scrd],
      [10, 6, 4, 16, C.scr],
      [6, 24, 12, 3, C.m],
      [6, 27, 12, 1, C.k],
      [5, 3, 14, 2, C.ml],
    ],
    accent: [
      [10, 14, 4, 6, C.gold],
      [11, 15, 2, 2, C.goldl],
    ],
  },

  // A wall of security monitors on a stand.
  monitors: {
    base: [
      [11, 22, 2, 4, C.ms],
      [7, 26, 10, 1, C.k],
      [3, 6, 8, 7, C.k],
      [4, 7, 6, 5, C.scrd],
      [13, 6, 8, 7, C.k],
      [14, 7, 6, 5, C.scrd],
      [3, 14, 8, 7, C.k],
      [4, 15, 6, 5, C.scrd],
      [13, 14, 8, 7, C.k],
      [14, 15, 6, 5, C.scrd],
    ],
    accent: [
      [4, 7, 6, 5, C.scr],
      [14, 15, 6, 5, C.scr],
      [5, 16, 2, 1, C.gl],
    ],
  },

  // A flatbed document scanner mid-pass.
  scanner: {
    base: [
      ...housing(3, 14, 18, 7),
      [3, 21, 18, 3, C.k],
      ...legs(3, 18, 24),
      [5, 10, 14, 4, C.paper],
      [6, 11, 12, 1, C.w],
      [6, 13, 8, 1, C.w],
      [3, 13, 18, 1, C.ml],
    ],
    accent: [
      [4, 17, 16, 2, C.scrl],
      [4, 16, 16, 1, C.scr],
    ],
  },

  // A behavioural incubation pod. Nobody is entirely sure what is inside.
  pod: {
    base: [
      ...housing(6, 20, 12, 5),
      [6, 25, 12, 2, C.k],
      [7, 6, 10, 14, C.scrd],
      [8, 7, 8, 12, C.scr],
      [6, 4, 12, 2, C.ml],
      [5, 5, 2, 15, C.ms],
      [17, 5, 2, 15, C.ms],
    ],
    accent: [
      [10, 10, 4, 7, C.vio],
      [11, 11, 2, 4, C.viol],
      [8, 21, 3, 2, C.gl],
    ],
  },

  // A rooftop signal dish.
  /* A parabolic dish on a mast, aimed to the right.
     The previous version stacked bars whose heights DESCENDED left to right (10, 12,
     10, 7, 4), which draws a lopsided wedge rather than a dish, and parked its accent
     as a detached 2x2 square in the top-left corner. Rendered at 70x81 in a room it
     read as a handful of grey blocks — you could not tell what the object was.
     A dish is a round thing, and the way pixel art draws round is by STEPPING: bars
     that grow to the middle and shrink away again give a circular outline, the far rim
     sits in shade, the near face catches the light, and a feed arm on a boom tells you
     which way it is pointing. The face is the accent, so tapping it lights the dish. */
  antenna: {
    base: [
      // plinth and mast
      [7, 26, 10, 2, C.k],
      [11, 20, 2, 6, C.ms],
      [9, 19, 6, 2, C.m],
      // dish, stepped to a round silhouette: far rim in shade, near face lighter
      [7, 9, 2, 10, C.ms],
      [9, 7, 2, 14, C.m],
      [11, 6, 2, 16, C.ml],
      [13, 7, 2, 14, C.ml],
      [15, 9, 2, 10, C.m],
      // top-left light catches the upper rim
      [9, 7, 2, 1, C.white],
      [11, 6, 2, 1, C.white],
      // feed boom and horn, so the dish is clearly aimed somewhere
      [17, 13, 3, 2, C.ms],
      [20, 12, 2, 4, C.ml],
    ],
    accent: [
      [11, 9, 2, 10, C.scrl],
      [13, 10, 2, 8, C.scr],
    ],
  },
};

export interface StationArtProps {
  kind: ClickStationKind;
  /** rendered scale multiplier (1 = 52x60 like the decoration sprites). */
  scale?: number;
}

/**
 * Pure sprite renderer. The tap animation lives in CSS on the wrapping button so
 * this component never re-renders per click — a clicker retriggers this art many
 * times a second and must not pay for a React update to draw its own feedback.
 */
function StationArtImpl({ kind, scale = 1 }: StationArtProps) {
  const sprite = SPRITES[kind];
  const shadowR = sprite.shadowR ?? 8;
  return (
    <svg
      width={52 * scale}
      height={60 * scale}
      viewBox="0 0 24 28"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {shadowR > 0 ? <ellipse cx={12} cy={27} rx={shadowR} ry={1.4} fill={C.shadow} /> : null}
      {sprite.base.map(rectEl)}
      {sprite.accent ? <g className="station__accent">{sprite.accent.map(rectEl)}</g> : null}
    </svg>
  );
}

export const StationArt = memo(StationArtImpl);
