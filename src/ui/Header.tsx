import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { useFmt } from './useFmt';
import { Acorn, GoldenNut } from '../art/Icons';

export function Header() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const quiet = useStore((s) => s.quietMode);
  const setQuiet = useStore((s) => s.setQuietMode);
  const nps = engine.productionPerSecond();

  return (
    <header className="header">
      <div className="header__title">
        <span className="header__company">{state.company.name}</span>
        <span className="header__rate">
          {fmt.num(nps)} {t('resource.nuts').toLowerCase()}/s
        </span>
      </div>
      <div className="header__resources">
        <div className="res res--nuts" title={t('resource.nuts')}>
          <Acorn size={20} />
          <span>{fmt.num(state.resources.nuts)}</span>
        </div>
        <div className="res res--golden" title={t('resource.goldenNuts')}>
          <GoldenNut size={18} />
          <span>{fmt.num(state.resources.goldenNuts)}</span>
        </div>
        <div className="res res--morale" title={t('resource.morale')}>
          <span className="res__icon">☺</span>
          <span>{Math.round(state.resources.morale)}</span>
        </div>
        <div className="res res--rep" title={t('resource.reputation')}>
          <span className="res__icon">★</span>
          <span>{fmt.num(state.resources.reputation)}</span>
        </div>
        <button
          className={`quiet-toggle ${quiet ? 'is-on' : ''}`}
          onClick={() => setQuiet(!quiet)}
          title={t('office.quietMode')}
          aria-pressed={quiet}
          aria-label={t('office.quietMode')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M4 9 h4 l5 -4 v14 l-5 -4 H4 Z"
              fill="currentColor"
            />
            {quiet ? (
              <line x1="16" y1="8" x2="21" y2="16" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="M16 8 a5 5 0 0 1 0 8" stroke="currentColor" strokeWidth="2" fill="none" />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
