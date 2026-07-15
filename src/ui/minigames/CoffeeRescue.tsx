import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  coffeeFallDuration,
  coffeeSpawnInterval,
  coffeeCatchScore,
  coffeeComboMultiplier,
} from '../../sim/minigames';
import type { SubGameProps } from './MicroGame';

interface Drop {
  id: number;
  x: number; // 0..100
  y: number; // 0..100 (motion mode) — progress down the area
  born: number;
}

const CATCH_HALF_WIDTH = 13;
const DROP_LIFETIME = 1600; // reduced-motion tap mode

// Deliver coffee before it's lost. Motion mode: move the mug with the mouse or
// arrow keys to catch falling drops. Reduced-motion mode: tap the drops before
// they fade (no motion, no time-pressure flashing). Consecutive catches build a
// combo multiplier; the mug's warmth meter fills as the streak grows.
export function CoffeeRescue({ seed, reducedMotion, timeLeft, onScore, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const [mugX, setMugX] = useState(50);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [splash, setSplash] = useState(false);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const idRef = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(Date.now());
  const rng = useRef(seedToRng(seed));
  void onEnd; // ending is driven by the shared shell timer

  const elapsed = () => (Date.now() - startRef.current) / 1000;

  function registerCatch() {
    streakRef.current += 1;
    setStreak(streakRef.current);
    scoreRef.current += coffeeCatchScore(streakRef.current);
    setScore(scoreRef.current);
    onScore(scoreRef.current);
    if (!reducedMotion) {
      setSplash(true);
      setTimeout(() => setSplash(false), 180);
    }
  }

  function registerMiss() {
    streakRef.current = 0;
    setStreak(0);
  }

  // spawn drops
  useEffect(() => {
    let cancelled = false;
    let handle: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (cancelled) return;
      setDrops((prev) => [
        ...prev,
        { id: idRef.current++, x: 8 + rng.current() * 84, y: 0, born: Date.now() },
      ]);
      handle = setTimeout(loop, coffeeSpawnInterval(elapsed()));
    };
    handle = setTimeout(loop, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, []);

  const mugXRef = useRef(mugX);
  mugXRef.current = mugX;

  // motion mode: animate falling + catch detection
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const speed = 100 / coffeeFallDuration(elapsed()); // % per second
      setDrops((prev) => {
        const next: Drop[] = [];
        for (const d of prev) {
          const y = d.y + speed * dt;
          if (y >= 88) {
            if (Math.abs(d.x - mugXRef.current) < CATCH_HALF_WIDTH) registerCatch();
            else registerMiss();
          } else {
            next.push({ ...d, y });
          }
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // reduced-motion tap mode: expire old drops (a lapsed drop breaks the streak)
  useEffect(() => {
    if (!reducedMotion) return;
    const h = setInterval(() => {
      setDrops((prev) => {
        const kept = prev.filter((d) => Date.now() - d.born < DROP_LIFETIME);
        if (kept.length < prev.length) registerMiss();
        return kept;
      });
    }, 150);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // pointer + keyboard control (motion mode)
  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: PointerEvent) => {
      const el = areaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMugX(Math.max(6, Math.min(94, ((e.clientX - r.left) / r.width) * 100)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setMugX((x) => Math.max(6, x - 6));
      if (e.key === 'ArrowRight') setMugX((x) => Math.min(94, x + 6));
    };
    const el = areaRef.current;
    el?.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [reducedMotion]);

  function tap(d: Drop) {
    setDrops((prev) => prev.filter((x) => x.id !== d.id));
    registerCatch();
  }

  const mult = coffeeComboMultiplier(streak);
  const warmth = Math.min(100, (streak / 12) * 100);

  return (
    <div className="coffee">
      <div className="coffee__hud">
        <span>{t('microgame.score', { value: score })}</span>
        {mult > 1 ? <span className="coffee__mult">{t('microgame.multiplier', { value: mult })}</span> : null}
        <span>{timeLeft}s</span>
      </div>
      <div className="coffee__meter" aria-hidden>
        <span className="coffee__meter-fill" style={{ width: `${warmth}%` }} />
      </div>
      <div className="coffee__area" ref={areaRef}>
        {drops.map((d) =>
          reducedMotion ? (
            <button
              key={d.id}
              className="coffee__drop coffee__drop--tap"
              style={{ left: `${d.x}%`, top: `${20 + (d.id % 4) * 18}%` }}
              onClick={() => tap(d)}
              aria-label={t('microgame.coffeeDrop')}
            />
          ) : (
            <span key={d.id} className="coffee__drop" style={{ left: `${d.x}%`, top: `${d.y}%` }} aria-hidden />
          ),
        )}
        {!reducedMotion ? (
          <span className={`coffee__mug ${splash ? 'is-splash' : ''}`} style={{ left: `${mugX}%` }} aria-hidden />
        ) : null}
      </div>
    </div>
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
