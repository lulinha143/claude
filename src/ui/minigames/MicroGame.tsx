import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { microGrade, type MicroMode } from '../../sim/minigames';
import { Icon } from '../../art/UiIcon';
import { useStore } from '../../state/store';
import { CoffeeRescue } from './CoffeeRescue';
import { BugSquash } from './BugSquash';
import { CableUntangle } from './CableUntangle';

export type { MicroMode };

const DURATION: Record<MicroMode, number> = {
  coffeeRescue: 30,
  bugSquash: 30,
  cableUntangle: 45,
};

export interface MicroGameProps {
  mode: MicroMode;
  seed: number;
  reducedMotion: boolean;
  /** Granted exactly once per completed play. */
  onReward: (score: number) => void;
  onClose: () => void;
}

export interface SubGameProps {
  seed: string;
  reducedMotion: boolean;
  paused: boolean;
  timeLeft: number;
  onScore: (absoluteScore: number) => void;
  onCombo: (multiplier: number) => void;
  onEnd: (finalScore: number) => void;
}

type Phase = 'intro' | 'countdown' | 'play' | 'result';

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

export function MicroGame({ mode, seed, reducedMotion, onReward, onClose }: MicroGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [finalScore, setFinalScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION[mode]);
  const [combo, setCombo] = useState(1);
  const [manualPaused, setManualPaused] = useState(false);
  const [visibilityPaused, setVisibilityPaused] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  const systemReducedMotion = useSystemReducedMotion();
  const motionReduced = reducedMotion || systemReducedMotion;
  const paused = manualPaused || visibilityPaused;
  const liveScore = useRef(0);
  const rewarded = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    const syncVisibility = () => setVisibilityPaused(document.visibilityState === 'hidden');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    if (phase !== 'countdown' || paused) return;
    if (countdown <= 0) {
      audio.play('chime');
      setPhase('play');
      return;
    }
    audio.play('toggle');
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [audio, countdown, paused, phase]);

  // One shared timer keeps every game consistent and pauses when the player
  // explicitly pauses or the app is hidden/minimized.
  useEffect(() => {
    if (phase !== 'play' || paused) return;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          end(liveScore.current);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, phase, round]);

  useEffect(() => {
    if (phase !== 'result') return;
    if (motionReduced || finalScore <= 0) {
      setDisplayScore(finalScore);
      return;
    }
    setDisplayScore(0);
    const started = performance.now();
    const duration = 650;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(finalScore * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [finalScore, motionReduced, phase]);

  function start() {
    setCountdown(3);
    setPhase('countdown');
  }

  function end(score: number) {
    if (ended.current) return;
    ended.current = true;
    setFinalScore(score);
    if (!rewarded.current) {
      rewarded.current = true;
      onReward(score);
    }
    setPhase('result');
  }

  function replay() {
    liveScore.current = 0;
    rewarded.current = false;
    ended.current = false;
    setFinalScore(0);
    setDisplayScore(0);
    setTimeLeft(DURATION[mode]);
    setCombo(1);
    setManualPaused(false);
    setRound((value) => value + 1);
    setPhase('intro');
  }

  const subProps: SubGameProps = {
    seed: `${seed}-${round}`,
    reducedMotion: motionReduced,
    paused,
    timeLeft,
    onScore: (score) => {
      liveScore.current = score;
      setDisplayScore(score);
    },
    onCombo: setCombo,
    onEnd: end,
  };

  return (
    <div className={`microgame microgame--${mode} microgame--${phase}`} data-phase={phase}>
      {phase === 'intro' ? (
        <section className="microgame__intro" aria-labelledby={`microgame-title-${mode}`}>
          <div className="microgame__intro-scene" aria-hidden="true">
            <span className="microgame__intro-glow" />
            <MicroGameEmblem mode={mode} />
            <span className="microgame__intro-spark microgame__intro-spark--one" />
            <span className="microgame__intro-spark microgame__intro-spark--two" />
          </div>
          <div className="microgame__intro-copy">
            <span className="microgame__eyebrow">{t('microgame.shiftBreak')}</span>
            <h3 id={`microgame-title-${mode}`}>{t(`microgame.${mode}.name`)}</h3>
            <p>{t(`microgame.${mode}.desc`)}</p>
            <div className="microgame__intro-actions">
              <button className="buy-btn microgame__start" onClick={start}>
                <Icon name="focus" size={17} /> {t('microgame.start')}
              </button>
              <button className="ghost-btn" onClick={onClose}>
                <Icon name="close" size={14} /> {t('common.back')}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {phase === 'countdown' ? (
        <div className="microgame__countdown" role="status" aria-live="assertive">
          <MicroGameEmblem mode={mode} compact />
          <span className="microgame__countdown-label">{t('microgame.getReady')}</span>
          <strong key={countdown}>{countdown || t('microgame.go')}</strong>
        </div>
      ) : null}

      {phase === 'play' ? (
        <>
          <div className="microgame__bar">
            <div className="microgame__identity">
              <MicroGameEmblem mode={mode} compact />
              <strong>{t(`microgame.${mode}.name`)}</strong>
            </div>
            <div className="microgame__readouts" aria-live="polite">
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
                className="ghost-btn microgame__pause"
                onClick={() => setManualPaused((value) => !value)}
                aria-pressed={paused}
              >
                {paused ? t('microgame.resume') : t('microgame.pause')}
              </button>
              <button className="ghost-btn microgame__exit" onClick={() => end(liveScore.current)}>
                <Icon name="close" size={14} /> {t('microgame.exit')}
              </button>
            </div>
          </div>
          <p className="microgame__instructions">{t(`microgame.${mode}.desc`)}</p>
          <div className={`microgame__stage ${paused ? 'is-paused' : ''}`} aria-busy={paused}>
            <div
              className="microgame__playfield"
              aria-hidden={paused ? true : undefined}
            >
              {mode === 'coffeeRescue' ? <CoffeeRescue key={round} {...subProps} /> : null}
              {mode === 'bugSquash' ? <BugSquash key={round} {...subProps} /> : null}
              {mode === 'cableUntangle' ? <CableUntangle key={round} {...subProps} /> : null}
            </div>
            {paused ? (
              <div className="microgame__paused" role="status">
                <Icon name="focus" size={26} />
                <strong>{t('microgame.paused')}</strong>
                {!visibilityPaused ? (
                  <button className="buy-btn" onClick={() => setManualPaused(false)}>
                    {t('microgame.resume')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {phase === 'result' ? (
        <section className="microgame__result" aria-labelledby="microgame-result-title">
          <div className="microgame__reward-burst" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} style={{ ['--burst-index' as string]: index }} />
            ))}
            <MicroGameEmblem mode={mode} />
          </div>
          <span className="microgame__eyebrow">{t('microgame.shiftComplete')}</span>
          <div id="microgame-result-title" className="microgame__grade">
            {t(`microgame.grade.${microGrade(finalScore)}`)}
          </div>
          <div className="microgame__final-score">
            <small>{t('microgame.finalScore')}</small>
            <strong>{displayScore}</strong>
          </div>
          <div className="microgame__reward-slip">
            <Icon name="reputation" size={20} />
            <span>
              <strong>{t('microgame.rewardEarned')}</strong>
              <small>{t('microgame.rewardBoost')}</small>
            </span>
          </div>
          <p className="microgame__reaction">{t(`microgame.${mode}.reaction`)}</p>
          <div className="button-row">
            <button className="buy-btn" onClick={replay}>
              {t('microgame.playAgain')}
            </button>
            <button className="ghost-btn" onClick={onClose}>
              {t('microgame.backToOffice')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function MicroGameEmblem({ mode, compact = false }: { mode: MicroMode; compact?: boolean }) {
  const size = compact ? 36 : 104;
  return (
    <svg
      className={`microgame-emblem microgame-emblem--${mode}`}
      width={size}
      height={size}
      viewBox="0 0 104 104"
      aria-hidden="true"
    >
      <ellipse cx="52" cy="91" rx="33" ry="7" fill="rgba(30,18,9,.25)" />
      {mode === 'coffeeRescue' ? (
        <>
          <path className="microgame-emblem__steam" d="M40 38c-8-10 8-13 0-24M56 36c-8-10 8-13 0-24" fill="none" stroke="#fff1cf" strokeWidth="5" strokeLinecap="round" />
          <path d="M27 42h50v34c0 10-8 16-18 16H45c-10 0-18-6-18-16Z" fill="#e6bb70" stroke="#332619" strokeWidth="4" />
          <path d="M77 49h8c13 0 13 22 0 22h-8" fill="none" stroke="#332619" strokeWidth="5" />
          <path d="M32 48h40v11H32Z" fill="#75482b" />
          <path d="M42 68q10 8 20 0" fill="none" stroke="#332619" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}
      {mode === 'bugSquash' ? (
        <>
          <path d="M18 81q34-24 68 0v11H18Z" fill="#8a5a2b" stroke="#332619" strokeWidth="4" />
          <ellipse cx="52" cy="64" rx="22" ry="25" fill="#b86c3f" stroke="#332619" strokeWidth="4" />
          <path d="M31 59 17 49M73 59l14-10M31 72l-16 5M73 72l16 5M43 38l-8-12M61 38l8-12" stroke="#332619" strokeWidth="5" strokeLinecap="round" />
          <circle cx="44" cy="58" r="5" fill="#fff4e0" /><circle cx="60" cy="58" r="5" fill="#fff4e0" />
          <circle cx="45" cy="59" r="2" fill="#332619" /><circle cx="59" cy="59" r="2" fill="#332619" />
          <path d="M45 73q7-5 14 0" fill="none" stroke="#332619" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}
      {mode === 'cableUntangle' ? (
        <>
          <path d="M22 28c20 4 12 48 35 51 20 2 16-31 29-34" fill="none" stroke="#38271c" strokeWidth="13" strokeLinecap="round" />
          <path d="M22 26c20 4 12 48 35 51 20 2 16-31 29-34" fill="none" stroke="#e6a93f" strokeWidth="8" strokeLinecap="round" />
          <path d="M22 25c20 4 12 48 35 51 20 2 16-31 29-34" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="2" strokeLinecap="round" />
          <g transform="translate(8 12)"><rect width="27" height="27" rx="7" fill="#f0e2c8" stroke="#332619" strokeWidth="4" /><path d="M7 13h13M13 7v13" stroke="#3f7d4f" strokeWidth="3" /></g>
          <g transform="translate(74 31)"><rect width="24" height="29" rx="6" fill="#f0e2c8" stroke="#332619" strokeWidth="4" /><circle cx="12" cy="10" r="4" fill="#4f9d69" /><path d="M7 20h10" stroke="#332619" strokeWidth="3" /></g>
          <path d="M38 83h28" stroke="#d8c4a8" strokeWidth="6" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}
