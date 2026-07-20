import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUG_HOLES, bugLifetime, bugSpawnInterval, bugScore, coffeeComboMultiplier } from '../../sim/minigames';
import { useStore } from '../../state/store';
import type { SubGameProps } from './MicroGame';

// Bug Squash — a reaction/precision game. Pests pop from a 3x3 grid of burrows
// for a shrinking window; tap them to squash. A single ~90ms driver loop owns
// all timing (spawn cadence + lifetime) from refs, so there are no nested
// state updates and nothing lingers after unmount. Fully reduced-motion safe
// (pests appear/disappear instantly, no continuous motion required).
export function BugSquash({ seed, reducedMotion, paused, timeLeft, onScore, onCombo, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [active, setActive] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [hit, setHit] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const spawnedAtRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const lastRef = useRef(-1);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const clockRef = useRef(0);
  const rng = useRef(seedToRng(seed));
  const hitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  void onEnd; // ended by the shared shell timer

  const elapsed = () => clockRef.current / 1000;

  useEffect(() => {
    if (paused) {
      if (hitTimer.current) clearTimeout(hitTimer.current);
      hitTimer.current = null;
      setHit(null);
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
        onCombo(1);
        nextSpawnRef.current = now + bugSpawnInterval(elapsed());
      }
    }, 90);
    return () => {
      clearInterval(id);
      if (hitTimer.current) clearTimeout(hitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  function whack(i: number) {
    if (paused || i !== activeRef.current) return; // tapping an empty burrow does nothing
    activeRef.current = null;
    setActive(null);
    streakRef.current += 1;
    setStreak(streakRef.current);
    scoreRef.current += bugScore(streakRef.current);
    onScore(scoreRef.current);
    onCombo(coffeeComboMultiplier(streakRef.current));
    audio.play('bugHit');
    setHit(i);
    if (hitTimer.current) clearTimeout(hitTimer.current);
    hitTimer.current = setTimeout(() => setHit(null), reducedMotion ? 0 : 220);
    nextSpawnRef.current = clockRef.current + Math.max(260, bugSpawnInterval(elapsed()) * 0.6);
  }

  const mult = coffeeComboMultiplier(streak);

  return (
    <div className="bugsquash">
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
          <div className="bugsquash__monitor"><span>BUG<br />TRACKER</span><i /></div>
          <div className="bugsquash__papers"><i /><i /><i /><b>URGENT</b></div>
          <div className="bugsquash__stamp">FIXED</div>
          <div className="bugsquash__pencil" />
          <div className="bugsquash__tape" />
        </div>
        <div className="bugsquash__grid">
          {Array.from({ length: BUG_HOLES }).map((_, index) => (
            <button
              key={index}
              className={`burrow ${active === index ? 'is-up' : ''} ${hit === index ? 'is-hit' : ''}`}
              onClick={() => whack(index)}
              disabled={paused}
              aria-label={active === index ? t('microgame.bug') : t('microgame.burrow')}
            >
              <span className="burrow__folder-tab" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="burrow__hole" aria-hidden="true" />
              {active === index ? <Bug variant={index % 3} /> : null}
              {hit === index ? (
                <span className="burrow__impact" aria-hidden="true">
                  <b>POW!</b>
                  {Array.from({ length: 6 }, (_, piece) => <i key={piece} style={{ ['--i' as string]: piece }} />)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bug({ variant }: { variant: number }) {
  const body = variant === 0 ? '#a95b38' : variant === 1 ? '#7d6aae' : '#73924e';
  const shell = variant === 0 ? '#e48b55' : variant === 1 ? '#aa92d3' : '#a4c96f';
  return (
    <svg className={`bug bug--${variant}`} width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <ellipse className="bug__wing bug__wing--left" cx="16" cy="25" rx="10" ry="7" fill="#d9e9d7" stroke="#2a1a0e" strokeWidth="1.8" transform="rotate(-25 16 25)" />
      <ellipse className="bug__wing bug__wing--right" cx="36" cy="25" rx="10" ry="7" fill="#d9e9d7" stroke="#2a1a0e" strokeWidth="1.8" transform="rotate(25 36 25)" />
      <ellipse cx="26" cy="31" rx="13" ry="15" fill={body} stroke="#2a1a0e" strokeWidth="2.6" />
      <path d="M26 17v29" stroke="#2a1a0e" strokeWidth="1.7" opacity=".8" />
      <path d="M17 22q9 6 18 0M15 33q11 7 22 0" stroke={shell} strokeWidth="4" fill="none" opacity=".9" />
      <path d="M13 27 3 19M39 27l10-8M13 34 2 35M39 34l11 1M17 42l-7 8M35 42l7 8" stroke="#2a1a0e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="21" cy="24" r="4" fill="#fff4e0" /><circle cx="31" cy="24" r="4" fill="#fff4e0" />
      <circle cx="22" cy="25" r="1.6" fill="#2a1a0e" /><circle cx="30" cy="25" r="1.6" fill="#2a1a0e" />
      <path d="M18 11l4 7M34 11l-4 7" stroke="#2a1a0e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 32q4-3 8 0" stroke="#2a1a0e" strokeWidth="2" fill="none" strokeLinecap="round" />
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
