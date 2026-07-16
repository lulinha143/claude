import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { microGrade, type MicroMode } from '../../sim/minigames';
import { Icon } from '../../art/UiIcon';
import { ShellSort } from './ShellSort';
import { CoffeeRescue } from './CoffeeRescue';
import { ProcurementConveyor } from './ProcurementConveyor';
import { BugSquash } from './BugSquash';
import { CableUntangle } from './CableUntangle';

export type { MicroMode };

const DURATION: Record<MicroMode, number> = {
  shellSort: 35,
  coffeeRescue: 30,
  procurement: 45,
  bugSquash: 30,
  cableUntangle: 45,
};

export interface MicroGameProps {
  mode: MicroMode;
  seed: number;
  reducedMotion: boolean;
  /** granted exactly once per completed play. */
  onReward: (score: number) => void;
  onClose: () => void;
}

export interface SubGameProps {
  seed: string;
  reducedMotion: boolean;
  timeLeft: number;
  onScore: (absoluteScore: number) => void;
  onEnd: (finalScore: number) => void;
}

export function MicroGame({ mode, seed, reducedMotion, onReward, onClose }: MicroGameProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'play' | 'result'>('play');
  const [round, setRound] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION[mode]);
  const liveScore = useRef(0);
  const rewarded = useRef(false);
  const ended = useRef(false);

  // shared countdown timer (drives the time-based games)
  useEffect(() => {
    if (phase !== 'play') return;
    const h = setInterval(() => {
      setTimeLeft((tl) => {
        if (tl <= 1) {
          clearInterval(h);
          end(liveScore.current);
          return 0;
        }
        return tl - 1;
      });
    }, 1000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

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
    setTimeLeft(DURATION[mode]);
    setRound((r) => r + 1);
    setPhase('play');
  }

  const subProps: SubGameProps = {
    seed: `${seed}-${round}`,
    reducedMotion,
    timeLeft,
    onScore: (s) => (liveScore.current = s),
    onEnd: (s) => end(s),
  };

  return (
    <div className="microgame">
      <div className="microgame__bar">
        <strong>{t(`microgame.${mode}.name`)}</strong>
        {phase === 'play' ? (
          <span className="microgame__timer" aria-label={t('microgame.timeLeft', { value: timeLeft })}>
            <Icon name="focus" size={14} /> {timeLeft}s
          </span>
        ) : null}
        <button className="ghost-btn microgame__exit" onClick={() => (phase === 'play' ? end(liveScore.current) : onClose())}>
          <Icon name="close" size={14} /> {phase === 'play' ? t('microgame.exit') : t('common.back')}
        </button>
      </div>

      {phase === 'play' ? (
        <>
          <p className="microgame__instructions">{t(`microgame.${mode}.desc`)}</p>
          {mode === 'shellSort' ? <ShellSort key={round} {...subProps} /> : null}
          {mode === 'coffeeRescue' ? <CoffeeRescue key={round} {...subProps} /> : null}
          {mode === 'procurement' ? <ProcurementConveyor key={round} {...subProps} /> : null}
          {mode === 'bugSquash' ? <BugSquash key={round} {...subProps} /> : null}
          {mode === 'cableUntangle' ? <CableUntangle key={round} {...subProps} /> : null}
        </>
      ) : (
        <div className="microgame__result">
          <div className="microgame__grade">{t(`microgame.grade.${microGrade(finalScore)}`)}</div>
          <div className="big-number">{t('microgame.result', { value: finalScore })}</div>
          <p className="muted small">{t('microgame.rewardNote')}</p>
          <div className="button-row">
            <button className="buy-btn" onClick={replay}>
              {t('microgame.playAgain')}
            </button>
            <button className="ghost-btn" onClick={onClose}>
              {t('common.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
