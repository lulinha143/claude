import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { useFmt } from './useFmt';
import { moraleProductionBonusPct, nextReputationUnlock } from '../sim/economy';
import { Acorn, GoldenNut } from '../art/Icons';
import { Icon } from '../art/UiIcon';
import { AnimatedNumber } from './AnimatedNumber';
import { useTooltip, TipContent } from './Tooltip';
import { WindowControls } from './WindowControls';

export function Header() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const muted = useStore((s) => s.masterMuted);
  const toggleMute = useStore((s) => s.toggleMute);
  const musicMuted = useStore((s) => s.musicMuted);
  const toggleMusic = useStore((s) => s.toggleMusic);
  const reduced = state.settings.reducedMotion;
  const nps = engine.productionPerSecond();

  // Rich, informative tooltips for every header element.
  const tipRate = useTooltip(
    <TipContent title={t('tip.rate.t')} lines={[t('tip.rate.d'), t('tip.current', { value: `${fmt.num(nps)}/s` })]} />,
  );
  const tipNuts = useTooltip(
    <TipContent
      title={t('tip.nuts.t')}
      lines={[t('tip.nuts.d'), t('tip.current', { value: fmt.num(state.resources.nuts) })]}
    />,
  );
  const tipGolden = useTooltip(
    <TipContent
      title={t('tip.golden.t')}
      lines={[t('tip.golden.d'), t('tip.current', { value: fmt.num(state.resources.goldenNuts) })]}
    />,
  );
  const moraleBonus = moraleProductionBonusPct(state.resources.morale);
  const tipMorale = useTooltip(
    <TipContent
      title={t('tip.morale.t')}
      lines={[
        t('tip.morale.d'),
        t('tip.morale.impact', {
          sign: moraleBonus >= 0 ? '+' : '',
          pct: moraleBonus,
        }),
        t('tip.current', { value: `${Math.round(state.resources.morale)}%` }),
      ]}
    />,
  );
  const nextRep = nextReputationUnlock(state);
  const tipRep = useTooltip(
    <TipContent
      title={t('tip.reputation.t')}
      lines={[
        t('tip.reputation.d'),
        nextRep !== null ? t('tip.reputation.next', { value: fmt.num(nextRep) }) : t('tip.reputation.maxed'),
        t('tip.current', { value: fmt.num(state.resources.reputation) }),
      ]}
    />,
  );
  const tipMute = useTooltip(
    <TipContent title={muted ? t('office.restoreAll') : t('office.muteAll')} lines={[t('tip.mute.d')]} />,
  );
  const tipMusic = useTooltip(
    <TipContent title={musicMuted ? t('office.restoreMusic') : t('office.muteMusic')} lines={[t('tip.music.d')]} />,
  );

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
          className={`mute-toggle ${muted ? 'is-muted' : ''}`}
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? t('office.restoreAll') : t('office.muteAll')}
          data-testid="mute-toggle"
          {...tipMute}
        >
          <Icon name={muted ? 'mute' : 'sound'} size={18} />
        </button>
        <button
          className={`music-toggle ${musicMuted ? 'is-muted' : ''}`}
          onClick={toggleMusic}
          aria-pressed={musicMuted}
          aria-label={musicMuted ? t('office.restoreMusic') : t('office.muteMusic')}
          data-testid="music-toggle"
          {...tipMusic}
        >
          <Icon name={musicMuted ? 'music-off' : 'music'} size={18} />
        </button>
        <WindowControls />
      </div>
    </header>
  );
}
