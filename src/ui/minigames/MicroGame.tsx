import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MICRO_CALIBRATION,
  coffeeVariationFor,
  microGrade,
  type MicroGradeId,
  type MicroMode,
  type MicroReward,
} from '../../sim/minigames';
import type { StickerKind } from '../../art/EmotionSticker';
import { useFmt } from '../useFmt';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { Icon } from '../../art/UiIcon';
import { useStore } from '../../state/store';
import { CoffeeRescue } from './CoffeeRescue';
import { BugSquash } from './BugSquash';
import { CableUntangle } from './CableUntangle';
import {
  BugArt,
  DrinkArt,
  FeatureArt,
  KeyCap,
  MicroGameEmblem,
  MicroHost,
  PauseGlyph,
  PlayGlyph,
} from './MinigameArt';
import { BUG_SPECIES_BY_ID } from '../../sim/minigames';

export type { MicroMode };
export { MicroGameEmblem };

export interface MicroGameProps {
  mode: MicroMode;
  seed: number;
  reducedMotion: boolean;
  /** The teammate who runs this game; their art and their lines. */
  hostId?: string;
  /** The player's record before this sitting. */
  best?: number;
  mastered?: boolean;
  /** A round starts: returns its ticket, so only a round on file can be paid. */
  onBegin?: () => string | undefined;
  /** Granted exactly once per completed play. */
  onReward: (score: number, roundId?: string) => MicroReward | void;
  /** A round was left before its whistle. */
  onAbandon?: (roundId: string) => void;
  onClose: () => void;
}

export interface SubGameProps {
  /** This round's seed (the sitting's seed and the round number). */
  seed: string;
  /** The sitting's seed, for rules that change from round to round. */
  baseSeed: number;
  round: number;
  reducedMotion: boolean;
  paused: boolean;
  timeLeft: number;
  onScore: (absoluteScore: number) => void;
  /** The combo multiplier now applied, and the streak that earned it. */
  onCombo: (multiplier: number, chain?: number) => void;
}

type Phase = 'intro' | 'countdown' | 'play' | 'result';

const STICKER_FOR_GRADE: Record<MicroGradeId, StickerKind> = {
  poor: 'calm',
  ok: 'joy',
  great: 'proud',
  perfect: 'proud',
};

function useSystemReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return prefersReducedMotion;
}

/**
 * Marks a scroll box that has more below (`data-more`), so the edge can fade and say
 * so: in a short window the host's reaction sits under the score, out of sight.
 */
function useMoreBelow(ref: RefObject<HTMLElement>, watch: unknown) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const sync = () => {
      const more = element.scrollHeight - element.clientHeight - element.scrollTop > 6;
      element.dataset.more = more ? 'true' : 'false';
    };
    sync();
    element.addEventListener('scroll', sync, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => {
      element.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, [ref, watch]);
}

/** The width a box actually has (see useBoxHeight). */
function useBoxWidth(ref: RefObject<HTMLElement>, fallback: number, watch: unknown): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const next = Math.round(element.getBoundingClientRect().width);
      if (next > 0) setWidth((current) => (Math.abs(current - next) > 2 ? next : current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, watch]);
  return width;
}

/**
 * The height a box actually has, so a host can be drawn at the cast scale for it.
 * The box must be sized by its layout, not by the host inside it. `watch` re-attaches
 * when the box is re-created (the intro after a replay).
 */
function useBoxHeight(ref: RefObject<HTMLElement>, fallback: number, watch: unknown): number {
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const next = Math.round(element.getBoundingClientRect().height);
      if (next > 0) setHeight((current) => (Math.abs(current - next) > 2 ? next : current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, watch]);
  return height;
}

export function MicroGame({
  mode,
  seed,
  reducedMotion,
  hostId = 'pip',
  best: startingBest = 0,
  mastered: startingMastered = false,
  onBegin,
  onReward,
  onAbandon,
  onClose,
}: MicroGameProps) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const calibration = MICRO_CALIBRATION[mode];
  const duration = calibration.duration;
  const [reward, setReward] = useState<MicroReward | null>(null);
  const [refused, setRefused] = useState(false);
  const audio = useStore((state) => state.audio);
  const arrangeDecoration = useStore((state) => state.arrangeDecoration);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [finalScore, setFinalScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [combo, setCombo] = useState(1);
  const [manualPaused, setManualPaused] = useState(false);
  const [roundReducedMotion, setRoundReducedMotion] = useState(reducedMotion);
  const [record, setRecord] = useState({ best: startingBest, mastered: startingMastered });
  const [visibilityPaused, setVisibilityPaused] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  const systemReducedMotion = useSystemReducedMotion();
  const requestedReducedMotion = reducedMotion || systemReducedMotion;
  // Input mode is fixed for a round. Changing the OS preference while coffee is
  // falling must not reinterpret old drops or alter the rules mid-play.
  const motionReduced = phase === 'intro' ? requestedReducedMotion : roundReducedMotion;
  const paused = manualPaused || visibilityPaused;
  const liveScore = useRef(0);
  const roundRef = useRef(0);
  const roundState = useRef<'idle' | 'countdown' | 'active' | 'completed' | 'abandoned'>('idle');
  const roundTicket = useRef<string | undefined>(undefined);
  const deadline = useRef<number | null>(null);
  const pausedRemaining = useRef<number | null>(null);
  const playfieldRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const wasPaused = useRef(false);
  const sceneHeight = useBoxHeight(sceneRef, 150, phase);
  const introBodyRef = useRef<HTMLDivElement>(null);
  const resultScrollRef = useRef<HTMLDivElement>(null);
  // The result's host stands tall only when the cabinet lays the host beside the report.
  const hostLineWide = useBoxWidth(resultScrollRef, 0, phase) >= 600;
  useMoreBelow(introBodyRef, phase);
  useMoreBelow(resultScrollRef, phase);

  useEffect(() => {
    const syncVisibility = () => setVisibilityPaused(document.visibilityState === 'hidden');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  // A live round waits for the player: Escape pauses it (and resumes it), instead of
  // closing the sheet and silently throwing the round away; leaving the window pauses
  // it too, so a notification stealing focus never costs a shift.
  useEffect(() => {
    if (phase !== 'play' && phase !== 'countdown') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setManualPaused((value) => !value);
    };
    const onBlur = () => setManualPaused(true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'countdown' || paused) return;
    if (countdown <= 0) {
      audio.play('chime');
      roundState.current = 'active';
      roundTicket.current = onBegin?.();
      pausedRemaining.current = duration * 1000;
      deadline.current = performance.now() + pausedRemaining.current;
      setPhase('play');
      return;
    }
    audio.play('toggle');
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // onBegin is read once, at the whistle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, countdown, duration, paused, phase]);

  // A monotonic deadline avoids doing reward/state side effects from inside a
  // React state updater. Pausing preserves the exact remaining milliseconds,
  // and completion first closes the round gate before snapshotting the score.
  useEffect(() => {
    if (phase !== 'play' || roundState.current !== 'active') return;
    if (paused) {
      if (deadline.current !== null) {
        pausedRemaining.current = Math.max(0, deadline.current - performance.now());
        deadline.current = null;
      }
      return;
    }
    if (deadline.current === null) {
      deadline.current = performance.now() + (pausedRemaining.current ?? timeLeft * 1000);
    }

    const tick = () => {
      if (roundState.current !== 'active' || deadline.current === null) return;
      const remainingMs = Math.max(0, deadline.current - performance.now());
      const seconds = Math.ceil(remainingMs / 1000);
      setTimeLeft((current) => (current === seconds ? current : seconds));
      if (remainingMs <= 0) completeRound();
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
    // completeRound is a stable function declaration; the round gate prevents
    // stale timer callbacks from completing a replayed round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, phase, round]);

  useEffect(() => {
    const playfield = playfieldRef.current;
    if (!playfield) return;
    if (paused) playfield.setAttribute('inert', '');
    else playfield.removeAttribute('inert');
  }, [paused, phase]);

  const focusControl = () => {
    window.requestAnimationFrame(() => {
      const control = playfieldRef.current?.querySelector<HTMLElement>('[data-game-control]');
      (control ?? playfieldRef.current)?.focus({ preventScroll: true });
    });
  };

  // Keyboard focus follows the round: Start on the intro, the board the moment play
  // begins (so the keys work at once), Resume while paused, Play again on the result.
  useEffect(() => {
    if (phase === 'intro') {
      window.requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true }));
    } else if (phase === 'play') {
      focusControl();
    } else if (phase === 'result') {
      window.requestAnimationFrame(() => againRef.current?.focus({ preventScroll: true }));
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play' && phase !== 'countdown') return;
    if (manualPaused) {
      window.requestAnimationFrame(() => resumeRef.current?.focus({ preventScroll: true }));
    } else if (wasPaused.current && !paused) {
      focusControl();
    }
    wasPaused.current = paused;
  }, [manualPaused, paused, phase]);

  useEffect(() => {
    if (phase !== 'result') return;
    if (motionReduced || finalScore <= 0) {
      setDisplayScore(finalScore);
      return;
    }
    setDisplayScore(0);
    const started = performance.now();
    const length = 650;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / length);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(finalScore * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [finalScore, motionReduced, phase]);

  // Leaving the sheet mid-round (the dock, the office button) is leaving the round.
  useEffect(
    () => () => {
      if (roundState.current === 'active' && roundTicket.current) onAbandon?.(roundTicket.current);
    },
    // Unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function start() {
    if (roundState.current === 'countdown' || roundState.current === 'active') return;
    liveScore.current = 0;
    roundState.current = 'countdown';
    setRoundReducedMotion(requestedReducedMotion);
    setManualPaused(false);
    setCountdown(3);
    setPhase('countdown');
  }

  function completeRound() {
    if (roundState.current !== 'active') return;
    // Close the callback gate synchronously before reading the final score. Any
    // queued drop/tap callback from the old playfield is ignored after this.
    roundState.current = 'completed';
    deadline.current = null;
    pausedRemaining.current = null;
    const score = liveScore.current;
    const ticket = roundTicket.current;
    roundTicket.current = undefined;
    setFinalScore(score);
    const paid = onReward(score, ticket) ?? null;
    setReward(paid);
    setRefused(!paid);
    if (paid) {
      setRecord((current) => ({
        best: Math.max(current.best, paid.best),
        mastered: current.mastered || paid.mastered || paid.masteredBefore,
      }));
    }
    setPhase('result');
  }

  function abandonRound() {
    if (roundState.current === 'completed' || roundState.current === 'abandoned') return;
    roundState.current = 'abandoned';
    deadline.current = null;
    pausedRemaining.current = null;
    if (roundTicket.current) onAbandon?.(roundTicket.current);
    roundTicket.current = undefined;
    onClose();
  }

  function replay() {
    setReward(null);
    setRefused(false);
    liveScore.current = 0;
    roundState.current = 'idle';
    roundTicket.current = undefined;
    deadline.current = null;
    pausedRemaining.current = null;
    setFinalScore(0);
    setDisplayScore(0);
    setTimeLeft(duration);
    setCombo(1);
    setManualPaused(false);
    roundRef.current += 1;
    setRound(roundRef.current);
    setPhase('intro');
  }

  const activeRound = round;
  const subProps: SubGameProps = {
    seed: `${seed}-${round}`,
    baseSeed: seed,
    round,
    reducedMotion: motionReduced,
    paused,
    timeLeft,
    onScore: (score) => {
      if (roundState.current !== 'active' || activeRound !== roundRef.current) return;
      liveScore.current = score;
      setDisplayScore(score);
    },
    onCombo: (multiplier) => {
      if (roundState.current === 'active' && activeRound === roundRef.current) setCombo(multiplier);
    },
  };

  const host = EMPLOYEES_BY_ID[hostId] ? hostId : 'pip';
  const hostName = t(EMPLOYEES_BY_ID[host].nameKey);
  const grade = microGrade(mode, finalScore);
  const variation = mode === 'coffeeRescue' ? coffeeVariationFor(seed, round) : null;
  const masteredNow = Boolean(reward?.mastered);
  const masteryFraction = Math.min(1, finalScore / calibration.mastery);
  const bestFraction = Math.min(1, record.best / calibration.mastery);
  const boostPercent = reward ? Math.round((reward.boost - 1) * 100) : 0;
  const ownPercent = reward ? Math.round((reward.ownBoost - 1) * 100) : 0;

  return (
    <div
      className={`microgame microgame--${mode} microgame--${phase} ${paused ? 'is-paused' : ''}`}
      data-phase={phase}
    >
      {phase === 'intro' ? (
        <section className="microgame__intro" aria-labelledby={`microgame-title-${mode}`}>
          {/* Focusable so a keyboard can scroll it in a short window. */}
          <div
            ref={introBodyRef}
            className="microgame__intro-body"
            tabIndex={0}
            role="region"
            aria-labelledby={`microgame-title-${mode}`}
          >
            <div className="microgame__intro-scene" ref={sceneRef}>
              <MicroHost
                employeeId={host}
                // A tall scene keeps room above the host for their words.
                space={Math.max(60, Math.min(190, sceneHeight - (sceneHeight > 200 ? 96 : 10)))}
                reducedMotion={motionReduced}
                sticker="focused"
              />
              <p className="micro-bubble">
                <b>{hostName}</b>
                <span>
                  {t(`microgame.host.${mode}.${host}.intro`, {
                    defaultValue: t(`microgame.${mode}.assignment`),
                  })}
                </span>
              </p>
            </div>
            <div className="microgame__intro-copy">
              <div className="microgame__title-row">
                <span className="microgame__title-emblem" aria-hidden="true">
                  <MicroGameEmblem mode={mode} />
                </span>
                <div>
                  <span className="microgame__eyebrow">{t('microgame.shiftBreak')}</span>
                  <h3 id={`microgame-title-${mode}`}>{t(`microgame.${mode}.name`)}</h3>
                </div>
              </div>
              <p className="microgame__desc">{t(`microgame.${mode}.desc`)}</p>
              <ul className="microgame__rules">
                {(['a', 'b', 'c'] as const).map((rule) => (
                  <li key={rule} className={`microgame__rule microgame__rule--${rule}`}>
                    <span className="microgame__rule-art" aria-hidden="true">
                      <RuleArt mode={mode} rule={rule} />
                    </span>
                    <span>{t(`microgame.${mode}.rules.${rule}`)}</span>
                  </li>
                ))}
              </ul>
              {variation ? (
                <p className="microgame__today">
                  <b>{t(`microgame.coffeeRescue.day.${variation.id}.title`)}</b>
                  <span>{t(`microgame.coffeeRescue.day.${variation.id}.body`)}</span>
                </p>
              ) : null}
              <p className="microgame__record-line">
                {record.best > 0 ? (
                  <span>{t('microgame.personalBest', { score: record.best })}</span>
                ) : null}
                <span>
                  {record.mastered
                    ? t('microgame.masteryOnFile')
                    : t('microgame.masteryTarget', { value: calibration.mastery })}
                </span>
              </p>
              <p className="microgame__controls-hint">
                <ControlsHint mode={mode} reduced={motionReduced} />
              </p>
            </div>
          </div>
          {/* Pinned under the brief, so Start is on screen however short the window. */}
          <div className="microgame__intro-actions">
            <button
              ref={startRef}
              type="button"
              className="buy-btn microgame__start"
              onClick={start}
            >
              <PlayGlyph /> {t('microgame.start')}
            </button>
            <button type="button" className="ghost-btn" onClick={onClose}>
              <Icon name="close" size={14} /> {t('common.back')}
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'countdown' ? (
        <div className="microgame__countdown">
          <MicroGameEmblem mode={mode} compact />
          <span className="microgame__countdown-live" role="status" aria-live="assertive">
            <span className="microgame__countdown-label">{t('microgame.getReady')}</span>
            <strong key={countdown}>{countdown || t('microgame.go')}</strong>
            {paused ? <small>{t('microgame.paused')}</small> : null}
          </span>
          {/* Focus left the window (or Esc) mid-countdown: a way back in besides Esc. */}
          {manualPaused && !visibilityPaused ? (
            <button
              ref={resumeRef}
              type="button"
              className="buy-btn"
              onClick={() => setManualPaused(false)}
            >
              <PlayGlyph /> {t('microgame.resume')}
            </button>
          ) : null}
        </div>
      ) : null}

      {phase === 'play' ? (
        <>
          <div className="microgame__bar">
            <div className="microgame__identity">
              <MicroGameEmblem mode={mode} compact />
              <strong>{t(`microgame.${mode}.name`)}</strong>
            </div>
            <div className="microgame__readouts">
              <span className="microgame__score">
                <small>{t('microgame.scoreLabel')}</small>
                <b>{displayScore}</b>
              </span>
              {combo > 1 ? (
                <span className="microgame__combo" key={combo}>
                  {t('microgame.combo', { value: combo })}
                </span>
              ) : null}
              <span
                className={`microgame__timer ${timeLeft <= 5 ? 'is-urgent' : ''}`}
                aria-label={t('microgame.timeLeft', { value: timeLeft })}
              >
                <Icon name="focus" size={14} /> {timeLeft}s
              </span>
            </div>
            <div className="microgame__controls">
              <button
                type="button"
                className="ghost-btn microgame__pause"
                onClick={() => setManualPaused((value) => !value)}
                aria-pressed={paused}
                aria-label={paused ? t('microgame.resume') : t('microgame.pause')}
                title={t('microgame.pauseKey')}
              >
                {paused ? <PlayGlyph /> : <PauseGlyph />}
                <span className="microgame__btn-label">
                  {paused ? t('microgame.resume') : t('microgame.pause')}
                </span>
              </button>
              <button
                type="button"
                className="ghost-btn microgame__exit"
                onClick={abandonRound}
                aria-label={t('microgame.exit')}
              >
                <Icon name="close" size={14} />
                <span className="microgame__btn-label">{t('microgame.exit')}</span>
              </button>
            </div>
          </div>
          <div className={`microgame__stage ${paused ? 'is-paused' : ''}`} aria-busy={paused}>
            <div
              ref={playfieldRef}
              className="microgame__playfield"
              aria-hidden={paused ? true : undefined}
              aria-label={t(`microgame.${mode}.name`)}
              tabIndex={-1}
            >
              {mode === 'coffeeRescue' ? <CoffeeRescue key={round} {...subProps} /> : null}
              {mode === 'bugSquash' ? <BugSquash key={round} {...subProps} /> : null}
              {mode === 'cableUntangle' ? <CableUntangle key={round} {...subProps} /> : null}
            </div>
            {paused ? (
              <div className="microgame__paused" role="status">
                <PauseGlyph />
                <strong>{t('microgame.paused')}</strong>
                {!visibilityPaused ? (
                  <>
                    <button
                      ref={resumeRef}
                      type="button"
                      className="buy-btn"
                      onClick={() => setManualPaused(false)}
                    >
                      {t('microgame.resume')}
                    </button>
                    <button type="button" className="ghost-btn" onClick={abandonRound}>
                      {t('microgame.exit')}
                    </button>
                    <small>{t('microgame.pausedHint')}</small>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {phase === 'result' ? (
        <section className="microgame__result" aria-labelledby="microgame-result-title">
          <div
            ref={resultScrollRef}
            className="microgame__result-scroll"
            tabIndex={0}
            role="region"
            aria-labelledby="microgame-result-title"
          >
            <div className={`microgame__report microgame__report--${grade}`}>
              <div className="microgame__report-head">
                <span className="microgame__eyebrow">{t('microgame.shiftComplete')}</span>
                <span
                  id="microgame-result-title"
                  className={`microgame__grade micro-stamp micro-stamp--${grade}`}
                >
                  {t(`microgame.grade.${grade}`)}
                </span>
              </div>
              <div className="microgame__final-score">
                <small>{t('microgame.finalScore')}</small>
                <strong>{displayScore}</strong>
                {reward?.newBest ? (
                  <span className="microgame__best-stamp micro-stamp" role="note">
                    {t('microgame.newBestStamp')}
                  </span>
                ) : null}
              </div>
              <div
                className={`microgame__mastery ${record.mastered ? 'is-mastered' : ''}`}
                role="img"
                aria-label={
                  record.mastered
                    ? t('microgame.masteryOnFile')
                    : t('microgame.masteryProgress', {
                        score: finalScore,
                        value: calibration.mastery,
                      })
                }
              >
                <span className="microgame__mastery-track" aria-hidden="true">
                  <i style={{ width: `${Math.round(masteryFraction * 100)}%` }} />
                  {record.best > finalScore ? (
                    <b style={{ left: `${Math.round(bestFraction * 100)}%` }} />
                  ) : null}
                </span>
                <small aria-hidden="true">
                  {masteredNow
                    ? t('microgame.masteryEarned')
                    : record.mastered
                      ? t('microgame.masteryOnFile')
                      : t('microgame.masteryProgress', {
                          score: finalScore,
                          value: calibration.mastery,
                        })}
                </small>
              </div>
              <div className="microgame__reward-slip">
                <Icon name="reputation" size={20} />
                <span>
                  <strong>
                    {refused
                      ? t('microgame.rewardFiled')
                      : t(finalScore > 0 ? 'microgame.rewardEarned' : 'microgame.practiceComplete')}
                  </strong>
                  {reward && finalScore > 0 ? (
                    <small>
                      {t('microgame.actualReward', {
                        nuts: fmt.num(reward.nuts),
                        percent: boostPercent,
                        seconds: reward.boostSeconds,
                      })}
                    </small>
                  ) : null}
                  {reward && finalScore > 0 && boostPercent > ownPercent ? (
                    <small className="microgame__renewed">
                      {t('microgame.boostRenewed', { value: ownPercent })}
                    </small>
                  ) : null}
                  {refused ? <small>{t('microgame.rewardFiledBody')}</small> : null}
                  {reward && finalScore <= 0 ? <small>{t('microgame.practiceBody')}</small> : null}
                  {reward && reward.employeeIds.length > 0 ? (
                    <small>
                      {t('microgame.teamReward', {
                        names: reward.employeeIds
                          .map((id) => t(EMPLOYEES_BY_ID[id].nameKey))
                          .join(', '),
                      })}
                    </small>
                  ) : null}
                </span>
              </div>
              {masteredNow ? (
                <div className="microgame__prize">
                  <strong>{t('microgame.masteryFirst')}</strong>
                  <small>{t('microgame.masteryPrize')}</small>
                  {reward?.decorationId ? (
                    <small>
                      {t('microgame.souvenir', { name: t(`deco.${reward.decorationId}.name`) })}
                    </small>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="microgame__host-line">
              <MicroHost
                employeeId={host}
                // Room to stand in a wide cabinet; the cast's smallest size in a small one.
                space={hostLineWide ? 150 : 60}
                reducedMotion={motionReduced}
                sticker={STICKER_FOR_GRADE[grade]}
              />
              <p className="micro-bubble">
                <b>{hostName}</b>
                <span>
                  {t(
                    reward?.newBest && grade !== 'perfect'
                      ? `microgame.host.${mode}.${host}.best`
                      : `microgame.host.${mode}.${host}.${grade}`,
                    { defaultValue: t(`microgame.${mode}.reaction`) },
                  )}
                </span>
              </p>
            </div>
          </div>
          <div className="microgame__result-actions">
            <button ref={againRef} type="button" className="buy-btn" onClick={replay}>
              <PlayGlyph /> {t('microgame.playAgain')}
            </button>
            {reward?.decorationId ? (
              <button
                type="button"
                className="reward-btn microgame__souvenir-btn"
                onClick={() => arrangeDecoration(reward.decorationId!)}
              >
                {t('microgame.placeSouvenir', { name: t(`deco.${reward.decorationId}.name`) })}
              </button>
            ) : null}
            <button type="button" className="ghost-btn" onClick={onClose}>
              {t('microgame.otherGames')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** The three rules on a game's intro, each with the piece of the board it is about. */
function RuleArt({ mode, rule }: { mode: MicroMode; rule: 'a' | 'b' | 'c' }) {
  if (mode === 'coffeeRescue') {
    if (rule === 'a') return <DrinkArt kind="espresso" />;
    if (rule === 'b') return <DrinkArt kind="decaf" />;
    return (
      <svg viewBox="0 0 40 40" className="micro-rule-icon" focusable="false">
        <path
          d="M8 6h24v28l-4-3-4 3-4-3-4 3-4-3-4 3Z"
          fill="#fffaf0"
          stroke="#2b1b10"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M13 14h14M13 20h10" stroke="#a8733f" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="m22 25 3 3 6-7"
          fill="none"
          stroke="#45763d"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (mode === 'bugSquash') {
    if (rule === 'a') return <BugArt species={BUG_SPECIES_BY_ID.runner} />;
    if (rule === 'b') return <BugArt species={BUG_SPECIES_BY_ID.armoured} />;
    return <FeatureArt />;
  }
  if (rule === 'a')
    return (
      <svg viewBox="0 0 40 40" className="micro-rule-icon" focusable="false">
        <path d="M6 30 34 10" stroke="#e49b45" strokeWidth="5" strokeLinecap="round" />
        <circle cx="10" cy="27" r="7" fill="#fffaf0" stroke="#2b1b10" strokeWidth="2.4" />
        <circle cx="30" cy="13" r="7" fill="#fffaf0" stroke="#2b1b10" strokeWidth="2.4" />
      </svg>
    );
  if (rule === 'b')
    return (
      <svg viewBox="0 0 40 40" className="micro-rule-icon" focusable="false">
        <path d="M6 8 34 32M34 8 6 32" stroke="#6ba9c6" strokeWidth="5" strokeLinecap="round" />
        <circle cx="20" cy="20" r="7.5" fill="#fff1e8" stroke="#c94452" strokeWidth="3" />
        <path d="m17 17 6 6m0-6-6 6" stroke="#c94452" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 40" className="micro-rule-icon" focusable="false">
      <circle cx="20" cy="22" r="13" fill="#fffaf0" stroke="#2b1b10" strokeWidth="2.6" />
      <path d="M20 22V14M20 22l6 3" stroke="#2b1b10" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 5h8" stroke="#2b1b10" strokeWidth="3" strokeLinecap="round" />
      <path d="M31 8l3-3" stroke="#a8801d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ControlsHint({ mode, reduced }: { mode: MicroMode; reduced: boolean }) {
  const { t } = useTranslation();
  if (mode === 'coffeeRescue' && !reduced) {
    return (
      <>
        <span>{t('microgame.coffeeRescue.controlsPointer')}</span>
        <span className="microgame__keys">
          <KeyCap dir="left" />
          <KeyCap dir="right" />
          {t('microgame.coffeeRescue.controlsKeys')}
        </span>
      </>
    );
  }
  return (
    <span>
      {t(`microgame.${mode}.controls${reduced && mode === 'coffeeRescue' ? 'Tap' : 'Hint'}`)}
    </span>
  );
}
