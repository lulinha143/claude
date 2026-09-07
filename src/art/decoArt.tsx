import { Fragment, type CSSProperties } from 'react';

// ============================================================================
//  Unified pixel-art decoration sprites
// ============================================================================
// Every decoration is drawn from integer pixel blocks on a shared 24x28 grid
// with crisp (nearest-neighbour) edges, one cohesive cozy palette, and a
// consistent top-left light. Floor/table props contact their support at the
// grid baseline (y=27 -> 27/28 ~= 0.964 of the box). That matches the placed
// and ghost anchor transforms exactly, so a dragged preview lines up with the
// final placement.
//
// The visual is chosen per *item id* so all 32 catalogue pieces read as
// distinct objects, even where several share an interaction "kind" (e.g.
// sawdust-pile, lab-plants and a fern are all the `plant` kind for sound and
// class purposes, but look nothing alike). The `kind` still drives behaviour
// (sound / .decor--kind / data-on / data-variant) in DecorationProp; this
// module only owns pixels.

// --- palette (limited + cohesive) ------------------------------------------
const C = {
  out: '#2a1d12',
  k: '#3a2817', // darkest wood
  w: '#6f4a24', // wood shadow
  wd: '#96662f', // wood
  wl: '#c08a44', // wood light
  wh: '#e6c690', // wood highlight
  paper: '#f2e6c8',
  white: '#fffdf4',
  ms: '#5c6774', // metal shadow
  m: '#8b97a4', // metal
  ml: '#c2ccd6', // metal light
  lg: '#2f6b3f', // leaf dark
  g: '#4f9d5a', // leaf
  gl: '#79c06e', // leaf light
  stem: '#2f6d47',
  tt: '#a24e33', // terracotta shadow
  t: '#cd7449', // terracotta
  tl: '#e2b48c', // terracotta light
  scr: '#6fa8c4', // glass / screen on
  scrl: '#a6d6ea', // screen light
  scrd: '#2b3a44', // screen off / dark
  gy: '#cf9a34', // gold shadow
  gold: '#ffd36b',
  goldl: '#fff0b8',
  red: '#b0473a',
  redl: '#d86a52',
  blue: '#5f7fc0',
  bluel: '#8fb4e6',
  vio: '#8a5fb0',
  viol: '#b48fd6',
  glow: 'rgba(255,211,107,0.34)',
  glowc: 'rgba(120,200,230,0.34)',
  glowp: 'rgba(180,143,214,0.34)',
  shadow: 'rgba(40,29,18,0.22)',
} as const;

type Rect = readonly [number, number, number, number, string];

interface Sprite {
  base: Rect[];
  glow?: Rect[]; // rendered behind base when `on`
  lit?: Rect[]; // over base when `on`
  unlit?: Rect[]; // over base when `!on`
  leaf?: Rect[]; // gentle sway group (.decor__leaf)
  bubble?: Rect[]; // rising bubbles (.decor__bubble)
  spin?: Rect[]; // twinkle group (.decor__spin)
  shadowR?: number; // contact shadow radius; 0 hides it (wall/ceiling props)
}

// --- shared parts -----------------------------------------------------------
function pot(rimHi: string, rim: string, body: string, shade: string): Rect[] {
  return [
    [6, 19, 12, 1, rimHi],
    [6, 20, 12, 1, rim],
    [7, 21, 10, 6, body],
    [14, 21, 3, 6, shade],
    [7, 20, 10, 1, C.k], // soil line
  ];
}

function bush(dark: string, mid: string, light: string, tall = false): Rect[] {
  if (tall) {
    // spiky / upright (lab plant)
    return [
      [11, 5, 2, 5, mid],
      [8, 7, 3, 6, dark],
      [13, 7, 3, 6, dark],
      [10, 9, 4, 8, mid],
      [9, 12, 6, 5, light],
      [7, 14, 3, 4, dark],
      [14, 14, 3, 4, dark],
      [11, 9, 1, 6, light],
    ];
  }
  return [
    [10, 7, 4, 2, mid],
    [8, 9, 8, 2, mid],
    [7, 11, 10, 2, light],
    [6, 13, 12, 2, mid],
    [7, 15, 10, 2, dark],
    [9, 17, 6, 2, dark],
    [9, 9, 2, 1, light],
    [12, 12, 2, 1, light],
    [8, 13, 2, 1, light],
  ];
}

const EMBLEMS = ['#ffd54a', '#e07a5f', '#7fb0c8'];

// --- per-item sprites -------------------------------------------------------
function spriteFor(id: string, on: boolean, variant: number, accent: string): Sprite {
  switch (id) {
    // ---- plants ----------------------------------------------------------
    case 'potted-fern':
      return { base: pot(C.tl, C.t, C.t, C.tt), leaf: bush(C.lg, C.g, C.gl) };
    case 'meeting-plant':
      return {
        base: pot('#8fb4e6', C.blue, C.blue, '#3f5aa0'),
        leaf: [
          [8, 7, 8, 3, C.g],
          [6, 10, 12, 3, C.gl],
          [7, 13, 10, 3, C.g],
          [9, 16, 6, 2, C.lg],
          [9, 9, 3, 1, C.gl],
          [13, 11, 2, 1, C.gl],
        ],
      };
    case 'lab-plants':
      return { base: pot(C.ml, C.m, C.ml, C.ms), leaf: bush('#2f7d6b', '#3fae94', '#7fdcc4', true) };
    case 'rooftop-garden-bed':
      // low wide wooden planter with tufts + a bloom
      return {
        base: [
          [3, 20, 18, 1, C.wl],
          [3, 21, 18, 6, C.wd],
          [3, 21, 18, 1, C.wh],
          [4, 22, 16, 1, C.k],
          [3, 26, 18, 1, C.w],
        ],
        leaf: [
          [5, 15, 3, 5, C.g],
          [8, 13, 3, 7, C.gl],
          [12, 14, 3, 6, C.g],
          [15, 16, 3, 4, C.lg],
          [8, 12, 3, 2, accent], // bloom
          [9, 11, 1, 1, C.goldl],
        ],
        shadowR: 10,
      };
    case 'sawdust-pile':
      return {
        base: [
          [11, 13, 3, 1, C.wh],
          [9, 14, 7, 2, C.wh],
          [7, 16, 11, 2, C.wl],
          [5, 18, 15, 3, C.wl],
          [3, 21, 19, 5, C.wd],
          [2, 25, 21, 2, C.w],
          [5, 20, 2, 1, C.wh],
          [9, 22, 3, 1, C.wh],
          [15, 21, 2, 1, C.k],
          [18, 17, 4, 1, C.k],
          [4, 16, 3, 1, C.k],
          [13, 24, 4, 1, C.wh],
        ],
        shadowR: 11,
      };

    // ---- lamps -----------------------------------------------------------
    case 'desk-lamp':
      return {
        base: [
          [7, 25, 8, 2, C.k],
          [8, 24, 6, 1, C.m],
          [11, 14, 2, 11, C.m],
          [11, 13, 6, 2, C.m],
          [15, 9, 2, 5, on ? accent : C.ms],
          [14, 12, 5, 2, on ? accent : C.ms],
          [16, 8, 3, 2, on ? accent : C.ms],
        ],
        glow: [[12, 9, 10, 8, C.glow]],
        lit: [[16, 13, 3, 1, C.goldl]],
      };
    case 'mood-lighting':
      // Sculptural ambient tower with stacked color cells and a broad aura.
      return {
        base: [
          [7, 25, 10, 2, C.k],
          [9, 23, 6, 2, C.m],
          [8, 7, 8, 16, C.ms],
          [9, 8, 6, 4, on ? C.viol : C.ms],
          [9, 13, 6, 4, on ? C.scr : C.ms],
          [9, 18, 6, 4, on ? C.gold : C.ms],
          [10, 8, 1, 13, C.white],
        ],
        glow: [[5, 5, 14, 19, C.glowp]],
      };
    case 'neon-sign': {
      // Hollow neon acorn: cap, tapered shell, and stem stay legible at card size.
      const nc = on ? '#ff5fa8' : '#5a3a52';
      const nl = on ? '#ffc0e0' : '#6a4a62';
      return {
        base: [
          [11, 3, 2, 3, nc],
          [8, 6, 8, 2, nc],
          [6, 8, 12, 3, nc],
          [6, 11, 2, 6, nc],
          [16, 11, 2, 6, nc],
          [8, 17, 2, 2, nc],
          [14, 17, 2, 2, nc],
          [10, 19, 4, 2, nc],
          [8, 8, 8, 1, nl],
          [7, 11, 1, 4, nl],
        ],
        glow: [[4, 2, 16, 21, 'rgba(255,95,168,0.30)']],
        shadowR: 0,
      };
    }
    case 'chandelier':
      // Branched brass fixture with three unmistakable glowing acorn pendants.
      return {
        base: [
          [11, 0, 2, 5, C.m],
          [10, 4, 4, 2, C.gold],
          [5, 6, 14, 2, C.gy],
          [4, 7, 2, 4, C.gy],
          [11, 7, 2, 4, C.gy],
          [18, 7, 2, 4, C.gy],
          [3, 10, 4, 2, C.w],
          [10, 10, 4, 2, C.w],
          [17, 10, 4, 2, C.w],
          [4, 12, 2, 4, on ? C.gold : C.gy],
          [11, 12, 2, 4, on ? C.gold : C.gy],
          [18, 12, 2, 4, on ? C.gold : C.gy],
          [5, 16, 1, 1, on ? C.goldl : C.gy],
          [12, 16, 1, 1, on ? C.goldl : C.gy],
          [19, 16, 1, 1, on ? C.goldl : C.gy],
        ],
        glow: [[2, 8, 20, 11, C.glow]],
        shadowR: 0,
      };
    case 'star-ceiling':
      return {
        base: [
          [2, 0, 20, 7, C.scrd],
          [4, 1, 1, 1, C.goldl],
          [8, 2, 1, 1, C.gold],
          [12, 1, 1, 1, C.goldl],
          [16, 3, 1, 1, C.gold],
          [19, 1, 1, 1, C.goldl],
          [6, 4, 1, 1, C.gold],
          [14, 5, 1, 1, C.goldl],
          [10, 4, 1, 1, C.gold],
        ],
        glow: on ? [[2, 0, 20, 7, 'rgba(255,211,107,0.18)']] : undefined,
        spin: [[11, 2, 1, 1, C.white]],
        shadowR: 0,
      };
    case 'hologram':
      // Ceiling emitter projects a cyan acorn through a fading light cone.
      return {
        base: [
          [8, 0, 8, 2, C.ms],
          [10, 2, 4, 2, C.m],
          [11, 7, 2, 2, on ? C.scrl : C.ms],
          [8, 9, 8, 3, on ? C.scr : C.scrd],
          [7, 12, 10, 3, on ? C.scr : C.scrd],
          [8, 15, 8, 4, on ? C.scrl : C.ms],
          [10, 19, 4, 2, on ? C.scr : C.scrd],
        ],
        glow: [
          [7, 4, 10, 4, 'rgba(120,200,230,0.16)'],
          [5, 8, 14, 9, C.glowc],
          [7, 17, 10, 5, 'rgba(120,200,230,0.16)'],
        ],
        shadowR: 0,
      };

    // ---- posters / wall art ---------------------------------------------
    case 'motivational-poster': {
      const emblem = EMBLEMS[variant % EMBLEMS.length];
      return {
        base: [
          [6, 3, 12, 20, C.k],
          [8, 5, 8, 16, C.paper],
          [9, 6, 3, 3, emblem],
          [8, 15, 8, 5, C.g],
          [8, 15, 3, 3, C.gl],
          [12, 16, 4, 4, C.lg],
        ],
        shadowR: 0,
      };
    }
    case 'window-view':
      return {
        base: [
          [4, 2, 16, 21, C.wd],
          [4, 2, 16, 1, C.wl],
          [6, 4, 12, 15, C.bluel],
          [13, 6, 3, 3, C.goldl], // sun
          [6, 14, 12, 5, C.g], // hills
          [7, 13, 4, 2, C.gl],
          [11, 4, 1, 15, C.wd], // mullions
          [6, 10, 12, 1, C.wd],
          [4, 19, 16, 4, C.w], // sill
        ],
        shadowR: 0,
      };
    case 'wooden-arch':
      return {
        base: [
          [9, 2, 6, 2, C.wl],
          [7, 4, 10, 2, C.wl],
          [5, 6, 4, 4, C.wd],
          [15, 6, 4, 4, C.wd],
          [4, 10, 4, 15, C.wd],
          [16, 10, 4, 15, C.wd],
          [5, 7, 2, 17, C.wl],
          [17, 7, 2, 17, C.w],
          [8, 6, 8, 2, C.w],
          [3, 24, 6, 3, C.k],
          [15, 24, 6, 3, C.k],
        ],
        shadowR: 9,
      };
    case 'blueprint-wall':
      return {
        base: [
          [4, 3, 16, 19, C.blue],
          [4, 3, 16, 1, C.bluel],
          [6, 6, 12, 1, C.white],
          [6, 9, 8, 1, C.white],
          [6, 12, 12, 1, C.white],
          [6, 15, 5, 1, C.white],
          [13, 15, 5, 1, C.white],
          [6, 18, 9, 1, C.white],
          [8, 7, 1, 5, C.scrl], // little floor-plan corners
          [15, 12, 1, 6, C.scrl],
          [16, 8, 2, 2, C.redl], // reviewer's note
          [11, 2, 2, 2, C.ml], // pin
        ],
        shadowR: 0,
      };
    case 'billboard':
      return {
        base: [
          [7, 19, 2, 8, C.w],
          [15, 19, 2, 8, C.w],
          [2, 3, 20, 16, C.k],
          [4, 5, 16, 12, accent],
          [6, 7, 12, 1, C.white],
          [6, 10, 9, 1, C.white],
          [6, 13, 11, 1, C.white],
          [2, 3, 20, 1, C.wl],
        ],
        shadowR: 8,
      };

    // ---- rugs ------------------------------------------------------------
    case 'tiny-rug':
      // Stepped perspective silhouette reads as a floor textile, not a shelf.
      return {
        base: [
          [8, 20, 8, 1, C.wh],
          [6, 21, 12, 1, accent],
          [4, 22, 16, 2, accent],
          [2, 24, 20, 3, accent],
          [4, 22, 16, 1, C.wh],
          [6, 24, 12, 1, C.wl],
          [9, 25, 6, 1, C.wh],
          [2, 26, 20, 1, C.w],
          [0, 25, 2, 1, C.wh],
          [22, 25, 2, 1, C.wh],
        ],
        shadowR: 0,
      };
    case 'gold-carpet':
      return {
        base: [
          [7, 19, 10, 1, C.goldl],
          [5, 20, 14, 2, C.gold],
          [3, 22, 18, 2, C.gold],
          [1, 24, 22, 3, C.gold],
          [3, 22, 18, 1, C.goldl],
          [5, 24, 14, 1, C.gy],
          [9, 25, 6, 1, C.goldl],
          [1, 26, 22, 1, C.gy],
          [0, 25, 1, 1, C.goldl],
          [23, 25, 1, 1, C.goldl],
        ],
        shadowR: 0,
      };

    // ---- aquarium --------------------------------------------------------
    case 'aquarium':
      return {
        base: [
          [7, 22, 10, 5, C.w],
          [7, 22, 10, 1, C.wl],
          [6, 7, 12, 15, C.m],
          [6, 7, 12, 1, C.ml],
        ],
        glow: [[6, 7, 12, 15, C.glowc]],
        lit: [
          [8, 9, 8, 11, C.scr],
          [8, 9, 8, 1, C.scrl],
          [11, 12, 3, 2, accent], // fish
          [10, 13, 1, 1, C.out],
          [9, 14, 1, 5, C.g], // plant
          [14, 15, 1, 4, C.g],
        ],
        unlit: [
          [8, 9, 8, 11, C.scrd],
          [11, 12, 3, 2, C.ms],
          [9, 14, 1, 5, C.lg],
        ],
        bubble: [
          [9, 18, 1, 1, C.white],
          [13, 17, 1, 1, C.white],
        ],
      };

    // ---- trophies --------------------------------------------------------
    case 'trophy-shelf':
      return {
        base: [
          [4, 17, 16, 2, C.wd],
          [4, 17, 16, 1, C.wl],
          [7, 11, 3, 6, C.gold],
          [6, 10, 5, 1, C.gold],
          [8, 8, 1, 2, C.gy],
          [13, 12, 3, 5, C.ml], // silver cup
          [12, 11, 5, 1, C.ml],
          [7, 9, 3, 1, C.goldl],
        ],
        spin: [[8, 6, 1, 2, C.white]],
        shadowR: 0,
      };
    case 'nut-statue':
      return {
        base: [
          [6, 21, 12, 5, C.m],
          [6, 21, 12, 1, C.ml],
          [8, 20, 8, 2, C.ms],
          [11, 4, 2, 3, C.gy],
          [8, 7, 8, 2, C.gy],
          [6, 9, 12, 3, C.gy],
          [7, 12, 10, 4, C.gold],
          [8, 16, 8, 3, C.gold],
          [10, 19, 4, 2, C.gold],
          [8, 12, 3, 5, C.goldl],
          [8, 9, 8, 1, C.goldl],
        ],
        spin: [[15, 10, 1, 2, C.white]],
        shadowR: 8,
      };

    // ---- cushions / rest -------------------------------------------------
    case 'beanbag-chairs':
      // Two slumped, asymmetrical bags with folds and soft low silhouettes.
      return {
        base: [
          [4, 15, 5, 2, accent],
          [2, 17, 9, 3, accent],
          [1, 20, 11, 5, accent],
          [3, 25, 8, 2, C.k],
          [3, 18, 3, 1, C.white],
          [6, 22, 4, 1, C.out],
          [15, 13, 4, 2, C.blue],
          [12, 15, 9, 4, C.blue],
          [11, 19, 12, 6, C.blue],
          [13, 25, 9, 2, C.k],
          [14, 16, 3, 1, C.bluel],
          [14, 21, 6, 1, C.out],
          [10, 23, 2, 2, C.w],
        ],
        shadowR: 11,
      };
    case 'snack-bar':
      return {
        base: [
          [3, 14, 18, 3, C.wl],
          [4, 17, 16, 10, C.wd],
          [4, 17, 16, 1, C.wh],
          [6, 19, 12, 6, C.k],
          [7, 20, 3, 4, C.red],
          [11, 20, 3, 4, C.gold],
          [15, 20, 2, 4, C.gl],
          [6, 12, 12, 2, accent],
          [8, 7, 2, 5, C.red],
          [12, 6, 4, 6, C.scr],
          [13, 7, 2, 3, C.goldl],
        ],
        shadowR: 10,
      };
    case 'hammock':
      return {
        base: [
          [2, 7, 3, 19, C.w],
          [19, 7, 3, 19, C.w],
          [3, 7, 1, 18, C.wl],
          [20, 7, 1, 18, C.wl],
          [5, 12, 3, 2, C.wd],
          [16, 12, 3, 2, C.wd],
          [6, 14, 12, 2, accent],
          [7, 16, 10, 3, accent],
          [9, 19, 6, 3, accent],
          [10, 20, 4, 1, C.white],
          [5, 13, 1, 2, C.wh],
          [18, 13, 1, 2, C.wh],
        ],
        shadowR: 10,
      };

    // ---- boxes / storage -------------------------------------------------
    case 'filing-cabinet':
      return {
        base: [
          // a little potted succulent someone left on top — instant charm
          [10, 4, 4, 3, C.t],
          [10, 4, 4, 1, C.tl],
          [11, 1, 1, 3, C.g],
          [12, 0, 1, 4, C.gl],
          [13, 1, 1, 3, C.g],
          [7, 7, 10, 19, C.m],
          [7, 7, 10, 1, C.ml],
          [15, 7, 2, 19, C.ms],
          [7, 13, 10, 1, C.ms],
          [7, 19, 10, 1, C.ms],
          [11, 10, 3, 1, C.ml], // handles
          [11, 16, 3, 1, C.ml],
          [11, 22, 3, 1, C.ml],
        ],
        shadowR: 8,
      };
    case 'safe':
      return {
        base: [
          [5, 8, 14, 18, C.ms],
          [5, 8, 14, 1, C.m],
          [7, 10, 10, 14, C.m],
          [10, 13, 4, 4, C.ms], // dial
          [11, 14, 2, 2, C.ml],
          [15, 16, 2, 3, C.ml], // handle
          [6, 9, 1, 1, C.ml], // bolts
          [17, 9, 1, 1, C.ml],
          [6, 24, 1, 1, C.ml],
          [17, 24, 1, 1, C.ml],
          // a little stash of gold peeking out the bottom — treasure charm
          [8, 20, 4, 2, C.gold],
          [8, 20, 4, 1, C.goldl],
          [9, 22, 2, 1, C.gy],
        ],
        shadowR: 9,
      };
    case 'sorting-bins':
      return {
        base: [
          [4, 11, 3, 3, C.paper], // a few unruly items peeking out
          [11, 10, 2, 4, C.gold],
          [17, 11, 3, 3, C.gl],
          [3, 14, 6, 12, C.red],
          [3, 14, 6, 1, C.redl],
          [9, 14, 6, 12, C.blue],
          [9, 14, 6, 1, C.bluel],
          [15, 14, 6, 12, C.g],
          [15, 14, 6, 1, C.gl],
          [4, 16, 4, 1, C.white],
          [10, 16, 4, 1, C.white],
          [16, 16, 4, 1, C.white],
          [5, 19, 2, 2, C.redl], // simple sorting marks
          [11, 19, 2, 2, C.bluel],
          [17, 19, 2, 2, C.gl],
        ],
        shadowR: 10,
      };
    case 'conveyor-plushie':
      // a cute acorn mascot plush
      return {
        base: [
          [8, 13, 8, 11, C.wd],
          [8, 13, 8, 3, C.wl], // cap
          [7, 8, 10, 6, C.wl], // head
          [8, 7, 8, 1, C.k], // stalk base
          [11, 4, 2, 3, C.k], // stalk
          [9, 10, 1, 1, C.out], // eyes
          [13, 10, 1, 1, C.out],
          [10, 12, 4, 1, C.out], // smile
          [6, 16, 2, 4, C.w], // arms
          [16, 16, 2, 4, C.w],
          [8, 24, 3, 2, C.w], // feet
          [13, 24, 3, 2, C.w],
        ],
        shadowR: 8,
      };
    case 'bubbling-beakers':
      return {
        base: [
          [3, 25, 18, 2, C.k],
          [5, 23, 14, 2, C.m],
          [8, 9, 2, 5, C.scrl],
          [6, 13, 6, 3, C.scrl],
          [5, 16, 8, 9, C.scrl],
          [6, 19, 6, 5, C.g],
          [15, 7, 2, 6, C.scrl],
          [13, 12, 6, 3, C.scrl],
          [12, 15, 8, 10, C.scrl],
          [13, 18, 6, 6, C.vio],
          [6, 16, 1, 6, C.white],
          [13, 15, 1, 7, C.white],
        ],
        bubble: [
          [9, 16, 1, 1, C.gl],
          [16, 14, 1, 1, C.viol],
          [15, 10, 1, 1, C.viol],
        ],
        shadowR: 10,
      };

    // ---- screens / devices ----------------------------------------------
    case 'label-maker':
      return {
        base: [
          [9, 10, 7, 3, C.paper], // label strip
          [11, 11, 1, 1, C.red], // tiny printed heart
          [13, 11, 1, 1, C.red],
          [11, 12, 3, 1, C.red],
          [6, 13, 12, 11, C.ms],
          [6, 13, 12, 1, C.m],
          [8, 15, 6, 3, on ? C.scr : C.scrd],
          [8, 20, 8, 1, C.m],
          [8, 22, 8, 1, C.m],
          [7, 26, 10, 1, C.k],
        ],
        lit: [[8, 15, 6, 1, C.scrl]],
      };
    case 'security-cam':
      return {
        base: [
          [4, 7, 2, 4, C.ms],
          [5, 9, 3, 2, C.m],
          [8, 8, 9, 5, C.ms],
          [8, 8, 9, 1, C.m],
          [15, 9, 3, 3, on ? C.scr : C.scrd],
          [15, 9, 1, 1, C.white], // glossy lens glint (cute "eye")
          [17, 10, 1, 1, C.ms],
        ],
        lit: [[9, 9, 1, 1, C.redl]],
        unlit: [[9, 9, 1, 1, C.red]],
        shadowR: 0,
      };
    case 'projector':
      return {
        base: [
          [5, 8, 13, 8, C.m],
          [5, 8, 13, 1, C.ml],
          [16, 10, 4, 4, on ? C.scrl : C.scrd],
          [7, 10, 1, 4, C.ms],
          [9, 10, 1, 4, C.ms],
          [7, 17, 10, 2, C.ml],
          [8, 19, 8, 2, C.m],
          [11, 21, 2, 4, C.ms],
          [6, 25, 12, 2, C.k],
          [7, 24, 2, 3, C.ms],
          [15, 24, 2, 3, C.ms],
        ],
        glow: [[18, 8, 6, 9, C.glowc]],
        lit: [[17, 11, 2, 1, C.white]],
        shadowR: 8,
      };

    default:
      // generic crate fallback
      return {
        base: [
          [6, 9, 12, 15, C.wd],
          [6, 9, 12, 1, C.wl],
          [6, 9, 12, 15, C.wd],
          [6, 16, 12, 1, C.w],
          [6, 9, 1, 15, C.wl],
          [10, 12, 4, 4, C.w],
        ],
        shadowR: 9,
      };
  }
}

const rectEl = (r: Rect, i: number) => (
  <rect key={i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={r[4]} />
);

const bubbleEl = (r: Rect, i: number) => (
  <rect
    key={`b${i}`}
    className="decor__bubble"
    x={r[0]}
    y={r[1]}
    width={r[2]}
    height={r[3]}
    fill={r[4]}
  />
);

const LEAF_STYLE: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: 'bottom center',
};
const SPIN_STYLE: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: 'center',
};

/**
 * Pixel-art renderer for a single decoration. Shape is picked per item id;
 * on/off (lamps, screens, tanks) and poster `variant` change which layers show.
 */
export function DecoArt({
  id,
  on,
  variant = 0,
  accent,
  reducedMotion,
  scale = 1,
  mirror = false,
}: {
  id: string;
  on: boolean;
  variant?: number;
  accent: string;
  reducedMotion: boolean;
  /** Per-item render multiplier from the placement spec (1 = catalogue base). */
  scale?: number;
  /** Horizontally flip the sprite (deterministic per item) for variety. */
  mirror?: boolean;
}) {
  const sp = spriteFor(id, on, variant, accent);
  const shadowR = sp.shadowR ?? 8;
  return (
    <svg
      width={52 * scale}
      height={60 * scale}
      viewBox="0 0 24 28"
      shapeRendering="crispEdges"
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      {shadowR > 0 ? <ellipse cx={12} cy={27} rx={shadowR} ry={1.4} fill={C.shadow} /> : null}
      {on && sp.glow ? sp.glow.map(rectEl) : null}
      {sp.base.map(rectEl)}
      {on ? sp.lit?.map(rectEl) : sp.unlit?.map(rectEl)}
      {sp.leaf ? (
        <g className="decor__leaf" style={LEAF_STYLE}>
          {sp.leaf.map(rectEl)}
        </g>
      ) : null}
      {sp.bubble && !reducedMotion ? <Fragment>{sp.bubble.map(bubbleEl)}</Fragment> : null}
      {sp.spin ? (
        <g className="decor__spin" style={SPIN_STYLE}>
          {sp.spin.map(rectEl)}
        </g>
      ) : null}
    </svg>
  );
}
