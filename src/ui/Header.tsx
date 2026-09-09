// The Nutshell Inc. letterhead.
//
// This is the top of a document, not a game HUD. The company identifies itself,
// the department under it, and the company's current standing is stamped across
// the corner the way an internal record would be — then, ruled off below, the
// figures for the period as fields on a form:
//
//   ⬢  NUTSHELL INC.                        ╔══════════════╗   − □ ×
//      BEHAVIOURAL RESEARCH DEPARTMENT      ║  ESTABLISHED ║
//                                           ║  INSTITUTION ║
//                                           ║   CYCLE 01   ║
//   ══════════════════════════════════════════╚═════════════╝════════
//    NUTS        GOLDEN    MORALE    STANDING   KERNELS
//    7.67M       36        82        167        3
//    +12.4/s               +14%      next 260
//
// Three decisions carry it:
//
//  - The DEPARTMENT is the subtitle, fixed and quiet, because that is what the
//    company calls itself. The company's standing used to occupy that line, which
//    put a changing value where an identity belongs. It now sits in the stamp,
//    where a changing status actually belongs, and gets far more emphasis for it.
//  - The stamp is the only rotated, double-ruled, letterpressed thing in the
//    interface, so "how the outside world sees Nutshell Inc." reads at a glance
//    and never competes with the numbers.
//  - The figures are FIELDS: a label above, the value, and underneath it what is
//    happening to that value. Ruled columns rather than floating pills, so the
//    strip carries more information while reading calmer.
//
// Everything here is live state. The cycle is the prestige count, the standing is
// the reputation tier, and the kernels field appears only once the company has
// actually been through a cycle and has any.

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
  const cycle = state.prestige.count + 1;
  const kernels = state.resources.permanentKernels;

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
  const tipKernels = useTooltip(
    <TipContent
      title={t('tip.kernels.t')}
      lines={[t('tip.kernels.d'), t('tip.current', { value: fmt.num(kernels) })]}
    />,
  );
  const tipStamp = useTooltip(
    <TipContent
      title={t(tier.nameKey)}
      lines={[t(tier.blurbKey), t('header.cycleTip', { n: cycle })]}
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
          <p className="header__department">{t('header.departmentFull')}</p>
        </div>

        {/* The company's standing, stamped on the record. */}
        <div className="header__stamp" {...tipStamp}>
          <span className="header__stamp-tier">{t(tier.nameKey)}</span>
          <span className="header__stamp-cycle">{t('header.cycle', { n: cycle })}</span>
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

      {/* --- the period's figures, as fields on a form ------------------------ */}
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

        {/* Only once the company has actually banked something permanent. */}
        {kernels > 0 ? (
          <div className="res-cell res-cell--kernels" {...tipKernels}>
            <span className="res-cell__label">
              <Icon name="prestige" size={12} />
              {t('resource.short.kernels')}
            </span>
            <span className="res-cell__value tabular">{fmt.num(kernels)}</span>
          </div>
        ) : null}
      </div>

      {iconPicker ? <CompanyIconPicker onClose={() => setIconPicker(false)} /> : null}
    </header>
  );
}
