import type { CritterState } from './animation';
import type { CritterSpecies } from './critterShapes';

// Original, code-drawn SVG characters. Each species has bespoke geometry (head,
// body, ears, tail/wings, muzzle) so silhouettes read as different animals at
// small sizes. Shared, expressive facial features (blinking eyes, eyebrows,
// mood-driven mouth) and the animation `state` (via CSS classes in styles.css)
// bring them to life. This component is the rendering boundary — gameplay never
// touches SVG internals, so a PixiJS/sprite renderer could replace it later.

export interface CritterProps {
  species: CritterSpecies;
  color: string;
  accent: string;
  state: CritterState;
  hasGlasses?: boolean;
  size?: number;
  reducedMotion?: boolean;
  title?: string;
  /** deterministic seed so idle blinks/breathing don't all sync up. */
  seed?: number;
}

type Mood = 'neutral' | 'happy' | 'worried' | 'asleep';

function moodFor(state: CritterState): Mood {
  if (state === 'celebrate') return 'happy';
  if (state === 'panic') return 'worried';
  if (state === 'sleep') return 'asleep';
  if (state === 'coffee' || state === 'tap' || state === 'talk') return 'happy';
  return 'neutral';
}

export function Critter({
  species,
  color,
  accent,
  state,
  hasGlasses = false,
  size = 64,
  reducedMotion = false,
  title,
  seed = 0,
}: CritterProps) {
  const dark = shade(color, -0.3);
  const line = shade(color, -0.45);
  const light = shade(color, 0.22);
  const belly = shade(color, 0.42);
  const mood = moodFor(state);
  const cls = `critter critter--${species} critter--${reducedMotion ? 'idle' : state}`;
  // stagger blink/breathe so a room full of critters feels alive, not robotic
  const blinkDelay = `${(seed % 13) * 0.37 + 0.2}s`;

  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox="0 0 100 104"
      role="img"
      aria-label={title ?? 'character'}
      style={reducedMotion ? undefined : ({ ['--blink-delay' as string]: blinkDelay } as React.CSSProperties)}
    >
      {title ? <title>{title}</title> : null}

      {/* soft contact shadow grounds the character on the floor */}
      <ellipse className="critter__shadow" cx="50" cy="98" rx="26" ry="5" fill="rgba(0,0,0,0.28)" />

      {renderBack(species, { color, dark, light })}
      {renderBody(species, { color, dark, light, belly, line })}
      {/* accent collar / tie */}
      {renderAccent(species, accent)}
      {renderLimbs(species, { color, dark, accent })}
      {renderHead(species, { color, dark, light, line, belly, accent, hasGlasses, mood })}
    </svg>
  );
}

interface Palette {
  color: string;
  dark: string;
  light?: string;
  belly?: string;
  line?: string;
  accent?: string;
  hasGlasses?: boolean;
  mood?: Mood;
}

// ---- back layer (tails / back wing) -------------------------------------
function renderBack(species: CritterSpecies, p: Palette): JSX.Element | null {
  const { color, dark, light } = p;
  switch (species) {
    case 'squirrel':
      return (
        <path
          className="critter__tail critter__tail--bushy"
          d="M74 86 C 104 78, 104 34, 78 24 C 96 30, 96 56, 84 66 C 98 60, 100 40, 90 30 C 104 44, 98 78, 74 82 Z"
          fill={light}
          stroke={dark}
          strokeWidth="2"
        />
      );
    case 'raccoon':
      return (
        <g className="critter__tail critter__tail--ringed">
          <path d="M74 84 C 98 80, 100 50, 86 40 C 96 52, 92 74, 74 78 Z" fill={light} stroke={dark} strokeWidth="2" />
          <path d="M88 44 q6 4 4 12" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M82 58 q6 3 3 11" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'beaver':
      return (
        <g className="critter__tail critter__tail--paddle">
          <ellipse cx="80" cy="82" rx="16" ry="10" fill={dark} stroke={shade(dark, -0.2)} strokeWidth="2" transform="rotate(28 80 82)" />
          <path d="M72 78 l14 8M76 72 l12 7M70 84 l12 6" stroke={shade(dark, -0.25)} strokeWidth="1.2" opacity="0.7" />
        </g>
      );
    case 'crow':
    case 'owl':
      return (
        <g className="critter__tail critter__tail--feathers">
          <path d="M70 82 l24 6 -22 6 Z" fill={dark} />
          <path d="M70 86 l22 2 -20 8 Z" fill={shade(color, -0.15)} />
        </g>
      );
    case 'mouse':
      // thin curly tail
      return (
        <path
          className="critter__tail"
          d="M72 84 q22 4 20 -14 q-2 -10 -10 -8 q8 0 7 8 q-1 12 -18 10 Z"
          fill={light}
          stroke={dark}
          strokeWidth="1.6"
        />
      );
    case 'otter':
      // short, thick, flat tail
      return (
        <path
          className="critter__tail"
          d="M72 84 q20 2 22 -10 q-2 8 -22 4 Z"
          fill={dark}
          stroke={shade(dark, -0.2)}
          strokeWidth="1.6"
        />
      );
    case 'rabbit':
      // small fluffy cottontail
      return <circle className="critter__tail" cx="76" cy="80" r="8" fill={light} stroke={dark} strokeWidth="1.5" />;
    case 'fox':
      // bushy tail with a pale tip
      return (
        <g className="critter__tail critter__tail--bushy">
          <path d="M74 86 C 102 80, 104 38, 80 26 C 96 34, 94 60, 82 68 C 98 62, 98 42, 90 34 C 102 50, 96 80, 74 82 Z" fill={color} stroke={dark} strokeWidth="2" />
          <path d="M80 26 C 90 30, 94 40, 92 50 C 86 40, 84 32, 78 30 Z" fill={light} />
        </g>
      );
    default:
      return null;
  }
}

function isBeaked(species: CritterSpecies): boolean {
  return species === 'crow' || species === 'owl';
}

// ---- body ----------------------------------------------------------------
function renderBody(species: CritterSpecies, p: Palette): JSX.Element {
  const { color, dark, belly = p.light, line = dark } = p;
  if (species === 'capybara') {
    return (
      <g>
        <rect className="critter__body" x="24" y="46" width="52" height="46" rx="20" fill={color} stroke={line} strokeWidth="2" />
        <ellipse cx="50" cy="74" rx="17" ry="16" fill={belly} opacity="0.6" />
      </g>
    );
  }
  if (species === 'crow') {
    return (
      <g>
        <ellipse className="critter__body" cx="50" cy="68" rx="21" ry="25" fill={color} stroke={line} strokeWidth="2" />
        <ellipse cx="50" cy="72" rx="12" ry="16" fill={shade(color, 0.12)} opacity="0.5" />
      </g>
    );
  }
  return (
    <g>
      <ellipse className="critter__body" cx="50" cy="68" rx="23" ry="25" fill={color} stroke={line} strokeWidth="2" />
      <ellipse cx="50" cy="72" rx="14" ry="17" fill={belly} opacity="0.6" />
    </g>
  );
}

// ---- accent (collar / tie / scarf) --------------------------------------
function renderAccent(species: CritterSpecies, accent: string): JSX.Element {
  if (species === 'crow') {
    // a little marketing scarf
    return <path className="critter__accent" d="M38 50 q12 8 24 0 l-2 6 q-10 5 -20 0 Z" fill={accent} stroke={shade(accent, -0.3)} strokeWidth="0.8" />;
  }
  if (species === 'capybara') {
    return <path className="critter__accent" d="M40 49 q10 6 20 0 l0 5 q-10 5 -20 0 Z" fill={accent} opacity="0.95" />;
  }
  // squirrel/raccoon/beaver/mole: a small necktie
  return (
    <g className="critter__accent">
      <path d="M50 47 l5 8 -5 12 -5 -12 Z" fill={accent} stroke={shade(accent, -0.3)} strokeWidth="0.8" />
      <path d="M45 47 h10 l-5 5 Z" fill={shade(accent, 0.12)} />
    </g>
  );
}

// ---- limbs (arms / wings / claws) ---------------------------------------
function renderLimbs(species: CritterSpecies, p: Palette): JSX.Element {
  const { color, dark } = p;
  if (species === 'crow' || species === 'owl') {
    return (
      <g>
        <path className="critter__arm critter__arm--l critter__wing" d="M30 60 q-12 8 -6 22 q8 -6 12 -12 Z" fill={shade(color, -0.12)} stroke={dark} strokeWidth="1.5" />
        <path className="critter__arm critter__arm--r critter__wing" d="M70 60 q12 8 6 22 q-8 -6 -12 -12 Z" fill={shade(color, -0.12)} stroke={dark} strokeWidth="1.5" />
      </g>
    );
  }
  if (species === 'mole') {
    // stubby arms ending in digging claws
    return (
      <g>
        <g className="critter__arm critter__arm--l">
          <ellipse cx="30" cy="70" rx="7" ry="9" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M26 78 l-2 4M30 79 l0 4M34 78 l2 4" stroke={dark} strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g className="critter__arm critter__arm--r">
          <ellipse cx="70" cy="70" rx="7" ry="9" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M66 78 l-2 4M70 79 l0 4M74 78 l2 4" stroke={dark} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </g>
    );
  }
  return (
    <g>
      <ellipse className="critter__arm critter__arm--l" cx="30" cy="68" rx="6.5" ry="11" fill={color} stroke={dark} strokeWidth="1.4" />
      <ellipse className="critter__arm critter__arm--r" cx="70" cy="68" rx="6.5" ry="11" fill={color} stroke={dark} strokeWidth="1.4" />
    </g>
  );
}

// ---- head + face ---------------------------------------------------------
function renderHead(species: CritterSpecies, p: Palette): JSX.Element {
  const { color, dark, light, line = dark, belly = light, accent = '#000', hasGlasses, mood = 'neutral' } = p;

  const ears = renderEars(species, { color, dark, light });
  const headShape = renderHeadShape(species, { color, dark, line, belly });
  const face = renderFace(species, { color, dark, light, accent, hasGlasses, mood });

  return (
    <g className="critter__head">
      {ears}
      {headShape}
      {face}
    </g>
  );
}

function renderEars(species: CritterSpecies, p: Palette): JSX.Element | null {
  const { color, dark, light } = p;
  switch (species) {
    case 'squirrel':
      return (
        <g>
          <path d="M36 18 q-3 -14 6 -14 q4 6 2 16 Z" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M64 18 q3 -14 -6 -14 q-4 6 -2 16 Z" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M39 12 q-1 -6 3 -7" stroke={light} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'raccoon':
      return (
        <g>
          <path d="M35 16 l-4 -12 12 6 Z" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M65 16 l4 -12 -12 6 Z" fill={color} stroke={dark} strokeWidth="1.4" />
        </g>
      );
    case 'beaver':
      return (
        <g>
          <circle cx="34" cy="16" r="6" fill={color} stroke={dark} strokeWidth="1.4" />
          <circle cx="66" cy="16" r="6" fill={color} stroke={dark} strokeWidth="1.4" />
        </g>
      );
    case 'capybara':
      return (
        <g>
          <ellipse cx="34" cy="18" rx="5" ry="4" fill={color} stroke={dark} strokeWidth="1.4" />
          <ellipse cx="66" cy="18" rx="5" ry="4" fill={color} stroke={dark} strokeWidth="1.4" />
        </g>
      );
    case 'crow':
      return (
        <g>
          <path d="M40 12 q-2 -6 4 -8 M50 9 q0 -6 4 -7 M60 12 q2 -6 -4 -8" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'mole':
      return (
        <g>
          <ellipse cx="38" cy="20" rx="3.5" ry="3" fill={color} stroke={dark} strokeWidth="1.2" />
          <ellipse cx="62" cy="20" rx="3.5" ry="3" fill={color} stroke={dark} strokeWidth="1.2" />
        </g>
      );
    case 'mouse':
      // big round ears with pink inners
      return (
        <g>
          <circle cx="33" cy="16" r="10" fill={color} stroke={dark} strokeWidth="1.4" />
          <circle cx="67" cy="16" r="10" fill={color} stroke={dark} strokeWidth="1.4" />
          <circle cx="33" cy="16" r="5" fill="#e59aa8" opacity="0.8" />
          <circle cx="67" cy="16" r="5" fill="#e59aa8" opacity="0.8" />
        </g>
      );
    case 'otter':
      return (
        <g>
          <ellipse cx="37" cy="15" rx="4.5" ry="3.5" fill={color} stroke={dark} strokeWidth="1.3" />
          <ellipse cx="63" cy="15" rx="4.5" ry="3.5" fill={color} stroke={dark} strokeWidth="1.3" />
        </g>
      );
    case 'hedgehog':
      // a crown of spikes behind the head
      return (
        <g>
          {[30, 38, 46, 54, 62, 70].map((x, i) => (
            <path
              key={x}
              d={`M${x} 18 l${i % 2 ? 4 : -4} -14 l6 12 Z`}
              fill={shade(color, -0.15)}
              stroke={dark}
              strokeWidth="1"
            />
          ))}
        </g>
      );
    case 'rabbit':
      // tall upright ears
      return (
        <g>
          <path d="M40 16 q-6 -22 2 -22 q6 0 3 22 Z" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M60 16 q6 -22 -2 -22 q-6 0 -3 22 Z" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M41 12 q-2 -12 2 -16" stroke="#e59aa8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M59 12 q2 -12 -2 -16" stroke="#e59aa8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'owl':
      // small feather ear-tufts
      return (
        <g>
          <path d="M36 14 l-3 -12 9 8 Z" fill={color} stroke={dark} strokeWidth="1.3" />
          <path d="M64 14 l3 -12 -9 8 Z" fill={color} stroke={dark} strokeWidth="1.3" />
        </g>
      );
    case 'fox':
      // tall pointed ears with dark tips
      return (
        <g>
          <path d="M36 16 L30 -2 46 10 Z" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M64 16 L70 -2 54 10 Z" fill={color} stroke={dark} strokeWidth="1.4" />
          <path d="M32 2 L30 -2 37 4 Z" fill={dark} />
          <path d="M68 2 L70 -2 63 4 Z" fill={dark} />
        </g>
      );
    default:
      return null;
  }
}

function renderHeadShape(species: CritterSpecies, p: Palette): JSX.Element {
  const { color, dark, line = dark, belly = p.light } = p;
  if (species === 'capybara') {
    return (
      <g>
        <rect x="30" y="16" width="40" height="34" rx="15" fill={color} stroke={line} strokeWidth="2" />
        <ellipse cx="50" cy="40" rx="15" ry="10" fill={belly} opacity="0.5" />
      </g>
    );
  }
  if (species === 'crow') {
    return (
      <g>
        <circle cx="50" cy="30" r="18" fill={color} stroke={line} strokeWidth="2" />
        <path d="M50 14 q-14 2 -16 16" stroke={shade(color, 0.15)} strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <circle cx="50" cy="30" r="19" fill={color} stroke={line} strokeWidth="2" />
      <ellipse cx="50" cy="37" rx="12" ry="9" fill={belly} opacity="0.5" />
    </g>
  );
}

function renderFace(species: CritterSpecies, p: Palette): JSX.Element {
  const { dark, accent = '#000', hasGlasses, mood = 'neutral' } = p;
  const eyeY = species === 'capybara' ? 30 : 29;
  const beaked = isBeaked(species);
  const eyeDx = beaked ? 6 : 7;
  const cx = 50;
  const droopy = species === 'capybara';
  const mole = species === 'mole';

  return (
    <g>
      {/* raccoon mask */}
      {species === 'raccoon' ? (
        <path
          d={`M31 ${eyeY - 4} q19 -8 38 0 q-2 9 -10 10 q-9 2 -9 -3 q0 5 -9 3 q-8 -1 -10 -10 Z`}
          fill={shade(dark, -0.1)}
          opacity="0.9"
        />
      ) : null}

      {/* eyes (blink + expression) */}
      <g className="critter__eyes">
        <Eye cx={cx - eyeDx} cy={eyeY} droopy={droopy} tiny={mole} mood={mood} />
        <Eye cx={cx + eyeDx} cy={eyeY} droopy={droopy} tiny={mole} mood={mood} />
      </g>

      {/* eyebrows react to mood */}
      {mood === 'worried' ? (
        <g className="critter__brow" stroke={dark} strokeWidth="1.6" strokeLinecap="round">
          <path d={`M${cx - eyeDx - 4} ${eyeY - 7} l6 3`} />
          <path d={`M${cx + eyeDx + 4} ${eyeY - 7} l-6 3`} />
        </g>
      ) : null}

      {/* glasses */}
      {hasGlasses ? (
        <g stroke={dark} strokeWidth="1.8" fill="rgba(255,255,255,0.12)">
          <circle cx={cx - eyeDx} cy={eyeY} r={mole ? 5 : 6.5} />
          <circle cx={cx + eyeDx} cy={eyeY} r={mole ? 5 : 6.5} />
          <line x1={cx - 1.5} y1={eyeY} x2={cx + 1.5} y2={eyeY} />
        </g>
      ) : null}

      {/* muzzle / nose / beak */}
      {beaked ? (
        <path d={`M${cx - 2} 33 l14 4 -14 4 Z`} fill="#e0a43b" stroke={shade('#e0a43b', -0.3)} strokeWidth="0.8" />
      ) : mole ? (
        <path d={`M${cx} 36 l4 3 -1 3 -3 1 -3 -1 -1 -3 Z`} fill="#e59aa8" stroke={dark} strokeWidth="0.8" />
      ) : (
        <ellipse cx={cx} cy={species === 'capybara' ? 40 : 37} rx="3" ry="2.4" fill={dark} />
      )}

      {/* mouth by mood (skip for beaked species — the beak is the mouth) */}
      {!beaked ? <Mouth cx={cx} y={species === 'capybara' ? 44 : 41} mood={mood} color={dark} /> : null}

      {/* buck teeth for squirrel & beaver */}
      {(species === 'beaver' || species === 'squirrel') && mood !== 'asleep' ? (
        <rect x={cx - 3.5} y={species === 'beaver' ? 42 : 40} width="7" height={species === 'beaver' ? 6 : 4} rx="1.2" fill="#fff" stroke={dark} strokeWidth="0.8" />
      ) : null}

      {/* rosy cheeks add warmth */}
      {mood !== 'asleep' ? (
        <g fill={accent} opacity="0.18">
          <circle cx={cx - 13} cy={eyeY + 6} r="3.5" />
          <circle cx={cx + 13} cy={eyeY + 6} r="3.5" />
        </g>
      ) : null}

      {/* sleep Zs */}
      {mood === 'asleep' ? (
        <g className="critter__zzz" stroke={dark} strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d="M64 16 h6 l-6 6 h6" />
          <path d="M72 8 h4 l-4 4 h4" />
        </g>
      ) : null}
    </g>
  );
}

function Eye({ cx, cy, droopy, tiny, mood }: { cx: number; cy: number; droopy: boolean; tiny: boolean; mood: Mood }) {
  const r = tiny ? 1.8 : 3.2;
  if (mood === 'asleep' || (droopy && mood === 'neutral')) {
    // closed / half-closed lid
    return <path d={`M${cx - r - 1} ${cy} q${r + 1} ${droopy && mood !== 'asleep' ? 2 : 3} ${2 * r + 2} 0`} stroke="#241a12" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#241a12" />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 0.35} fill="#fff" opacity="0.85" />
    </g>
  );
}

function Mouth({ cx, y, mood, color }: { cx: number; y: number; mood: Mood; color: string }) {
  if (mood === 'happy') return <path d={`M${cx - 5} ${y} q5 5 10 0`} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  if (mood === 'worried') return <ellipse cx={cx} cy={y + 1} rx="2.6" ry="3" fill={color} />;
  if (mood === 'asleep') return <path d={`M${cx - 3} ${y} h6`} stroke={color} strokeWidth="1.4" strokeLinecap="round" />;
  return <path d={`M${cx - 4} ${y} q4 3 8 0`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
}

// colour helpers (no external deps)
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
