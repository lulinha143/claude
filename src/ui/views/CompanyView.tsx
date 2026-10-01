import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { moraleCap } from '../../sim/economy';
import { GoldenNut } from '../../art/Icons';
import { CompanyIcon } from '../../art/companyIcons';
import { CompanyIconPicker } from '../modals/CompanyIconPicker';
import { historyLabelKeys } from '../../content/historyLabels';
import { ProductionBreakdown } from '../ProductionBreakdown';
import { DepartmentNetwork } from '../DepartmentNetwork';
import { ReputationLadder } from '../ReputationLadder';
import { EnsembleNotes } from '../EnsembleNotes';
import { reputationTier } from '../../content/reputationTiers';
import { useNotifications } from '../notificationsStore';
import { Icon } from '../../art/UiIcon';

/** The last few office notes — toasts are brief, this is where you catch up. */
function RecentNotes() {
  const { t } = useTranslation();
  const history = useNotifications((s) => s.history);
  return (
    <div className="panel company-recent">
      <h3>{t('company.recent')}</h3>
      {history.length === 0 ? (
        <p className="muted small">{t('company.recentEmpty')}</p>
      ) : (
        <ul className="company-recent__list">
          {history.map((note) => (
            <li key={note.id} data-tone={note.tone}>
              <Icon name={note.icon} size={13} />
              <span>{note.text}</span>
              {note.count > 1 ? <b>×{note.count}</b> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CompanyView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const audio = useStore((s) => s.audio);
  const cap = moraleCap(state);
  const [iconPicker, setIconPicker] = useState(false);
  const tier = reputationTier(state.resources.reputation);

  return (
    <section className="view view--company">
      <h2>{t('company.title')}</h2>

      {/* The letterhead that used to crowd the HUD: who the company is, which
          department it calls itself, and how the outside world stamps it. */}
      <div className="company-letterhead">
        <div className="company-letterhead__who">
          <p className="company-letterhead__name">{state.company.name}</p>
          <p className="company-letterhead__dept">{t('header.departmentFull')}</p>
        </div>
        <div className="company-letterhead__stamp" title={t(tier.blurbKey)}>
          <span>{t(tier.nameKey)}</span>
          <span>{t('header.cycle', { n: state.prestige.count + 1 })}</span>
        </div>
      </div>

      <RecentNotes />
      <EnsembleNotes activeOnly />

      <div className="panel company-charter">
        <div className="company-identity">
          <button
            type="button"
            className="company-identity__logo"
            onClick={() => setIconPicker(true)}
            aria-label={t('company.icon.change')}
          >
            <CompanyIcon id={state.company.icon} size={34} />
          </button>
          <label className="field company-identity__name">
            <span>{t('company.rename')}</span>
            <input
              defaultValue={state.company.name}
              placeholder={t('company.renamePlaceholder')}
              onBlur={(e) => engine.renameCompany(e.target.value)}
            />
          </label>
          <button className="ghost-btn" type="button" onClick={() => setIconPicker(true)}>
            {t('company.icon.change')}
          </button>
        </div>
        <p className="muted">{t('company.founded', { date: fmt.date(state.createdAt) })}</p>
        <p className="muted">{t('company.prestigeCount', { count: state.prestige.count })}</p>
      </div>
      {iconPicker ? <CompanyIconPicker onClose={() => setIconPicker(false)} /> : null}

      <ProductionBreakdown />

      <div className="panel company-standing">
        <div className="meter">
          <span>{t('resource.morale')}</span>
          <div className="bar">
            <div
              className="bar__fill bar__fill--morale"
              style={{ width: `${(state.resources.morale / cap) * 100}%` }}
            />
          </div>
          <span>
            {Math.round(state.resources.morale)}/{cap}
          </span>
        </div>
        {/* Reputation is a named ladder now, not a bar scaled to an arbitrary
            maximum, so the player can see which rung they hold and what is next. */}
        <ReputationLadder />
      </div>

      <div className="panel company-network">
        <h3 className="panel__title">
          <span className="panel__marker" aria-hidden />
          {t('synergy.title')}
        </h3>
        <p className="muted small">{t('synergy.subtitle')}</p>
        <DepartmentNetwork />
      </div>

      <div className="panel company-assignments">
        <h3>{t('daily.title')}</h3>
        <ul className="daily-list">
          {state.daily.challenges.map((ch) => {
            const done = ch.progress >= ch.goal;
            return (
              <li key={ch.id} className={`daily ${done ? 'is-done' : ''}`}>
                <div className="daily__info">
                  <span>{t(`daily.${challengeKey(ch.id)}`, { goal: fmt.int(ch.goal) })}</span>
                  <div className="bar">
                    <div
                      className="bar__fill"
                      style={{ width: `${Math.min(100, (ch.progress / ch.goal) * 100)}%` }}
                    />
                  </div>
                </div>
                <button
                  className="buy-btn"
                  disabled={!done || ch.claimed}
                  onClick={() => {
                    if (engine.claimDaily(ch.id)) audio.play('celebrate');
                  }}
                >
                  {ch.claimed ? (
                    t('common.claimed')
                  ) : (
                    <>
                      <GoldenNut size={14} />
                      {t('common.claim')}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted small">{t('daily.resetsIn')}</p>
      </div>

      <div className="panel company-timeline">
        <h3>{t('company.timeline')}</h3>
        {state.eventHistory.length === 0 ? (
          <p className="muted small">{t('company.timelineEmpty')}</p>
        ) : (
          <ul className="timeline">
            {state.eventHistory
              .slice(-8)
              .reverse()
              .map((h, i) => {
                const labels = historyLabelKeys(h.eventId, h.choiceId);
                return (
                  <li key={`${h.at}-${i}`} className="timeline__row">
                    <span className="timeline__title">{t(labels.titleKey)}</span>
                    <span className="timeline__choice">{t(labels.choiceKey)}</span>
                    <span className="timeline__date">{fmt.date(h.at)}</span>
                  </li>
                );
              })}
          </ul>
        )}
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
