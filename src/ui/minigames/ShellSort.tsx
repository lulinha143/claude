import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellSequence, shellBinFor, shellScoreDelta, type ShellItem, type ShellBin } from '../../sim/minigames';
import { NutDot, GoldenNut } from '../../art/Icons';
import type { SubGameProps } from './MicroGame';

// Conveyor Sort: items ride in one at a time — a good nut, a rare golden nut, or
// a broken shell — and the player drops each into the right bin. Bins are told
// apart by ICON + LABEL + PATTERN (dots / rays / stripes), never colour alone,
// for colourblind accessibility.
// Mouse: click a bin. Keyboard: 1 = good, 2 = golden, 3 = shell.
export function ShellSort({ seed, reducedMotion, onScore, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const items = useMemo(() => shellSequence(seed, 22), [seed]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const endedRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current: ShellItem | undefined = items[index];

  // End exactly once when the conveyor is emptied (never inside a state updater).
  useEffect(() => {
    if (!endedRef.current && items.length > 0 && index >= items.length) {
      endedRef.current = true;
      onEnd(scoreRef.current);
    }
  }, [index, items.length, onEnd]);

  // Clean up any pending flash timer on unmount (no setState after unmount).
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const place = useCallback(
    (bin: ShellBin) => {
      if (index >= items.length) return;
      const item = items[index];
      const correct = shellBinFor(item.kind) === bin;
      const nextCombo = correct ? comboRef.current + 1 : 0;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      if (correct) {
        scoreRef.current += shellScoreDelta(true, nextCombo, item.kind);
        setScore(scoreRef.current);
        onScore(scoreRef.current);
      }
      setFlash(correct ? 'good' : 'bad');
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (!reducedMotion) flashTimer.current = setTimeout(() => setFlash(null), 220);
      else setFlash(null);
      setIndex(index + 1);
    },
    [index, items, onScore, reducedMotion],
  );

  // keyboard controls (1/2/3)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '1') place('good');
      else if (e.key === '2') place('golden');
      else if (e.key === '3') place('shell');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [place]);

  const upcoming = items.slice(index + 1, index + 4);

  return (
    <div className={`shellsort ${flash ? `is-flash-${flash}` : ''}`}>
      <div className="shellsort__hud">
        <span>{t('microgame.score', { value: score })}</span>
        <span className={combo >= 3 ? 'shellsort__combo is-hot' : 'shellsort__combo'}>
          {t('microgame.combo', { value: combo })}
        </span>
        <span>{Math.max(0, items.length - index)}</span>
      </div>

      <div className="shellsort__conveyor">
        <div className="shellsort__item" aria-live="polite">
          {current ? <ShellToken kind={current.kind} size={54} label /> : null}
        </div>
        <div className="shellsort__queue" aria-hidden>
          {upcoming.map((it, i) => (
            <span key={`${it.id}-${i}`} className="shellsort__queue-item">
              <ShellToken kind={it.kind} size={22} />
            </span>
          ))}
        </div>
      </div>

      <div className="shellsort__bins">
        <button
          className="bin bin--good"
          onClick={() => place('good')}
          disabled={!current}
          aria-label={t('microgame.binGood')}
        >
          <span className="bin__pattern bin__pattern--dots" aria-hidden />
          <NutDot color="#c98a4b" size={26} />
          <span className="bin__label">{t('microgame.binGood')}</span>
          <kbd>1</kbd>
        </button>
        <button
          className="bin bin--golden"
          onClick={() => place('golden')}
          disabled={!current}
          aria-label={t('microgame.binGolden')}
        >
          <span className="bin__pattern bin__pattern--rays" aria-hidden />
          <GoldenNut size={26} />
          <span className="bin__label">{t('microgame.binGolden')}</span>
          <kbd>2</kbd>
        </button>
        <button
          className="bin bin--shell"
          onClick={() => place('shell')}
          disabled={!current}
          aria-label={t('microgame.binShell')}
        >
          <span className="bin__pattern bin__pattern--stripes" aria-hidden />
          <BrokenShell size={26} />
          <span className="bin__label">{t('microgame.binShell')}</span>
          <kbd>3</kbd>
        </button>
      </div>
    </div>
  );
}

function ShellToken({ kind, size, label }: { kind: ShellItem['kind']; size: number; label?: boolean }) {
  const { t } = useTranslation();
  if (kind === 'goldenNut') {
    return (
      <div className="shellsort__token" aria-label={label ? t('microgame.goldenNut') : undefined}>
        <GoldenNut size={size} />
      </div>
    );
  }
  if (kind === 'brokenShell') {
    return (
      <div className="shellsort__token" aria-label={label ? t('microgame.brokenShell') : undefined}>
        <BrokenShell size={size} />
      </div>
    );
  }
  return (
    <div className="shellsort__token" aria-label={label ? t('microgame.goodNut') : undefined}>
      <NutDot color="#c98a4b" size={size} />
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
