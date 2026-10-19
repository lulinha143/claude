import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useFmt } from '../useFmt';
import { Icon, type IconName } from '../../art/UiIcon';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { MOOD_POSITIVE, MOOD_TONE } from '../../sim/mood';
import { MoodEmoji } from '../../art/EmployeeMoodBadge';
import { GAME_EVENTS_BY_ID } from '../../content/events';
import { eventCast } from '../../sim/happenings';
import { PopupShell, usePopupExit } from './PopupShell';
import { IncidentScene } from './IncidentScene';

type Tone = 'positive' | 'negative' | 'neutral';
interface Line {
  icon: IconName;
  text: string;
  tone: Tone;
}

// After an event choice resolves, this panel spells out the REAL, measured
// consequences (diffed from the simulation), never buried in tooltips: currency
// and stat deltas, temporary boosts, new content, and — crucially — how it
// affected each individual employee (emotion + productivity + friendship).
export function ConsequenceModal() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const c = engine.lastConsequence;
  const { closing, exitThen } = usePopupExit();
  if (!c) return null;
  const close = () => exitThen(() => engine.clearConsequence());
  const def = c.eventId ? GAME_EVENTS_BY_ID[c.eventId] : undefined;
  const nameOf = (id: string) => {
    const nameKey = EMPLOYEES_BY_ID[id]?.nameKey;
    return state.employees[id]?.nickname ?? (nameKey ? t(nameKey) : id);
  };

  const r = c.report;
  const lines: Line[] = [];
  const push = (icon: IconName, text: string, tone: Tone) => lines.push({ icon, text, tone });

  if (r.nuts > 0) push('nut', t('consequence.nutsGain', { value: fmt.num(r.nuts) }), 'positive');
  else if (r.nuts < 0)
    push('nut', t('consequence.nutsLoss', { value: fmt.num(-r.nuts) }), 'negative');
  if (r.goldenNuts > 0)
    push('golden', t('consequence.goldenGain', { value: fmt.num(r.goldenNuts) }), 'positive');
  else if (r.goldenNuts < 0)
    push('golden', t('consequence.goldenLoss', { value: fmt.num(-r.goldenNuts) }), 'negative');
  if (r.morale > 0)
    push('morale', t('consequence.moraleUp', { value: fmt.num(r.morale) }), 'positive');
  else if (r.morale < 0)
    push('morale', t('consequence.moraleDown', { value: fmt.num(-r.morale) }), 'negative');
  if (r.reputation > 0)
    push('reputation', t('consequence.repUp', { value: fmt.num(r.reputation) }), 'positive');
  else if (r.reputation < 0)
    push('reputation', t('consequence.repDown', { value: fmt.num(-r.reputation) }), 'negative');
  if (r.boostMultiplier > 0)
    push(
      'production',
      t('consequence.boost', { value: r.boostMultiplier, seconds: r.boostSeconds }),
      'positive',
    );
  // content flags that aren't numeric deltas
  for (const e of c.effects) {
    if (e.type === 'collectNut') push('encyclopedia', t('consequence.newNut'), 'positive');
    if (e.type === 'unlockSecret') push('hidden', t('consequence.secret'), 'positive');
  }
  if (r.momentCreated) push('moment', t('consequence.moment'), 'neutral');

  const nothing = lines.length === 0 && r.employees.length === 0;

  return (
    <PopupShell
      variant="reward"
      className="consequence-modal"
      ariaLabel={t('event.resultTitle')}
      closing={closing}
      onDismiss={close}
      actions={
        <button className="buy-btn buy-btn--big" disabled={closing} onClick={close}>
          {t('common.ok')}
        </button>
      }
    >
      {/* The same card, turned over: the same room and people, now reacting. */}
      {c.place && def ? (
        <IncidentScene
          roomId={c.place.roomId}
          people={eventCast(state, def, c.place)}
          rarity={c.rarity ?? def.rarity}
          told
          reducedMotion={state.settings.reducedMotion}
          // How they took it, as measured: the same marks the answer previewed.
          reactions={Object.fromEntries(
            r.employees.map((e) => [e.id, { emotion: e.emotion, friendship: e.friendshipDelta }]),
          )}
        />
      ) : null}
      <div className="consequence-modal__head">
        {c.place && def ? null : <Icon name="notification" size={20} />}
        <div>
          <small className="consequence-modal__eyebrow">{t('event.resultTitle')}</small>
          <h2>{t(c.titleKey)}</h2>
          <p className="muted small consequence-modal__choice">{t(c.choiceLabelKey)}</p>
        </div>
      </div>

      <div className="modal__scroll">
        {/* What happened first, in the team's own words; then what it changed. */}
        {c.reactions.length > 0 ? (
          <div className="consequence-reactions">
            {c.reactions.map((r2, i) => (
              <p key={i} className="consequence-reaction">
                {t(r2)}
              </p>
            ))}
          </div>
        ) : null}

        <ul className="consequence-list">
          {nothing ? (
            <li className="consequence-line consequence-line--neutral">
              <Icon name="moment" size={16} /> {t('event.noEffects')}
            </li>
          ) : (
            lines.map((l, i) => (
              <li key={i} className={`consequence-line consequence-line--${l.tone}`}>
                <Icon name={l.icon} size={16} /> {l.text}
              </li>
            ))
          )}
        </ul>

        {r.employees.length > 0 ? (
          <div className="consequence-team">
            <div className="consequence-team__label">{t('event.employeeChangesLabel')}</div>
            <ul className="consequence-team__list">
              {r.employees.map((e) => {
                const delta = Math.round(e.productivityDelta * 100);
                const minutes = e.emotionUntil
                  ? Math.round((e.emotionUntil - Date.now()) / 60000)
                  : 0;
                return (
                  <li key={e.id} className="consequence-emp">
                    <span className="consequence-emp__name">{nameOf(e.id)}</span>
                    {e.emotion ? (
                      <span
                        className={`mood-chip mood-chip--sm ${MOOD_POSITIVE[e.emotion] ? 'mood-chip--positive' : 'mood-chip--negative'}`}
                        data-mood={e.emotion}
                        style={{ ['--mood-color' as string]: MOOD_TONE[e.emotion] }}
                      >
                        <MoodEmoji mood={e.emotion} color={MOOD_TONE[e.emotion]} />
                        <span className={MOOD_POSITIVE[e.emotion] ? 'prod-pos' : 'prod-neg'}>
                          {t(`mood.${e.emotion}`)}
                        </span>
                      </span>
                    ) : null}
                    <span className="consequence-emp__meta">
                      {e.emotion && delta !== 0 ? (
                        <span className={delta > 0 ? 'prod-pos' : 'prod-neg'}>
                          {t('consequence.productivity', {
                            value: `${delta > 0 ? '+' : ''}${delta}`,
                          })}
                        </span>
                      ) : null}
                      {e.friendshipDelta !== 0 ? (
                        <span className={e.friendshipDelta > 0 ? 'prod-pos' : 'prod-neg'}>
                          {t('consequence.friendshipDelta', {
                            value: `${e.friendshipDelta > 0 ? '+' : ''}${e.friendshipDelta}`,
                          })}
                        </span>
                      ) : null}
                      {minutes > 0 ? (
                        <span className="muted">
                          {t('consequence.forMinutes', { value: minutes })}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* Not everything is spelled out: some of it shows up later, in the office. */}
        {c.setInMotion || c.remembered ? (
          <div className="consequence-notes">
            {c.setInMotion ? (
              <p className="consequence-note consequence-note--motion">
                <Icon name="refresh" size={14} /> {t('incident.inMotion')}
              </p>
            ) : null}
            {c.remembered ? (
              <p className="consequence-note consequence-note--memory">
                <Icon name="employees" size={14} />{' '}
                {t('incident.remembered', { name: nameOf(c.remembered) })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </PopupShell>
  );
}
