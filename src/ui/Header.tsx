import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { useFmt } from './useFmt';
import { Acorn, GoldenNut } from '../art/Icons';
import { Icon } from '../art/UiIcon';
import { AnimatedNumber } from './AnimatedNumber';
import { useTooltip, TipContent } from './Tooltip';

export function Header() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const quiet = useStore((s) => s.quietMode);
  const setQuiet = useStore((s) => s.setQuietMode);
  const reduced = state.settings.reducedMotion;
  const nps = engine.productionPerSecond();

  // Rich, informative tooltips for every header element.
  const tipRate = useTooltip(<TipContent title={t('tip.rate.t')} lines={[t('tip.rate.d'), `${fmt.num(nps)}/s`]} />);
  const tipNuts = useTooltip(
    <TipContent title={t('tip.nuts.t')} lines={[t('tip.nuts.d'), `${fmt.num(state.resources.nuts)}`]} />,
  );
  const tipGolden = useTooltip(
    <TipContent title={t('tip.golden.t')} lines={[t('tip.golden.d'), `${fmt.num(state.resources.goldenNuts)}`]} />,
  );
  const tipMorale = useTooltip(
    <TipContent title={t('tip.morale.t')} lines={[t('tip.morale.d'), `${Math.round(state.resources.morale)}%`]} />,
  );
  const tipRep = useTooltip(
    <TipContent title={t('tip.reputation.t')} lines={[t('tip.reputation.d'), `${fmt.num(state.resources.reputation)}`]} />,
  );
  const tipQuiet = useTooltip(<TipContent title={t('tip.quiet.t')} lines={[t('tip.quiet.d')]} />);

  return (
    <header className="header">
      <div className="header__title">
        <span className="header__company">{state.company.name}</span>
        <span className="header__rate" {...tipRate}>
          <Icon name="production" size={12} /> {fmt.num(nps)}/s
        </span>
      </div>
      <div className="header__resources">
        <div className="res res--nuts" {...tipNuts}>
          <Acorn size={20} />
          <AnimatedNumber value={state.resources.nuts} format={fmt.num} reducedMotion={reduced} />
        </div>
        <div className="res res--golden" {...tipGolden}>
          <GoldenNut size={18} />
          <span className="tabular">{fmt.num(state.resources.goldenNuts)}</span>
        </div>
        <div className="res res--morale" {...tipMorale}>
          <Icon name="morale" size={16} />
          <span className="tabular">{Math.round(state.resources.morale)}</span>
        </div>
        <div className="res res--rep" {...tipRep}>
          <Icon name="reputation" size={15} />
          <span className="tabular">{fmt.num(state.resources.reputation)}</span>
        </div>
        <button
          className={`quiet-toggle ${quiet ? 'is-on' : ''}`}
          onClick={() => setQuiet(!quiet)}
          aria-pressed={quiet}
          aria-label={t('office.quietMode')}
          {...tipQuiet}
        >
          <Icon name={quiet ? 'quiet' : 'sound'} size={18} />
        </button>
      </div>
    </header>
  );
}
