import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { MICRO_SOUVENIRS, MICRO_TEAM } from '../../sim/minigames';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { BALANCE } from '../../sim/config';
import { formatClock } from '../../sim/format';
import { MicroGame, MicroGameEmblem, type MicroMode } from '../minigames/MicroGame';

export function FocusView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const activityRequest = useStore((s) => s.activityRequest);
  const requestActivity = useStore((s) => s.requestActivity);
  const [custom, setCustom] = useState(30);
  const [micro, setMicro] = useState<{ mode: MicroMode; seed: number } | null>(() =>
    activityRequest ? { mode: activityRequest, seed: Date.now() & 0xffff } : null,
  );
  useEffect(() => {
    requestActivity(null);
  }, [requestActivity]);
  // Tell the shell a game is on stage, so the office behind it can rest.
  const setMinigameOpen = useStore((s) => s.setMinigameOpen);
  useEffect(() => {
    setMinigameOpen(Boolean(micro));
    return () => setMinigameOpen(false);
  }, [micro, setMinigameOpen]);
  const [, forceTick] = useState(0);

  // live countdown
  useEffect(() => {
    if (!state.focus.active) return;
    const h = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(h);
  }, [state.focus.active]);

  const remaining = Math.max(0, Math.floor((state.focus.endsAt - Date.now()) / 1000));

  return (
    <section className={`view view--focus ${micro ? 'view--focus-game' : ''}`}>
      {!micro ? <h2>{t('focus.title')}</h2> : null}

      {!micro &&
        (!state.settings.focusHarvestEnabled ? (
          <div className="panel">
            <p>{t('focus.disabled')}</p>
            <button
              className="buy-btn"
              onClick={() => engine.updateSettings({ focusHarvestEnabled: true })}
            >
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
                  <button
                    key={m}
                    className="preset-btn"
                    onClick={() => {
                      engine.startFocus(m);
                      audio.play('event');
                    }}
                  >
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
                    onChange={(e) =>
                      setCustom(Math.max(1, Math.min(180, Number(e.target.value) || 1)))
                    }
                  />
                  <button
                    className="preset-btn"
                    onClick={() => {
                      engine.startFocus(custom);
                      audio.play('event');
                    }}
                  >
                    {t('focus.start')}
                  </button>
                </label>
              </div>
            )}
            <p className="muted small">{t('focus.privacy')}</p>
          </div>
        ))}

      <div className="panel">
        {!micro ? <h3>{t('microgame.title')}</h3> : null}
        {micro ? (
          <MicroGame
            mode={micro.mode}
            seed={micro.seed}
            reducedMotion={state.settings.reducedMotion}
            onReward={(score) => {
              const reward = engine.rewardMicrogame(micro.mode, score);
              audio.play('celebrate');
              return reward;
            }}
            onClose={() => setMicro(null)}
          />
        ) : (
          <div className="microgame-menu">
            {(['coffeeRescue', 'bugSquash', 'cableUntangle'] as MicroMode[]).map((m) => (
              <button
                key={m}
                className={`micro-card micro-card--${m}`}
                onClick={() => setMicro({ mode: m, seed: Date.now() & 0xffff })}
              >
                <span className="micro-card__art" aria-hidden="true">
                  <MicroGameEmblem mode={m} compact />
                </span>
                <span className="micro-card__copy">
                  <strong>{t(`microgame.${m}.name`)}</strong>
                  <span>{t(`microgame.${m}.assignment`)}</span>
                  {MICRO_TEAM[m].some((id) => state.employees[id]?.hired) ? (
                    <small>
                      {t('microgame.colleagues', {
                        names: MICRO_TEAM[m]
                          .filter((id) => state.employees[id]?.hired)
                          .map(
                            (id) => state.employees[id].nickname || t(EMPLOYEES_BY_ID[id].nameKey),
                          )
                          .join(', '),
                      })}
                    </small>
                  ) : null}
                  <small className="micro-card__souvenir">
                    {t(
                      (state.microgames[m]?.best ?? 0) >= 30
                        ? 'microgame.masteryFiled'
                        : state.collections.secrets.includes(`deco:${MICRO_SOUVENIRS[m]}`)
                          ? 'microgame.masteryGoalOwned'
                          : 'microgame.masteryGoal',
                      { name: t(`deco.${MICRO_SOUVENIRS[m]}.name`) },
                    )}
                  </small>
                  {state.microgames[m]?.plays ? (
                    <small>
                      {t('microgame.personalBest', { score: state.microgames[m].best })}
                    </small>
                  ) : null}
                </span>
                <span className="micro-card__play" aria-hidden="true">
                  {t('microgame.play')} ›
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
