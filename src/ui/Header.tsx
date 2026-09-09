// The Nutshell Inc. masthead.
//
// The old header packed the company name, the production rate, four resources and
// three buttons into one cramped row of icons with no hierarchy. This is the same
// information — plus more — arranged as a company letterhead:
//
//   ● NUTSHELL INC.                              − □ ×
//     Established Institution · Behavioural Research
//   ┌──────────────┬──────────┬──────────┬──────────────┐
//   │ NUTS 7.67M   │ GOLDEN 36│ MORALE 82│ STANDING 167 │
//   │ +12.4/s      │          │  +14%    │ next 260     │
//   └──────────────┴──────────┴──────────┴──────────────┘
//
// Two deliberate choices:
//
//  - The subtitle is the company's REPUTATION TIER, not a fixed tagline. It costs
//    no extra space, and it means the masthead quietly narrates the company's
//    slide from "Unlisted Entity" to something far less reassuring.
//  - Each resource cell carries a small label and a secondary line. Labels make
//    the strip self-describing so it needs less icon-reading, and the secondary
//    line is where "what is happening to this number" lives (production rate,
//    morale's effect on output, the next standing threshold). That is how the HUD
//    holds MORE information while reading calmer.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { useFmt } from './useFmt';
import { moraleProductionBonusPct, nextReputationUnlock } from '../sim/economy';
import { reputationTier } from '../content/reputationTiers';
import { Acorn, GoldenNut } from '../art/Icons';
import { Icon } from '../art/UiIcon';
import { CompanyIcon } from '../art/companyIcons';
import { AnimatedNumber } from './AnimatedNumber';
import { useTooltip, TipContent } from './Tooltip';
import { WindowControls } from './WindowControls';
import { CompanyIconPicker } from './modals/CompanyIconPicker';

export function Header() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const [iconPicker, setIconPicker] = useState(false);
  const muted = useStore((s) => s.masterMuted);
  const toggleMute = useStore((s) => s.toggleMute);
  const musicMuted = useStore((s) => s.musicMuted);
  const toggleMusic = useStore((s) => s.toggleMusic);
  const reduced = state.settings.reducedMotion;
  const nps = engine.productionPerSecond();
  const tier = reputationTier(state.resources.reputation);
  const moraleBonus = moraleProductionBonusPct(state.resources.morale);
  const nextRep = nextReputationUnlock(state);

  // Rich, informative tooltips for every header element.
  const tipNuts = useTooltip(
    <TipContent
      title={t('tip.nuts.t')}
      lines={[
        t('tip.nuts.d'),
        t('tip.rate.d'),
        t('tip.current', { value: fmt.num(state.resources.nuts) }),
      ]}
    />,
  );
  const tipGolden = useTooltip(
    <TipContent
      title={t('tip.golden.t')}
      lines={[t('tip.golden.d'), t('tip.current', { value: fmt.num(state.resources.goldenNuts) })]}
    />,
  );
  const tipMorale = useTooltip(
    <TipContent
      title={t('tip.morale.t')}
      lines={[
        t('tip.morale.d'),
        t('tip.morale.impact', { sign: moraleBonus >= 0 ? '+' : '', pct: moraleBonus }),
        t('tip.current', { value: `${Math.round(state.resources.morale)}%` }),
      ]}
    />,
  );
  const tipRep = useTooltip(
    <TipContent
      title={t('tip.reputation.t')}
      lines={[
        // What it DOES first — the flavour line is atmosphere, not instruction.
        t('tip.reputation.d'),
        t(tier.blurbKey),
        nextRep !== null
          ? t('tip.reputation.next', { value: fmt.num(nextRep) })
          : t('tip.reputation.maxed'),
        t('tip.current', { value: fmt.num(state.resources.reputation) }),
      ]}
    />,
  );
  const tipMute = useTooltip(
    <TipContent
      title={muted ? t('office.restoreAll') : t('office.muteAll')}
      lines={[t('tip.mute.d')]}
    />,
  );
  const tipMusic = useTooltip(
    <TipContent
      title={musicMuted ? t('office.restoreMusic') : t('office.muteMusic')}
      lines={[t('tip.music.d')]}
    />,
  );
  const tipLogo = useTooltip(
    <TipContent title={t('company.icon.title')} lines={[t('company.icon.tip')]} />,
  );

  return (
    <header className="header">
      {/* --- letterhead ----------------------------------------------------- */}
      <div className="header__identity">
        <button
          type="button"
          className="header__brand-mark"
          onClick={() => setIconPicker(true)}
          aria-label={t('company.icon.change')}
          data-testid="company-logo"
          {...tipLogo}
        >
          <CompanyIcon id={state.company.icon} size={18} />
        </button>
        <div className="header__title">
          <h1 className="header__company">{state.company.name}</h1>
          {/* Live standing, doubling as the department line. */}
          <p className="header__department">
            <span className="header__tier">{t(tier.nameKey)}</span>
            <span className="header__divider" aria-hidden>
              ·
            </span>
            <span className="header__department-name">{t('header.department')}</span>
          </p>
        </div>
        <div className="header__controls">
          <button
            className={`mute-toggle ${muted ? 'is-muted' : ''}`}
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? t('office.restoreAll') : t('office.muteAll')}
            data-testid="mute-toggle"
            {...tipMute}
          >
            <Icon name={muted ? 'mute' : 'sound'} size={16} />
          </button>
          <button
            className={`music-toggle ${musicMuted ? 'is-muted' : ''}`}
            onClick={toggleMusic}
            aria-pressed={musicMuted}
            aria-label={musicMuted ? t('office.restoreMusic') : t('office.muteMusic')}
            data-testid="music-toggle"
            {...tipMusic}
          >
            <Icon name={musicMuted ? 'music-off' : 'music'} size={16} />
          </button>
          <WindowControls />
        </div>
      </div>

      {/* --- resource strip -------------------------------------------------- */}
      <div className="header__strip">
        <div className="res-cell res-cell--nuts" {...tipNuts}>
          <span className="res-cell__label">
            <Acorn size={12} />
            {t('resource.short.nuts')}
          </span>
          <span className="res-cell__value">
            <AnimatedNumber value={state.resources.nuts} format={fmt.num} reducedMotion={reduced} />
          </span>
          <span className="res-cell__note res-cell__note--pos">+{fmt.num(nps)}/s</span>
        </div>

        <div className="res-cell res-cell--golden" {...tipGolden}>
          <span className="res-cell__label">
            <GoldenNut size={12} />
            {t('resource.short.golden')}
          </span>
          <span className="res-cell__value tabular">{fmt.num(state.resources.goldenNuts)}</span>
        </div>

        <div className="res-cell res-cell--morale" {...tipMorale}>
          <span className="res-cell__label">
            <Icon name="morale" size={12} />
            {t('resource.short.morale')}
          </span>
          <span className="res-cell__value tabular">{Math.round(state.resources.morale)}</span>
          {/* Morale's whole job is what it does to output, so say so. */}
          <span
            className={`res-cell__note ${moraleBonus >= 0 ? 'res-cell__note--pos' : 'res-cell__note--neg'}`}
          >
            {moraleBonus >= 0 ? '+' : '-'}
            {Math.abs(moraleBonus)}%
          </span>
        </div>

        <div className="res-cell res-cell--rep" {...tipRep}>
          <span className="res-cell__label">
            <Icon name="reputation" size={12} />
            {t('resource.short.reputation')}
          </span>
          <span className="res-cell__value tabular">{fmt.num(state.resources.reputation)}</span>
          {nextRep !== null ? (
            <span className="res-cell__note">
              {t('repTier.nextShort', { at: fmt.num(nextRep) })}
            </span>
          ) : null}
        </div>
      </div>

      {iconPicker ? <CompanyIconPicker onClose={() => setIconPicker(false)} /> : null}
    </header>
  );
}
