import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Acorn, NutDot } from '../art/Icons';

export type MicroMode = 'shellSort' | 'coffeeRescue' | 'inventory';

interface Target {
  id: number;
  x: number;
  y: number;
  good: boolean;
  bornAt: number;
  life: number;
}

const DURATION = 20;

// A single, genuinely playable timing/reaction micro-game with three flavours.
// Click the "good" targets, avoid the "bad" ones, before the timer runs out.
export function MicroGame({ mode, onFinish }: { mode: MicroMode; onFinish: (score: number) => void }) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(DURATION);
  const [targets, setTargets] = useState<Target[]>([]);
  const idRef = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);

  const goodRatio = mode === 'inventory' ? 0.35 : 0.6;

  const spawn = useCallback(() => {
    const id = idRef.current++;
    setTargets((prev) => [
      ...prev.filter((tg) => Date.now() - tg.bornAt < tg.life),
      {
        id,
        x: 8 + Math.random() * 84,
        y: 12 + Math.random() * 76,
        good: Math.random() < goodRatio,
        bornAt: Date.now(),
        life: mode === 'coffeeRescue' ? 1400 : 1100,
      },
    ]);
  }, [goodRatio, mode]);

  useEffect(() => {
    if (!running) return;
    const spawner = setInterval(spawn, mode === 'coffeeRescue' ? 550 : 700);
    const ticker = setInterval(() => {
      setTime((tm) => {
        if (tm <= 1) {
          clearInterval(spawner);
          clearInterval(ticker);
          setRunning(false);
          setTargets([]);
          setScore((s) => {
            onFinish(s);
            return s;
          });
          return 0;
        }
        return tm - 1;
      });
    }, 1000);
    return () => {
      clearInterval(spawner);
      clearInterval(ticker);
    };
  }, [running, spawn, mode, onFinish]);

  // prune expired targets
  useEffect(() => {
    if (!running) return;
    const h = setInterval(() => setTargets((prev) => prev.filter((tg) => Date.now() - tg.bornAt < tg.life)), 120);
    return () => clearInterval(h);
  }, [running]);

  function start() {
    setScore(0);
    setTime(DURATION);
    setTargets([]);
    setRunning(true);
  }

  function hit(tg: Target) {
    setTargets((prev) => prev.filter((x) => x.id !== tg.id));
    setScore((s) => Math.max(0, s + (tg.good ? 2 : -1)));
  }

  return (
    <div className="microgame">
      <div className="microgame__hud">
        <span>{t('microgame.score', { value: score })}</span>
        <span>{t('microgame.timeLeft', { value: time })}</span>
      </div>
      <div className="microgame__area" ref={areaRef}>
        {!running ? (
          <button className="buy-btn microgame__start" onClick={start}>
            {t('microgame.start')}
          </button>
        ) : (
          targets.map((tg) => (
            <button
              key={tg.id}
              className={`microgame__target ${tg.good ? 'is-good' : 'is-bad'}`}
              style={{ left: `${tg.x}%`, top: `${tg.y}%` }}
              onClick={() => hit(tg)}
              aria-label={tg.good ? t('microgame.goodNut') : t('microgame.brokenShell')}
            >
              {tg.good ? <NutDot color="#c98a4b" size={30} /> : <Acorn size={26} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
