import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellSequence, shellBinFor, shellScoreDelta, type ShellItem } from '../../sim/minigames';
import { NutDot } from '../../art/Icons';
import type { SubGameProps } from './MicroGame';

// Sort each item into the correct bin. Bins are distinguished by ICON + LABEL +
// PATTERN (stripes vs dots), never colour alone, for colourblind accessibility.
// Mouse: click a bin. Keyboard: ArrowLeft / 1 = good nut, ArrowRight / 2 = shell.
export function ShellSort({ seed, reducedMotion, onScore, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const items = useMemo(() => shellSequence(seed, 18), [seed]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const scoreRef = useRef(0);

  const current: ShellItem | undefined = items[index];

  const place = useCallback(
    (bin: 'good' | 'shell') => {
      if (!current) return;
      const correct = shellBinFor(current.kind) === bin;
      setCombo((c) => {
        const nextCombo = correct ? c + 1 : 0;
        if (correct) {
          const delta = shellScoreDelta(true, nextCombo);
          scoreRef.current += delta;
          setScore(scoreRef.current);
          onScore(scoreRef.current);
        }
        return nextCombo;
      });
      setFlash(correct ? 'good' : 'bad');
      setTimeout(() => setFlash(null), reducedMotion ? 0 : 220);
      setIndex((i) => {
        const next = i + 1;
        if (next >= items.length) onEnd(scoreRef.current);
        return next;
      });
    },
    [current, items.length, onEnd, onScore, reducedMotion],
  );

  // keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === '1') place('good');
      else if (e.key === 'ArrowRight' || e.key === '2') place('shell');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [place]);

  return (
    <div className={`shellsort ${flash ? `is-flash-${flash}` : ''}`}>
      <div className="shellsort__hud">
        <span>{t('microgame.score', { value: score })}</span>
        <span>{t('microgame.combo', { value: combo })}</span>
        <span>{items.length - index}</span>
      </div>

      <div className="shellsort__item" aria-live="polite">
        {current ? (
          current.kind === 'goodNut' ? (
            <div className="shellsort__token" aria-label={t('microgame.goodNut')}>
              <NutDot color="#c98a4b" size={54} />
            </div>
          ) : (
            <div className="shellsort__token" aria-label={t('microgame.brokenShell')}>
              <BrokenShell />
            </div>
          )
        ) : null}
      </div>

      <div className="shellsort__bins">
        <button className="bin bin--good" onClick={() => place('good')} aria-label={t('microgame.binGood')}>
          <span className="bin__pattern bin__pattern--dots" aria-hidden />
          <NutDot color="#c98a4b" size={26} />
          <span className="bin__label">{t('microgame.binGood')}</span>
          <kbd>1</kbd>
        </button>
        <button className="bin bin--shell" onClick={() => place('shell')} aria-label={t('microgame.binShell')}>
          <span className="bin__pattern bin__pattern--stripes" aria-hidden />
          <BrokenShell size={26} />
          <span className="bin__label">{t('microgame.binShell')}</span>
          <kbd>2</kbd>
        </button>
      </div>
    </div>
  );
}

function BrokenShell({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-hidden>
      <path d="M10 20 q14 -12 28 0 l-4 3 -3 -3 -4 4 -3 -3 -4 4 -3 -3 -4 3 Z" fill="#7a4a24" stroke="#4a2c14" strokeWidth="1.5" />
      <path d="M12 22 q12 16 24 0 l-3 2 -3 -2 -3 2 -3 -2 -3 2 -3 -2 Z" fill="#a9743b" stroke="#4a2c14" strokeWidth="1.2" />
    </svg>
  );
}
