import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import {
  MICRO_CALIBRATION,
  MICRO_MODES,
  MICRO_SOUVENIRS,
  MICRO_TEAM,
  isMicroMastered,
} from '../../sim/minigames';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { BALANCE } from '../../sim/config';
import { formatClock } from '../../sim/format';
import { MicroGame, type MicroMode } from '../minigames/MicroGame';
import { MicroGameEmblem, MicroHost, microHostFor } from '../minigames/MinigameArt';
import { useFmt } from '../useFmt';

export function FocusView() {
  const { t } = useTranslation();
  const fmt = useFmt();
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
  const reducedMotion = state.settings.reducedMotion;

  if (micro) {
    const record = state.microgames[micro.mode];
    return (
      <section className="view view--focus view--focus-game">
        <h2>{t('dock.activities')}</h2>
        <MicroGame
          mode={micro.mode}
          seed={micro.seed}
          reducedMotion={reducedMotion}
          hostId={microHostFor(micro.mode, state.employees)}
          best={record?.best ?? 0}
          mastered={isMicroMastered(state, micro.mode)}
          onBegin={() => engine.beginMicrogameRound(micro.mode)}
          onAbandon={(roundId) => engine.abandonMicrogameRound(roundId)}
          onReward={(score, roundId) => {
            const reward = engine.rewardMicrogame(micro.mode, score, roundId);
            audio.play(reward?.mastered || reward?.newBest ? 'celebrate' : 'reward');
            return reward;
          }}
          onClose={() => setMicro(null)}
        />
      </section>
    );
  }

  return (
    <section className="view view--focus">
      <h2>{t('dock.activities')}</h2>

      <div className="panel micro-cabinet">
        <h3>{t('microgame.title')}</h3>
        <p className="micro-cabinet__lede">{t('microgame.lede')}</p>
        <div className="microgame-menu">
          {MICRO_MODES.map((m) => {
            const record = state.microgames[m];
            const cal = MICRO_CALIBRATION[m];
            const best = record?.best ?? 0;
            const mastered = isMicroMastered(state, m);
            const souvenirOwned = state.collections.secrets.includes(`deco:${MICRO_SOUVENIRS[m]}`);
            const hired = MICRO_TEAM[m].filter((id) => state.employees[id]?.hired);
            const host = microHostFor(m, state.employees);
            return (
              <button
                key={m}
                type="button"
                className={`micro-card micro-card--${m} ${mastered ? 'is-mastered' : ''}`}
                onClick={() => setMicro({ mode: m, seed: Date.now() & 0xffff })}
              >
                <span className="micro-card__art" aria-hidden="true">
                  <MicroHost employeeId={host} space={64} reducedMotion />
                  <span className="micro-card__emblem">
                    <MicroGameEmblem mode={m} compact />
                  </span>
                </span>
                <span className="micro-card__copy">
                  <span className="micro-card__head">
                    <strong>{t(`microgame.${m}.name`)}</strong>
                    <span className="micro-card__play" aria-hidden="true">
                      {t('microgame.play')}
                    </span>
                  </span>
                  <span className="micro-card__assignment">{t(`microgame.${m}.assignment`)}</span>
                  {hired.length > 0 ? (
                    <small className="micro-card__team">
                      {t('microgame.colleagues', {
                        value: cal.great,
                        names: fmt.list(
                          hired.map(
                            (id) => state.employees[id].nickname || t(EMPLOYEES_BY_ID[id].nameKey),
                          ),
                        ),
                      })}
                    </small>
                  ) : null}
                  <small className="micro-card__souvenir">
                    {t(
                      mastered
                        ? 'microgame.masteryFiled'
                        : souvenirOwned
                          ? 'microgame.masteryGoalOwned'
                          : 'microgame.masteryGoal',
                      { name: t(`deco.${MICRO_SOUVENIRS[m]}.name`), value: cal.mastery },
                    )}
                  </small>
                  <span className="micro-card__progress" aria-hidden="true">
                    <i style={{ width: `${Math.round(Math.min(1, best / cal.mastery) * 100)}%` }} />
                  </span>
                  {record?.plays ? (
                    <small className="micro-card__best">
                      {t('microgame.personalBest', { score: best })}
                    </small>
                  ) : (
                    <small className="micro-card__best">{t('microgame.firstShift')}</small>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!state.settings.focusHarvestEnabled ? (
        <div className="panel">
          <h3>{t('focus.title')}</h3>
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
          <h3>{t('focus.title')}</h3>
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
      )}
    </section>
  );
}
