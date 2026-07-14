import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useFmt } from './useFmt';
import { productionBreakdown } from '../sim/economy';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { Icon } from '../art/UiIcon';

// Explains, line by line, how nuts/second is computed: base + each employee,
// then every multiplier (upgrades, passives, morale, prestige, focus, boosts).
export function ProductionBreakdown() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const b = productionBreakdown(state, engine.isFocusActive());
  const boost = engine.currentBoostMultiplier();

  const pct = (frac: number) => `+${Math.round(frac * 100)}%`;
  const mult = (m: number) => `×${m.toFixed(2)}`;

  return (
    <div className="panel">
      <h3>
        <Icon name="production" size={15} /> {t('prod.title')}
      </h3>
      <ul className="prod-list">
        <li>
          <span>{t('prod.base')}</span>
          <span className="tabular">{fmt.num(b.base)}/s</span>
        </li>
        {b.employees.map((e) => (
          <li key={e.id}>
            <span>{t(EMPLOYEES_BY_ID[e.id]?.nameKey ?? e.id)}</span>
            <span className="tabular">+{fmt.num(e.rate)}/s</span>
          </li>
        ))}
        <li className="prod-list__subtotal">
          <span>{t('prod.raw')}</span>
          <span className="tabular">{fmt.num(b.rawPerSecond)}/s</span>
        </li>
        {b.upgradeBonus > 0 ? (
          <li>
            <span>{t('prod.upgrades')}</span>
            <span className="prod-pos">{pct(b.upgradeBonus)}</span>
          </li>
        ) : null}
        {b.passiveBonus > 0 ? (
          <li>
            <span>{t('prod.passives')}</span>
            <span className="prod-pos">{pct(b.passiveBonus)}</span>
          </li>
        ) : null}
        <li>
          <span>{t('prod.morale')}</span>
          <span className={b.moraleMult >= 1 ? 'prod-pos' : 'prod-neg'}>{mult(b.moraleMult)}</span>
        </li>
        {b.prestigeMult > 1 ? (
          <li>
            <span>{t('prod.prestige')}</span>
            <span className="prod-pos">{mult(b.prestigeMult)}</span>
          </li>
        ) : null}
        {b.focusMult > 1 ? (
          <li>
            <span>{t('prod.focus')}</span>
            <span className="prod-pos">{mult(b.focusMult)}</span>
          </li>
        ) : null}
        {boost > 1 ? (
          <li>
            <span>{t('prod.boost')}</span>
            <span className="prod-pos">{mult(boost)}</span>
          </li>
        ) : null}
        <li className="prod-list__total">
          <span>{t('prod.total')}</span>
          <span className="tabular">{fmt.num(b.total * boost)}/s</span>
        </li>
      </ul>
    </div>
  );
}
