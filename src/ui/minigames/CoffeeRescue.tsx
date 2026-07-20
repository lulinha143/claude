import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  coffeeFallDuration,
  coffeeSpawnInterval,
  coffeeCatchScore,
  coffeeComboMultiplier,
} from '../../sim/minigames';
import { useStore } from '../../state/store';
import type { SubGameProps } from './MicroGame';

interface Drop {
  id: number;
  x: number; // 0..100
  y: number; // 0..100 progress down the play area
  born: number;
}

const CATCH_HALF_WIDTH = 13;
const DROP_LIFETIME = 1600; // reduced-motion tap mode
const FLOOR_Y = 88;

// Deliver coffee before it's lost. Motion mode: move the mug with the mouse or
// arrow keys to catch falling drops. Reduced-motion mode: tap the drops before
// they fade (no motion, no time-pressure flashing). Consecutive catches build a
// combo multiplier; the mug's warmth meter fills as the streak grows.
//
// The list of drops lives in a ref (single source of truth) so the animation
// loop can update positions AND resolve catches/misses without ever calling a
// React state setter inside another setter's updater.
export function CoffeeRescue({ seed, reducedMotion, paused, timeLeft, onScore, onCombo, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [mugX, setMugX] = useState(50);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [streak, setStreak] = useState(0);
  const [splash, setSplash] = useState(false);
  const [catchFx, setCatchFx] = useState<{ id: number; x: number; value: number } | null>(null);
  const dropsRef = useRef<Drop[]>([]);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const idRef = useRef(0);
  const mugXRef = useRef(50);
  const areaRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef(Date.now());
  const pausedAtRef = useRef<number | null>(paused ? Date.now() : null);
  const pausedDurationRef = useRef(0);
  const rng = useRef(seedToRng(seed));
  const splashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  void onEnd; // ending is driven by the shared shell timer

  mugXRef.current = mugX;

  const activeNow = () => {
    const now = Date.now();
    const currentPause = pausedAtRef.current == null ? 0 : now - pausedAtRef.current;
    return now - pausedDurationRef.current - currentPause;
  };
  const elapsed = () => (activeNow() - startedAtRef.current) / 1000;

  useEffect(() => {
    if (paused) {
      if (pausedAtRef.current == null) pausedAtRef.current = Date.now();
      return;
    }
    if (pausedAtRef.current != null) {
      pausedDurationRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    if (!paused) return;
    if (splashTimer.current) clearTimeout(splashTimer.current);
    splashTimer.current = null;
    setSplash(false);
    setCatchFx(null);
  }, [paused]);

  useEffect(
    () => () => {
      if (splashTimer.current) clearTimeout(splashTimer.current);
    },
    [],
  );

  function commitDrops(next: Drop[]) {
    dropsRef.current = next;
    setDrops(next);
  }

  function registerCatch(n = 1) {
    const scoreBefore = scoreRef.current;
    for (let i = 0; i < n; i += 1) {
      streakRef.current += 1;
      scoreRef.current += coffeeCatchScore(streakRef.current);
    }
    if (n > 0) {
      const multiplier = coffeeComboMultiplier(streakRef.current);
      setStreak(streakRef.current);
      onScore(scoreRef.current);
      onCombo(multiplier);
      audio.play('coffeeCatch');
      setCatchFx({ id: Date.now(), x: mugXRef.current, value: scoreRef.current - scoreBefore });
      if (!reducedMotion) setSplash(true);
      if (splashTimer.current) clearTimeout(splashTimer.current);
      splashTimer.current = setTimeout(() => {
        setSplash(false);
        setCatchFx(null);
      }, reducedMotion ? 0 : 420);
    }
  }

  function registerMiss() {
    if (streakRef.current !== 0) {
      streakRef.current = 0;
      setStreak(0);
      onCombo(1);
    }
  }

  // spawn drops
  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let handle: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (cancelled) return;
      const drop: Drop = { id: idRef.current++, x: 8 + rng.current() * 84, y: 0, born: activeNow() };
      commitDrops([...dropsRef.current, drop]);
      handle = setTimeout(loop, coffeeSpawnInterval(elapsed()));
    };
    handle = setTimeout(loop, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
      if (splashTimer.current) clearTimeout(splashTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // motion mode: animate falling + resolve catches/misses from the ref
  useEffect(() => {
    if (reducedMotion || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const speed = 100 / coffeeFallDuration(elapsed()); // % per second
      const next: Drop[] = [];
      let caught = 0;
      let missed = 0;
      for (const d of dropsRef.current) {
        const y = d.y + speed * dt;
        if (y >= FLOOR_Y) {
          if (Math.abs(d.x - mugXRef.current) < CATCH_HALF_WIDTH) caught += 1;
          else missed += 1;
        } else {
          next.push({ ...d, y });
        }
      }
      commitDrops(next);
      if (caught > 0) registerCatch(caught);
      if (missed > 0) registerMiss();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reducedMotion]);

  // reduced-motion tap mode: expire old drops (a lapsed drop breaks the streak)
  useEffect(() => {
    if (!reducedMotion || paused) return;
    const h = setInterval(() => {
      const now = activeNow();
      const kept = dropsRef.current.filter((d) => now - d.born < DROP_LIFETIME);
      if (kept.length < dropsRef.current.length) {
        commitDrops(kept);
        registerMiss();
      }
    }, 150);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reducedMotion]);

  // pointer + keyboard control (motion mode)
  useEffect(() => {
    if (reducedMotion || paused) return;
    const onMove = (e: PointerEvent) => {
      const el = areaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMugX(Math.max(6, Math.min(94, ((e.clientX - r.left) / r.width) * 100)));
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      onMove(e);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setMugX((x) => Math.max(6, x - 6));
      if (e.key === 'ArrowRight') setMugX((x) => Math.min(94, x + 6));
    };
    const el = areaRef.current;
    el?.addEventListener('pointerdown', onPointerDown);
    el?.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('pointerdown', onPointerDown);
      el?.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [paused, reducedMotion]);

  function tap(d: Drop) {
    if (paused) return;
    commitDrops(dropsRef.current.filter((x) => x.id !== d.id));
    registerCatch(1);
  }

  const mult = coffeeComboMultiplier(streak);
  const warmth = Math.min(100, (streak / 12) * 100);

  return (
    <div className="coffee">
      <div className="coffee__status">
        <span className="coffee__order-ticket">
          <b>{t('microgame.coffeeRescue.order')}</b>
          <small>{timeLeft}s</small>
        </span>
        <div
          className="coffee__meter"
          role="meter"
          aria-label={t('microgame.coffeeRescue.warmth')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(warmth)}
        >
          <span className="coffee__meter-fill" style={{ width: `${warmth}%` }} />
          <i aria-hidden="true">♨</i>
        </div>
        <span className={`coffee__streak ${mult > 1 ? 'is-hot' : ''}`}>
          {streak > 0 ? t('microgame.combo', { value: mult }) : t('microgame.coffeeRescue.steady')}
        </span>
      </div>
      <div className="coffee__area" ref={areaRef}>
        <div className="coffee__cafe" aria-hidden="true">
          <div className="coffee__shelf"><i /><i /><i /><span /></div>
          <div className="coffee__menu-board">NUT<br />ROAST<br /><b>★ ★ ★</b></div>
          <div className="coffee__window"><i /><i /><span /></div>
          <CoffeeBuddy />
          <div className="coffee__counter" />
        </div>
        {drops.map((drop) =>
          reducedMotion ? (
            <button
              key={drop.id}
              className="coffee__drop coffee__drop--tap"
              style={{ left: `${drop.x}%`, top: `${20 + (drop.id % 4) * 16}%` }}
              onClick={() => tap(drop)}
              disabled={paused}
              aria-label={t('microgame.coffeeDrop')}
            >
              <span aria-hidden="true" />
            </button>
          ) : (
            <span
              key={drop.id}
              className="coffee__drop"
              style={{ left: `${drop.x}%`, top: `${drop.y}%` }}
              aria-hidden="true"
            >
              <i />
            </span>
          ),
        )}
        <span
          className={`coffee__mug ${splash ? 'is-splash' : ''} ${reducedMotion ? 'is-stationary' : ''}`}
          style={{ left: `${reducedMotion ? 50 : mugX}%` }}
          aria-hidden="true"
        >
          <span className="coffee__liquid"><i /><i /><i /></span>
          <span className="coffee__foam">● ● ●</span>
          <span className="coffee__mug-face"><i /><i /><b /></span>
          <span className="coffee__steam"><i /><i /><i /></span>
        </span>
        {catchFx ? (
          <span
            key={catchFx.id}
            className="coffee__catch-fx"
            style={{ left: `${catchFx.x}%` }}
            aria-hidden="true"
          >
            <b>+{catchFx.value}</b>
            {Array.from({ length: 7 }, (_, index) => <i key={index} style={{ ['--i' as string]: index }} />)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CoffeeBuddy() {
  return (
    <svg className="coffee__buddy" viewBox="0 0 110 115" aria-hidden="true">
      <ellipse cx="55" cy="107" rx="30" ry="6" fill="rgba(20,12,7,.22)" />
      <path d="M78 96c29-8 28-51 7-60 13 20 7 39-8 46Z" fill="#cd7540" stroke="#332619" strokeWidth="3" />
      <ellipse cx="55" cy="79" rx="27" ry="29" fill="#cd7540" stroke="#332619" strokeWidth="3" />
      <circle cx="55" cy="46" r="29" fill="#dd8751" stroke="#332619" strokeWidth="3" />
      <path d="M31 31 37 7l15 17M79 31 73 7 58 24" fill="#dd8751" stroke="#332619" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="55" cy="56" rx="17" ry="13" fill="#efc294" />
      <circle cx="45" cy="45" r="3.4" fill="#332619" /><circle cx="65" cy="45" r="3.4" fill="#332619" />
      <path d="M47 59q8 7 16 0" fill="none" stroke="#332619" strokeWidth="3" strokeLinecap="round" />
      <path className="coffee__buddy-arm" d="M33 75q-16 10-18 25" fill="none" stroke="#cd7540" strokeWidth="10" strokeLinecap="round" />
      <path d="M48 67h14l-7 16Z" fill="#739274" stroke="#332619" strokeWidth="2" />
    </svg>
  );
}

// tiny local seeded rng (avoids importing the sim rng type surface here)
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
