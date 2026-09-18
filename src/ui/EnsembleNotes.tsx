import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { decorationEnsembles } from '../sim/decorationEnsembles';
import { ROOMS_BY_ID } from '../content/rooms';

export function EnsembleNotes({ activeOnly = false }: { activeOnly?: boolean }) {
  const { t } = useTranslation();
  const { state } = useGame();
  const sets = decorationEnsembles(state).filter((set) => !activeOnly || set.active);
  if (!sets.length) return null;
  return (
    <details className="ensemble-notes">
      <summary>
        {t('ensemble.title')}{' '}
        <span>
          {sets.filter((set) => set.active).length}/{sets.length}
        </span>
      </summary>
      <p>{t('ensemble.intro')}</p>
      <ul>
        {sets.map(({ definition: set, placed, active }) => (
          <li key={set.id} data-active={active}>
            <div>
              <strong>{t(`ensemble.${set.id}.name`)}</strong>
              <span>
                {t(ROOMS_BY_ID[set.roomId].nameKey)} · {placed.length}/{set.items.length}
              </span>
            </div>
            <p>{t(`ensemble.${set.id}.effect`)}</p>
            <p className="ensemble-notes__pieces">
              {set.items.map((id, index) => (
                <span key={id} data-placed={placed.includes(id)}>
                  {index ? ' · ' : ''}
                  {t(`deco.${id}.name`)}
                </span>
              ))}
            </p>
            <small>{t(active ? 'ensemble.active' : 'ensemble.inactive')}</small>
          </li>
        ))}
      </ul>
    </details>
  );
}
