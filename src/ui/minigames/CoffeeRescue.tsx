import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  coffeeFallDuration,
  coffeeSpawnInterval,
  coffeeCatchScore,
  coffeeComboMultiplier,
  coffeeCatchGeometry,
  resolveCoffeeDrop,
  type CoffeeCatchGeometry,
} from '../../sim/minigames';
import { useStore } from '../../state/store';
import type { SubGameProps } from './MicroGame';

interface Drop {
  id: number;
  x: number; // 0..100
  y: number; // 0..100 progress down the play area
  born: number;
}

const DROP_LIFETIME = 1800; // reduced-motion tap mode
const FALLBACK_GEOMETRY: CoffeeCatchGeometry = {
  minMugX: 9,
  maxMugX: 88,
  halfCatchWidth: 7,
  catchY: 76,
};

// Deliver coffee before it's lost. Motion mode: move the mug with the mouse or
// arrow keys to catch falling drops. Reduced-motion mode: tap the drops before
// they fade (no motion, no time-pressure flashing). Consecutive catches build a
// combo multiplier; the mug's warmth meter fills as the streak grows.
//
// The list of drops lives in a ref (single source of truth) so the animation
// loop can update positions AND resolve catches/misses without ever calling a
// React state setter inside another setter's updater.
export function CoffeeRescue({ seed, reducedMotion, paused, onScore, onCombo }: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [mugX, setMugX] = useState(50);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [streak, setStreak] = useState(0);
  const [splash, setSplash] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [catchFx, setCatchFx] = useState<{ id: number; x: number; value: number } | null>(null);
  const [missFx, setMissFx] = useState<{ id: number; x: number } | null>(null);
  const dropsRef = useRef<Drop[]>([]);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const idRef = useRef(0);
  const mugXRef = useRef(50);
  const areaRef = useRef<HTMLDivElement>(null);
  const mugRef = useRef<HTMLSpanElement>(null);
  const geometryRef = useRef<CoffeeCatchGeometry>(FALLBACK_GEOMETRY);
  const startedAtRef = useRef(performance.now());
  const pausedAtRef = useRef<number | null>(paused ? performance.now() : null);
  const pausedDurationRef = useRef(0);
  const nextSpawnAtRef = useRef(startedAtRef.current + 500);
  const rng = useRef(seedToRng(seed));
  const splashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  mugXRef.current = mugX;

  const activeNow = () => {
    const now = performance.now();
    const currentPause = pausedAtRef.current == null ? 0 : now - pausedAtRef.current;
    return now - pausedDurationRef.current - currentPause;
  };
  const elapsed = () => (activeNow() - startedAtRef.current) / 1000;

  useEffect(() => {
    if (paused) {
      if (pausedAtRef.current == null) pausedAtRef.current = performance.now();
      return;
    }
    if (pausedAtRef.current != null) {
      pausedDurationRef.current += performance.now() - pausedAtRef.current;
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

  // Derive collision and edge clamps from the rendered café rather than fixed
  // percentages. This keeps the visible mug lip honest at 320px and ultrawide.
  useEffect(() => {
    const area = areaRef.current;
    const mug = mugRef.current;
    if (!area || !mug) return;
    const measure = () => {
      const areaRect = area.getBoundingClientRect();
      const mugRect = mug.getBoundingClientRect();
      if (areaRect.width <= 0 || areaRect.height <= 0) return;
      const after = getComputedStyle(mug, '::after');
      const handleWidth =
        (Number.parseFloat(after.width) || 18) + (Number.parseFloat(after.borderRightWidth) || 5);
      const geometry = coffeeCatchGeometry(
        areaRect.width,
        areaRect.height,
        mugRect.width,
        mugRect.top - areaRect.top,
        handleWidth,
      );
      geometryRef.current = geometry;
      setMugX((current) => Math.max(geometry.minMugX, Math.min(geometry.maxMugX, current)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(mug);
    return () => observer.disconnect();
  }, []);

  function commitDrops(next: Drop[]) {
    dropsRef.current = next;
    setDrops(next);
  }

  function registerCatch(n = 1, x = mugXRef.current) {
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
      setFeedback(
        t('microgame.coffeeRescue.caught', { count: n, value: scoreRef.current - scoreBefore }),
      );
      setMissFx(null);
      setCatchFx({ id: performance.now(), x, value: scoreRef.current - scoreBefore });
      if (!reducedMotion) setSplash(true);
      if (splashTimer.current) clearTimeout(splashTimer.current);
      splashTimer.current = setTimeout(
        () => {
          setSplash(false);
          setCatchFx(null);
        },
        reducedMotion ? 0 : 420,
      );
    }
  }

  function registerMiss(x: number) {
    const lostStreak = streakRef.current;
    if (lostStreak !== 0) {
      streakRef.current = 0;
      setStreak(0);
      onCombo(1);
    }
    setFeedback(
      lostStreak > 0
        ? t('microgame.coffeeRescue.streakLost', { count: lostStreak })
        : t('microgame.coffeeRescue.missed'),
    );
    setCatchFx(null);
    setMissFx({ id: performance.now(), x });
    if (splashTimer.current) clearTimeout(splashTimer.current);
    splashTimer.current = setTimeout(() => setMissFx(null), reducedMotion ? 0 : 380);
  }

  function removeDrop(id: number): boolean {
    const result = resolveCoffeeDrop(dropsRef.current, id);
    if (!result.resolved) return false;
    commitDrops(result.drops);
    return true;
  }

  // Spawn deadlines live on the active clock, so pausing preserves the exact
  // remainder instead of granting a fresh delay on every resume.
  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let handle: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = Math.max(0, nextSpawnAtRef.current - activeNow());
      handle = setTimeout(spawn, delay);
    };
    const spawn = () => {
      if (cancelled) return;
      const now = activeNow();
      const geometry = geometryRef.current;
      const minDropX = Math.max(4, geometry.minMugX - geometry.halfCatchWidth + 1);
      const maxDropX = Math.min(96, geometry.maxMugX + geometry.halfCatchWidth - 1);
      const drop: Drop = {
        id: idRef.current++,
        x: minDropX + rng.current() * Math.max(1, maxDropX - minDropX),
        y: 0,
        born: now,
      };
      commitDrops([...dropsRef.current, drop]);
      const interval = coffeeSpawnInterval(elapsed());
      nextSpawnAtRef.current = Math.max(nextSpawnAtRef.current + interval, now + interval * 0.35);
      schedule();
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // refs intentionally own the active-clock scheduler across pause renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Motion mode: resolve against the rendered mug lip and clamp long RAF
  // gaps so refocus cannot teleport drops through the catch line.
  useEffect(() => {
    if (reducedMotion || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const speed = 100 / coffeeFallDuration(elapsed());
      const geometry = geometryRef.current;
      const next: Drop[] = [];
      const caught: Drop[] = [];
      const missed: Drop[] = [];
      for (const drop of dropsRef.current) {
        const y = drop.y + speed * dt;
        if (y >= geometry.catchY) {
          if (Math.abs(drop.x - mugXRef.current) <= geometry.halfCatchWidth) caught.push(drop);
          else missed.push(drop);
        } else {
          next.push({ ...drop, y });
        }
      }
      commitDrops(next);
      if (caught.length > 0) {
        const catchX = caught.reduce((total, drop) => total + drop.x, 0) / caught.length;
        registerCatch(caught.length, catchX);
      }
      if (missed.length > 0) registerMiss(missed[missed.length - 1].x);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reducedMotion]);

  // Reduced-motion tap mode: expiry and tapping both resolve by drop id via
  // the ref, so an expiry/click race can never award a removed drop twice.
  useEffect(() => {
    if (!reducedMotion || paused) return;
    const handle = setInterval(() => {
      const now = activeNow();
      const expired = dropsRef.current.filter((drop) => now - drop.born >= DROP_LIFETIME);
      if (expired.length === 0) return;
      const expiredIds = new Set(expired.map((drop) => drop.id));
      commitDrops(dropsRef.current.filter((drop) => !expiredIds.has(drop.id)));
      registerMiss(expired[expired.length - 1].x);
    }, 100);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reducedMotion]);

  function moveMug(clientX: number) {
    const area = areaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const geometry = geometryRef.current;
    const x = ((clientX - rect.left) / rect.width) * 100;
    setMugX(Math.max(geometry.minMugX, Math.min(geometry.maxMugX, x)));
  }

  function handlePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (reducedMotion || paused || !event.isPrimary) return;
    if (event.type === 'pointerdown') {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    moveMug(event.clientX);
  }

  function handleKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (reducedMotion || paused || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight'))
      return;
    event.preventDefault();
    const geometry = geometryRef.current;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    setMugX((x) => Math.max(geometry.minMugX, Math.min(geometry.maxMugX, x + direction * 5)));
  }

  function tap(drop: Drop) {
    if (paused || !removeDrop(drop.id)) return;
    registerCatch(1, drop.x);
  }

  const mult = coffeeComboMultiplier(streak);
  const warmth = Math.min(100, (streak / 12) * 100);

  return (
    <div className="coffee">
      <div className="coffee__status">
        <span className="coffee__order-ticket">
          <b>{t('microgame.coffeeRescue.order')}</b>
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
      <span className="sr-only" role="status" aria-live="polite">
        {feedback}
      </span>
      <div
        className="coffee__area"
        ref={areaRef}
        data-game-control
        role="region"
        tabIndex={reducedMotion ? -1 : 0}
        aria-label={t('microgame.coffeeRescue.controls')}
        onKeyDown={handleKey}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
      >
        <div className="coffee__cafe" aria-hidden="true">
          <div className="coffee__shelf">
            <i />
            <i />
            <i />
            <span />
          </div>
          <div className="coffee__menu-board">
            NUT
            <br />
            ROAST
            <br />
            <b>★ ★ ★</b>
          </div>
          <div className="coffee__window">
            <i />
            <i />
            <span />
          </div>
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
          ref={mugRef}
          className={`coffee__mug ${splash ? 'is-splash' : ''} ${reducedMotion ? 'is-stationary' : ''}`}
          style={{ left: `${reducedMotion ? 50 : mugX}%` }}
          aria-hidden="true"
        >
          <span className="coffee__liquid">
            <i />
            <i />
            <i />
          </span>
          <span className="coffee__foam">● ● ●</span>
          <span className="coffee__mug-face">
            <i />
            <i />
            <b />
          </span>
          <span className="coffee__steam">
            <i />
            <i />
            <i />
          </span>
        </span>
        {missFx ? (
          <span
            key={missFx.id}
            className="coffee__miss-fx"
            style={{ left: `${missFx.x}%` }}
            aria-hidden="true"
          >
            <i />
            <b>{t('microgame.coffeeRescue.missMark')}</b>
          </span>
        ) : null}
        {catchFx ? (
          <span
            key={catchFx.id}
            className="coffee__catch-fx"
            style={{ left: `${catchFx.x}%` }}
            aria-hidden="true"
          >
            <b>+{catchFx.value}</b>
            {Array.from({ length: 7 }, (_, index) => (
              <i key={index} style={{ ['--i' as string]: index }} />
            ))}
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
      <path
        d="M78 96c29-8 28-51 7-60 13 20 7 39-8 46Z"
        fill="#cd7540"
        stroke="#332619"
        strokeWidth="3"
      />
      <ellipse cx="55" cy="79" rx="27" ry="29" fill="#cd7540" stroke="#332619" strokeWidth="3" />
      <circle cx="55" cy="46" r="29" fill="#dd8751" stroke="#332619" strokeWidth="3" />
      <path
        d="M31 31 37 7l15 17M79 31 73 7 58 24"
        fill="#dd8751"
        stroke="#332619"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="55" cy="56" rx="17" ry="13" fill="#efc294" />
      <circle cx="45" cy="45" r="3.4" fill="#332619" />
      <circle cx="65" cy="45" r="3.4" fill="#332619" />
      <path
        d="M47 59q8 7 16 0"
        fill="none"
        stroke="#332619"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="coffee__buddy-arm"
        d="M33 75q-16 10-18 25"
        fill="none"
        stroke="#cd7540"
        strokeWidth="10"
        strokeLinecap="round"
      />
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
