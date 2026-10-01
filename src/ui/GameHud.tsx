// The game HUD: one slim walnut shelf across the top of the window.
//
// It replaces the old "letterhead" (company name, department line, tier stamp and
// a ruled resource ledger), which took 108px of a 380×460 window before the office
// even began. A companion-window game needs the opposite: the office is the
// screen, and the HUD is a thin strip of stickers on a shelf above it.
//
//   [logo]  🌰 5.38M +12/s   ◆73  ☺81  ★1.6K        🔊 ♫ ⚙  − □ ×
//
// - Nuts are the hero number (animated), with the rate beside it.
// - Golden, Morale and Reputation are small stickers; their names, effects and
//   next goals live in the tooltips, so the strip stays calm.
// - The company's identity (name, department, standing stamp, cycle) moved to the
//   Company page of the Archive, where there is room to read it.
// - In the frameless desktop build the shelf is the window's drag handle, and the
//   window controls sit at its right end.
// Narrow windows drop stickers progressively via container queries (hud.css), so
// the strip is one row at every size down to Electron's 320px minimum.

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

interface HudStatProps {
  kind: string;
  icon: JSX.Element;
  value: string;
  label: string;
  tone?: 'pos' | 'neg';
  tip: ReturnType<typeof useTooltip>;
}

function HudStat({ kind, icon, value, label, tone, tip }: HudStatProps) {
  return (
    <div
      className={`hud-stat hud-stat--${kind}`}
      data-tone={tone}
      tabIndex={0}
      aria-label={`${label}: ${value}`}
      {...tip}
    >
      <span className="hud-stat__icon" aria-hidden>
        {icon}
      </span>
      <span className="hud-stat__value tabular" aria-hidden>
        {value}
      </span>
    </div>
  );
}

export function GameHud() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const [iconPicker, setIconPicker] = useState(false);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const muted = useStore((s) => s.masterMuted);
  const toggleMute = useStore((s) => s.toggleMute);
  const musicMuted = useStore((s) => s.musicMuted);
  const toggleMusic = useStore((s) => s.toggleMusic);
  const reduced = state.settings.reducedMotion;
  const nps = engine.productionPerSecond();
  const tier = reputationTier(state.resources.reputation);
  const moraleBonus = moraleProductionBonusPct(state.resources.morale);
  const nextRep = nextReputationUnlock(state);
  const kernels = state.resources.permanentKernels;

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
        t('tip.reputation.d'),
        t(tier.nameKey),
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
  const tipMute = useTooltip(
    <TipContent
      title={muted ? t('settings.restoreAll') : t('settings.muteAll')}
      lines={[t('tip.mute.d')]}
    />,
  );
  const tipMusic = useTooltip(
    <TipContent
      title={musicMuted ? t('settings.restoreMusic') : t('settings.muteMusic')}
      lines={[t('tip.music.d')]}
    />,
  );
  const tipSettings = useTooltip(
    <TipContent title={t('nav.settings')} lines={[t('tip.nav.settings')]} />,
  );
  const tipLogo = useTooltip(
    <TipContent title={t('company.icon.title')} lines={[t('company.icon.tip')]} />,
  );

  const settingsOpen = view === 'settings' && !engine.activeTalk;

  return (
    <header className="hud" data-testid="hud">
      <div className="hud__left">
        <button
          type="button"
          className="hud__logo"
          onClick={() => setIconPicker(true)}
          aria-label={t('company.icon.change')}
          data-testid="company-logo"
          {...tipLogo}
        >
          <CompanyIcon id={state.company.icon} size={18} />
        </button>
        <div
          className="hud__nuts"
          tabIndex={0}
          aria-label={`${t('resource.nuts')}: ${fmt.num(state.resources.nuts)}`}
          data-testid="hud-nuts"
          {...tipNuts}
        >
          <span className="hud__nuts-icon" aria-hidden>
            <Acorn size={20} />
          </span>
          <span className="hud__nuts-value" aria-hidden>
            <AnimatedNumber value={state.resources.nuts} format={fmt.num} reducedMotion={reduced} />
          </span>
          <span className="hud__rate" aria-hidden>
            +{fmt.num(nps)}/s
          </span>
        </div>
      </div>

      <div className="hud__stats">
        <HudStat
          kind="golden"
          icon={<GoldenNut size={15} />}
          value={fmt.num(state.resources.goldenNuts)}
          label={t('resource.goldenNuts')}
          tip={tipGolden}
        />
        <HudStat
          kind="morale"
          icon={<Icon name="morale" size={15} />}
          value={String(Math.round(state.resources.morale))}
          label={t('resource.morale')}
          tone={moraleBonus >= 0 ? 'pos' : 'neg'}
          tip={tipMorale}
        />
        <HudStat
          kind="rep"
          icon={<Icon name="reputation" size={15} />}
          value={fmt.num(state.resources.reputation)}
          label={t('resource.reputation')}
          tip={tipRep}
        />
        {kernels > 0 ? (
          <HudStat
            kind="kernels"
            icon={<Icon name="prestige" size={15} />}
            value={fmt.num(kernels)}
            label={t('resource.permanentKernels')}
            tip={tipKernels}
          />
        ) : null}
      </div>

      <div className="hud__tools">
        <button
          type="button"
          className={`hud__tool mute-toggle ${muted ? 'is-muted' : ''}`}
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? t('settings.restoreAll') : t('settings.muteAll')}
          data-testid="mute-toggle"
          {...tipMute}
        >
          <Icon name={muted ? 'mute' : 'sound'} size={16} />
        </button>
        <button
          type="button"
          className={`hud__tool music-toggle ${musicMuted ? 'is-muted' : ''}`}
          onClick={toggleMusic}
          aria-pressed={musicMuted}
          aria-label={musicMuted ? t('settings.restoreMusic') : t('settings.muteMusic')}
          data-testid="music-toggle"
          {...tipMusic}
        >
          <Icon name={musicMuted ? 'music-off' : 'music'} size={16} />
        </button>
        <button
          type="button"
          className={`hud__tool hud__settings ${settingsOpen ? 'is-active' : ''}`}
          onClick={() => {
            engine.closeTalk();
            setView(settingsOpen ? 'office' : 'settings');
          }}
          aria-pressed={settingsOpen}
          aria-label={t('nav.settings')}
          data-view="settings"
          {...tipSettings}
        >
          <Icon name="settings" size={16} />
        </button>
        <WindowControls />
      </div>

      {iconPicker ? <CompanyIconPicker onClose={() => setIconPicker(false)} /> : null}
    </header>
  );
}
