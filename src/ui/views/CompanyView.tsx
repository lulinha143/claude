import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { moraleCap } from '../../sim/economy';
import { GoldenNut } from '../../art/Icons';

export function CompanyView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const audio = useStore((s) => s.audio);
  const cap = moraleCap(state);

  return (
    <section className="view view--company">
      <h2>{t('company.title')}</h2>

      <div className="panel">
        <label className="field">
          <span>{t('company.rename')}</span>
          <input
            defaultValue={state.company.name}
            placeholder={t('company.renamePlaceholder')}
            onBlur={(e) => engine.renameCompany(e.target.value)}
          />
        </label>
        <p className="muted">{t('company.founded', { date: fmt.date(state.createdAt) })}</p>
        <p className="muted">{t('company.prestigeCount', { count: state.prestige.count })}</p>
      </div>

      <div className="panel">
        <div className="meter">
          <span>{t('resource.morale')}</span>
          <div className="bar">
            <div className="bar__fill bar__fill--morale" style={{ width: `${(state.resources.morale / cap) * 100}%` }} />
          </div>
          <span>{Math.round(state.resources.morale)}/{cap}</span>
        </div>
        <div className="meter">
          <span>{t('resource.reputation')}</span>
          <div className="bar">
            <div className="bar__fill bar__fill--rep" style={{ width: `${Math.min(100, state.resources.reputation / 3)}%` }} />
          </div>
          <span>{fmt.num(state.resources.reputation)}</span>
        </div>
      </div>

      <div className="panel">
        <h3>{t('daily.title')}</h3>
        <ul className="daily-list">
          {state.daily.challenges.map((ch) => {
            const done = ch.progress >= ch.goal;
            return (
              <li key={ch.id} className={`daily ${done ? 'is-done' : ''}`}>
                <div className="daily__info">
                  <span>{t(`daily.${challengeKey(ch.id)}`, { goal: fmt.int(ch.goal) })}</span>
                  <div className="bar">
                    <div className="bar__fill" style={{ width: `${Math.min(100, (ch.progress / ch.goal) * 100)}%` }} />
                  </div>
                </div>
                <button
                  className="buy-btn"
                  disabled={!done || ch.claimed}
                  onClick={() => { if (engine.claimDaily(ch.id)) audio.play('celebrate'); }}
                >
                  {ch.claimed ? t('common.claimed') : <><GoldenNut size={14} />{t('common.claim')}</>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted small">{t('daily.resetsIn')}</p>
      </div>
    </section>
  );
}

function challengeKey(id: string): string {
  if (id.startsWith('produceNuts')) return 'produceNuts';
  if (id.startsWith('completeFocus')) return 'completeFocus';
  if (id.startsWith('employeeConversations')) return 'conversations';
  if (id.startsWith('playMicrogame')) return 'microgame';
  if (id.startsWith('maintainMorale')) return 'morale';
  return 'crates';
}
