import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BUG_HOLES,
  bugSpawnInterval,
  bugSpeciesLifetime,
  bugSpeciesScore,
  pickBugSpecies,
  firstBugSpecies,
  coffeeComboMultiplier,
  applyBugEmptyPenalty,
  resolveBugWhack,
  type BugSpecies,
  type RecentBugTarget,
} from '../../sim/minigames';
import { useStore } from '../../state/store';
import type { SubGameProps } from './MicroGame';

// Bug Squash — a reaction/precision game. Pests pop from a 3x3 grid of burrows
// for a shrinking window; tap them to squash. A single ~90ms driver loop owns
// all timing (spawn cadence + lifetime) from refs, so there are no nested
// state updates and nothing lingers after unmount. Fully reduced-motion safe
// (pests appear/disappear instantly, no continuous motion required).
export function BugSquash({
  seed,
  reducedMotion,
  paused,
  timeLeft,
  onScore,
  onCombo,
}: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [active, setActive] = useState<number | null>(null);
  const [activeSpecies, setActiveSpecies] = useState<BugSpecies>(() => pickBugSpecies(0));
  /** Taps still needed on the bug currently up (armoured pests take two). */
  const [tapsLeft, setTapsLeft] = useState(1);
  const [urgent, setUrgent] = useState(false);
  const [streak, setStreak] = useState(0);
  const [hit, setHit] = useState<{ hole: number; species: BugSpecies } | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const activeRef = useRef<{
    hole: number;
    token: number;
    species: BugSpecies;
    tapsLeft: number;
  } | null>(null);
  const recentRef = useRef<RecentBugTarget | null>(null);
  const pressedTokenRef = useRef<{ hole: number; token: number | null } | null>(null);
  const tokenRef = useRef(0);
  const spawnedAtRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const lastRef = useRef(-1);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const clockRef = useRef(0);
  const rng = useRef(seedToRng(seed));
  const hitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const elapsed = () => clockRef.current / 1000;

  useEffect(() => {
    if (paused) {
      if (hitTimer.current) clearTimeout(hitTimer.current);
      hitTimer.current = null;
      setHit(null);
      setWrong(null);
      return;
    }
    if (nextSpawnRef.current === 0) nextSpawnRef.current = 500;
    let lastTick = performance.now();
    const id = setInterval(() => {
      const tick = performance.now();
      clockRef.current += tick - lastTick;
      lastTick = tick;
      const now = clockRef.current;
      if (activeRef.current == null) {
        if (now >= nextSpawnRef.current) {
          let hole = Math.floor(rng.current() * BUG_HOLES);
          if (hole === lastRef.current) hole = (hole + 1) % BUG_HOLES;
          // The opening pest is always the basic worker so the round teaches its
          // own interaction first; see firstBugSpecies().
          const species =
            tokenRef.current === 0 ? firstBugSpecies() : pickBugSpecies(rng.current());
          activeRef.current = {
            hole,
            token: ++tokenRef.current,
            species,
            tapsLeft: species.taps,
          };
          lastRef.current = hole;
          spawnedAtRef.current = now;
          setActive(hole);
          setActiveSpecies(species);
          setTapsLeft(species.taps);
          setUrgent(false);
        }
      } else if (
        now - spawnedAtRef.current >
        bugSpeciesLifetime(activeRef.current.species, elapsed())
      ) {
        recentRef.current = { hole: activeRef.current.hole, at: now };
        activeRef.current = null;
        setActive(null);
        setUrgent(false);
        streakRef.current = 0;
        setStreak(0);
        onCombo(1);
        nextSpawnRef.current = now + bugSpawnInterval(elapsed());
      } else {
        setUrgent(
          now - spawnedAtRef.current >
            bugSpeciesLifetime(activeRef.current.species, elapsed()) * 0.68,
        );
      }
    }, 90);
    return () => {
      clearInterval(id);
      if (hitTimer.current) clearTimeout(hitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  function armWhack(hole: number) {
    const target = activeRef.current;
    pressedTokenRef.current = {
      hole,
      token: target?.hole === hole ? target.token : null,
    };
  }

  function whack(hole: number, keyboard: boolean) {
    if (paused) return;
    const capturedToken = keyboard
      ? activeRef.current?.hole === hole
        ? activeRef.current.token
        : null
      : pressedTokenRef.current?.hole === hole
        ? pressedTokenRef.current.token
        : null;
    pressedTokenRef.current = null;
    const now = clockRef.current;
    const resolution = resolveBugWhack(
      activeRef.current,
      hole,
      capturedToken,
      recentRef.current,
      now,
    );
    if (resolution === 'grace') return;
    if (resolution === 'empty') {
      const penalty = applyBugEmptyPenalty(scoreRef.current);
      scoreRef.current = penalty.score;
      streakRef.current = 0;
      setStreak(0);
      onScore(scoreRef.current);
      onCombo(1);
      audio.play('error');
      setWrong(hole);
      setFeedback(
        penalty.lost > 0
          ? t('microgame.bugSquash.penalty', { value: penalty.lost })
          : t('microgame.bugSquash.empty'),
      );
      if (hitTimer.current) clearTimeout(hitTimer.current);
      hitTimer.current = setTimeout(() => setWrong(null), reducedMotion ? 320 : 360);
      return;
    }

    const target = activeRef.current!;

    // ARMOURED: the first tap cracks the shell and the bug stays up. The spawn token
    // is deliberately NOT rotated, so the pointer-down capture on the follow-up tap
    // still matches and the existing grace/race protection keeps working unchanged.
    if (target.tapsLeft > 1) {
      target.tapsLeft -= 1;
      setTapsLeft(target.tapsLeft);
      audio.play('click');
      setFeedback(t('microgame.bugSquash.cracked'));
      return;
    }

    recentRef.current = { hole, at: now };
    activeRef.current = null;
    setActive(null);
    setTapsLeft(1);
    setUrgent(false);
    streakRef.current += 1;
    setStreak(streakRef.current);
    const gained = bugSpeciesScore(target.species, streakRef.current);
    scoreRef.current += gained;
    onScore(scoreRef.current);
    onCombo(coffeeComboMultiplier(streakRef.current));
    audio.play('bugHit');
    setWrong(null);
    setHit({ hole, species: target.species });
    setFeedback(t('microgame.bugSquash.hit', { value: gained }));
    if (hitTimer.current) clearTimeout(hitTimer.current);
    hitTimer.current = setTimeout(() => setHit(null), reducedMotion ? 420 : 460);
    nextSpawnRef.current = clockRef.current + Math.max(260, bugSpawnInterval(elapsed()) * 0.6);
  }

  const mult = coffeeComboMultiplier(streak);

  return (
    <div className={`bugsquash ${wrong != null ? 'is-wrong' : ''}`}>
      <span className="sr-only" role="status" aria-live="polite">
        {feedback}
      </span>
      <div className="bugsquash__status">
        <span className="bugsquash__ticket">
          <b>{t('microgame.bugSquash.ticket')}</b>
          <small>{timeLeft}s</small>
        </span>
        <span className={`bugsquash__streak ${mult > 1 ? 'is-hot' : ''}`}>
          {streak > 0 ? t('microgame.combo', { value: mult }) : t('microgame.bugSquash.scanning')}
        </span>
        <span className="bugsquash__threat" aria-hidden="true">
          <i className={active != null ? 'is-alert' : ''} />
          <i className={active != null ? 'is-alert' : ''} />
          <i />
        </span>
      </div>
      <div className="bugsquash__desk">
        <div className="bugsquash__props" aria-hidden="true">
          <div className="bugsquash__monitor">
            <span>
              BUG
              <br />
              TRACKER
            </span>
            <i />
          </div>
          <div className="bugsquash__papers">
            <i />
            <i />
            <i />
            <b>URGENT</b>
          </div>
          <div className="bugsquash__stamp">FIXED</div>
          <div className="bugsquash__pencil" />
          <div className="bugsquash__tape" />
        </div>
        <div className="bugsquash__grid">
          {Array.from({ length: BUG_HOLES }).map((_, index) => (
            <button
              key={index}
              className={`burrow ${active === index ? 'is-up' : ''} ${active === index ? `burrow--${activeSpecies.id}` : ''} ${urgent && active === index ? 'is-urgent' : ''} ${hit?.hole === index ? 'is-hit' : ''} ${wrong === index ? 'is-wrong' : ''}`}
              onPointerDown={() => armWhack(index)}
              onClick={(event) => whack(index, event.detail === 0)}
              disabled={paused}
              aria-label={active === index ? t('microgame.bug') : t('microgame.burrow')}
            >
              <span className="burrow__folder-tab" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="burrow__hole" aria-hidden="true" />
              {active === index ? (
                <Bug species={activeSpecies} cracked={tapsLeft < activeSpecies.taps} />
              ) : null}
              {hit?.hole === index ? <Bug species={hit.species} squashed /> : null}
              {hit?.hole === index ? (
                <span className="burrow__impact" aria-hidden="true">
                  <b>POW!</b>
                  {Array.from({ length: 6 }, (_, piece) => (
                    <i key={piece} style={{ ['--i' as string]: piece }} />
                  ))}
                </span>
              ) : null}
              {wrong === index ? (
                <span className="burrow__miss" aria-hidden="true">
                  <b>-2</b>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const SPECIES_PAINT: Record<string, { body: string; shell: string }> = {
  // Colour now MEANS something: the player should be able to read the behaviour off
  // the pest before deciding whether to commit to it.
  //
  // Chosen against THIS board, not in the abstract. The desk is brown wood, the
  // folders are grey-tan and the tray is teal-grey, so the first attempt at an
  // armoured pest (#5d6b74 body, #9fb3bd plate) came out almost exactly the colour
  // of the furniture — the one species that demands two taps was the hardest of the
  // four to spot. It is now dark slate against a bright steel plate, which reads as
  // armour AND separates from the folders behind it.
  worker: { body: '#a95b38', shell: '#e48b55' },
  runner: { body: '#6b4fa8', shell: '#b79cf0' },
  armoured: { body: '#2f4757', shell: '#cfe2ec' },
  rare: { body: '#8a5a12', shell: '#ffd54a' },
};

function Bug({
  species,
  squashed = false,
  cracked = false,
}: {
  species: BugSpecies;
  squashed?: boolean;
  cracked?: boolean;
}) {
  const paint = SPECIES_PAINT[species.id] ?? SPECIES_PAINT.worker;
  const body = paint.body;
  const shell = paint.shell;
  return (
    <svg
      className={`bug bug--${species.id} ${squashed ? 'is-squashed' : ''} ${cracked ? 'is-cracked' : ''}`}
      width="58"
      height="58"
      viewBox="0 0 52 52"
      aria-hidden="true"
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
      {/* Runner: swept back, so "this one is quick" is legible at a glance. */}
      {species.id === 'runner' ? (
        <path d="M11 20 3 9l14 6M41 20l8-11-14 6" fill={shell} stroke="#2a1a0e" strokeWidth="2" />
      ) : null}
      {/* Armoured: a plate over the back, which splits once it has been cracked. */}
      {species.id === 'armoured' ? (
        <g stroke="#2a1a0e" strokeWidth="2">
          <path d="M15 26q11-8 22 0v8q-11 6-22 0Z" fill={shell} />
          {cracked ? (
            <path d="M26 24l-4 6 5 3-3 6" fill="none" strokeWidth="1.8" stroke="#2a1a0e" />
          ) : null}
        </g>
      ) : null}
      {/* Rare: it shines. Worth dropping everything for. */}
      {species.id === 'rare' ? (
        <g>
          <path d="M26 17 22 7l4 3 4-3-4 10" fill={shell} stroke="#2a1a0e" strokeWidth="1.8" />
          <path
            d="M8 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
            fill="#fff4c0"
            stroke="#2a1a0e"
            strokeWidth="1.2"
          />
        </g>
      ) : null}
      <circle cx="17" cy="17" r="2" fill={shell} opacity=".8" />
    </svg>
  );
}

function seedToRng(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i += 1) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
