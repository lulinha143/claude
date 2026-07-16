import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useFmt } from '../useFmt';
import { Icon, type IconName } from '../../art/UiIcon';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { MOOD_TONE, MOOD_POSITIVE } from '../../sim/mood';

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
  const { engine } = useGame();
  const fmt = useFmt();
  const c = engine.lastConsequence;
  if (!c) return null;

  const r = c.report;
  const lines: Line[] = [];
  const push = (icon: IconName, text: string, tone: Tone) => lines.push({ icon, text, tone });

  if (r.nuts > 0) push('nut', t('consequence.nutsGain', { value: fmt.num(r.nuts) }), 'positive');
  else if (r.nuts < 0) push('nut', t('consequence.nutsLoss', { value: fmt.num(-r.nuts) }), 'negative');
  if (r.goldenNuts > 0) push('golden', t('consequence.goldenGain', { value: fmt.num(r.goldenNuts) }), 'positive');
  else if (r.goldenNuts < 0) push('golden', t('consequence.goldenLoss', { value: fmt.num(-r.goldenNuts) }), 'negative');
  if (r.morale > 0) push('morale', t('consequence.moraleUp', { value: fmt.num(r.morale) }), 'positive');
  else if (r.morale < 0) push('morale', t('consequence.moraleDown', { value: fmt.num(-r.morale) }), 'negative');
  if (r.reputation > 0) push('reputation', t('consequence.repUp', { value: fmt.num(r.reputation) }), 'positive');
  else if (r.reputation < 0) push('reputation', t('consequence.repDown', { value: fmt.num(-r.reputation) }), 'negative');
  if (r.boostMultiplier > 0)
    push('production', t('consequence.boost', { value: r.boostMultiplier, seconds: r.boostSeconds }), 'positive');
  // content flags that aren't numeric deltas
  for (const e of c.effects) {
    if (e.type === 'collectNut') push('encyclopedia', t('consequence.newNut'), 'positive');
    if (e.type === 'unlockSecret') push('hidden', t('consequence.secret'), 'positive');
  }
  if (r.momentCreated) push('moment', t('consequence.moment'), 'neutral');

  const nothing = lines.length === 0 && r.employees.length === 0;

  return (
    <div className="modal-backdrop">
      <div
        className="modal consequence-modal modal--framed"
        role="dialog"
        aria-modal
        aria-label={t('event.resultTitle')}
      >
        <div className="consequence-modal__head">
          <Icon name="notification" size={20} />
          <div>
            <h2>{t('event.resultTitle')}</h2>
            <p className="muted small">
              {t(c.titleKey)} — {t(c.choiceLabelKey)}
            </p>
          </div>
        </div>

        <div className="modal__scroll">
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
                const name = EMPLOYEES_BY_ID[e.id]?.nameKey;
                const delta = Math.round(e.productivityDelta * 100);
                const minutes = e.emotionUntil ? Math.round((e.emotionUntil - Date.now()) / 60000) : 0;
                return (
                  <li key={e.id} className="consequence-emp">
                    <span className="consequence-emp__name">{name ? t(name) : e.id}</span>
                    {e.emotion ? (
                      <span className="mood-chip mood-chip--sm">
                        <span className="mood-dot" style={{ background: MOOD_TONE[e.emotion] }} />
                        <span className={MOOD_POSITIVE[e.emotion] ? 'prod-pos' : 'prod-neg'}>
                          {t(`mood.${e.emotion}`)}
                        </span>
                      </span>
                    ) : null}
                    <span className="consequence-emp__meta">
                      {e.emotion && delta !== 0 ? (
                        <span className={delta > 0 ? 'prod-pos' : 'prod-neg'}>
                          {t('consequence.productivity', { value: `${delta > 0 ? '+' : ''}${delta}` })}
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
                        <span className="muted">{t('consequence.forMinutes', { value: minutes })}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {c.reactions.length > 0 ? (
          <div className="consequence-reactions">
            <div className="consequence-reactions__label">{t('event.reactionsLabel')}</div>
            {c.reactions.map((r2, i) => (
              <div key={i} className="consequence-reaction">
                <Icon name="employees" size={14} /> {t(r2)}
              </div>
            ))}
          </div>
        ) : null}

        </div>

        <button className="buy-btn buy-btn--big" onClick={() => engine.clearConsequence()}>
          {t('common.ok')}
        </button>
      </div>
    </div>
  );
}
