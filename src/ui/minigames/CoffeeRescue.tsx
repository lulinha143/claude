import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COFFEE_KEY_TAP,
  applyCoffeeHazard,
  coffeeCatchGeometry,
  coffeeComboMultiplier,
  coffeeKeyVelocity,
  coffeeKindCatchScore,
  coffeeKindFallDuration,
  coffeeOrder,
  coffeeOrderBonus,
  coffeePairX,
  coffeePhaseAt,
  coffeeSpawnGap,
  coffeeVariationFor,
  fillCoffeeOrder,
  firstCoffeeDropKind,
  microComboNext,
  pickCoffeeDropKind,
  resolveCoffeeDrop,
  type CoffeeCatchGeometry,
  type CoffeeDropKind,
  type CoffeeOrder,
  type CoffeePhaseId,
} from '../../sim/minigames';
import { useStore } from '../../state/store';
import { COFFEE_CUP_SHARE, CafeBackdrop, CoffeeMugArt, DrinkArt } from './MinigameArt';
import type { SubGameProps } from './MicroGame';

interface Drop {
  id: number;
  x: number; // 0..100
  y: number; // 0..100 progress down the play area
  born: number;
  /** What is falling. Decides speed, value, and whether it should be caught. */
  kind: CoffeeDropKind;
  /** Reduced-motion counter slot (1-5), the key that taps it. */
  slot: number;
}

/** Reduced-motion tap mode: how long a cup waits on the counter. */
const DROP_LIFETIME = 1800;
/** Reduced-motion tap mode: five places on the counter, one per number key. */
const TAP_SLOTS = [14, 32, 50, 68, 86];
const FALLBACK_GEOMETRY: CoffeeCatchGeometry = {
  minMugX: 9,
  maxMugX: 88,
  halfCatchWidth: 7,
  catchY: 76,
};

type Fx =
  | { id: number; type: 'catch'; x: number; value: number; order: boolean }
  | { id: number; type: 'miss'; x: number }
  | { id: number; type: 'hazard'; x: number; lost: number };

// Deliver coffee before it is lost. Motion mode: the mug follows the pointer (or a
// finger dragged across the counter), and Left/Right (or A/D) glide it while held.
// Reduced-motion mode: cups wait on the counter and are tapped (or numbered 1-5).
// A catch streak builds the combo; the ticket on the counter is an order, and
// filling it pays a bonus. Decaf is the one thing not to catch.
//
// The list of drops lives in a ref (single source of truth) so the animation
// loop can update positions AND resolve catches/misses without ever calling a
// React state setter inside another setter's updater.
export function CoffeeRescue({
  seed,
  baseSeed,
  round,
  reducedMotion,
  paused,
  onScore,
  onCombo,
}: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const variation = useMemo(() => coffeeVariationFor(baseSeed, round), [baseSeed, round]);
  const [mugX, setMugX] = useState(50);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [streak, setStreak] = useState(0);
  const [order, setOrder] = useState<CoffeeOrder>(() => coffeeOrder(seed, 0, variation));
  const [orderDone, setOrderDone] = useState<{ id: number; bonus: number } | null>(null);
  const [ticked, setTicked] = useState<number | null>(null);
  const [phase, setPhase] = useState<CoffeePhaseId>('warmup');
  const [banner, setBanner] = useState<{ id: number; phase: CoffeePhaseId } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [fx, setFx] = useState<Fx | null>(null);
  const [splash, setSplash] = useState(false);
  const dropsRef = useRef<Drop[]>([]);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const orderRef = useRef(order);
  const orderBusyRef = useRef(false);
  const phaseRef = useRef<CoffeePhaseId>('warmup');
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
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Held keyboard directions and when the hold began (for the ease-in). */
  const heldRef = useRef<{ left: boolean; right: boolean; since: number }>({
    left: false,
    right: false,
    since: 0,
  });

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

  // A pause (or the window losing focus) lets go of every held key: a key released
  // while the counter could not hear it must not leave the mug gliding on its own.
  useEffect(() => {
    if (!paused) return;
    heldRef.current = { left: false, right: false, since: 0 };
    if (fxTimer.current) clearTimeout(fxTimer.current);
    fxTimer.current = null;
    setSplash(false);
    setFx(null);
  }, [paused]);

  useEffect(() => {
    const release = () => {
      heldRef.current = { left: false, right: false, since: 0 };
    };
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('blur', release);
      for (const timer of [fxTimer, orderTimer, bannerTimer, tickTimer]) {
        if (timer.current) clearTimeout(timer.current);
      }
    };
  }, []);

  // Derive collision and edge clamps from the rendered café rather than fixed
  // percentages. This keeps the visible mug lip honest at 320px and ultrawide.
  useEffect(() => {
    const area = areaRef.current;
    const mug = mugRef.current;
    if (!area || !mug) return;
    const measure = () => {
      const areaRect = area.getBoundingClientRect();
      const mugRect = mug.getBoundingClientRect();
      if (areaRect.width <= 0 || areaRect.height <= 0 || mugRect.width <= 0) return;
      // Catches are judged on the cup (not its handle), at the rim; the whole drawn
      // mug, handle included, stays inside the counter.
      const cup = coffeeCatchGeometry(
        areaRect.width,
        areaRect.height,
        mugRect.width * COFFEE_CUP_SHARE,
        mugRect.top - areaRect.top + mugRect.height * 0.12,
        0,
      );
      const edge = ((mugRect.width / 2 + 4) / areaRect.width) * 100;
      const geometry: CoffeeCatchGeometry = { ...cup, minMugX: edge, maxMugX: 100 - edge };
      geometryRef.current = geometry;
      placeMug(Math.max(geometry.minMugX, Math.min(geometry.maxMugX, mugXRef.current)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(mug);
    return () => observer.disconnect();
    // placeMug only touches refs and a state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeMug(next: number) {
    // Input, visible position and collision share the same immediate coordinate.
    mugXRef.current = next;
    if (mugRef.current) mugRef.current.style.left = `${next}%`;
    setMugX(next);
  }

  function commitDrops(next: Drop[]) {
    dropsRef.current = next;
    setDrops(next);
  }

  function showFx(next: Fx, ms: number) {
    if (fxTimer.current) clearTimeout(fxTimer.current);
    setFx(next);
    fxTimer.current = setTimeout(() => {
      fxTimer.current = null;
      setFx(null);
      setSplash(false);
    }, ms);
  }

  function announcePhase(id: CoffeePhaseId) {
    if (phaseRef.current === id) return;
    phaseRef.current = id;
    setPhase(id);
    if (id === 'warmup') return;
    setBanner({ id: performance.now(), phase: id });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1900);
  }

  /** A good catch ticks the order; a complete order pays its bonus and the next comes in. */
  function serve(kind: CoffeeDropKind): { bonus: number } {
    if (orderBusyRef.current) return { bonus: 0 };
    const before = orderRef.current;
    // fillCoffeeOrder ticks the first open slot of this drink: that is the one to flash.
    const slot = before.items.findIndex((item, index) => item === kind.id && !before.filled[index]);
    const result = fillCoffeeOrder(before, kind.id);
    if (!result.matched) return { bonus: 0 };
    orderRef.current = result.order;
    setOrder(result.order);
    setTicked(slot);
    if (tickTimer.current) clearTimeout(tickTimer.current);
    tickTimer.current = setTimeout(() => setTicked(null), 420);
    if (!result.completed) return { bonus: 0 };
    const bonus = coffeeOrderBonus(result.order);
    orderBusyRef.current = true;
    setOrderDone({ id: performance.now(), bonus });
    if (orderTimer.current) clearTimeout(orderTimer.current);
    orderTimer.current = setTimeout(
      () => {
        const next = coffeeOrder(seed, result.order.index + 1, variation);
        orderRef.current = next;
        orderBusyRef.current = false;
        setOrder(next);
        setOrderDone(null);
      },
      reducedMotion ? 700 : 950,
    );
    return { bonus };
  }

  /**
   * Resolve a set of caught drops.
   *
   * Hazards are handled first and separately: catching one is a MISTAKE, so it must
   * not also be credited as part of the same catch. It breaks the streak, which is
   * the real cost — the points are almost incidental next to losing a 3x multiplier.
   */
  function registerCatch(caughtKinds: CoffeeDropKind[], x = mugXRef.current) {
    const hazards = caughtKinds.filter((kind) => kind.hazard);
    const goods = caughtKinds.filter((kind) => !kind.hazard);

    if (hazards.length > 0) {
      // Read the streak BEFORE destroying it: how much was riding on the mistake is
      // the most useful thing we can tell the player, and zeroing first loses it.
      const lostStreak = streakRef.current;
      let lost = 0;
      for (let i = 0; i < hazards.length; i += 1) {
        const penalty = applyCoffeeHazard(scoreRef.current);
        scoreRef.current = penalty.score;
        lost += penalty.lost;
      }
      streakRef.current = 0;
      setStreak(0);
      onScore(scoreRef.current);
      onCombo(1, 0);
      audio.play('error');
      // Unlike the miss mark, this one LINGERS under reduced motion: reduced motion
      // means "no movement", not "no feedback", and a player who just lost a long
      // streak deserves a visible record of why.
      showFx({ id: performance.now(), type: 'hazard', x, lost }, reducedMotion ? 900 : 520);
      setFeedback(
        lostStreak > 0
          ? t('microgame.coffeeRescue.hazardStreak', { value: lost, count: lostStreak })
          : t('microgame.coffeeRescue.hazard', { value: lost }),
      );
      if (goods.length === 0) return;
    }

    let gained = 0;
    let bonus = 0;
    for (const kind of goods) {
      streakRef.current += 1;
      gained += coffeeKindCatchScore(kind, streakRef.current);
      bonus += serve(kind).bonus;
    }
    if (goods.length === 0) return;
    scoreRef.current += gained + bonus;
    const multiplier = coffeeComboMultiplier(streakRef.current);
    setStreak(streakRef.current);
    onScore(scoreRef.current);
    onCombo(multiplier, streakRef.current);
    audio.play('coffeeCatch', { pitch: 1 + (multiplier - 1) * 0.12 });
    if (bonus > 0) window.setTimeout(() => audio.play('reward'), 120);
    setFeedback(
      bonus > 0
        ? t('microgame.coffeeRescue.orderDone', { value: gained, bonus })
        : t('microgame.coffeeRescue.caught', { count: goods.length, value: gained }),
    );
    if (reducedMotion) {
      // No flying number: the counter's own readouts already changed.
      setFx(null);
      return;
    }
    setSplash(true);
    showFx(
      { id: performance.now(), type: 'catch', x, value: gained + bonus, order: bonus > 0 },
      460,
    );
  }

  function registerMiss(x: number) {
    const lostStreak = streakRef.current;
    if (lostStreak !== 0) {
      streakRef.current = 0;
      setStreak(0);
      onCombo(1, 0);
    }
    setFeedback(
      lostStreak > 0
        ? t('microgame.coffeeRescue.streakLost', { count: lostStreak })
        : t('microgame.coffeeRescue.missed'),
    );
    showFx({ id: performance.now(), type: 'miss', x }, reducedMotion ? 700 : 420);
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
      const seconds = elapsed();
      const beat = coffeePhaseAt(seconds);
      announcePhase(beat.id);
      const geometry = geometryRef.current;
      const minDropX = Math.max(4, geometry.minMugX - geometry.halfCatchWidth + 1);
      const maxDropX = Math.min(96, geometry.maxMugX + geometry.halfCatchWidth - 1);
      const fresh: Drop[] = [];
      // The first thing that falls always teaches the basic rule; see
      // firstCoffeeDropKind().
      const kind =
        idRef.current === 0
          ? firstCoffeeDropKind()
          : pickCoffeeDropKind(rng.current(), variation, beat);
      if (reducedMotion) {
        const taken = new Set(dropsRef.current.map((drop) => drop.slot));
        const free = TAP_SLOTS.map((_, index) => index + 1).filter((slot) => !taken.has(slot));
        if (free.length > 0) {
          const slot = free[Math.floor(rng.current() * free.length) % free.length];
          fresh.push({ id: idRef.current++, x: TAP_SLOTS[slot - 1], y: 0, born: now, kind, slot });
        }
      } else {
        const x = minDropX + rng.current() * Math.max(1, maxDropX - minDropX);
        fresh.push({ id: idRef.current++, x, y: 0, born: now, kind, slot: 0 });
        // The rush sends two at once, too far apart for one mug: pick one.
        if (beat.pairChance > 0 && rng.current() < beat.pairChance) {
          const second = pickCoffeeDropKind(rng.current(), variation, beat);
          fresh.push({
            id: idRef.current++,
            x: coffeePairX(x, rng.current(), minDropX, maxDropX),
            y: 0,
            born: now,
            kind: second,
            slot: 0,
          });
        }
      }
      if (fresh.length > 0) commitDrops([...dropsRef.current, ...fresh]);
      const interval = coffeeSpawnGap(seconds, variation);
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

  // Motion mode: one frame loop moves the drops, glides the mug for held keys and
  // resolves catches against the rendered mug lip. Long frame gaps are clamped so a
  // refocus cannot teleport drops through the catch line.
  useEffect(() => {
    if (reducedMotion || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const seconds = elapsed();
      const geometry = geometryRef.current;
      const held = heldRef.current;
      const direction = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      if (direction !== 0) {
        const speed = coffeeKeyVelocity(now - held.since);
        const next = Math.max(
          geometry.minMugX,
          Math.min(geometry.maxMugX, mugXRef.current + direction * speed * dt),
        );
        if (next !== mugXRef.current) placeMug(next);
      }
      const next: Drop[] = [];
      const caught: Drop[] = [];
      const missed: Drop[] = [];
      for (const drop of dropsRef.current) {
        // Each kind falls at its own rate, so a fast espresso can overtake a
        // slow carafe that spawned before it.
        const y = drop.y + (100 / coffeeKindFallDuration(drop.kind, seconds, variation)) * dt;
        if (y >= geometry.catchY) {
          if (Math.abs(drop.x - mugXRef.current) <= geometry.halfCatchWidth) caught.push(drop);
          // A decaf left to fall is the right call, not a miss: it must not cost
          // the streak the player just protected by stepping aside.
          else if (!drop.kind.hazard) missed.push(drop);
        } else {
          next.push({ ...drop, y });
        }
      }
      if (dropsRef.current.length > 0) commitDrops(next);
      if (caught.length > 0) {
        const catchX = caught.reduce((total, drop) => total + drop.x, 0) / caught.length;
        registerCatch(
          caught.map((drop) => drop.kind),
          catchX,
        );
      }
      if (missed.length > 0) registerMiss(missed[missed.length - 1].x);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reducedMotion]);

  // Reduced-motion tap mode: expiry and tapping both resolve by drop id via
  // the ref, so an expiry/click race can never award a removed drop twice. A
  // decaf left alone is the right call and costs nothing.
  useEffect(() => {
    if (!reducedMotion || paused) return;
    const handle = setInterval(() => {
      const now = activeNow();
      const expired = dropsRef.current.filter((drop) => now - drop.born >= DROP_LIFETIME);
      if (expired.length === 0) return;
      const expiredIds = new Set(expired.map((drop) => drop.id));
      commitDrops(dropsRef.current.filter((drop) => !expiredIds.has(drop.id)));
      const lostCoffee = expired.filter((drop) => !drop.kind.hazard);
      if (lostCoffee.length > 0) registerMiss(lostCoffee[lostCoffee.length - 1].x);
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
    placeMug(Math.max(geometry.minMugX, Math.min(geometry.maxMugX, x)));
  }

  function handlePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (reducedMotion || paused || !event.isPrimary) return;
    if (event.type === 'pointerdown') {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      // A finger keeps steering the mug wherever it slides, even off the counter.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    moveMug(event.clientX);
  }

  function setHeld(key: string, down: boolean): boolean {
    const held = heldRef.current;
    const left = key === 'ArrowLeft' || key === 'a' || key === 'A';
    const right = key === 'ArrowRight' || key === 'd' || key === 'D';
    if (!left && !right) return false;
    const wasMoving = held.left || held.right;
    if (left) held.left = down;
    if (right) held.right = down;
    if (down && !wasMoving) held.since = performance.now();
    return true;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (paused) return;
    if (reducedMotion) {
      const slot = Number(event.key);
      if (Number.isInteger(slot) && slot >= 1 && slot <= TAP_SLOTS.length) {
        event.preventDefault();
        const drop = dropsRef.current.find((candidate) => candidate.slot === slot);
        if (drop) tap(drop);
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!setHeld(event.key, true)) return;
    event.preventDefault();
    // The press itself moves the mug at once; holding then glides it every frame
    // instead of waiting for the system's key repeat.
    if (!event.repeat) {
      const geometry = geometryRef.current;
      const direction = heldRef.current.right && !heldRef.current.left ? 1 : -1;
      placeMug(
        Math.max(
          geometry.minMugX,
          Math.min(geometry.maxMugX, mugXRef.current + direction * COFFEE_KEY_TAP),
        ),
      );
    }
  }

  function handleKeyUp(event: React.KeyboardEvent<HTMLDivElement>) {
    if (setHeld(event.key, false)) event.preventDefault();
  }

  function tap(drop: Drop) {
    if (paused || !removeDrop(drop.id)) return;
    registerCatch([drop.kind], drop.x);
  }

  const mult = coffeeComboMultiplier(streak);
  const next = microComboNext('coffeeRescue', streak);
  const toward = next === null ? 1 : streak / next;

  return (
    <div className={`coffee coffee--${variation.id} coffee--${phase}`} data-phase-beat={phase}>
      {/* Over the status row, never over the board: a banner must not hide targets. */}
      {banner ? (
        <span
          className={`micro-banner micro-banner--${banner.phase}`}
          key={banner.id}
          aria-hidden="true"
        >
          <b>{t(`microgame.coffeeRescue.phase.${banner.phase}.title`)}</b>
          <small>{t(`microgame.coffeeRescue.phase.${banner.phase}.body`)}</small>
        </span>
      ) : null}
      <div className="coffee__status">
        <div
          className={`coffee__order-ticket ${orderDone ? 'is-done' : ''}`}
          aria-label={t('microgame.coffeeRescue.orderLabel', {
            items: order.items.map((item) => t(`microgame.coffeeRescue.kind.${item}`)).join(', '),
            done: order.filled.filter(Boolean).length,
            total: order.items.length,
          })}
          role="img"
        >
          <b>{t('microgame.coffeeRescue.order', { value: order.index + 1 })}</b>
          <span className="coffee__order-items">
            {order.items.map((item, index) => (
              <span
                key={`${order.index}-${index}`}
                className={`coffee__order-item ${order.filled[index] ? 'is-filled' : ''} ${ticked === index ? 'is-ticked' : ''}`}
              >
                <DrinkArt kind={item} />
              </span>
            ))}
          </span>
          {orderDone ? (
            <span className="coffee__order-stamp" key={orderDone.id}>
              {t('microgame.coffeeRescue.orderStamp', { value: orderDone.bonus })}
            </span>
          ) : null}
        </div>
        <div
          className={`coffee__streak ${mult > 1 ? 'is-hot' : ''}`}
          role="meter"
          aria-label={t('microgame.coffeeRescue.warmth')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(toward * 100)}
        >
          <span className="coffee__streak-label">
            {streak > 0
              ? t('microgame.chain', { count: streak })
              : t('microgame.coffeeRescue.steady')}
          </span>
          <span className="coffee__meter" aria-hidden="true">
            <span
              className="coffee__meter-fill"
              style={{ width: `${Math.round(toward * 100)}%` }}
            />
          </span>
          <span className="coffee__streak-next" aria-hidden="true">
            {next === null
              ? t('microgame.comboMax')
              : t('microgame.comboNext', { value: mult + 1, count: next - streak })}
          </span>
        </div>
      </div>
      <span className="micro-feedback" role="status" aria-live="polite">
        {feedback}
      </span>
      <div
        className={`coffee__area ${reducedMotion ? 'is-tap-mode' : ''}`}
        ref={areaRef}
        data-game-control
        role="region"
        tabIndex={0}
        aria-label={t(
          reducedMotion ? 'microgame.coffeeRescue.tapControls' : 'microgame.coffeeRescue.controls',
        )}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => {
          heldRef.current = { left: false, right: false, since: 0 };
        }}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
      >
        <div className="coffee__cafe" aria-hidden="true">
          <CafeBackdrop />
        </div>
        {drops.map((drop) =>
          reducedMotion ? (
            <button
              key={drop.id}
              type="button"
              className={`coffee__drop coffee__drop--tap coffee__drop--${drop.kind.id}`}
              style={{ left: `${drop.x}%` }}
              onClick={() => tap(drop)}
              disabled={paused}
              /* Per-kind label, not one generic one. In reduced-motion mode the drop
                 is a real button that a screen reader announces, and labelling the
                 hazard identically to the rest would make it impossible to avoid
                 without sight — i.e. unfair rather than merely unpolished. */
              aria-label={t(`microgame.coffeeRescue.drop.${drop.kind.id}`)}
            >
              <DrinkArt kind={drop.kind.id} />
              <span className="coffee__slot" aria-hidden="true">
                {drop.slot}
              </span>
            </button>
          ) : (
            <span
              key={drop.id}
              className={`coffee__drop coffee__drop--${drop.kind.id}`}
              style={{ left: `${drop.x}%`, top: `${drop.y}%` }}
              aria-hidden="true"
            >
              <DrinkArt kind={drop.kind.id} />
            </span>
          ),
        )}
        <span
          ref={mugRef}
          className={`coffee__mug ${splash ? 'is-splash' : ''} ${reducedMotion ? 'is-stationary' : ''}`}
          style={{ left: `${reducedMotion ? 50 : mugX}%` }}
          aria-hidden="true"
        >
          <CoffeeMugArt fill={Math.min(1, streak / 12)} hot={mult > 1} />
        </span>
        {fx?.type === 'catch' ? (
          <span
            key={fx.id}
            className={`coffee__catch-fx ${fx.order ? 'is-order' : ''}`}
            style={{ left: `${fx.x}%` }}
            aria-hidden="true"
          >
            <b>+{fx.value}</b>
            {Array.from({ length: 7 }, (_, index) => (
              <i key={index} style={{ ['--i' as string]: index }} />
            ))}
          </span>
        ) : null}
        {fx && fx.type !== 'catch' ? (
          <span
            key={fx.id}
            className={`coffee__miss-fx ${fx.type === 'hazard' ? 'is-hazard' : ''}`}
            style={{ left: `${fx.x}%` }}
            aria-hidden="true"
          >
            <b>
              {fx.type === 'hazard'
                ? t('microgame.coffeeRescue.hazardMark', { value: fx.lost })
                : t('microgame.coffeeRescue.missMark')}
            </b>
          </span>
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
