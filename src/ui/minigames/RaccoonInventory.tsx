import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { inventoryRound, inventorySize, inventoryScoreDelta, type InventoryItem } from '../../sim/minigames';
import type { SubGameProps } from './MicroGame';

type Phase = 'memorize' | 'guess' | 'reveal';

// Rizzo "borrowed" something. Memorise the shelf, then spot which item changed.
// Deterministic per round (see inventoryRound). Reduced-motion mode removes the
// timed flip and lets the player reveal at their own pace.
export function RaccoonInventory({ seed, reducedMotion, onScore, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const [roundNum, setRoundNum] = useState(0);
  const [phase, setPhase] = useState<Phase>('memorize');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  void onEnd; // ended by the shared shell timer

  const round = useMemo(
    () => inventoryRound(`${seed}-${roundNum}`, inventorySize(roundNum)),
    [seed, roundNum],
  );
  const beforeItems = useMemo(() => {
    const arr = round.items.slice();
    arr[round.changedIndex] = round.before;
    return arr;
  }, [round]);

  // auto-advance the memorise phase in motion mode
  useEffect(() => {
    if (phase !== 'memorize' || reducedMotion) return;
    const h = setTimeout(() => setPhase('guess'), 2400);
    return () => clearTimeout(h);
  }, [phase, reducedMotion, roundNum]);

  function guess(i: number) {
    if (phase !== 'guess') return;
    setChosen(i);
    if (i === round.changedIndex) {
      streakRef.current += 1;
      setStreak(streakRef.current);
      scoreRef.current += inventoryScoreDelta(streakRef.current);
      setScore(scoreRef.current);
      onScore(scoreRef.current);
    } else {
      streakRef.current = 0;
      setStreak(0);
    }
    setPhase('reveal');
    if (!reducedMotion) {
      setTimeout(next, 1600);
    }
  }

  function next() {
    setChosen(null);
    setPhase('memorize');
    setRoundNum((r) => r + 1);
  }

  const shown = phase === 'memorize' ? beforeItems : round.items;
  const correct = chosen === round.changedIndex;

  return (
    <div className="inv">
      <div className="inv__hud">
        <span>{t('microgame.score', { value: score })}</span>
        {streak >= 2 ? <span className="inv__streak">{t('microgame.streak', { value: streak })}</span> : null}
        <span className="inv__phase">
          {phase === 'memorize' ? t('microgame.memorize') : phase === 'guess' ? t('microgame.whatChanged') : ''}
        </span>
      </div>

      <div className="inv__shelf" role="group" aria-label={t('microgame.inventory.name')}>
        {shown.map((item, i) => {
          const isChanged = i === round.changedIndex;
          const cls = [
            'inv__slot',
            phase === 'guess' ? 'is-clickable' : '',
            phase === 'reveal' && isChanged ? 'is-answer' : '',
            phase === 'reveal' && chosen === i && !isChanged ? 'is-wrong' : '',
          ].join(' ');
          return (
            <button
              key={i}
              className={cls}
              disabled={phase !== 'guess'}
              onClick={() => guess(i)}
              aria-label={t(`microgame.item.${item}`)}
            >
              <InventoryGlyph item={item} />
              <span className="inv__slot-label">{t(`microgame.item.${item}`)}</span>
            </button>
          );
        })}
      </div>

      {phase === 'memorize' && reducedMotion ? (
        <button className="buy-btn" onClick={() => setPhase('guess')}>
          {t('microgame.ready')}
        </button>
      ) : null}

      {phase === 'reveal' ? (
        <div className="inv__explain">
          <p>
            {correct ? t('microgame.correct') : t('microgame.incorrect')}{' '}
            {t('microgame.itChanged', {
              before: t(`microgame.item.${round.before}`),
              after: t(`microgame.item.${round.after}`),
            })}
          </p>
          {reducedMotion ? (
            <button className="buy-btn" onClick={next}>
              {t('microgame.next')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Distinct silhouettes per item — recognisable without relying on colour.
function InventoryGlyph({ item, size = 40 }: { item: InventoryItem; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': true } as const;
  const stroke = '#2a2016';
  const fill = '#c98a4b';
  switch (item) {
    case 'stapler':
      return (
        <svg {...common}>
          <rect x="5" y="16" width="22" height="6" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <rect x="7" y="11" width="18" height="6" rx="3" fill="#a9743b" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'mug':
      return (
        <svg {...common}>
          <rect x="8" y="9" width="12" height="14" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M20 12 h4 a3 3 0 0 1 0 6 h-4" fill="none" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'clip':
      return (
        <svg {...common}>
          <path d="M12 6 v16 a4 4 0 0 0 8 0 v-12 a2 2 0 0 0 -4 0 v12" fill="none" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'nut':
      return (
        <svg {...common}>
          <ellipse cx="16" cy="18" rx="8" ry="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M8 12 q8 -6 16 0" stroke={stroke} strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'floppy':
      return (
        <svg {...common}>
          <rect x="7" y="7" width="18" height="18" rx="2" fill="#6b7280" stroke={stroke} strokeWidth="1.5" />
          <rect x="12" y="7" width="8" height="6" fill="#e0e0e0" />
        </svg>
      );
    case 'plant':
      return (
        <svg {...common}>
          <path d="M16 20 q-8 -2 -6 -12 q6 2 6 10 q0 -10 6 -12 q2 8 -6 14" fill="#3f7d4f" stroke={stroke} strokeWidth="1" />
          <path d="M12 20 h8 l-1 6 h-6 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'lamp':
      return (
        <svg {...common}>
          <path d="M10 10 h12 l-3 7 h-6 Z" fill="#e0a43b" stroke={stroke} strokeWidth="1.5" />
          <path d="M16 17 v8 M12 25 h8" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <rect x="10" y="5" width="12" height="22" rx="3" fill="#2f3640" stroke={stroke} strokeWidth="1.5" />
          <rect x="12" y="8" width="8" height="13" fill="#7fb0c8" />
        </svg>
      );
    case 'key':
      return (
        <svg {...common}>
          <circle cx="11" cy="12" r="6" fill="none" stroke={stroke} strokeWidth="2" />
          <path d="M15 15 l9 9 M20 20 l3 -3 M22 22 l3 -3" stroke={stroke} strokeWidth="2" fill="none" />
        </svg>
      );
    case 'battery':
      return (
        <svg {...common}>
          <rect x="6" y="11" width="18" height="10" rx="2" fill="#5a9a68" stroke={stroke} strokeWidth="1.5" />
          <rect x="24" y="14" width="3" height="4" fill={stroke} />
        </svg>
      );
    default:
      return <svg {...common} />;
  }
}
