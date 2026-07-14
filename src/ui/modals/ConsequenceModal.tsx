import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useFmt } from '../useFmt';
import { Icon, type IconName } from '../../art/UiIcon';
import type { EventEffect } from '../../content/types';
import { EMPLOYEES_BY_ID } from '../../content/employees';

type Tone = 'positive' | 'negative' | 'neutral';
interface Line {
  icon: IconName;
  text: string;
  tone: Tone;
}

// After an event choice resolves, this panel spells out EVERY consequence in
// plain language (never buried in tooltips), plus the team's reactions. Shown
// whenever the engine has a pending `lastConsequence`.
export function ConsequenceModal() {
  const { t } = useTranslation();
  const { engine } = useGame();
  const fmt = useFmt();
  const c = engine.lastConsequence;
  if (!c) return null;

  const lines: Line[] = [];
  for (const e of c.effects) lines.push(...effectLines(e, t, fmt.num));

  return (
    <div className="modal-backdrop">
      <div className="modal consequence-modal" role="dialog" aria-modal aria-label={t('event.resultTitle')}>
        <div className="consequence-modal__head">
          <Icon name="notification" size={20} />
          <div>
            <h2>{t('event.resultTitle')}</h2>
            <p className="muted small">
              {t(c.titleKey)} — {t(c.choiceLabelKey)}
            </p>
          </div>
        </div>

        <ul className="consequence-list">
          {lines.length === 0 ? (
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

        {c.reactions.length > 0 ? (
          <div className="consequence-reactions">
            <div className="consequence-reactions__label">{t('event.reactionsLabel')}</div>
            {c.reactions.map((r, i) => (
              <div key={i} className="consequence-reaction">
                <Icon name="employees" size={14} /> {t(r)}
              </div>
            ))}
          </div>
        ) : null}

        <button className="buy-btn buy-btn--big" onClick={() => engine.clearConsequence()}>
          {t('common.ok')}
        </button>
      </div>
    </div>
  );
}

type TF = ReturnType<typeof useTranslation>['t'];

function effectLines(e: EventEffect, t: TF, num: (v: number) => string): Line[] {
  const v = e.value ?? 0;
  switch (e.type) {
    case 'nuts':
      return v >= 0
        ? [{ icon: 'nut', text: t('consequence.nutsGain', { value: num(v) }), tone: 'positive' }]
        : [{ icon: 'nut', text: t('consequence.nutsLoss', { value: num(-v) }), tone: 'negative' }];
    case 'goldenNuts':
      return [{ icon: 'golden', text: t('consequence.goldenGain', { value: num(v) }), tone: 'positive' }];
    case 'morale':
      return v >= 0
        ? [{ icon: 'morale', text: t('consequence.moraleUp', { value: num(v) }), tone: 'positive' }]
        : [{ icon: 'morale', text: t('consequence.moraleDown', { value: num(v) }), tone: 'negative' }];
    case 'reputation':
      return v >= 0
        ? [{ icon: 'reputation', text: t('consequence.repUp', { value: num(v) }), tone: 'positive' }]
        : [{ icon: 'reputation', text: t('consequence.repDown', { value: num(v) }), tone: 'negative' }];
    case 'productionBoost':
      return [
        {
          icon: 'production',
          text: t('consequence.boost', { value: v || 1.5, seconds: e.durationSeconds ?? 60 }),
          tone: 'positive',
        },
      ];
    case 'friendship': {
      const name = e.employeeId ? EMPLOYEES_BY_ID[e.employeeId]?.nameKey : null;
      return [
        {
          icon: 'employees',
          text: name ? t('consequence.friendshipNamed', { name: t(name) }) : t('consequence.friendship'),
          tone: 'positive',
        },
      ];
    }
    case 'collectNut':
      return [{ icon: 'encyclopedia', text: t('consequence.newNut'), tone: 'positive' }];
    case 'unlockSecret':
      return [{ icon: 'hidden', text: t('consequence.secret'), tone: 'positive' }];
    case 'momentCard':
      return [{ icon: 'moment', text: t('consequence.moment'), tone: 'neutral' }];
    default:
      return [];
  }
}
