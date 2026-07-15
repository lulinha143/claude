import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUG_HOLES, bugLifetime, bugSpawnInterval, bugScore, coffeeComboMultiplier } from '../../sim/minigames';
import type { SubGameProps } from './MicroGame';

// Bug Squash — a reaction/precision game. Pests pop from a 3x3 grid of burrows
// for a shrinking window; tap them to squash. A single ~90ms driver loop owns
// all timing (spawn cadence + lifetime) from refs, so there are no nested
// state updates and nothing lingers after unmount. Fully reduced-motion safe
// (pests appear/disappear instantly, no continuous motion required).
export function BugSquash({ seed, reducedMotion, timeLeft, onScore, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hit, setHit] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const spawnedAtRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const lastRef = useRef(-1);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const startRef = useRef(Date.now());
  const rng = useRef(seedToRng(seed));
  const hitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  void onEnd; // ended by the shared shell timer

  const elapsed = () => (Date.now() - startRef.current) / 1000;

  useEffect(() => {
    nextSpawnRef.current = Date.now() + 500;
    const id = setInterval(() => {
      const now = Date.now();
      if (activeRef.current == null) {
        if (now >= nextSpawnRef.current) {
          let h = Math.floor(rng.current() * BUG_HOLES);
          if (h === lastRef.current) h = (h + 1) % BUG_HOLES;
          activeRef.current = h;
          lastRef.current = h;
          spawnedAtRef.current = now;
          setActive(h);
        }
      } else if (now - spawnedAtRef.current > bugLifetime(elapsed())) {
        // ducked back without being squashed → miss, combo resets
        activeRef.current = null;
        setActive(null);
        streakRef.current = 0;
        setStreak(0);
        nextSpawnRef.current = now + bugSpawnInterval(elapsed());
      }
    }, 90);
    return () => {
      clearInterval(id);
      if (hitTimer.current) clearTimeout(hitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function whack(i: number) {
    if (i !== activeRef.current) return; // tapping an empty burrow does nothing
    activeRef.current = null;
    setActive(null);
    streakRef.current += 1;
    setStreak(streakRef.current);
    scoreRef.current += bugScore(streakRef.current);
    setScore(scoreRef.current);
    onScore(scoreRef.current);
    setHit(i);
    if (hitTimer.current) clearTimeout(hitTimer.current);
    hitTimer.current = setTimeout(() => setHit(null), reducedMotion ? 0 : 220);
    nextSpawnRef.current = Date.now() + Math.max(260, bugSpawnInterval(elapsed()) * 0.6);
  }

  const mult = coffeeComboMultiplier(streak);

  return (
    <div className="bugsquash">
      <div className="bugsquash__hud">
        <span>{t('microgame.score', { value: score })}</span>
        {mult > 1 ? <span className="coffee__mult">{t('microgame.multiplier', { value: mult })}</span> : null}
        <span>{timeLeft}s</span>
      </div>
      <div className="bugsquash__grid">
        {Array.from({ length: BUG_HOLES }).map((_, i) => (
          <button
            key={i}
            className={`burrow ${active === i ? 'is-up' : ''} ${hit === i ? 'is-hit' : ''}`}
            onClick={() => whack(i)}
            aria-label={active === i ? t('microgame.bug') : t('microgame.burrow')}
          >
            <span className="burrow__hole" aria-hidden />
            {active === i ? <Bug /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bug() {
  return (
    <svg className="bug" width="42" height="42" viewBox="0 0 42 42" aria-hidden>
      <ellipse cx="21" cy="24" rx="11" ry="12" fill="#7a4a24" stroke="#2a1a0e" strokeWidth="2" />
      <path d="M10 20 q-5 -3 -7 -8 M32 20 q5 -3 7 -8 M10 26 h-8 M32 26 h8 M11 32 q-4 3 -6 8 M31 32 q4 3 6 8" stroke="#2a1a0e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="17" cy="20" r="2.4" fill="#fff" />
      <circle cx="25" cy="20" r="2.4" fill="#fff" />
      <circle cx="17" cy="20" r="1.1" fill="#2a1a0e" />
      <circle cx="25" cy="20" r="1.1" fill="#2a1a0e" />
      <path d="M14 8 l3 5 M28 8 l-3 5" stroke="#2a1a0e" strokeWidth="2" strokeLinecap="round" />
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
