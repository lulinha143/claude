import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { BALANCE } from '../../sim/config';
import { formatClock } from '../../sim/format';
import { MicroGame, type MicroMode } from '../minigames/MicroGame';

export function FocusView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const [custom, setCustom] = useState(30);
  const [micro, setMicro] = useState<MicroMode | null>(null);
  const [, forceTick] = useState(0);

  // live countdown
  useEffect(() => {
    if (!state.focus.active) return;
    const h = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(h);
  }, [state.focus.active]);

  const remaining = Math.max(0, Math.floor((state.focus.endsAt - Date.now()) / 1000));

  return (
    <section className="view view--focus">
      <h2>{t('focus.title')}</h2>

      {!state.settings.focusHarvestEnabled ? (
        <div className="panel">
          <p>{t('focus.disabled')}</p>
          <button className="buy-btn" onClick={() => engine.updateSettings({ focusHarvestEnabled: true })}>
            {t('focus.enable')}
          </button>
        </div>
      ) : (
        <div className="panel">
          <p className="muted">{t('focus.intro')}</p>
          {state.focus.active ? (
            <div className="focus-active">
              <div className="focus-active__label">{t('focus.active')}</div>
              <div className="focus-active__clock">{formatClock(remaining)}</div>
              <button className="ghost-btn" onClick={() => engine.cancelFocus()}>
                {t('focus.cancel')}
              </button>
            </div>
          ) : (
            <div className="focus-presets">
              {BALANCE.focus.presetMinutes.map((m) => (
                <button key={m} className="preset-btn" onClick={() => { engine.startFocus(m); audio.play('event'); }}>
                  {m}m
                </button>
              ))}
              <label className="field field--inline">
                <span>{t('focus.custom')}</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={custom}
                  onChange={(e) => setCustom(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                />
                <button className="preset-btn" onClick={() => { engine.startFocus(custom); audio.play('event'); }}>
                  {t('focus.start')}
                </button>
              </label>
            </div>
          )}
          <p className="muted small">{t('focus.privacy')}</p>
        </div>
      )}

      <div className="panel">
        <h3>{t('microgame.title')}</h3>
        {micro ? (
          <MicroGame
            mode={micro}
            seed={Date.now() & 0xffff}
            reducedMotion={state.settings.reducedMotion}
            onReward={(score) => {
              engine.rewardMicrogame(micro, score);
              audio.play('celebrate');
            }}
            onClose={() => setMicro(null)}
          />
        ) : (
          <div className="microgame-menu">
            {(['shellSort', 'coffeeRescue', 'inventory'] as MicroMode[]).map((m) => (
              <button key={m} className="micro-card" onClick={() => setMicro(m)}>
                <strong>{t(`microgame.${m}.name`)}</strong>
                <span>{t(`microgame.${m}.desc`)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
