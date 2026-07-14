import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { useFmt } from './useFmt';
import { Acorn, GoldenNut } from '../art/Icons';
import { Icon } from '../art/UiIcon';
import { AnimatedNumber } from './AnimatedNumber';

export function Header() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const quiet = useStore((s) => s.quietMode);
  const setQuiet = useStore((s) => s.setQuietMode);
  const reduced = state.settings.reducedMotion;
  const nps = engine.productionPerSecond();

  return (
    <header className="header">
      <div className="header__title">
        <span className="header__company">{state.company.name}</span>
        <span className="header__rate">
          <Icon name="production" size={12} /> {fmt.num(nps)}/s
        </span>
      </div>
      <div className="header__resources">
        <div className="res res--nuts" title={t('resource.nuts')}>
          <Acorn size={20} />
          <AnimatedNumber value={state.resources.nuts} format={fmt.num} reducedMotion={reduced} />
        </div>
        <div className="res res--golden" title={t('resource.goldenNuts')}>
          <GoldenNut size={18} />
          <span className="tabular">{fmt.num(state.resources.goldenNuts)}</span>
        </div>
        <div className="res res--morale" title={t('resource.morale')}>
          <Icon name="morale" size={16} />
          <span className="tabular">{Math.round(state.resources.morale)}</span>
        </div>
        <div className="res res--rep" title={t('resource.reputation')}>
          <Icon name="reputation" size={15} />
          <span className="tabular">{fmt.num(state.resources.reputation)}</span>
        </div>
        <button
          className={`quiet-toggle ${quiet ? 'is-on' : ''}`}
          onClick={() => setQuiet(!quiet)}
          title={t('office.quietMode')}
          aria-pressed={quiet}
          aria-label={t('office.quietMode')}
        >
          <Icon name={quiet ? 'quiet' : 'sound'} size={18} />
        </button>
      </div>
    </header>
  );
}
